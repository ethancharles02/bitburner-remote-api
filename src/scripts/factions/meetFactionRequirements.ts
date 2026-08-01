import { NS, CityName, CompanyName, JobField, FactionName } from "@ns";
import { hackAndGetAllAccessServers } from "/scripts/helpers.js";
import { factionNames, joinAvailableFactions, allFactionsJoined } from "./factionJoiner";
import { getPathToServer } from "/scripts/getPathToServer.js";
import { neurofluxGovernor } from "/scripts/buyAugments";

enum ServerName {
    csec = "CSEC",
    avmnite = "avmnite-02h",
    iiii = "I.I.I.I",
    run = "run4theh111z"
}

const backdoorFactions: Partial<Record<ServerName, FactionName>> = {
    [ServerName.csec]: factionNames.CyberSec,
    [ServerName.avmnite]: factionNames.NiteSec,
    [ServerName.iiii]: factionNames.TheBlackHand,
    [ServerName.run]: factionNames.BitRunners,
}

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

    // for (const server of Object.keys(backdoorFactions)) {
    //     if (allAccessibleServers.has(server) && !ns.getServer(server).backdoorInstalled) {
    //         const pathList = getPathToServer(ns, server);
    //         for (const pathServer of pathList) {
    //             ns.singularity.connect(pathServer);
    //         }
    //         await ns.singularity.installBackdoor();
    //     }
    // }
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

function handleLocationFactions(ns: NS) {
    const player = ns.getPlayer();
    for (const faction of Object.keys(locationFactions) as FactionName[]) {
        const cityName = locationFactions[faction] as CityName;
        if (cityName && !player.factions.includes(faction)) {
            ns.singularity.travelToCity(cityName);
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

type WorkOptions = {
    readonly workType: WorkType;
    readonly workName: string;
    readonly repGain: number;
    readonly neededRepAmount: number;
}

function workForOptimalOption(ns: NS): boolean {
    const player = ns.getPlayer();
    const workOptions: Array<WorkOptions> = [];

    // Loop through all companies and push all viable options with how much rep is needed
    for (const [factionName, companyName] of Object.entries(companyFactions)) {
        if (!player.factions.includes(factionName as FactionName)) {
            if (Object.keys(player.jobs).includes(companyName)) {
                const jobName = player.jobs[companyName];
                if (jobName) {
                    const repGains = 5 * ns.formulas.work.companyGains(player, companyName, jobName, ns.singularity.getCompanyFavor(companyName)).reputation;
                    const curRep = ns.singularity.getCompanyRep(companyName);
                    const neededRepAmount = 400_000 - curRep;
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

    const ownedAugments = ns.singularity.getOwnedAugmentations(true);
    // Loop through all factions and push all viable options with how much rep is needed for max augment
    for (const factionName of player.factions) {
        const repGains = 5 * ns.formulas.work.factionGains(player, "hacking", ns.singularity.getFactionFavor(factionName)).reputation;
        const augmentations = ns.singularity.getAugmentationsFromFaction(factionName);
        const curRep = ns.singularity.getFactionRep(factionName);
        let maxRepReq = 0;
        for (const augment of augmentations) {
            if (!ownedAugments.includes(augment) && augment != neurofluxGovernor) {
                const repReq = ns.singularity.getAugmentationRepReq(augment);
                if (repReq > maxRepReq) {
                    maxRepReq = repReq;
                }
            }
        }

        if (maxRepReq > 0) {
            const neededRepAmount = maxRepReq - curRep;
            if (neededRepAmount > 0) {
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

    // Get faction/company that needs the smallest amount of rep
    workOptions.sort((a, b) => (a.neededRepAmount / a.repGain) - (b.neededRepAmount / b.repGain));
    if (workOptions.length > 0) {
        const topOption = workOptions[0];
        if (topOption.workType == WorkType.Company) {
            ns.singularity.workForCompany(topOption.workName as CompanyName, false);
        } else if (topOption.workType == WorkType.Faction) {
            ns.singularity.workForFaction(topOption.workName as FactionName, "hacking", false);
        }
    } else {
        return true;
    }

    ns.tprintf(`Work Option Analysis:`)
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
        handleLocationFactions(ns);
        handleCompanyFactions(ns);
        joinAvailableFactions(ns);
        const allDone = workForOptimalOption(ns);

        if (allDone) {
            break;
        } else {
            // 5 Minutes
            await ns.sleep(5 * 60 * 1000);
        }
    }

    ns.tprint("\nFaction join script finished running\n")
}