import { NS } from "@ns";

export async function main(ns: NS) {
    // Buy all possible nodes first
    while (ns.hacknet.purchaseNode() != -1) { };

    // Loop through these functions maxing out the first one and going down the list after that
    const upgradeFuncs = [
        ns.hacknet.upgradeLevel,
        ns.hacknet.upgradeCache,
        ns.hacknet.upgradeCore,
        ns.hacknet.upgradeRam
    ];

    const numNodes = ns.hacknet.numNodes();
    for (const upgradeFunc of upgradeFuncs) {
        let upgradeSuccessful = true;
        while (upgradeSuccessful) {
            upgradeSuccessful = false;
            for (let i = 0; i < numNodes; i++) {
                upgradeSuccessful ||= upgradeFunc(i);
            }
        }
    }
}