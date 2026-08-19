import { FactionName, NS } from "@ns";
import { factionNames, neurofluxGovernor } from "./factions/factionConstants"
import { neededMoneyForRep } from "./factions/meetFactionRequirements";
import { Color } from "./colors";

type AugmentPurchase = {
    readonly factionName: FactionName;
    readonly augmentName: string;
    readonly augmentPrice: number;
}

export function buyAugments(ns: NS, doBuyNeuroGov: boolean) {
    let player = ns.getPlayer();
    const ownedAugmentations = ns.singularity.getOwnedAugmentations(true);
    const augmentsToBuy: AugmentPurchase[] = [];
    let maxRepFaction = "";
    let maxFavorFaction = "";
    let maxRep = -Infinity;
    let maxFavor = -Infinity;
    let hasFactions = false;
    for (const factionName of Object.values(factionNames)) {
        if (player.factions.includes(factionName)) {
            hasFactions = true;
            const rep = ns.singularity.getFactionRep(factionName);
            const favor = ns.singularity.getFactionFavor(factionName);
            if (rep > maxRep) {
                maxRepFaction = factionName;
                maxRep = rep;
            }
            if (favor > maxFavor) {
                maxFavorFaction = factionName;
                maxFavor = favor;
            }

            const augmentations = ns.singularity.getAugmentationsFromFaction(factionName);
            for (const augmentation of augmentations) {
                if ((!ownedAugmentations.includes(augmentation) && augmentation != neurofluxGovernor)) {
                    augmentsToBuy.push({augmentName: augmentation, factionName: factionName, augmentPrice: ns.singularity.getAugmentationPrice(augmentation)})
                }
            }
        }
    }

    if (!hasFactions) {
        return;
    }

    let purchaseFaction = maxRepFaction as FactionName;
    if (maxFavor >= ns.getFavorToDonate()) {
        purchaseFaction = maxFavorFaction as FactionName;
    }

    augmentsToBuy.sort((a, b) => b.augmentPrice - a.augmentPrice);
    let success = true;
    const augmentsPurchased = [];
    while (success) {
        success = false;
        const augmentsToDelete = [];
        for (const augment of augmentsToBuy) {
            const result = ns.singularity.purchaseAugmentation(augment.factionName, augment.augmentName);
            success ||= result;
            if (result) {
                augmentsToDelete.push(augment);
                augmentsPurchased.push(augment);
            }
        }

        // Buy neuroflux governors
        if (doBuyNeuroGov && maxRepFaction != "") {
            // Purchase rep if possible and needed to buy neuroflux
            if (maxFavor >= ns.getFavorToDonate()) {
                // Update player (for money available)
                player = ns.getPlayer();
                const curPurchaseRep = ns.singularity.getFactionRep(purchaseFaction);
                const neededRep = curPurchaseRep - ns.singularity.getAugmentationRepReq(neurofluxGovernor);
                if (neededRep > 0) {
                    const neededMoney = neededMoneyForRep(ns, ns.singularity.getAugmentationRepReq(neurofluxGovernor), player)
                    const totalCost = neededMoney + ns.singularity.getAugmentationPrice(neurofluxGovernor);
                    if (totalCost <= player.money) {
                        ns.singularity.donateToFaction(purchaseFaction, neededMoney);
                        // TODO just for testing. Remove this when you have confidence
                        if (ns.singularity.getFactionRep(purchaseFaction) < ns.singularity.getAugmentationRepReq(neurofluxGovernor)) {
                            throw Error(`Didn't purchase the needed amount of rep (${ns.singularity.getFactionRep(purchaseFaction)} instead of ${ns.singularity.getAugmentationRepReq(neurofluxGovernor)}), double check money to rep formula`);
                        }
                    }
                }
            }
            const result = ns.singularity.purchaseAugmentation(purchaseFaction, neurofluxGovernor);
            success ||= result;
            if (result) {
                const augment: AugmentPurchase = {
                    augmentName: neurofluxGovernor,
                    factionName: purchaseFaction,
                    augmentPrice: -1
                }
                augmentsPurchased.push(augment)
            }
        }

        for (const augment of augmentsToDelete) {
            augmentsToBuy.splice(augmentsToBuy.findIndex((val) => val == augment), 1);
        }
    }

    ns.tprintf(`Augments purchased:`);
    for (const augment of augmentsPurchased) {
        ns.tprintf(`\t${Color.Blue}${augment.augmentName}`);
    }

    ns.tprintf(`Failed to purchase:`);
    for (const augment of augmentsToBuy) {
        ns.tprintf(`\t${Color.Red}${augment.augmentName}`);
    }
}

export async function main(ns: NS) {
    let doBuyNeuroGov = true;
    if (ns.args.length == 1) {
        doBuyNeuroGov = String(ns.args[0]) == "1";
    }
    buyAugments(ns, doBuyNeuroGov);
}