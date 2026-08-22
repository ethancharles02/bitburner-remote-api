import { NS } from "@ns";

import { batchFile, getMostLucrativeServer, hackAndGetAllAccessServers, runScript } from "/scripts/helpers.js";
import { ScriptRunnerManager } from "/scripts/scriptRunner.js";
import { buyHacknetNodes } from "/scripts/hacknet";
import { attemptUpgradeTarget, spendHacknetHashes, HashUpgrades } from "/scripts/hacknetHash";
import { buyCloudServers } from "/scripts/cloudServers";

export function applyHashUpgrades(ns: NS, doUpgradeHacknetNodes: boolean, doUpgradeTargets: boolean, spendLeftoverHashes: boolean, ...targets: string[]) {
    if (doUpgradeHacknetNodes) {
        buyHacknetNodes(ns);
    }

    if (doUpgradeTargets) {
        for (const target of targets) {
            attemptUpgradeTarget(ns, target);
        }
    }

    if (spendLeftoverHashes) {
        // If there are any hashes left, turn them into money for future hacknet upgrades
        spendHacknetHashes(ns, HashUpgrades.getMoney, undefined, -1);
    }
}

function isServerPrepped(ns: NS, server: string): boolean {
    return ns.getServerSecurityLevel(server) <= ns.getServerMinSecurityLevel(server)
        && ns.getServerMoneyAvailable(server) >= ns.getServerMaxMoney(server);
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
    const totalThreads = scriptRunnerManager.getPossibleThreads(batchFile.weaken, "");
    let weakenThreadsNeeded = Math.ceil((ns.getServerSecurityLevel(target) - securityThresh) / weakenAmount);
    // If we have extra threads left over and we will need to grow
    if (weakenThreadsNeeded != 0 && weakenThreadsNeeded < totalThreads && ns.getServerMoneyAvailable(target) < moneyThresh) {
        await scriptRunnerManager.runScript(batchFile.weaken, "", false, weakenThreadsNeeded, false, target);
    } else {
        // Since we aren't doing both initial weaken and grow, weaken threads can just be set to 0
        weakenThreadsNeeded = 0;
        while (ns.getServerSecurityLevel(target) > securityThresh) {
            await scriptRunnerManager.runScript(batchFile.weaken, "", false, -1, true, target);
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

        ns.tprintf(`${target} Counteracting grow:\n\tGrow: ${numGrowThreads}\n\tWeaken: ${numWeakenThreads}`);

        const bufferTimeMs = 20;
        const weakenTimeMs = ns.getWeakenTime(target);
        const growTimeMs = ns.getGrowTime(target);

        const maxTime = Math.max(weakenTimeMs, growTimeMs);
        const additionalGrowTimeMs = maxTime - growTimeMs;
        const additionalWeakenTimeMs = maxTime - weakenTimeMs;

        const processIds = [];
        processIds.push(...await scriptRunnerManager.runScript(batchFile.grow, "", false, numGrowThreads, false, target, String(additionalGrowTimeMs + bufferTimeMs)));
        processIds.push(...await scriptRunnerManager.runScript(batchFile.weaken, "", false, numWeakenThreads, false, target, String(additionalWeakenTimeMs + bufferTimeMs * 2)));
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

    const hackTimeMs = ns.formulas.hacking.hackTime(optimalServer, player);
    const weakenTimeMs = ns.formulas.hacking.weakenTime(optimalServer, player);
    const growTimeMs = ns.formulas.hacking.growTime(optimalServer, player);

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

function isHackingLevelPastThreshold(ns: NS, oldLevel: number, thresh: number) {
    const thresholdLevel = oldLevel * thresh;
    return ns.getHackingLevel() >= thresholdLevel;
}

export async function smartHack(
        ns: NS,
        scriptRunnerManager: ScriptRunnerManager,
        batchResetTimeMs: number,
        amountToHack: number,
        batchHostname: string,
        bufferTimeLimitMs: number,
        target: string,
        hackingLevelThreshold: number) {
    let numCores = 1;
    if (batchHostname != "") {
        numCores = ns.getServer(batchHostname).cpuCores;
    }

    const weakenAmount = ns.weakenAnalyze(1, numCores);
    const moneyThresh = ns.getServerMaxMoney(target);
    const securityThresh = ns.getServerMinSecurityLevel(target);

    const curMoney = ns.getServerMoneyAvailable(target);
    const curSecurity = ns.getServerSecurityLevel(target);
    ns.tprintf(`${target} Server Deviation:\n\tMoney: ${curMoney} / ${moneyThresh} (${curMoney / moneyThresh})\n\tSecurity: ${curSecurity} / ${securityThresh} (${curSecurity / securityThresh})`);

    if (!isServerPrepped(ns, target)) {
        // Grow and then counteract with weaken
        await prepServer(ns, scriptRunnerManager, numCores, weakenAmount, target, moneyThresh, securityThresh);
    }

    // Estimating the higher cost weaken instead of cheaper hack. If this needs to be recalculated, you should wait for all scripts to be finished first since they mess with the calculation
    const estimatedNumAvailableThreads = scriptRunnerManager.getPossibleThreads(batchFile.weaken, batchHostname);

    const lastProcessIds: number[] = [];
    const oldTime = performance.now();
    let batchSetCount = 0;
    while (performance.now() - oldTime < batchResetTimeMs) {
        const level = ns.getHackingLevel();

        ns.tprintf(`\n${target} Batch Set: ${batchSetCount}`);
        const batchStats = getBatchStats(ns, target, amountToHack, numCores, estimatedNumAvailableThreads);

        ns.tprintf(`Raw Batch:\n\tHack: ${batchStats.threadStats.numHackThreadsRaw}\n\tWeaken: ${batchStats.threadStats.numHackWeakenThreadsRaw}\n\tGrow: ${batchStats.threadStats.numGrowthThreadsRaw}\n\tWeaken: ${batchStats.threadStats.numGrowWeakenThreadsRaw}`);
        ns.tprintf(`Adjusted Batch:\n\tHack: ${batchStats.threadStats.numHackThreads}\n\tWeaken: ${batchStats.threadStats.numHackWeakenThreads}\n\tGrow: ${batchStats.threadStats.numGrowThreads}\n\tWeaken: ${batchStats.threadStats.numGrowWeakenThreads}`);

        ns.tprintf(`Batch Stats:`);
        ns.tprintf(`\tnumAvailableThreads: ${estimatedNumAvailableThreads}`);
        if (batchStats.numBatches == 0) {
            throw Error("0 Batches were calculated as available");
        }
        let bufferTimeMs = batchStats.bufferTimeMs;
        // Prevent buffer time from getting too low
        if (bufferTimeMs < bufferTimeLimitMs) {
            ns.tprintf(`WARNING: Buffer time could go less than ${bufferTimeLimitMs} ms. It is recommended that you increase the hack amount`);
            bufferTimeMs = bufferTimeLimitMs;
        }

        // TODO this is only temporary for fixing the prep bug
        if (!isServerPrepped(ns, target)) {
            throw Error(`${target} was not prepped by the end of a batch cycle`);
        }

        let firstBatchExtraBuffer = 0;
        let batchOffset = 0;
        if (batchStats.numBatches > 1) {
            // Adds 0.3 ms of buffer for each script + 1 additional for startup time
            firstBatchExtraBuffer = batchStats.numBatches * (4 * 0.3) + 1;
            // Takes the buffer time into account (subtracting 100 to be safe for the delay waiting
            // for process IDs to finish)
            firstBatchExtraBuffer = Math.max(0, firstBatchExtraBuffer - (batchStats.bufferTimeMs - 100));

            const totalBatchTime = bufferTimeMs * 4
            batchOffset = Math.ceil(firstBatchExtraBuffer / totalBatchTime);
            ns.tprintf(`\tRemoving ${batchOffset} batch(es) to account for additional buffer time`);
        }

        const numBatches = batchStats.numBatches - batchOffset;

        ns.tprintf(`\tNumBatches: ${numBatches}\n\tBufferTime: ${batchStats.bufferTimeMs}\n\tAdditionalBufferTime: ${firstBatchExtraBuffer}`);
        const firstProcessIds = [];
        let j = 0;
        for (let i = 0; i < numBatches; i++) {
            await scriptRunnerManager.runScript(batchFile.hack, batchHostname, false, batchStats.threadStats.numHackThreads, false, target, String(batchStats.threadStats.additionalHackTimeMs + bufferTimeMs * j++));
            await scriptRunnerManager.runScript(batchFile.weaken, batchHostname, false, batchStats.threadStats.numHackWeakenThreads, false, target, String(batchStats.threadStats.additionalWeakenTimeMs + bufferTimeMs * j++));
            await scriptRunnerManager.runScript(batchFile.grow, batchHostname, false, batchStats.threadStats.numGrowThreads, false, target, String(batchStats.threadStats.additionalGrowTimeMs + bufferTimeMs * j++));

            if (i == 0) {
                firstProcessIds.push(...await scriptRunnerManager.runScript(batchFile.weaken, batchHostname, false, batchStats.threadStats.numGrowWeakenThreads, false, target, String(batchStats.threadStats.additionalWeakenTimeMs + bufferTimeMs * j++)));
                j += firstBatchExtraBuffer / bufferTimeMs;
            } else if (i == numBatches - 1) {
                lastProcessIds.push(...await scriptRunnerManager.runScript(batchFile.weaken, batchHostname, false, batchStats.threadStats.numGrowWeakenThreads, false, target, String(batchStats.threadStats.additionalWeakenTimeMs + bufferTimeMs * j++)));
            } else {
                await scriptRunnerManager.runScript(batchFile.weaken, batchHostname, false, batchStats.threadStats.numGrowWeakenThreads, false, target, String(batchStats.threadStats.additionalWeakenTimeMs + bufferTimeMs * j++));
            }
        }
        let isSafe = false;
        while (firstProcessIds.some(id => ns.isRunning(id))) {
            isSafe = true;
            // Due to the resolution of this, the additional buffer time needs to account for it,
            // otherwise this could prevent proper timing
            await ns.sleep(50);
        }

        if (isHackingLevelPastThreshold(ns, level, hackingLevelThreshold)) {
            break;
        }

        if (!isSafe) {
            throw Error("Execution is completing too fast, processes are finishing before they are all started, increase the hack amount");
        }

        // This plus the sleep in the first process ID loop shouldn't exceed the buffer of sleep created after the first process IDs
        await ns.sleep(5);
        batchSetCount += 1;
    }
    // Wait till the last process is done
    while (lastProcessIds.some(id => ns.isRunning(id))) {
        await ns.sleep(100);
    }
}

export async function main(ns: NS) {
    ns.disableLog("sleep");

    if (ns.args.length > 0) {
        const numRequiredArgs = 5;
        const batchResetTimeMs = Number(ns.args[0]);
        const amountToHack = Number(ns.args[1]);
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
        scriptRunnerManager.addScript(batchFile.weaken, true, true);
        scriptRunnerManager.addScript(batchFile.grow, true, true);
        scriptRunnerManager.addScript(batchFile.hack, true, true);

        await smartHack(ns, scriptRunnerManager, batchResetTimeMs, amountToHack, batchHostname, bufferTimeLimitMs, target, 1.1);
    } else {
        // Make sure there is enough Ram for this script
        const reservedRam = ns.getScriptRam("/scripts/smartHack.js") + 8;
        const batchResetTimeMs = 1000 * 60 * 10;
        const amountToHack = 0.001;
        // Since our calculations include our cores (more than 1), we can only use home, otherwise, we could use ""
        const batchHostname = "";
        // const batchHostname = "home";
        const bufferTimeLimitMs = 200;
        // Only do this if you have hacknet servers
        const doHashUpgrades = true;
        const doUpgradeHacknetNodes = true;
        const doUpgradeTargets = true;
        const spendLeftoverHashes = true;
        const includeHacknetServers = true;
        const upgradeCloudServers = true;

        const doTorBuy = true;
        const doComputerUpgrade = true;

        while (true) {
            const target = getMostLucrativeServer(ns);
            // const target = "foodnstuff";
            // const target = "phantasy";

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

            if (doHashUpgrades) {
                applyHashUpgrades(ns, doUpgradeHacknetNodes, doUpgradeTargets, spendLeftoverHashes, target);
            }

            const scriptRunnerManager = new ScriptRunnerManager(ns);

            scriptRunnerManager.addHost("home", ns.getServerMaxRam("home") - reservedRam);
            for (const server of hackAndGetAllAccessServers(ns, includeHacknetServers)) {
                scriptRunnerManager.addHost(server);
            }
            scriptRunnerManager.addScript(batchFile.weaken, true, true);
            scriptRunnerManager.addScript(batchFile.grow, true, true);
            scriptRunnerManager.addScript(batchFile.hack, true, true);

            await smartHack(ns, scriptRunnerManager, batchResetTimeMs, amountToHack, batchHostname, bufferTimeLimitMs, target, 1.1);
        }
    }
}