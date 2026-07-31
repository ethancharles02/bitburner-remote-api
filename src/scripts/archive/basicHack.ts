import { NS } from "@ns";
import { getMaxMoneyServer } from "/scripts/helpers.js";

/** @param {NS} ns */
export async function main(ns: NS) {
    // Amount of iterations to do before updating the target server
    const refreshLimit = 10;
    const moneyThreshMultiplier = 0.9;
    const securityThreshAdder = 0.5;

    let target = getMaxMoneyServer(ns);
    let moneyThresh = ns.getServerMaxMoney(target) * moneyThreshMultiplier;
    let securityThresh = ns.getServerMinSecurityLevel(target) + securityThreshAdder;

    let i = 0;
    // Infinite loop that continously hacks/grows/weakens the target server
    while (true) {
        if (i == refreshLimit) {
            target = getMaxMoneyServer(ns);
            moneyThresh = ns.getServerMaxMoney(target) * moneyThreshMultiplier;
            securityThresh = ns.getServerMinSecurityLevel(target) + securityThreshAdder;
            i = 0;
        }

        if (ns.getServerSecurityLevel(target) > securityThresh) {
            // If the server's security level is above our threshold, weaken it
            await ns.weaken(target);
        } else if (ns.getServerMoneyAvailable(target) < moneyThresh) {
            // If the server's money is less than our threshold, grow it
            await ns.grow(target);
        } else {
            // Otherwise, hack it
            await ns.hack(target);
        }

        i++;
    }
}