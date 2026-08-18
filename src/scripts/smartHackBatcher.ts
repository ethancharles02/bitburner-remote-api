import { NS } from "@ns";

import { getSortedLucrativeServers, hackAndGetAllAccessServers, runScript, batchFile } from "/scripts/helpers.js";
import { getRequiredThreadsForBatch, applyHashUpgrades } from "/scripts/smartHack.js";
import { ScriptRunnerManager } from "/scripts/scriptRunner.js";
import { buyCloudServers } from "/scripts/cloudServers";

export async function main(ns: NS) {
    ns.disableLog("sleep");
    const batchResetTimeMs = 1000 * 60 * 10;
    // TODO this could be adjusted such that it uses a binary search to check values (with a
    // granularity of 0.01) and find the maximum for the amount of targets?
    const amountToHack = 0.5;
    const targetBufferTime = 100;
    const bufferTimeLimitMs = 50;
    const maxTargets = 1;

    const doHashUpgrades = true;
    // TODO Consider adjusting the optimal target finding to account for the total cost of hashes it
    // would take to optimize the server fully. This could just be the main priority as a flag to
    // set?
    const doUpgradeHacknetNodes = true;
    const includeHacknetServers = false;
    const spendLeftoverHashes = false;
    const upgradeCloudServers = true;

    const doTorBuy = true;
    const doComputerUpgrade = true;
    // Ram for use by other applications
    const additionalAllottedRam = 64

    const smartHackRam = ns.getScriptRam("/scripts/smartHack.js");
    const thisScriptRam = ns.getScriptRam("/scripts/smartHackBatcher.js");

    // Ram for use of smartHack scripts
    const reservedRam = (smartHackRam * maxTargets) + thisScriptRam + additionalAllottedRam;
    while (true) {
        await runScript(ns, "/scripts/killBatches.js", "home", true);
        if (doComputerUpgrade) {
            await runScript(ns, "/scripts/upgradeComputer.js", "home", true);
        }

        if (doTorBuy) {
            await runScript(ns, "/scripts/torBuy.js", "home", true);
        }

        if (upgradeCloudServers) {
            buyCloudServers(ns, false);
        }

        const targets = getSortedLucrativeServers(ns);
        // const targets = ["phantasy"];
        const hosts = ["home", ...hackAndGetAllAccessServers(ns, includeHacknetServers)];

        const runner = new ScriptRunnerManager(ns);
        for (const host of hosts) {
            if (host == "home") {
                runner.addHost(host, ns.getServerMaxRam(host) - reservedRam);
            } else {
                runner.addHost(host);
            }
        }
        runner.addScript(batchFile.weaken, true, true, "");

        const ramCost = runner.hosts["home"].scriptsRamCost[batchFile.weaken];
        const threadsAvailableObj = runner.getThreadsAvailableObj(batchFile.weaken);
        // For each target key, an array of hosts and allotted ram amounts follows
        const targetBatchManifest: Record<string, [Array<string>, Array<number>]> = {};

        let hostsToDelete = [];
        for (const target of targets) {
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
            applyHashUpgrades(ns, doUpgradeHacknetNodes, true, spendLeftoverHashes, ...Object.keys(targetBatchManifest));
        }

        const ids = [];
        for (const [target, hostsAndRam] of Object.entries(targetBatchManifest)) {
            ids.push(ns.exec("/scripts/smartHack.js", "home", 1, batchResetTimeMs, amountToHack, "", bufferTimeLimitMs, target, ...hostsAndRam[0], ...hostsAndRam[1]));
        }

        if (Object.keys(targetBatchManifest).length >= maxTargets) {
            ns.tprintf(`WARNING: Max targets reached for smarthacking, consider increasing hack amount`);
        }

        while (ids.some(id => ns.isRunning(id))) {
            await ns.sleep(50);
        }
    }
}