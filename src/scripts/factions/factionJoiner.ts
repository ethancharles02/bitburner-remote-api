import { NS, CityName, CompanyName, JobField, FactionName } from "@ns";

export const factionNames: Record<string, FactionName> = {
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

const contestingFactions = [
    factionNames.Aevum,
    factionNames.Chongqing,
    factionNames.Ishima,
    factionNames.NewTokyo,
    factionNames.Sector12,
    factionNames.Volhaven,
]

export function joinAvailableFactions(ns: NS) {
    for (const factionName of ns.singularity.checkFactionInvitations()) {
        if (!contestingFactions.includes(factionName as FactionName)) {
            ns.singularity.joinFaction(factionName);
        }
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

export async function main(ns: NS) {
    joinAvailableFactions(ns);

    ns.tprint("\nFaction join script finished running\n")
}