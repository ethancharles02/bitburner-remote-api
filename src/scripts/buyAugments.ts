import { FactionName, NS } from "@ns";
import { factionNames } from "/scripts/factions/factionJoiner"

export const neurofluxGovernor = "NeuroFlux Governor";

type AugmentPurchase = {
    readonly factionName: FactionName;
    readonly augmentName: string;
    readonly augmentPrice: number;
}

export function buyAugments(ns: NS, doBuyNeuroGov: boolean) {
    const player = ns.getPlayer();
    const ownedAugmentations = ns.singularity.getOwnedAugmentations(true);
    const augmentsToBuy: AugmentPurchase[] = [];
    let maxRepFaction = "";
    let maxRep = -Infinity;
    for (const factionName of Object.values(factionNames)) {
        const rep = ns.singularity.getFactionRep(factionName);
        if (rep > maxRep) {
            maxRepFaction = factionName;
            maxRep = rep;
        }
        if (player.factions.includes(factionName)) {
            const augmentations = ns.singularity.getAugmentationsFromFaction(factionName);
            for (const augmentation of augmentations) {
                if ((!ownedAugmentations.includes(augmentation) && augmentation != neurofluxGovernor)) {
                    augmentsToBuy.push({augmentName: augmentation, factionName: factionName, augmentPrice: ns.singularity.getAugmentationPrice(augmentation)})
                }
            }
        }
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

        // TODO when buying, have it purchase rep if possible
        // Buy neuroflux governors
        if (doBuyNeuroGov && maxRepFaction != "") {
            const result = ns.singularity.purchaseAugmentation(maxRepFaction as FactionName, neurofluxGovernor);
            success ||= result;
            if (result) {
                const augment: AugmentPurchase = {
                    augmentName: neurofluxGovernor,
                    factionName: maxRepFaction as FactionName,
                    augmentPrice: -1
                }
                augmentsPurchased.push(augment)
            }
        }

        for (const augment of augmentsToDelete) {
            augmentsToBuy.splice(augmentsToBuy.findIndex((val) => val == augment), 1);
        }
    }

    const blue = "\u001b[38;2;100;100;255m";
    const red = "\u001b[38;2;255;0;0m";

    ns.tprintf(`Augments purchased:`);
    for (const augment of augmentsPurchased) {
        ns.tprintf(`\t${blue}${augment.augmentName}`);
    }

    ns.tprintf(`Failed to purchase:`);
    for (const augment of augmentsToBuy) {
        ns.tprintf(`\t${red}${augment.augmentName}`);
    }
}

export async function main(ns: NS) {
    let doBuyNeuroGov = true;
    if (ns.args.length == 1) {
        doBuyNeuroGov = String(ns.args[0]) == "1";
    }
    buyAugments(ns, doBuyNeuroGov);
}