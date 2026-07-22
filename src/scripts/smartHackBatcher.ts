import { NS } from "@ns";

import { getSortedLucrativeServers, hackAndGetAllAccessServers } from "/scripts/helpers.js";
import { getRequiredThreadsForBatch, applyHashUpgrades } from "/scripts/smartHack.js";
import { ScriptRunnerManager } from "/scripts/scriptRunner.js";

export async function main(ns: NS) {
    ns.disableLog("sleep");
    const batchResetTimeMs = 1000 * 60 * 10;
    const amountToHack = 0.9;
    const targetBufferTime = 100;
    const bufferTimeLimitMs = 50;
    const maxTargets = 3;
    const doHashUpgrades = true;
    const includeHacknetServers = false;
    const spendLeftoverHashes = false;
    // Ram for use by other applications
    const additionalAllottedRam = 32

    const smartHackRam = ns.getScriptRam("/scripts/smartHack.js");
    const thisScriptRam = ns.getScriptRam("/scripts/smartHackBatcher.js");

    // Ram for use of smartHack scripts
    const reservedRam = (smartHackRam * maxTargets) + thisScriptRam;
    while (true) {
        const targets = getSortedLucrativeServers(ns);
        const hosts = ["home", ...hackAndGetAllAccessServers(ns, includeHacknetServers)];

        const runner = new ScriptRunnerManager(ns);
        for (const host of hosts) {
            if (host == "home") {
                runner.addHost(host, ns.getServerMaxRam(host) - (reservedRam + additionalAllottedRam));
            } else {
                runner.addHost(host);
            }
        }
        runner.addScript("weaken.js", true, true, "");

        const ramCost = runner.hosts["home"].scriptsRamCost["weaken.js"];
        const threadsAvailableObj = runner.getThreadsAvailableObj("weaken.js");
        // For each target key, an array of hosts and allotted ram amounts follows
        const targetBatchManifest: Record<string, [Array<string>, Array<number>]> = {};

        let hostsToDelete = [];
        for (const target of targets) {
            // TODO convert all printf calls to be template literals (ie. `print ${testVar}`)
            // TODO currently calculating with 1 assumed core. A major refactor of the script runner
            // could be done to instead allot ram on a server basis and use their cores (ie. we
            // specify how much we need to weaken/grow and the scriptrunner decides which servers to
            // assign the task). The easiest way I imagine this could be done is that when adding
            // scripts to the script runner, you could also include a weight with that script. You
            // then ask to run scripts with a particular weight allotment
            let requiredThreads = Math.floor(getRequiredThreadsForBatch(ns, target, amountToHack, 1, targetBufferTime));
            while (requiredThreads > 0 && hosts.length > 0 && Object.keys(targetBatchManifest).length < maxTargets) {
                let usedThreads = 0;
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

        if (doHashUpgrades) {
            applyHashUpgrades(ns, true, spendLeftoverHashes, ...Object.keys(targetBatchManifest));
        }

        const ids = [];
        for (const [target, hostsAndRam] of Object.entries(targetBatchManifest)) {
            ids.push(ns.run("/scripts/smartHack.js", 1, batchResetTimeMs, amountToHack, "", bufferTimeLimitMs, target, ...hostsAndRam[0], ...hostsAndRam[1]));
        }

        if (Object.keys(targetBatchManifest).length >= maxTargets) {
            ns.tprint("WARNING: Max targets reached for smarthacking, consider increasing hack amount");
        }

        while (ids.some(id => ns.isRunning(id))) {
            await ns.sleep(50);
        }
    }
}