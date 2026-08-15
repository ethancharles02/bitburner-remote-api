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

export async function main(ns: NS) {
    joinAvailableFactions(ns);

    ns.tprintf(`\nFaction join script finished running\n`)
}