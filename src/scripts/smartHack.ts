import { NS } from "@ns";

import { getMostLucrativeServer, hackAndGetAllAccessServers } from "/scripts/helpers.js";
import { ScriptRunnerManager } from "/scripts/scriptRunner.js";

/**
 * Grows a target to max with counteracting weakens interleaved
 * */
async function prepServer(
        ns: NS,
        scriptRunnerManager: ScriptRunnerManager,
        numCores: number,
        weakenAmount: number,
        target: string,
        moneyThresh: number,
        securityThresh: number) {
    const totalThreads = scriptRunnerManager.getPossibleThreads("weaken.js", "");
    let weakenThreadsNeeded = Math.ceil((ns.getServerSecurityLevel(target) - securityThresh) / weakenAmount);
    // If we have extra threads left over and we will need to grow
    if (weakenThreadsNeeded != 0 && weakenThreadsNeeded < totalThreads && ns.getServerMoneyAvailable(target) < moneyThresh) {
        await scriptRunnerManager.runScript("weaken.js", "", false, weakenThreadsNeeded, false, target);
    } else {
        // Since we aren't doing both initial weaken and grow, weaken threads can just be set to 0
        weakenThreadsNeeded = 0;
        while (ns.getServerSecurityLevel(target) > securityThresh) {
            await scriptRunnerManager.runScript("weaken.js", "", false, -1, true, target);
        }
    }

    // Only works because RAM cost of weaken and grow are equivalent. Also assuming that total threads isn't changing. This should be the only script running
    while (ns.getServerMoneyAvailable(target) < moneyThresh) {
        let numGrowThreads = totalThreads - weakenThreadsNeeded;
        // Reset back to 0 so we return back to total threads
        weakenThreadsNeeded = 0;
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

export async function smartHack(
        ns: NS,
        scriptRunnerManager: ScriptRunnerManager,
        batchResetTimeMs: number,
        amountToHack: number,
        batchHostname: string,
        bufferTimeLimitMs: number,
        target: string) {
    const formulasExists = ns.fileExists("Formulas.exe");
    const optimalServer = ns.getServer(target);
    const optimalLowMoneyServer = ns.getServer(target);
    const player = ns.getPlayer();
    if (formulasExists) {
        optimalServer.moneyAvailable = optimalServer.moneyMax;
        optimalServer.hackDifficulty = optimalServer.minDifficulty;
        optimalLowMoneyServer.hackDifficulty = optimalLowMoneyServer.minDifficulty;
    }
    let numCores = 1;
    if (batchHostname != "") {
        numCores = ns.getServer(batchHostname).cpuCores;
    }

    // TODO refactor out to a function that takes a target and a script runner manager? Set up
    // two separate processes where one uses home and the other uses our other servers to hack
    // the second most lucrative server
    const weakenAmount = ns.weakenAnalyze(1, numCores);
    const moneyThresh = ns.getServerMaxMoney(target);
    const securityThresh = ns.getServerMinSecurityLevel(target);
    const moneyAmount = moneyThresh * amountToHack;

    const curMoney = ns.getServerMoneyAvailable(target);
    const curSecurity = ns.getServerSecurityLevel(target);
    ns.tprintf("%s Server Deviation:\n\tMoney: %f / %f (%f)\n\tSecurity: %f / %f (%f)", target, curMoney, moneyThresh, curMoney / moneyThresh, curSecurity, securityThresh, curSecurity / securityThresh);

    // Grow and then counteract with weaken
    await prepServer(ns, scriptRunnerManager, numCores, weakenAmount, target, moneyThresh, securityThresh);

    // Estimating the higher cost weaken instead of cheaper hack. If this needs to be recalculated, you should wait for all scripts to be finished first since they mess with the calculation
    const estimatedNumAvailableThreads = scriptRunnerManager.getPossibleThreads("weaken.js", batchHostname);

    let lastProcessIds = [];
    const oldTime = performance.now();
    let batchSetCount = 0;
    while (performance.now() - oldTime < batchResetTimeMs) {
        ns.tprintf("\n%s Batch Set: %d", target, batchSetCount);
        const numHackThreadsRaw = formulasExists ? amountToHack / ns.formulas.hacking.hackPercent(optimalServer, player) : ns.hackAnalyzeThreads(target, moneyAmount);
        const numHackThreads = Math.max(Math.floor(numHackThreadsRaw), 1);

        const numHackWeakenThreadsRaw = ns.hackAnalyzeSecurity(numHackThreads) / weakenAmount;
        const numHackWeakenThreads = Math.ceil(numHackWeakenThreadsRaw);

        optimalLowMoneyServer.moneyAvailable = moneyThresh - moneyAmount;
        const numGrowthThreadsRaw = formulasExists ? ns.formulas.hacking.growThreads(optimalLowMoneyServer, player, moneyThresh, numCores) : ns.growthAnalyze(target, moneyThresh / (moneyThresh - moneyAmount), numCores);
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

export async function main(ns: NS) {
    ns.disableLog("sleep");

    if (ns.args.length > 0) {
        const additionalAllottedRam = Number(ns.args[0]);
        const batchResetTimeMs = Number(ns.args[1]);
        const amountToHack = Number(ns.args[2]);
        // Since our calculations include our cores (more than 1), we can only use home, otherwise, we could use ""
        // const batchHostname = "";
        const batchHostname = String(ns.args[3]);
        const bufferTimeLimitMs = Number(ns.args[4]);
        const target = String(ns.args[5]);
        const servers = ns.args.slice(6, ns.args.length);
        const scriptRunnerManager = new ScriptRunnerManager(ns);
        for (const server of servers) {
            scriptRunnerManager.addHost(String(server), additionalAllottedRam);
        }
        scriptRunnerManager.addScript("weaken.js", true, true);
        scriptRunnerManager.addScript("grow.js", true, true);
        scriptRunnerManager.addScript("hack.js", true, true);

        // const target = "iron-gym";
        await smartHack(ns, scriptRunnerManager, batchResetTimeMs, amountToHack, batchHostname, bufferTimeLimitMs, target);
    } else {
        const additionalAllottedRam = 8;
        const batchResetTimeMs = 1000 * 60 * 30;
        const amountToHack = 0.026;
        // Since our calculations include our cores (more than 1), we can only use home, otherwise, we could use ""
        // const batchHostname = "";
        const batchHostname = "home";
        const bufferTimeLimitMs = 200;
        const scriptRunnerManager = new ScriptRunnerManager(ns);
        scriptRunnerManager.addHost("home", additionalAllottedRam);
        // When running multiple cores,
        for (const server of hackAndGetAllAccessServers(ns)) {
            scriptRunnerManager.addHost(server, 0);
        }
        scriptRunnerManager.addScript("weaken.js", true, true);
        scriptRunnerManager.addScript("grow.js", true, true);
        scriptRunnerManager.addScript("hack.js", true, true);

        while (true) {
            const target = getMostLucrativeServer(ns);
            // const target = "iron-gym";
            await smartHack(ns, scriptRunnerManager, batchResetTimeMs, amountToHack, batchHostname, bufferTimeLimitMs, target);
        }
    }

}