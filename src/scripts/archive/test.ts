import { NS } from "@ns";

import { hackAndGetAllAccessServers } from "/scripts/helpers";

export async function main(ns: NS): Promise<void> {
    for (const server of hackAndGetAllAccessServers(ns)) {
        ns.tprintf(`${server}: ${ns.getServer(server).cpuCores}`);
    }
}