import { NS } from "@ns";

import { getSortedLucrativeServers } from "/scripts/helpers.js";

export async function main(ns: NS) {
    ns.disableLog("sleep");
    const batchResetTimeMs = 1000 * 60 * 30;
    const amountToHack = 0.026;
    // const targetBufferTime = 1000;
    const bufferTimeLimitMs = 500;

    const ids = [];
    const additionalAllottedRam = 8;
    while (true) {
        const targets = getSortedLucrativeServers(ns);

        ids.push(ns.run("/scripts/smartHack.js", 1, additionalAllottedRam, batchResetTimeMs, 0.1, "home", bufferTimeLimitMs, targets[0], "home"));
        ids.push(ns.run("/scripts/smartHack.js", 1, 0, batchResetTimeMs, 0.9, "", bufferTimeLimitMs, targets[1], ...targets));

        while (ids.some(id => ns.isRunning(id))) {
            await ns.sleep(50);
        }
    }
}