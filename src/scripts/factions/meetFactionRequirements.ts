import { NS, CityName, CompanyName, FactionName, Player } from "@ns";
import { hackAndGetAllAccessServers } from "/scripts/helpers.js";
import { locationFactions, companyFactions, neurofluxGovernor, factionNames, contestingFactions } from "./factionConstants";
import { getPathToServer } from "/scripts/getPathToServer.js";
import { Color } from "../colors";

function getBestContestingFaction(ns: NS, invitations: FactionName[]): string {
    const ownedAugments = ns.singularity.getOwnedAugmentations(true);
    // The best faction is currently set to be the faction that offers the most augments
    let maxAugmentCount = 0;
    let bestContestingFaction = "";
    // TODO test this
    for (const factionName of contestingFactions) {
        if (invitations.includes(factionName)) {
            const augments = ns.singularity.getAugmentationsFromFaction(factionName);
            const numAugments = augments.reduce((sum, curAugment) => sum + (!ownedAugments.includes(curAugment) ? 1 : 0), 0);
            if (numAugments > maxAugmentCount) {
                maxAugmentCount = numAugments;
                bestContestingFaction = factionName;
            }
        }
    }

    return bestContestingFaction;
}

export function joinAvailableFactions(ns: NS) {
    const invitations = ns.singularity.checkFactionInvitations();

    for (const factionName of invitations) {
        // Allow if it is the best contesting faction
        if (!contestingFactions.includes(factionName)) {
            ns.singularity.joinFaction(factionName);
        }
    }

    const bestContestingFaction = getBestContestingFaction(ns, invitations);
    if (bestContestingFaction != "") {
        ns.singularity.joinFaction(bestContestingFaction as FactionName);
    }
}

export function allFactionsJoined(ns: NS) {
    const player = ns.getPlayer();
    let allFactionsJoined = true;
    for (const factionName of Object.values(factionNames)) {
        if (!contestingFactions.includes(factionName)) {
            allFactionsJoined &&= player.factions.includes(factionName);
        }
    }
    return allFactionsJoined;
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

// TODO this involves constantly traveling since location factions fight and will rescind their
// invitation if you join specific ones. Update it to be smarter
async function handleLocationFactions(ns: NS) {
    const player = ns.getPlayer();
    if (player.money > 20e6) {
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
    readonly secondsToCompletion: number;
    readonly isLoPri: boolean;
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

function getPlayerRepGainsFromJob(ns: NS, player: Player, companyName: CompanyName) {
    const jobName = player.jobs[companyName];
    if (jobName) {
        const repGains = 5 * ns.formulas.work.companyGains(player, companyName, jobName, ns.singularity.getCompanyFavor(companyName)).reputation;
        return repGains;
    } else {
        throw Error("getPlayerRepGainsFromJob called when the player doesn't have this job");
    }
}

function getPlayerRepGainsFromFaction(ns: NS, player: Player, factionName: FactionName) {
    // The timing is 200ms so multiply by 5
    const repGains = 5 * ns.formulas.work.factionGains(player, "hacking", ns.singularity.getFactionFavor(factionName)).reputation;
    return repGains;
}

function getCompanyWorkOptions(ns: NS, player: Player, companyFactions: Partial<Record<FactionName, CompanyName>>): WorkOption[] {
    const companyRepReq = 400_000;
    const workOptions: WorkOption[] = [];
    const ownedAugments = ns.singularity.getOwnedAugmentations(true);

    ns.tprintf(`Company Rep Options:`);
    // Loop through all companies and push all viable options with how much rep is needed
    for (const [factionName, companyName] of Object.entries(companyFactions)) {
        if (!player.factions.includes(factionName as FactionName)) {
            if (Object.keys(player.jobs).includes(companyName)) {
                const jobName = player.jobs[companyName];
                if (jobName) {
                    const repGains = getPlayerRepGainsFromJob(ns, player, companyName);
                    const curRep = ns.singularity.getCompanyRep(companyName);
                    const neededRepAmount = companyRepReq - curRep;

                    if (neededRepAmount > 0) {
                        const augmentations = ns.singularity.getAugmentationsFromFaction(factionName as FactionName);
                        // TODO this should be the min between this or the favor limit of rep
                        const maxAugmentRepReq = getMaxRepReqFromAugments(ns, augmentations, ownedAugments);
                        const factionRepGain = getPlayerRepGainsFromFaction(ns, player, factionName as FactionName);

                        const secondsToCompletion = (neededRepAmount / repGains) + (maxAugmentRepReq / factionRepGain);

                        ns.tprintf(`\t${companyName}:`);
                        ns.tprintf(`\t\tWork: ${neededRepAmount.toFixed(2)} / ${repGains.toFixed(2)}`);
                        ns.tprintf(`\t\tAugments: ${maxAugmentRepReq.toFixed(2)} / ${factionRepGain.toFixed(2)}`);
                        workOptions.push(
                            {
                                workName: companyName,
                                workType: WorkType.Company,
                                secondsToCompletion: secondsToCompletion,
                                isLoPri: false
                            }
                        );
                    }
                }
            }
        }
    }

    return workOptions;
}

export function neededMoneyForRep(ns: NS, neededRep: number, player: Player): number {
    return (neededRep * 1e6) / (player.mults.faction_rep * ns.getBitNodeMultipliers().FactionWorkRepGain);
}

export function getRepNeededToDonate(ns: NS): number {
    const neededFavor = ns.getFavorToDonate();
    return getRepFromFavor(neededFavor);
}

function getLowPriString(isLowPri: boolean): string {
    return isLowPri ? " (Low Priority)" : "";
}

type NeededRep = {
    readonly neededRep: number;
    readonly isLowPri: boolean;
}

function getNeededRepForFaction(ns: NS, player: Player, ownedAugments: string[], faction: FactionName, doAttemptRepPurchase: boolean): NeededRep {
    const neededFavor = ns.getFavorToDonate();
    const augmentations = ns.singularity.getAugmentationsFromFaction(faction);
    const curRep = ns.singularity.getFactionRep(faction);
    const curFavor = ns.singularity.getFactionFavor(faction);
    const totalRep = curRep + getRepFromFavor(curFavor);
    const repNeededToDonate = getRepNeededToDonate(ns);
    const maxRepReq = getMaxRepReqFromAugments(ns, augmentations, ownedAugments);

    let neededRepAmount = 0;
    let isLowPri = false;
    if (maxRepReq > 0) {
        neededRepAmount = Math.max(0, maxRepReq - curRep);
        if (neededRepAmount > 0) {
            if (doAttemptRepPurchase && curFavor >= neededFavor) {
                const neededMoney = neededMoneyForRep(ns, neededRepAmount, player);
                // If we have enough money, purchase the rep, otherwise, add it to the low
                // priority list
                if (player.money >= neededMoney) {
                    const result = ns.singularity.donateToFaction(faction, neededMoney);
                    if (result) {
                        return {
                            neededRep: 0,
                            isLowPri: false
                        };
                    }
                }
            }

            // Decides if it is low priority or not (otherwise, updates rep to amount needed for
            // donation)
            if (curFavor >= neededFavor || totalRep >= repNeededToDonate) {
                isLowPri = true;
            } else {
                if (maxRepReq > repNeededToDonate) {
                    neededRepAmount = repNeededToDonate - totalRep;
                }
            }
        }
    }
    return {
        neededRep: neededRepAmount,
        isLowPri: isLowPri
    };
}

function getFactionWorkOptions(ns: NS, player: Player): WorkOption[] {
    const workOptions: WorkOption[] = [];
    const ownedAugments = ns.singularity.getOwnedAugmentations(true);

    ns.tprintf(`Faction Rep Options:`);
    // Loop through all factions and push all viable options with how much rep is needed for max augment
    for (const factionName of player.factions) {
        const repGains = getPlayerRepGainsFromFaction(ns, player, factionName);

        const neededRep = getNeededRepForFaction(ns, player, ownedAugments, factionName, true);

        if (neededRep.neededRep > 0) {
            workOptions.push(
                {
                    workName: factionName,
                    workType: WorkType.Faction,
                    secondsToCompletion: neededRep.neededRep / repGains,
                    isLoPri: neededRep.isLowPri
                }
            )
            ns.tprintf(`\t${factionName}${getLowPriString(neededRep.isLowPri)}: ${neededRep.neededRep.toFixed(2)} / ${repGains.toFixed(2)}`);
        }
    }

    return workOptions;
}

function workOptionSorter(a: WorkOption, b: WorkOption) {
    if (a.isLoPri && !b.isLoPri) {
        return 1;
    }

    if (!a.isLoPri && b.isLoPri) {
        return -1;
    }

    return a.secondsToCompletion - b.secondsToCompletion;
}

function workForOptimalOption(ns: NS): boolean {
    const player = ns.getPlayer();
    const workOptions: WorkOption[] = [];

    workOptions.push(...getCompanyWorkOptions(ns, player, companyFactions));
    workOptions.push(...getFactionWorkOptions(ns, player));

    // Get faction/company that needs the smallest amount of rep
    if (workOptions.length > 0) {
        workOptions.sort(workOptionSorter);
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
        const minutesToCompletion = ((workOption.secondsToCompletion) / 60).toFixed(0);
        const color = workOption.workType == WorkType.Company ? Color.Orange : Color.Blue;
        ns.tprintf(`\t${color}${workOption.workName}${getLowPriString(workOption.isLoPri)}: ${minutesToCompletion} minutes`);
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