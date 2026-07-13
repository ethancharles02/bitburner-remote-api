import { NS } from "@ns";
import { getMaxMoneyServer, hackAndGetAllAccessServers } from "/scripts/helpers.js";
import { ScriptRunnerManager } from "/scripts/scriptRunner.js";

/** @param {NS} ns */
export async function main(ns: NS) {
    // Hide sleep output
    ns.disableLog("sleep");

    // Amount of iterations to do before updating the target server
    const refreshLimit = 10;
    const moneyThreshMultiplier = 0.9;
    const securityThreshAdder = 0.5;

    let target = getMaxMoneyServer(ns);

    // Additional ram to make sure the computer has
    let additionalAllottedRam = 16;
    let scriptRunnerManager = new ScriptRunnerManager(ns);
    scriptRunnerManager.addHost("home", additionalAllottedRam);
    for (let server of hackAndGetAllAccessServers(ns)) {
        scriptRunnerManager.addHost(server, 0);
    }
    scriptRunnerManager.addScript("weaken.js", true, true);
    scriptRunnerManager.addScript("grow.js", true, true);
    scriptRunnerManager.addScript("hack.js", true, true);

    let moneyThresh = ns.getServerMaxMoney(target) * moneyThreshMultiplier;
    let securityThresh = ns.getServerMinSecurityLevel(target) + securityThreshAdder;

    let i = 0;
    let processIds = [];
    // Infinite loop that continously hacks/grows/weakens the target server
    // @ignore-infinite
    while (true) {
        if (i == refreshLimit) {
            target = getMaxMoneyServer(ns);
            moneyThresh = ns.getServerMaxMoney(target) * moneyThreshMultiplier;
            securityThresh = ns.getServerMinSecurityLevel(target) + securityThreshAdder;
            i = 0;
        }

        if (ns.getServerSecurityLevel(target) > securityThresh) {
            processIds = await scriptRunnerManager.runScript("weaken.js", "", false, -1, true, target);
        } else if (ns.getServerMoneyAvailable(target) < moneyThresh) {
            processIds = await scriptRunnerManager.runScript("grow.js", "", false, -1, true, target);
        } else {
            processIds = await scriptRunnerManager.runScript("hack.js", "", false, -1, true, target);
        }
        await ns.sleep(100);

        i++;
    }
}