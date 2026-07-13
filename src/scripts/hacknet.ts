import { NS } from "@ns";

import { spendHacknetHashes, HashUpgrades } from "/scripts/hacknetHash";

export function buyHacknetNodes(ns: NS) {
    // Buy all possible nodes first
    while (ns.hacknet.purchaseNode() != -1);

    // Loop through these functions maxing out the first one and going down the list after that
    const upgradeFuncs = [
        ns.hacknet.upgradeLevel,
        ns.hacknet.upgradeCache,
        ns.hacknet.upgradeCore,
        ns.hacknet.upgradeRam,
        ns.hacknet.upgradeCache
    ];

    const numNodes = ns.hacknet.numNodes();
    let upgradeSuccessful = true;
    while (upgradeSuccessful) {
        upgradeSuccessful = false;
        for (const upgradeFunc of upgradeFuncs) {
            for (let i = 0; i < numNodes; i++) {
                // Can't directly do or-equals because of short circuiting
                const result = upgradeFunc(i);
                upgradeSuccessful ||= result;
            }
        }
    }
}

export async function main(ns: NS) {
    const doLoop = ns.args.length >= 1 ? Boolean(ns.args[0]) : false;
    if (doLoop) {
        while (true) {
            spendHacknetHashes(ns, HashUpgrades.getMoney, undefined, -1);
            buyHacknetNodes(ns);
            // Wait 30 seconds
            await ns.sleep(1000 * 30);
        }
    } else {
        buyHacknetNodes(ns);
    }
}