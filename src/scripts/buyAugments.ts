import { FactionName, NS } from "@ns";
import { factionNames } from "/scripts/factions/factionJoiner"

export const neurofluxGovernor = "NeuroFlux Governor";

type AugmentPurchase = {
    readonly factionName: FactionName;
    readonly augmentName: string;
    readonly augmentPrice: number;
}

export function buyAugments(ns: NS, doFilter: boolean) {
    const player = ns.getPlayer();
    const ownedAugmentations = ns.singularity.getOwnedAugmentations(true);
    const augmentsToBuy: AugmentPurchase[] = [];
    for (const factionName of Object.values(factionNames)) {
        if (player.factions.includes(factionName)) {
            const augmentations = ns.singularity.getAugmentationsFromFaction(factionName);
            for (const augmentation of augmentations) {
                if ((!ownedAugmentations.includes(augmentation) || augmentation == neurofluxGovernor) && (augmentation != neurofluxGovernor || !doFilter)) {
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
                if (augment.augmentName != neurofluxGovernor) {
                    augmentsToDelete.push(augment);
                }
                augmentsPurchased.push(augment);
            }
        }

        for (const augment of augmentsToDelete) {
            augmentsToBuy.splice(augmentsToBuy.findIndex((val) => val == augment), 1);
        }
    }

    const blue = "\u001b[38;2;100;100;255m";
    const red = "\u001b[38;2;255;0;0m";

    ns.tprintf("Augments purchased:");
    for (const augment of augmentsPurchased) {
        ns.tprintf(`\t${blue}${augment.augmentName}`);
    }

    ns.tprintf("Failed to purchase:");
    for (const augment of augmentsToBuy) {
        ns.tprintf(`\t${red}${augment.augmentName}`);
    }
}

export async function main(ns: NS) {
    let doFilter = true;
    if (ns.args.length == 1) {
        doFilter = String(ns.args[0]) == "1";
    }
    buyAugments(ns, doFilter);
}