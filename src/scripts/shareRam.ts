import { NS } from "@ns";
import { hackAndGetAllAccessServers } from "/scripts/helpers.js";
import { ScriptRunnerManager } from "/scripts/scriptRunner.js";

export async function main(ns: NS) {
    const servers = hackAndGetAllAccessServers(ns);
    const reservedRam = 128;

    const scriptRunnerManager = new ScriptRunnerManager(ns);
    scriptRunnerManager.addHost("home", ns.getServerMaxRam("home") - reservedRam);
    // When running multiple cores,
    for (const server of servers) {
        scriptRunnerManager.addHost(server);
    }
    scriptRunnerManager.addScript("share.ts", true, true);

    while (true) {
        await scriptRunnerManager.runScript("share.ts", "", false, -1, true)
    }
}