import { NS } from "@ns";

export function buyCloudServers(ns: NS, isVerbose = false) {
    // Buy all possible servers first
    while (ns.cloud.purchaseServer("cloud", 2) != "");

    const ramLimit = ns.cloud.getRamLimit()
    let upgradeSuccessful = true;
    while (upgradeSuccessful) {
        upgradeSuccessful = false;
        for (const server of ns.cloud.getServerNames()) {
            const serverRam = ns.getServer(server).maxRam;
            if (serverRam != ramLimit) {
                const result = ns.cloud.upgradeServer(server, serverRam * 2);
                upgradeSuccessful ||= result;
            }
        }
    }

    if (isVerbose) {
        ns.tprintf(`Current Cloud Server Status:`)
        for (const server of ns.cloud.getServerNames()) {
            ns.tprintf(`\t${server}: ${ns.getServer(server).maxRam}`);
        }
    }
}

export async function main(ns: NS) {
    buyCloudServers(ns, true);
}