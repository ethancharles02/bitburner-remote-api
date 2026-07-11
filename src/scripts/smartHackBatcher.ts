import { NS } from "@ns";

import { getSortedLucrativeServers, hackAndGetAllAccessServers } from "/scripts/helpers.js";
import { getRequiredThreadsForBatch } from "/scripts/smartHack.js";
import { ScriptRunnerManager } from "/scripts/scriptRunner.js";

export async function main(ns: NS) {
    ns.disableLog("sleep");
    const batchResetTimeMs = 1000 * 60 * 60;
    const amountToHack = 0.99;
    const targetBufferTime = 100;
    const bufferTimeLimitMs = 50;

    const smartHackRam = ns.getScriptRam("/scripts/smartHack.js");
    const thisScriptRam = ns.getScriptRam("/scripts/smartHackBatcher.js");

    // We don't know how many threads we are going to spawn off so this allows for a buffer
    const reservedRam = 1024;
    const smartHackLimit = Math.floor((reservedRam - thisScriptRam) / smartHackRam);
    while (true) {
        const targets = getSortedLucrativeServers(ns);
        const hosts = [...hackAndGetAllAccessServers(ns)];

        const runner = new ScriptRunnerManager(ns);
        runner.addHost("home", ns.getServerMaxRam("home") - reservedRam);
        for (const host of hosts) {
            runner.addHost(host);
        }
        runner.addScript("weaken.js", true, true, "");

        const ramCost = runner.hosts["home"].scriptsRamCost["weaken.js"];
        const threadsAvailableObj = runner.getThreadsAvailableObj("weaken.js");
        // For each target key, an array of hosts and allotted ram amounts follows
        const targetBatchManifest: Record<string, [Array<string>, Array<number>]> = {};

        let isHomeAvailable = true;
        const numCores = ns.getServer("home").cpuCores;
        let hostsToDelete = [];
        for (const target of targets) {
            let requiredThreads = Math.floor(getRequiredThreadsForBatch(ns, target, amountToHack, isHomeAvailable ? numCores : 1, targetBufferTime));
            while (requiredThreads > 0 && hosts.length > 0 && Object.keys(targetBatchManifest).length < smartHackLimit) {
                let usedThreads = 0;
                if (isHomeAvailable) {
                    const threadsAvailable = threadsAvailableObj["home"];
                    usedThreads = Math.min(threadsAvailable, requiredThreads);
                    if (usedThreads > 0) {
                        targetBatchManifest[target] = [["home"], [usedThreads * ramCost]];
                        threadsAvailableObj["home"] -= usedThreads;
                        requiredThreads -= usedThreads;
                        // We can't get much done with a limited number of threads
                        if (threadsAvailableObj["home"] <= 1000) {
                            isHomeAvailable = false;
                            break;
                        }
                    }
                } else {
                    for (const host of hosts) {
                        const threadsAvailable = threadsAvailableObj[host];
                        usedThreads = Math.min(threadsAvailable, requiredThreads);
                        if (usedThreads > 0) {
                            const allottedRam = usedThreads * ramCost;
                            if (target in targetBatchManifest) {
                                targetBatchManifest[target][0].push(host);
                                targetBatchManifest[target][1].push(allottedRam);
                            } else {
                                targetBatchManifest[target] = [[host], [allottedRam]];
                            }
                            threadsAvailableObj[host] -= usedThreads;
                        }
                        if (threadsAvailableObj[host] == 0) {
                            delete threadsAvailableObj[host];
                            hostsToDelete.push(host);
                        }
                        requiredThreads -= usedThreads;
                        if (requiredThreads == 0) {
                            break;
                        }
                    }

                    for (const host of hostsToDelete) {
                        hosts.splice(hosts.indexOf(host), 1);
                    }
                    hostsToDelete = [];
                }
                if (hosts.length == 0) {
                    break;
                }
            }
        }

        const ids = [];
        for (const [target, hostsAndRam] of Object.entries(targetBatchManifest)) {
            const batchHostname = hostsAndRam[0][0] == "home" ? "home" : "";
            ids.push(ns.run("/scripts/smartHack.js", 1, batchResetTimeMs, amountToHack, batchHostname, bufferTimeLimitMs, target, ...hostsAndRam[0], ...hostsAndRam[1]));
        }

        if (Object.keys(targetBatchManifest).length == smartHackLimit) {
            ns.tprint("WARNING: Hit the limit of reserved ram for batching, consider increasing reservedRam");
        }

        while (ids.some(id => ns.isRunning(id))) {
            await ns.sleep(50);
        }
    }
}