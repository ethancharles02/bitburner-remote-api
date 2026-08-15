import { NS, CityName, CompanyName, JobField, FactionName, Player } from "@ns";
import { hackAndGetAllAccessServers } from "/scripts/helpers.js";
import { factionNames, joinAvailableFactions, allFactionsJoined } from "./factionJoiner";
import { getPathToServer } from "/scripts/getPathToServer.js";
import { neurofluxGovernor } from "/scripts/buyAugments";

const locationFactions: Partial<Record<FactionName, CityName>> = {
    [factionNames.TianDiHui]: "New Tokyo",

    [factionNames.Aevum]: "Aevum",
    [factionNames.Chongqing]: "Chongqing",
    [factionNames.Ishima]: "Ishima",
    [factionNames.NewTokyo]: "New Tokyo",
    [factionNames.Sector12]: "Sector-12",
    [factionNames.Volhaven]: "Volhaven",
}

const companyFactions: Partial<Record<FactionName, CompanyName>> = {
    [factionNames.ECorp]: "ECorp",
    [factionNames.MegaCorp]: "MegaCorp",
    [factionNames.KuaiGongInternational]: "KuaiGong International",
    [factionNames.FourSigma]: "Four Sigma",
    [factionNames.NWO]: "NWO",
    [factionNames.BladeIndustries]: "Blade Industries",
    [factionNames.OmniTekIncorporated]: "OmniTek Incorporated",
    [factionNames.BachmanAndAssociates]: "Bachman & Associates",
    [factionNames.ClarkeIncorporated]: "Clarke Incorporated",
    [factionNames.FulcrumSecretTechnologies]: "Fulcrum Technologies"
}

async function handleBackdoorFactions(ns: NS) {
    const allAccessibleServers = hackAndGetAllAccessServers(ns, false, false);

    // TODO add servers to a backdoor server list and then loop through that to backdoor. Then you
    // can add a print message to inform the user of the progress of backdooring
    for (const server of allAccessibleServers) {
        if (!ns.getServer(server).backdoorInstalled) {
            const pathList = getPathToServer(ns, server);
            for (const pathServer of pathList) {
                ns.singularity.connect(pathServer);
            }
            await ns.singularity.installBackdoor();
        }
    }

    ns.singularity.connect("home");
}

async function handleLocationFactions(ns: NS) {
    const player = ns.getPlayer();
    for (const faction of Object.keys(locationFactions) as FactionName[]) {
        const cityName = locationFactions[faction] as CityName;
        const hasInvite = ns.singularity.checkFactionInvitations().includes(faction);
        const inFaction = player.factions.includes(faction);
        if (cityName && !(inFaction || hasInvite)) {
            ns.singularity.travelToCity(cityName);
            // Waits to give the game time to recognize and send faction invite
            await ns.sleep(5000);
        }
    }
    ns.singularity.travelToCity("Sector-12");
}

function handleCompanyFactions(ns: NS) {
    const player = ns.getPlayer();
    for (const [factionName, companyName] of Object.entries(companyFactions)) {
        // If the player isn't in the company faction
        if (!player.factions.includes(factionName as FactionName)) {
            // If the player isn't in the company job
            while (ns.singularity.applyToCompany(companyName, "Software") !== null);
        }
    }
}

enum WorkType {
    Company,
    Faction
}

type WorkOption = {
    readonly workType: WorkType;
    readonly workName: string;
    readonly repGain: number;
    readonly neededRepAmount: number;
}

// Copied from the source code
const log1point02 = 0.019802627296179712;
function getRepFromFavor(favor: number): number {
    return Math.max(25000 * Math.expm1(log1point02 * favor), 0);
}

function getMaxRepReqFromAugments(ns: NS, augments: string[], augmentFilter: string[]): number {
    let maxRepReq = 0;
    for (const augment of augments) {
        if (!augmentFilter.includes(augment) && augment != neurofluxGovernor) {
            const repReq = ns.singularity.getAugmentationRepReq(augment);
            if (repReq > maxRepReq) {
                maxRepReq = repReq;
            }
        }
    }
    return maxRepReq;
}

function getCompanyWorkOptions(ns: NS, player: Player, companyFactions: Partial<Record<FactionName, CompanyName>>): WorkOption[] {
    const companyRepReq = 400_000;
    const workOptions: WorkOption[] = [];
    // Loop through all companies and push all viable options with how much rep is needed
    for (const [factionName, companyName] of Object.entries(companyFactions)) {
        if (!player.factions.includes(factionName as FactionName)) {
            if (Object.keys(player.jobs).includes(companyName)) {
                const jobName = player.jobs[companyName];
                if (jobName) {
                    const repGains = 5 * ns.formulas.work.companyGains(player, companyName, jobName, ns.singularity.getCompanyFavor(companyName)).reputation;
                    const curRep = ns.singularity.getCompanyRep(companyName);
                    const neededRepAmount = companyRepReq - curRep;
                    if (neededRepAmount > 0) {
                        workOptions.push(
                            {
                                workName: companyName,
                                repGain: repGains,
                                workType: WorkType.Company,
                                neededRepAmount: neededRepAmount
                            }
                        );
                    }
                }
            }
        }
    }

    return workOptions;
}

function neededMoneyForRep(ns: NS, neededRep: number, player: Player): number {
    return (neededRep * 1e6) / (player.mults.faction_rep * ns.getBitNodeMultipliers().FactionWorkRepGain);
}

export function getRepNeededToDonate(ns: NS): number {
    const neededFavor = ns.getFavorToDonate();
    return getRepFromFavor(neededFavor);
}

function getFactionWorkOptions(ns: NS, player: Player): WorkOption[] {
    const workOptions: WorkOption[] = [];
    const ownedAugments = ns.singularity.getOwnedAugmentations(true);

    const neededFavor = ns.getFavorToDonate();
    const repNeededToDonate = getRepNeededToDonate(ns);

    // Loop through all factions and push all viable options with how much rep is needed for max augment
    for (const factionName of player.factions) {
        // The timing is 200ms so multiply by 5
        const repGains = 5 * ns.formulas.work.factionGains(player, "hacking", ns.singularity.getFactionFavor(factionName)).reputation;
        const augmentations = ns.singularity.getAugmentationsFromFaction(factionName);
        let curRep = ns.singularity.getFactionRep(factionName);
        const curFavor = ns.singularity.getFactionFavor(factionName);
        const totalRep = curRep + getRepFromFavor(curFavor);
        const maxRepReq = getMaxRepReqFromAugments(ns, augmentations, ownedAugments);

        if (maxRepReq > 0) {
            let neededRepAmount = maxRepReq - curRep;
            if (neededRepAmount > 0) {
                if (curFavor >= neededFavor) {
                    const result = ns.singularity.donateToFaction(factionName, neededMoneyForRep(ns, neededRepAmount, player));
                    if (result) {
                        continue;
                    }
                }
                curRep = ns.singularity.getFactionRep(factionName);
                if (maxRepReq > repNeededToDonate) {
                    neededRepAmount = repNeededToDonate - totalRep;
                    if (neededRepAmount <= 0) {
                        continue;
                    }
                }
                workOptions.push(
                    {
                        workName: factionName,
                        repGain: repGains,
                        workType: WorkType.Faction,
                        neededRepAmount: neededRepAmount
                    }
                );
            }
        }
    }

    return workOptions;
}

function workForOptimalOption(ns: NS): boolean {
    const player = ns.getPlayer();
    const workOptions: WorkOption[] = [];

    // TODO improve company work options to have timing for the augments after joining the faction
    // as well
    workOptions.push(...getCompanyWorkOptions(ns, player, companyFactions));
    workOptions.push(...getFactionWorkOptions(ns, player));

    // Get faction/company that needs the smallest amount of rep
    if (workOptions.length > 0) {
        workOptions.sort((a, b) => (a.neededRepAmount / a.repGain) - (b.neededRepAmount / b.repGain));
        const topOption = workOptions[0];
        if (topOption.workType == WorkType.Company) {
            ns.singularity.workForCompany(topOption.workName as CompanyName, false);
        } else if (topOption.workType == WorkType.Faction) {
            ns.singularity.workForFaction(topOption.workName as FactionName, "hacking", false);
        }
    } else {
        return true;
    }

    ns.tprintf(`Work Option Analysis:`);
    for (const workOption of workOptions) {
        const minutesToCompletion = ((workOption.neededRepAmount / workOption.repGain) / 60).toFixed(0);
        ns.tprintf(`\t${workOption.workName}: ${workOption.neededRepAmount.toFixed(2)} / ${workOption.repGain.toFixed(2)} (${minutesToCompletion} minutes)`);
    }

    return false;
}

export async function main(ns: NS) {
    ns.disableLog("sleep");

    while (true) {
        await handleBackdoorFactions(ns);
        await handleLocationFactions(ns);
        handleCompanyFactions(ns);
        joinAvailableFactions(ns);
        // Optimal option function will return true if all options are completed
        const allDone = workForOptimalOption(ns) && allFactionsJoined(ns);

        if (allDone) {
            break;
        } else {
            // 5 Minutes
            await ns.sleep(5 * 60 * 1000);
        }
    }

    ns.tprintf(`\nFaction join script finished running\n`)
}