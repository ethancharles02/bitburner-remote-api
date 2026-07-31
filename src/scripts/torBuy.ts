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
                    ns.tprint(`Purchased ${program}`);
                } else {
                    ns.tprint(`${program}: ${cost}`);
                }
            }
        }
    } else {
        if (verbose) {
            ns.tprint("Can't purchase tor router");
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