import { NS } from "@ns";

import { getMostLucrativeServer, hackAndGetAllAccessServers, getMaxMoneyServer } from "/scripts/helpers.js";
import { ScriptRunnerManager } from "/scripts/scriptRunner.js";

/**
 * Grows a target to max with counteracting weakens interleaved
 * @param {NS} ns
 * @param {ScriptRunnerManager} scriptRunnerManager Script runner
 * @param {string} target Host name to use
 * @param {float} moneyThresh Amount of money to reach
 * */
async function counteractingGrow(ns: NS, scriptRunnerManager: ScriptRunnerManager, target: string, moneyThresh: number) {
    // Only works because RAM cost of weaken and grow are equivalent. Also assuming that total threads isn't changing. This should be the only script running
    const totalThreads = scriptRunnerManager.getPossibleThreads("weaken.js", "");
    const numCores = ns.getServer("home").cpuCores;
    while (ns.getServerMoneyAvailable(target) < moneyThresh) {
        let numGrowThreads = totalThreads;
        let numWeakenThreads = 0;
        while (ns.weakenAnalyze(numWeakenThreads, numCores) < ns.growthAnalyzeSecurity(numGrowThreads, undefined, numCores)) {
            numGrowThreads -= 1;
            numWeakenThreads += 1;
        }

        ns.tprintf("Counteracting grow:\n\tGrow: %d\n\tWeaken: %d", numGrowThreads, numWeakenThreads);

        const bufferTimeMs = 20;
        const weakenTimeMs = ns.getWeakenTime(target);
        const growTimeMs = ns.getGrowTime(target);

        const maxTime = Math.max(weakenTimeMs, growTimeMs);
        const additionalGrowTimeMs = maxTime - growTimeMs;
        const additionalWeakenTimeMs = maxTime - weakenTimeMs;

        const processIds = [];
        processIds.push(...await scriptRunnerManager.runScript("grow.js", "", false, numGrowThreads, false, target, String(additionalGrowTimeMs)));
        processIds.push(...await scriptRunnerManager.runScript("weaken.js", "", false, numWeakenThreads, false, target, String(additionalWeakenTimeMs + bufferTimeMs)));
        while (processIds.some(id => ns.isRunning(id))) {
            await ns.sleep(100);
        }
    }
}

/** @param {NS} ns */
export async function main(ns: NS) {
    ns.disableLog("sleep");
    const batchResetTimeMs = 1000 * 60 * 30;
    // TODO optimize this for minimum deviation of floor/ceil or is that too much?
    const amountToHack = 0.01;
    const additionalAllottedRam = 8;
    // Since our calculations include our cores (more than 1), we can only use home, otherwise, we could use ""
    const batchHostname = "";
    // const batchHostname = "home";
    const bufferTimeLimitMs = 200;

    while (true) {
        const numCores = ns.getServer("home").cpuCores;
        const weakenAmount = ns.weakenAnalyze(1, numCores);
        // const target = getMostLucrativeServer(ns);
        // const target = getMaxMoneyServer(ns);
        const target = "iron-gym";
        const moneyThresh = ns.getServerMaxMoney(target);
        const securityThresh = ns.getServerMinSecurityLevel(target);
        const moneyAmount = moneyThresh * amountToHack;

        const scriptRunnerManager = new ScriptRunnerManager(ns);
        scriptRunnerManager.addHost("home", additionalAllottedRam);
        // When running multiple cores,
        for (const server of hackAndGetAllAccessServers(ns)) {
            scriptRunnerManager.addHost(server, 0);
        }
        scriptRunnerManager.addScript("weaken.js", true, true);
        scriptRunnerManager.addScript("grow.js", true, true);
        scriptRunnerManager.addScript("hack.js", true, true);

        const curMoney = ns.getServerMoneyAvailable(target);
        const curSecurity = ns.getServerSecurityLevel(target);
        ns.tprintf("Server Deviation:\n\tMoney: %f / %f (%f)\n\tSecurity: %f / %f (%f)", curMoney, moneyThresh, curMoney / moneyThresh, curSecurity, securityThresh, curSecurity / securityThresh);

        // TODO these could probably be combined such that if weaken is more than enough, use left over threads to grow too.
        while (ns.getServerSecurityLevel(target) > securityThresh) {
            await scriptRunnerManager.runScript("weaken.js", "", false, -1, true, target);
        }

        // Grow and then counteract with weaken
        await counteractingGrow(ns, scriptRunnerManager, target, moneyThresh);

        // Estimating the higher cost weaken instead of cheaper hack. If this needs to be recalculated, you should wait for all scripts to be finished first since they mess with the calculation
        const estimatedNumAvailableThreads = scriptRunnerManager.getPossibleThreads("weaken.js", batchHostname);

        let lastProcessIds = [];
        const oldTime = performance.now();
        let batchSetCount = 0;
        while (performance.now() - oldTime < batchResetTimeMs) {
            ns.tprintf("\nBatch Set: %d", batchSetCount);
            const numHackThreadsRaw = ns.hackAnalyzeThreads(target, moneyAmount);
            const numHackThreads = Math.max(Math.floor(numHackThreadsRaw), 1);

            const numHackWeakenThreadsRaw = ns.hackAnalyzeSecurity(numHackThreads) / weakenAmount;
            const numHackWeakenThreads = Math.ceil(numHackWeakenThreadsRaw);

            const numGrowthThreadsRaw = ns.growthAnalyze(target, moneyThresh / (moneyThresh - moneyAmount), numCores);
            const numGrowThreads = Math.ceil(numGrowthThreadsRaw);

            const numGrowWeakenThreadsRaw = ns.growthAnalyzeSecurity(numGrowThreads, undefined, numCores) / weakenAmount;
            const numGrowWeakenThreads = Math.ceil(numGrowWeakenThreadsRaw);
            const hackTimeMs = ns.getHackTime(target);
            const weakenTimeMs = ns.getWeakenTime(target);
            const growTimeMs = ns.getGrowTime(target);

            const maxTime = Math.max(hackTimeMs, weakenTimeMs, growTimeMs);
            const additionalHackTimeMs = maxTime - hackTimeMs;
            const additionalGrowTimeMs = maxTime - growTimeMs;
            const additionalWeakenTimeMs = maxTime - weakenTimeMs;

            ns.tprintf("Raw Batch:\n\tHack: %f\n\tWeaken: %f\n\tGrow: %f\n\tWeaken: %f", numHackThreadsRaw, numHackWeakenThreadsRaw, numGrowthThreadsRaw, numGrowWeakenThreadsRaw);
            ns.tprintf("Adjusted Batch:\n\tHack: %d\n\tWeaken: %d\n\tGrow: %d\n\tWeaken: %d", numHackThreads, numHackWeakenThreads, numGrowThreads, numGrowWeakenThreads);

            // The number of batches as spreading out half of all available threads (allowing us to assign the second half of threads after the first hack and keep a consistent income)
            const numBatches = Math.floor(estimatedNumAvailableThreads / ((numHackThreads + numHackWeakenThreads + numGrowThreads + numGrowWeakenThreads) * 2));
            ns.tprintf("Batch Stats:");
            ns.tprintf("\tnumAvailableThreads: %d", estimatedNumAvailableThreads);
            if (numBatches == 0) {
                throw Error("0 Batches were calculated as available");
            }
            let bufferTimeMs = Math.ceil(maxTime / (numBatches * 4));
            // Prevent buffer time from getting too low
            if (bufferTimeMs < bufferTimeLimitMs) {
                ns.tprintf("WARNING: Buffer time could go less than %d ms. You can probably hack a more lucrative server", bufferTimeLimitMs)
                bufferTimeMs = bufferTimeLimitMs;
            }

            ns.tprintf("\tNumBatches: %d\n\tBufferTime: %d", numBatches, bufferTimeMs);
            const firstProcessIds = [];
            lastProcessIds = [];
            for (let i = 0; i < numBatches; i++) {
                const adjustedCount = i * 4;
                await scriptRunnerManager.runScript("hack.js", batchHostname, false, numHackThreads, false, target, String(additionalHackTimeMs + bufferTimeMs * adjustedCount));
                await scriptRunnerManager.runScript("weaken.js", batchHostname, false, numHackWeakenThreads, false, target, String(additionalWeakenTimeMs + bufferTimeMs * (adjustedCount + 1)));
                await scriptRunnerManager.runScript("grow.js", batchHostname, false, numGrowThreads, false, target, String(additionalGrowTimeMs + bufferTimeMs * (adjustedCount + 2)));

                if (i == 0) {
                    firstProcessIds.push(...await scriptRunnerManager.runScript("weaken.js", batchHostname, false, numGrowWeakenThreads, false, target, String(additionalWeakenTimeMs + bufferTimeMs * (adjustedCount + 3))));
                } else if (i == numBatches - 1) {
                    lastProcessIds.push(...await scriptRunnerManager.runScript("weaken.js", batchHostname, false, numGrowWeakenThreads, false, target, String(additionalWeakenTimeMs + bufferTimeMs * (adjustedCount + 3))));
                } else {
                    await scriptRunnerManager.runScript("weaken.js", batchHostname, false, numGrowWeakenThreads, false, target, String(additionalWeakenTimeMs + bufferTimeMs * (adjustedCount + 3)));
                }
            }
            let isSafe = false;
            while (firstProcessIds.some(id => ns.isRunning(id))) {
                isSafe = true;
                await ns.sleep(50);
            }

            if (!isSafe) {
                throw Error("Execution is completing too fast, processes are finishing before they are all started, increase the hack amount");
            }

            await ns.sleep(20);
            batchSetCount += 1;
        }
        // Wait till the last process is done
        while (lastProcessIds.some(id => ns.isRunning(id))) {
            await ns.sleep(50);
        }
    }
}