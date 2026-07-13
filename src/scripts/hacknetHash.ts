import { NS } from "@ns";

export enum HashUpgrades {
    getMoney = "Sell for Money",
    getCorporationFunds = "Sell for Corporation Funds",
    reduceMinSecurity = "Reduce Minimum Security",
    increaseMaxMoney = "Increase Maximum Money",
    improveStudying = "Improve Studying",
    improveGymTraining = "Improve Gym Training",
    getCorporationResearch = "Exchange for Corporation Research",
    getBBRank = "Exchange for Bladeburner Rank",
    getBBSp = "Exchange for Bladeburner SP",
    generateCodingContract = "Generate Coding Contract",
    getCompanyFavor = "Company Favor"
}

/**
 * @param {AutocompleteData} data - context about the game, useful when autocompleting
 * @param {string[]} args - current arguments, not including "run script.js"
 * @returns {string[]} - the array of possible autocomplete options
 */
export function autocomplete(data: AutocompleteData, args: string[]) {
    return Object.keys(HashUpgrades);
}

export function spendHacknetHashes(ns: NS, upgrade: HashUpgrades, target: string | undefined = undefined, count: number | undefined = undefined) {
    if (count == -1) {
        while (ns.hacknet.spendHashes(upgrade, target));
    } else {
        ns.hacknet.spendHashes(upgrade, target, count);
    }
}

// Prioritizes maximizing money first and then decreasing security
export function attemptUpgradeTarget(ns: NS, target: string) {
    // Less than 10 trillion, it can still be increased
    if (ns.getServerMaxMoney(target) < 10_000_000_000_000) {
        spendHacknetHashes(ns, HashUpgrades.increaseMaxMoney, target, -1);
    }
    // More than 1, it can still be decreased
    if (ns.getServerMinSecurityLevel(target) > 1) {
        spendHacknetHashes(ns, HashUpgrades.reduceMinSecurity, target, -1);
    }
}

export async function main(ns: NS) {
    let upgrade = HashUpgrades.getMoney;
    if (String(ns.args[0]) in HashUpgrades) {
        upgrade = HashUpgrades[ns.args[0] as keyof typeof HashUpgrades];
    }
    const target = ns.args.length >= 2 && String(ns.args[1]) != "" ? String(ns.args[1]) : undefined;
    const count = ns.args.length >= 3 ? Number(ns.args[2]) : undefined;
    const doLoop = ns.args.length >= 4 ? Boolean(ns.args[3]) : false;
    if (doLoop) {
        while (true) {
            spendHacknetHashes(ns, upgrade, target, count);
            await ns.sleep(10000);
        }
    } else {
        spendHacknetHashes(ns, upgrade, target, count);
    }
}