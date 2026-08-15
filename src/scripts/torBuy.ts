import { NS } from "@ns";

export function torBuy(ns: NS, verbose = false) {
    if (ns.singularity.purchaseTor()) {
        const programs = ns.singularity.getDarkwebPrograms();
        for (const program of programs) {
            ns.singularity.purchaseProgram(program);
        }

        if (verbose) {
            for (const program of programs) {
                const cost = ns.singularity.getDarkwebProgramCost(program)
                if (cost == 0) {
                    ns.tprintf(`Purchased ${program}`);
                } else {
                    ns.tprintf(`${program}: ${cost}`);
                }
            }
        }
    } else {
        if (verbose) {
            ns.tprintf(`Can't purchase tor router`);
        }
    }
}

export async function main(ns: NS) {
    if (ns.args.length == 1) {
        torBuy(ns, ns.args[0] == "1" ? true : false);
    } else {
        torBuy(ns);
    }
}