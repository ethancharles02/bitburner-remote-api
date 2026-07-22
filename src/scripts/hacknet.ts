import { NS } from "@ns";

import { spendHacknetHashes, HashUpgrades } from "/scripts/hacknetHash";

export enum NodeStats {
    level = "level",
    cache = "cache",
    cores = "cores",
    ram = "ram"
}

type HacknetUpgrades = [getName: NodeStats, upgradeFunc: CallableFunction];
type MaxMin = [min: number, max: number];
type HacknetUpgradesMaxMin = Record<NodeStats, MaxMin>;

function getUpgradeMaxMinStats(ns: NS, upgradeFuncs: HacknetUpgrades[]) {
    const numNodes = ns.hacknet.numNodes();
    // Initialize the object as high min and low max for each nodestat
    const maxMinStats: HacknetUpgradesMaxMin = Object.values(NodeStats).reduce((acc, role) => {
        acc[role] = [Infinity, -Infinity];
        return acc;
    }, {} as HacknetUpgradesMaxMin);

    // Assign maximums and minimums for each stat
    for (let i = 0; i < numNodes; i++) {
        const stats = ns.hacknet.getNodeStats(i);
        for (const [getName, _] of upgradeFuncs) {
            const stat = stats[getName] ?? 0;
            if (stat > maxMinStats[getName][1]) {
                maxMinStats[getName][1] = stat;
            } else if (stat < maxMinStats[getName][0]) {
                maxMinStats[getName][0] = stat;
            }
        }
    }

    return maxMinStats;
}

export function buyHacknetNodes(ns: NS) {
    // Buy all possible nodes first
    while (ns.hacknet.purchaseNode() != -1);

    // Loop through these functions maxing out the first one and going down the list after that
    const upgradeFuncs: HacknetUpgrades[] = [
        [NodeStats.level, ns.hacknet.upgradeLevel],
        [NodeStats.cache, ns.hacknet.upgradeCache],
        [NodeStats.cores, ns.hacknet.upgradeCore],
        [NodeStats.ram, ns.hacknet.upgradeRam]
    ];

    const numNodes = ns.hacknet.numNodes();
    let upgradeSuccessful = true;
    while (upgradeSuccessful) {
        // Initialize the object as high min and low max for each nodestat
        const maxMinStats: HacknetUpgradesMaxMin = getUpgradeMaxMinStats(ns, upgradeFuncs);

        upgradeSuccessful = false;
        for (const [getName, upgradeFunc] of upgradeFuncs) {
            for (let i = 0; i < numNodes; i++) {
                const stat = ns.hacknet.getNodeStats(i)[getName] ?? 0;
                // Prioritize upgrades of stats that are lower than the max if they exist
                if (maxMinStats[getName][0] == maxMinStats[getName][1] || stat < maxMinStats[getName][1]) {
                    // Can't directly do or-equals because of short circuiting
                    const result = upgradeFunc(i);
                    upgradeSuccessful ||= result;
                }
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