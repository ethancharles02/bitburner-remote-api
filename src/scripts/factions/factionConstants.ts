import { CityName, CompanyName, FactionName } from "@ns";

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

export const contestingFactions = [
    factionNames.Aevum,
    factionNames.Chongqing,
    factionNames.Ishima,
    factionNames.NewTokyo,
    factionNames.Sector12,
    factionNames.Volhaven,
]

export const locationFactions: Partial<Record<FactionName, CityName>> = {
    [factionNames.TianDiHui]: "New Tokyo",

    [factionNames.Aevum]: "Aevum",
    [factionNames.Chongqing]: "Chongqing",
    [factionNames.Ishima]: "Ishima",
    [factionNames.NewTokyo]: "New Tokyo",
    [factionNames.Sector12]: "Sector-12",
    [factionNames.Volhaven]: "Volhaven",
}

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

export const neurofluxGovernor = "NeuroFlux Governor";
