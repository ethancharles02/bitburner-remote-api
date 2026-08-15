import { NS } from "@ns";
import { batchFile, hackAndGetAllAccessServers } from "/scripts/helpers";

export function killBatches(ns: NS, host = "") {
    if (host == "") {
        for (const server of ["home", ...hackAndGetAllAccessServers(ns, true, true)]) {
            killBatches(ns, server);
        }
    } else {
        ns.scriptKill(batchFile.hack, host);
        ns.scriptKill(batchFile.weaken, host);
        ns.scriptKill(batchFile.grow, host);
    }
}

export async function safeKillBatches(ns: NS, secondBuffer = 10) {
    ns.scriptKill(batchFile.smartHackBatcher, "home");
    ns.scriptKill(batchFile.smartHack, "home");
    for (const server of ["home", ...hackAndGetAllAccessServers(ns, true, true)]) {
        ns.scriptKill(batchFile.hack, server);
    }
    // Wait 10 seconds to give time for some weakens and grows to run to put the server back
    await ns.sleep(1000 * secondBuffer);
    killBatches(ns);
}

export async function main(ns: NS) {
    let doSafeKill = false;
    if (ns.args.length == 1) {
        doSafeKill = Boolean(ns.args[0]);
    }
    if (doSafeKill) {
        const secondBuffer = 10;
        ns.tprint(`Ending batches, please wait ${secondBuffer} seconds.`);
        await safeKillBatches(ns, secondBuffer);
        ns.tprint(`Batches ended`);
    } else {
        killBatches(ns);
    }
}