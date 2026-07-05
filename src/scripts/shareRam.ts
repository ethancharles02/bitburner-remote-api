import { NS } from "@ns";
import { hackAndGetAllAccessServers } from "/scripts/helpers.js";
import { ScriptRunnerManager } from "/scripts/scriptRunner.js";

export async function main(ns: NS) {
    const servers = hackAndGetAllAccessServers(ns);
    const additionalAllottedRam = 16;

    const scriptRunnerManager = new ScriptRunnerManager(ns);
    scriptRunnerManager.addHost("home", additionalAllottedRam);
    // When running multiple cores,
    for (const server of servers) {
        scriptRunnerManager.addHost(server, 0);
    }
    scriptRunnerManager.addScript("share.ts", true, true);

    while (true) {
        await scriptRunnerManager.runScript("share.ts", "", false, -1, true)
    }
}