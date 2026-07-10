import { NS } from "@ns";

/**
 * Opens all possible ports on a target and nukes them
 * */
export function openTarget(ns: NS, target: string): boolean {
    const portScripts = {
        "BruteSSH.exe": ns.brutessh,
        "FTPCrack.exe": ns.ftpcrack,
        "relaySMTP.exe": ns.relaysmtp,
        "HTTPWorm.exe": ns.httpworm,
        "SQLInject.exe": ns.sqlinject
    };

    for (const [portScriptName, portScriptFunc] of Object.entries(portScripts)) {
        if (ns.fileExists(portScriptName, "home")) {
            portScriptFunc(target);
        }
    }

    return ns.nuke(target);
}

/**
 * Gets a list of all servers
 * */
export function getAllServers(ns: NS, startTarget: string, parentTarget = ""): Set<string> {
    const servers = new Set(ns.scan(startTarget));
    servers.delete(parentTarget);

    let newServers: Set<string> = new Set();
    for (const server of servers) {
        newServers = newServers.union(getAllServers(ns, server, startTarget));
    }

    return servers.union(newServers);
}

/**
 * Gets a list of all servers (after attempting to hack them) with root access
 * */
export function hackAndGetAllAccessServers(ns: NS): Set<string> {
    const hackedServers: Set<string> = new Set();
    for (const server of getAllServers(ns, "home")) {
        if (ns.getHackingLevel() >= ns.getServerRequiredHackingLevel(server)) {
            if (openTarget(ns, server)) {
                hackedServers.add(server);
            }
        }
    }

    return hackedServers;
}

/**
 * Gets a list of all servers (after attempting to hack them) with root access
 * */
export function getMaxMoneyServer(ns: NS) {
    const servers = hackAndGetAllAccessServers(ns);
    let curMoney = 0;
    let maxMoney = 0;
    let maxServer = "home";

    for (const server of servers) {
        curMoney = ns.getServerMaxMoney(server);
        if (curMoney > maxMoney) {
            maxMoney = curMoney;
            maxServer = server;
        }
    }

    return maxServer;
}

export function getSortedLucrativeServers(ns: NS) {
    const servers = [...hackAndGetAllAccessServers(ns)];
    let curVal = 0;
    const player = ns.getPlayer();
    const formulasExists = ns.fileExists("Formulas.exe");
    if (formulasExists) {
        ns.tprintf("Formulas Utility Estimation:");
    } else {
        ns.tprintf("Heuristic Utility Estimation:");
    }
    const serversValues: Record<string, number> = {};
    for (const server of servers) {
        if (formulasExists) {
            const mockServerObj = ns.getServer(server);
            mockServerObj.hackDifficulty = mockServerObj.minDifficulty;
            const moneyMax = mockServerObj.moneyMax ?? 0;
            mockServerObj.moneyAvailable = moneyMax;
            const hackPerc = ns.formulas.hacking.hackPercent(mockServerObj, player);
            const hackT = ns.formulas.hacking.hackTime(mockServerObj, player);
            const hackChance = ns.formulas.hacking.hackChance(mockServerObj, player);
            // Utility of server
            curVal = (hackPerc * moneyMax * hackChance) / hackT;
            // curVal = (hackPerc * moneyMax);
        } else {
            // Estimated utility of server
            curVal = ns.getServerMaxMoney(server) / ns.getServerMinSecurityLevel(server);
        }
        if (curVal > 0) {
            serversValues[server] = curVal;
        }
    }

    const sortedServers = Object.keys(serversValues).sort((a: string, b: string) => serversValues[b] - serversValues[a])
    for (const server of sortedServers) {
        ns.tprintf("\t%s: %f", server, serversValues[server]);
    }

    return sortedServers;
}

export function getMostLucrativeServer(ns: NS) {
    return getSortedLucrativeServers(ns)[0];
}

export async function main(ns: NS) {
    const server = getAllServers(ns, "home");
    ns.tprint(server);
}