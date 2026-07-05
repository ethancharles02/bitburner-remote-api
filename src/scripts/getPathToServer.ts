import { NS } from "@ns";

/**
 * @param {AutocompleteData} data - context about the game, useful when autocompleting
 * @param {string[]} args - current arguments, not including "run script.js"
 * @returns {string[]} - the array of possible autocomplete options
 */
export function autocomplete(data: AutocompleteData, args: string[]) {
    return data.servers;
}

/**
 * Finds the path to the given server and returns an ordered list to it
 * @param {NS} ns
 * @param {string} target - Target server host name
 * @returns {list<string>} List of servers
 * */
export function getPathToServer(ns: NS, target: string) {
    if (!ns.serverExists(target)) {
        return [];
    }
    // TODO Set up autocomplete for the cn function so we can autocomplete servers?
    const startTarget = "home";
    const helper = function (curServer: string, parentServer: string): Array<string> {
        if (curServer == target) {
            return [curServer];
        }
        let servers = ns.scan(curServer);
        // Remove parent server
        servers = servers.filter(item => item != parentServer);

        let newServers = [];
        for (const server of servers) {
            newServers = helper(server, curServer);
            if (newServers.length > 0) {
                newServers.splice(0, 0, curServer);
                return newServers;
            }
        }

        return [];
    }
    return helper(startTarget, "")
}

export function createJoinString(serverList: string[]): string {
    let connectString = "";
    for (const server of serverList) {
        connectString += "connect " + server + ";";
    }
    return connectString
}

/** @param {NS} ns */
export async function main(ns: NS) {
    const serverTarget = String(ns.args[0]);
    const pathList = getPathToServer(ns, serverTarget);
    const connectString = createJoinString(pathList);
    navigator.clipboard.writeText(connectString);
    ns.tprint(connectString);
    ns.tprint("Added to clipboard");
}