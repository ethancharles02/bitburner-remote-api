import { NS } from "@ns";

export function upgradeComputer(ns: NS) {
    while (ns.singularity.upgradeHomeRam());
    while (ns.singularity.upgradeHomeCores());
}

export async function main(ns: NS) {
    upgradeComputer(ns);
}