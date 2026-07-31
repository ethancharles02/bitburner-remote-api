import { NS, CityName, CompanyName, JobField, FactionName } from "@ns";
import { hackAndGetAllAccessServers } from "/scripts/helpers.js";
import { getPathToServer, createJoinString } from "/scripts/getPathToServer.js";

const factionNames: Record<string, FactionName> = {
    // Backdoor
    CyberSec: "CyberSec",
    NiteSec: "NiteSec",
    TheBlackHand: "The Black Hand",
    BitRunners: "BitRunners",

    // Passive
    Netburners: "Netburners",
    Daedalus: "Daedalus",
    TheCovenant: "The Covenant",
    Illuminati: "Illuminati",

    // Location
    TianDiHui: "Tian Di Hui",
    // Location conflicting
    Chongqing: "Chongqing",
    Sector12: "Sector-12",
    Ishima: "Ishima",
    NewTokyo: "New Tokyo",
    Aevum: "Aevum",
    Volhaven: "Volhaven",

    // Corporations
    ECorp: "ECorp",
    MegaCorp: "MegaCorp",
    FourSigma: "Four Sigma",
    KuaiGongInternational: "KuaiGong International",
    BladeIndustries: "Blade Industries",
    NWO: "NWO",
    BachmanAndAssociates: "Bachman & Associates",
    OmniTekIncorporated: "OmniTek Incorporated",
    ClarkeIncorporated: "Clarke Incorporated",
    FulcrumSecretTechnologies: "Fulcrum Secret Technologies",

    // Criminal
    SlumSnakes: "Slum Snakes",
    Silhouette: "Silhouette",
    Tetrads: "Tetrads",
    SpeakersForTheDead: "Speakers for the Dead",
    TheDarkArmy: "The Dark Army",
    TheSyndicate: "The Syndicate",

    // Needs to be sorted
    Bladeburners: "Bladeburners",
    ChurchOfTheMachineGod: "Church of the Machine God",
    ShadowsOfAnarchy: "Shadows of Anarchy",
}

enum ServerName {
    csec = "CSEC",
    avmnite = "avmnite-02h",
    iiii = "I.I.I.I",
    run = "run4theh111z"
}

export const backdoorFactions: Partial<Record<ServerName, FactionName>> = {
    [ServerName.csec]: factionNames.CyberSec,
    [ServerName.avmnite]: factionNames.NiteSec,
    [ServerName.iiii]: factionNames.TheBlackHand,
    [ServerName.run]: factionNames.BitRunners,
}

// export const passiveFactions = [
//     FactionName.netburners,
//     FactionName.covenant,
//     FactionName.daedalus,
//     FactionName.illuminati
// ]

export const locationFactions: Partial<Record<FactionName, CityName>> = {
    [factionNames.TianDiHui]: "New Tokyo",

    [factionNames.Aevum]: "Aevum",
    [factionNames.Chongqing]: "Chongqing",
    [factionNames.Ishima]: "Ishima",
    [factionNames.NewTokyo]: "New Tokyo",
    [factionNames.Sector12]: "Sector-12",
    [factionNames.Volhaven]: "Volhaven",
}

export const contestingFactions = [
    factionNames.Aevum,
    factionNames.Chongqing,
    factionNames.Ishima,
    factionNames.NewTokyo,
    factionNames.Sector12,
    factionNames.Volhaven,
]

export const companyFactions: Partial<Record<FactionName, CompanyName>> = {
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
    const allAccessibleServers = hackAndGetAllAccessServers(ns);

    for (const server of Object.keys(backdoorFactions)) {
        if (allAccessibleServers.has(server) && !ns.getServer(server).backdoorInstalled) {
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
    for (const faction of Object.keys(locationFactions) as FactionName[]) {
        const cityName = locationFactions[faction] as CityName;
        if (cityName) {
            ns.singularity.travelToCity(cityName);
        }
    }
    ns.singularity.travelToCity("Sector-12");
}

async function handleCompanyFactions(ns: NS) {
    const player = ns.getPlayer();
    for (const [factionName, companyName] of Object.entries(companyFactions)) {
        // If the player isn't in the company faction
        if (!player.factions.includes(factionName as FactionName)) {
            // If the player isn't in the company job
            while (ns.singularity.applyToCompany(companyName, "Software") !== null);

            if (Object.keys(ns.getPlayer().jobs).includes(companyName)) {
                ns.singularity.workForCompany(companyName, false);
                break;
            }
        }
    }
}

function joinAvailableFactions(ns: NS) {
    for (const factionName of ns.singularity.checkFactionInvitations()) {
        if (!contestingFactions.includes(factionName as FactionName)) {
            ns.singularity.joinFaction(factionName);
        }
    }
}

function allFactionsJoined(ns: NS) {
    const player = ns.getPlayer();
    let allFactionsJoined = true;
    for (const factionName of Object.values(factionNames)) {
        if (!contestingFactions.includes(factionName)) {
            allFactionsJoined &&= player.factions.includes(factionName);
        }
    }
    return allFactionsJoined;
}

export async function main(ns: NS) {
    ns.disableLog("sleep");

    while (true) {
        await handleBackdoorFactions(ns);
        await handleLocationFactions(ns);
        joinAvailableFactions(ns);
        await handleCompanyFactions(ns);
        joinAvailableFactions(ns);

        if (allFactionsJoined(ns)) {
            break;
        } else {
            await ns.sleep(30000);
        }
    }

    ns.tprint("\nFaction join script finished running\n")
}