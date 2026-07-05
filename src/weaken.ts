import { NS } from "@ns";

export async function main(ns: NS) {
    const target = String(ns.args[0]);
    let additionalMsec = 0;
    if (ns.args.length == 2) {
        additionalMsec = Number(ns.args[1]);
    }
    await ns.weaken(target, { additionalMsec: additionalMsec });
}