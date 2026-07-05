import { NS } from "@ns";
import { hackAndGetAllAccessServers } from "/scripts/helpers.js";
import { getPathToServer, createJoinString } from "/scripts/getPathToServer.js";

export async function main(ns: NS) {
    ns.disableLog("sleep");
    const servers = [
        "CSEC",
        "avmnite-02h",
        "I.I.I.I",
        "run4theh111z"
    ];

    const allAccessibleServers = hackAndGetAllAccessServers(ns);

    for (const server of servers) {
        if (allAccessibleServers.has(server) && !ns.getServer(server).backdoorInstalled) {
            let factionJoinString = "";
            const pathList = getPathToServer(ns, server);
            factionJoinString += createJoinString(pathList);
            factionJoinString += "backdoor;";
            navigator.clipboard.writeText(factionJoinString);
            ns.tprint(factionJoinString);
            ns.tprint("Added to clipboard");

            while (!ns.getServer(server).backdoorInstalled) {
                await ns.sleep(1000);
            }
        }
    }

    ns.tprint("\nFaction join script finished running\n")
}