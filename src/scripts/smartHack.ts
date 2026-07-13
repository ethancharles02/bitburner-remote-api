import { NS } from "@ns";

import { getMostLucrativeServer, hackAndGetAllAccessServers } from "/scripts/helpers.js";
import { ScriptRunnerManager } from "/scripts/scriptRunner.js";
import { buyHacknetNodes } from "/scripts/hacknet";
import { attemptUpgradeTarget } from "/scripts/hacknetHash";

export function applyHashUpgrades(ns: NS, ...targets: string[]) {
    buyHacknetNodes(ns);
    for (const target of targets) {
        attemptUpgradeTarget(ns, target);
    }
}

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

        ns.tprintf("%s Counteracting grow:\n\tGrow: %d\n\tWeaken: %d", target, numGrowThreads, numWeakenThreads);

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

type ThreadStats = {
    readonly numHackThreadsRaw: number;
    readonly numHackThreads: number;
    readonly numHackWeakenThreadsRaw: number;
    readonly numHackWeakenThreads: number;
    readonly numGrowthThreadsRaw: number;
    readonly numGrowThreads: number;
    readonly numGrowWeakenThreadsRaw: number;
    readonly numGrowWeakenThreads: number;
    readonly maxTime: number;
    readonly additionalHackTimeMs: number;
    readonly additionalGrowTimeMs: number;
    readonly additionalWeakenTimeMs: number;
}

type BatchStats = {
    readonly threadStats: ThreadStats;
    readonly bufferTimeMs: number;
    readonly numBatches: number;
}

export function getThreadStats(ns: NS, target: string, amountToHack: number, numCores: number) {

    const player = ns.getPlayer();
    const optimalServer = ns.getServer(target);
    const optimalLowMoneyServer = ns.getServer(target);
    optimalServer.moneyAvailable = optimalServer.moneyMax;
    optimalServer.hackDifficulty = optimalServer.minDifficulty;
    optimalLowMoneyServer.hackDifficulty = optimalLowMoneyServer.minDifficulty;
    const moneyThresh = optimalLowMoneyServer.moneyMax ?? 0;
    optimalLowMoneyServer.moneyAvailable = moneyThresh - (moneyThresh * amountToHack);
    if (moneyThresh == 0) {
        throw Error("Shouldn't be getting batchstats for a server with no max money");
    }

    const weakenAmount = ns.weakenAnalyze(1, numCores);

    const numHackThreadsRaw = amountToHack / ns.formulas.hacking.hackPercent(optimalServer, player);
    const numHackThreads = Math.max(Math.floor(numHackThreadsRaw), 1);

    const numHackWeakenThreadsRaw = ns.hackAnalyzeSecurity(numHackThreads) / weakenAmount;
    const numHackWeakenThreads = Math.ceil(numHackWeakenThreadsRaw);

    const numGrowthThreadsRaw = ns.formulas.hacking.growThreads(optimalLowMoneyServer, player, moneyThresh, numCores);
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
    const threadStats: ThreadStats = {
        numHackThreadsRaw: numHackThreadsRaw,
        numHackWeakenThreadsRaw: numHackWeakenThreadsRaw,
        numGrowthThreadsRaw: numGrowthThreadsRaw,
        numGrowWeakenThreadsRaw: numGrowWeakenThreadsRaw,
        numHackThreads: numHackThreads,
        numHackWeakenThreads: numHackWeakenThreads,
        numGrowThreads: numGrowThreads,
        numGrowWeakenThreads: numGrowWeakenThreads,
        maxTime: maxTime,
        additionalHackTimeMs: additionalHackTimeMs,
        additionalGrowTimeMs: additionalGrowTimeMs,
        additionalWeakenTimeMs: additionalWeakenTimeMs,
    }
    return threadStats;
}

export function getRequiredThreadsForBatch(ns: NS, target: string, amountToHack: number, numCores: number, targetBufferTime: number) {
    const threadStats = getThreadStats(ns, target, amountToHack, numCores);
    const numBatches = threadStats.maxTime / (targetBufferTime * 4);
    const requiredThreads = numBatches * ((threadStats.numHackThreads + threadStats.numHackWeakenThreads + threadStats.numGrowThreads + threadStats.numGrowWeakenThreads) * 2);

    return requiredThreads;
}

export function getBatchStats(ns: NS, target: string, amountToHack: number, numCores: number, estimatedNumAvailableThreads: number) {
    const threadStats = getThreadStats(ns, target, amountToHack, numCores);

    // The number of batches as spreading out half of all available threads (allowing us to assign the second half of threads after the first hack and keep a consistent income)
    const numBatches = Math.floor(estimatedNumAvailableThreads / ((threadStats.numHackThreads + threadStats.numHackWeakenThreads + threadStats.numGrowThreads + threadStats.numGrowWeakenThreads) * 2));
    const bufferTimeMs = Math.ceil(threadStats.maxTime / (numBatches * 4));

    const batchStats: BatchStats = {
        threadStats: threadStats,
        bufferTimeMs: bufferTimeMs,
        numBatches: numBatches
    }
    return batchStats;
}

export async function smartHack(
        ns: NS,
        scriptRunnerManager: ScriptRunnerManager,
        batchResetTimeMs: number,
        amountToHack: number,
        batchHostname: string,
        bufferTimeLimitMs: number,
        target: string) {
    let numCores = 1;
    if (batchHostname != "") {
        numCores = ns.getServer(batchHostname).cpuCores;
    }

    const weakenAmount = ns.weakenAnalyze(1, numCores);
    const moneyThresh = ns.getServerMaxMoney(target);
    const securityThresh = ns.getServerMinSecurityLevel(target);

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
        const batchStats = getBatchStats(ns, target, amountToHack, numCores, estimatedNumAvailableThreads);

        ns.tprintf("Raw Batch:\n\tHack: %f\n\tWeaken: %f\n\tGrow: %f\n\tWeaken: %f", batchStats.threadStats.numHackThreadsRaw, batchStats.threadStats.numHackWeakenThreadsRaw, batchStats.threadStats.numGrowthThreadsRaw, batchStats.threadStats.numGrowWeakenThreadsRaw);
        ns.tprintf("Adjusted Batch:\n\tHack: %d\n\tWeaken: %d\n\tGrow: %d\n\tWeaken: %d", batchStats.threadStats.numHackThreads, batchStats.threadStats.numHackWeakenThreads, batchStats.threadStats.numGrowThreads, batchStats.threadStats.numGrowWeakenThreads);

        ns.tprintf("Batch Stats:");
        ns.tprintf("\tnumAvailableThreads: %d", estimatedNumAvailableThreads);
        if (batchStats.numBatches == 0) {
            // ns.tprint("WARNING: 0 Batches were calculated as available");
            // return;
            throw Error("0 Batches were calculated as available");
        }
        let bufferTimeMs = batchStats.bufferTimeMs;
        // Prevent buffer time from getting too low
        if (bufferTimeMs < bufferTimeLimitMs) {
            ns.tprintf("WARNING: Buffer time could go less than %d ms. You can probably hack a more lucrative server", bufferTimeLimitMs)
            bufferTimeMs = bufferTimeLimitMs;
        }

        ns.tprintf("\tNumBatches: %d\n\tBufferTime: %d", batchStats.numBatches, batchStats.bufferTimeMs);
        const firstProcessIds = [];
        lastProcessIds = [];
        for (let i = 0; i < batchStats.numBatches; i++) {
            const adjustedCount = i * 4;
            await scriptRunnerManager.runScript("hack.js", batchHostname, false, batchStats.threadStats.numHackThreads, false, target, String(batchStats.threadStats.additionalHackTimeMs + bufferTimeMs * adjustedCount));
            await scriptRunnerManager.runScript("weaken.js", batchHostname, false, batchStats.threadStats.numHackWeakenThreads, false, target, String(batchStats.threadStats.additionalWeakenTimeMs + bufferTimeMs * (adjustedCount + 1)));
            await scriptRunnerManager.runScript("grow.js", batchHostname, false, batchStats.threadStats.numGrowThreads, false, target, String(batchStats.threadStats.additionalGrowTimeMs + bufferTimeMs * (adjustedCount + 2)));

            if (i == 0) {
                firstProcessIds.push(...await scriptRunnerManager.runScript("weaken.js", batchHostname, false, batchStats.threadStats.numGrowWeakenThreads, false, target, String(batchStats.threadStats.additionalWeakenTimeMs + bufferTimeMs * (adjustedCount + 3))));
            } else if (i == batchStats.numBatches - 1) {
                lastProcessIds.push(...await scriptRunnerManager.runScript("weaken.js", batchHostname, false, batchStats.threadStats.numGrowWeakenThreads, false, target, String(batchStats.threadStats.additionalWeakenTimeMs + bufferTimeMs * (adjustedCount + 3))));
            } else {
                await scriptRunnerManager.runScript("weaken.js", batchHostname, false, batchStats.threadStats.numGrowWeakenThreads, false, target, String(batchStats.threadStats.additionalWeakenTimeMs + bufferTimeMs * (adjustedCount + 3)));
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
        const numRequiredArgs = 5;
        const batchResetTimeMs = Number(ns.args[0]);
        const amountToHack = Number(ns.args[1]);
        // Since our calculations include our cores (more than 1), we can only use home, otherwise, we could use ""
        // const batchHostname = "";
        const batchHostname = String(ns.args[2]);
        const bufferTimeLimitMs = Number(ns.args[3]);
        const target = String(ns.args[4]);
        if ((ns.args.length - numRequiredArgs) % 2 != 0) {
            throw Error("Wrong number of args passed to smart hack");
        }
        const numHosts = Math.floor((ns.args.length - numRequiredArgs) / 2);
        const hosts = ns.args.slice(numRequiredArgs, ns.args.length - numHosts);
        const allottedRamByHost = ns.args.slice(numRequiredArgs + numHosts, ns.args.length);
        const scriptRunnerManager = new ScriptRunnerManager(ns);
        for (let i = 0; i < hosts.length; i++) {
            scriptRunnerManager.addHost(String(hosts[i]), Number(allottedRamByHost[i]));
        }
        scriptRunnerManager.addScript("weaken.js", true, true);
        scriptRunnerManager.addScript("grow.js", true, true);
        scriptRunnerManager.addScript("hack.js", true, true);

        // const target = "iron-gym";
        await smartHack(ns, scriptRunnerManager, batchResetTimeMs, amountToHack, batchHostname, bufferTimeLimitMs, target);
    } else {
        // Make sure there is enough Ram for this script to run at least
        const reservedRam = ns.getScriptRam("/scripts/smartHack.js") + 4;
        const batchResetTimeMs = 1000 * 60 * 30;
        const amountToHack = 0.01;
        // Since our calculations include our cores (more than 1), we can only use home, otherwise, we could use ""
        const batchHostname = "";
        // const batchHostname = "home";
        const bufferTimeLimitMs = 200;
        // Only do this if you have hacknet servers
        const doHashUpgrades = false;

        while (true) {
            const scriptRunnerManager = new ScriptRunnerManager(ns);
            scriptRunnerManager.addHost("home", ns.getServerMaxRam("home") - reservedRam);
            for (const server of hackAndGetAllAccessServers(ns)) {
                scriptRunnerManager.addHost(server);
            }
            scriptRunnerManager.addScript("weaken.js", true, true);
            scriptRunnerManager.addScript("grow.js", true, true);
            scriptRunnerManager.addScript("hack.js", true, true);
            const target = getMostLucrativeServer(ns);
            // const target = "foodnstuff";

            if (doHashUpgrades) {
                applyHashUpgrades(ns, target);
            }

            await smartHack(ns, scriptRunnerManager, batchResetTimeMs, amountToHack, batchHostname, bufferTimeLimitMs, target);
        }
    }
}