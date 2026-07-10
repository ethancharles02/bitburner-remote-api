import { NS } from "@ns";

export class ScriptRunner {
    scriptsRamCost: Record<string, number>;
    hostname: string;
    allottedRam: number;
    ns: NS;
    availableRam: number;
    // PID -> Ram Usage
    runningScripts: Record<string, number>;

    /**
     * @param {NS} ns
     * @param {string} hostname Name of host who will be running scripts
     * */
    constructor(ns: NS, hostname: string, allottedRam: number | undefined = undefined) {
        this.scriptsRamCost = {};
        this.hostname = hostname;
        this.allottedRam = allottedRam ?? ns.getServerMaxRam(hostname);

        this.runningScripts = {};
        this.ns = ns;

        this.availableRam = 0;
        this.refreshAvailableRam();
    }

    refreshAvailableRam() {
        let totalramUsed = 0;
        const pidsToDelete: number[] = [];
        for (const [pid, ramUsed] of Object.entries(this.runningScripts)) {
            const numPid = Number(pid);
            if (this.ns.isRunning(numPid)) {
                totalramUsed += ramUsed;
            } else {
                pidsToDelete.push(numPid);
            }
        }

        for (const pid of pidsToDelete) {
            delete this.runningScripts[pid];
        }

        this.availableRam = this.allottedRam - totalramUsed;
    }

    /**
     * Adds a script to the script runner (downloading it if necessary)
     * @param {string} scriptPath Script name
     * @param {bool} downloadScript Downloads the script to the server if the script isn't found
     * @param {bool} refreshScript Forcibly redownloads the script to the server
     * @returns {bool} If script was successfully added
     * */
    addScript(scriptPath: string, downloadScript = true, refreshScript = true) {
        if (refreshScript) {
            if (this.ns.fileExists(scriptPath, "home")) {
                this.ns.scp(scriptPath, this.hostname, "home");
            } else {
                this.ns.print("Couldn't find script: %s to refresh", scriptPath);
                return false;
            }
        }

        if (!this.ns.fileExists(scriptPath, this.hostname)) {
            if (downloadScript && this.ns.fileExists(scriptPath, "home")) {
                this.ns.scp(scriptPath, this.hostname, "home");
            } else {
                this.ns.print("No file found with path: %s on host: %s", scriptPath, this.hostname)
                return false;
            }
        }

        this.scriptsRamCost[scriptPath] = this.ns.getScriptRam(scriptPath, this.hostname);
        this.ns.printf("ramCost: %f", this.scriptsRamCost[scriptPath]);
        return true;
    }

    getMaxThreadsForScript(scriptPath: string) {
        if (!(scriptPath in this.scriptsRamCost)) {
            throw Error("Script not found in scripts object");
        }
        return Math.floor(this.availableRam / this.scriptsRamCost[scriptPath]);
    }

    /**
     * Runs a script with the given number of threads
     * @param {string} scriptPath Script name
     * @param {int} numThreads Number of threads to use. If -1, uses all available RAM
     * @param {list<string>} scriptArgs Args to pass to script
     * @returns {number} PID of script. 0 if the script couldn't be run
     * */
    runScript(scriptPath: string, numThreads: number, ...scriptArgs: Array<string>) {
        if (!(scriptPath in this.scriptsRamCost)) {
            this.ns.printf("Script wasn't added: %s", scriptPath);
            return 0;
        }
        if (numThreads == -1) {
            numThreads = this.getMaxThreadsForScript(scriptPath);
        }
        if (numThreads <= 0) {
            this.ns.printf("Not enough ram available for any threads: %s", scriptPath);
            return 0;
        }
        const pid = this.ns.exec(scriptPath, this.hostname, { threads: numThreads }, ...scriptArgs);
        this.runningScripts[pid] = this.scriptsRamCost[scriptPath] * numThreads;
        return pid;
    }
}

export class ScriptRunnerManager {
    ns: NS;
    hosts: Record<string, ScriptRunner>;

    /**
     * @param {NS} ns
     * */
    constructor(ns: NS) {
        this.ns = ns;
        /** @type {Object<string, ScriptRunner>} */
        this.hosts = {};
    }

    /**
     * Adds a possible host to run scripts from
     * @param {string} hostname Server to host from
     * @param {bool} downloadScript Downloads the script to the server if the script isn't found
     * @param {bool} refreshScript Forcibly redownloads the script to the server
     * @returns {bool} If script was successfully added
     * */
    addHost(hostname: string, allottedRam: number | undefined = undefined) {
        if (!this.ns.serverExists(hostname)) {
            this.ns.printf("Couldn't find server with name: %s", hostname);
        }

        this.hosts[hostname] = new ScriptRunner(this.ns, hostname, allottedRam);
    }

    invalidHostname(hostname: string) {
        this.ns.printf("Couldn't find hostname in hosts: %s", hostname);
        throw Error("No Hostname. See log");
    }

    getThreadsAvailableObj(scriptPath: string): Record<string, number> {
        const threadsAvailable: Record<string, number> = {};
        for (const [hostname, scriptRunner] of Object.entries(this.hosts)) {
            scriptRunner.refreshAvailableRam();
            threadsAvailable[hostname] = scriptRunner.getMaxThreadsForScript(scriptPath);
        }
        return threadsAvailable
    }

    /**
     * Gets the total number of threads a server can run on a script
     * @param {string} scriptPath Script name
     * @param {string} hostname Server to host from. "" to return value for all hosts total
     * @returns {int} Number of threads that is possible from this script
     * */
    getPossibleThreads(scriptPath: string, hostname: string): number {
        if (hostname == "") {
            let totalThreads = 0;
            for (const [_, scriptRunner] of Object.entries(this.hosts)) {
                scriptRunner.refreshAvailableRam();
                totalThreads += scriptRunner.getMaxThreadsForScript(scriptPath);
            }
            return totalThreads
        } else if (hostname in this.hosts) {
            this.hosts[hostname].refreshAvailableRam();
            return this.hosts[hostname].getMaxThreadsForScript(scriptPath);
        } else {
            this.invalidHostname(hostname);
            return 0;
        }
    }

    /**
     * Adds a script to the given hostname or all available hosts
     * @param {string} scriptPath Script name
     * @param {bool} downloadScript Downloads the script to the server if the script isn't found
     * @param {bool} refreshScript Forcibly redownloads the script to the server
     * @param {string} hostname Hostname to add script to ("" for all hosts)
     * @returns {bool} If script was successfully added
     * */
    addScript(scriptPath: string, downloadScript = true, refreshScript = true, hostname = ""): boolean {
        if (hostname == "") {
            for (const [_, scriptRunner] of Object.entries(this.hosts)) {
                scriptRunner.addScript(scriptPath, downloadScript, refreshScript);
            }
        } else if (hostname in this.hosts) {
            this.hosts[hostname].addScript(scriptPath, downloadScript, refreshScript);
        } else {
            this.invalidHostname(hostname);
        }
        return true;
    }

    /**
     * Runs a script with the given number of threads
     * @param {string} scriptPath Script name
     * @param {string} hostname Host name to use. Use "" for all hosts
     * @param {boolean} limitToOneHost If using "" for hostname, this will prevent the script from being distributed across multiple hosts to meet the thread count
     * @param {int} numThreads Number of threads to use. If -1, uses all available RAM
     * @param {list<string>} scriptArgs Args to pass to script
     * @returns {list<number>} PID of script. 0 if the script couldn't be run
     * */
    async runScript(scriptPath: string, hostname: string, limitToOneHost: boolean, numThreads: number, awaitFinish: boolean, ...scriptArgs: Array<string>) {
        const runningIds = [];
        let isScriptRun = false;
        if (hostname == "") {
            for (const [_, scriptRunner] of Object.entries(this.hosts)) {
                if (numThreads == 0) {
                    break;
                }

                scriptRunner.refreshAvailableRam();
                const maxThreads = scriptRunner.getMaxThreadsForScript(scriptPath);
                if (maxThreads == 0) {
                    continue;
                }

                let usedThreads = -1;
                if (numThreads == -1) {
                    usedThreads = maxThreads;
                } else {
                    usedThreads = Math.min(numThreads, maxThreads);
                    if (limitToOneHost && usedThreads != numThreads) {
                        continue;
                    }
                    numThreads -= usedThreads;
                }

                this.ns.printf("Script path: %s, num threads: %d, script cost: %f, available ram: %f", scriptPath, usedThreads, scriptRunner.scriptsRamCost[scriptPath], scriptRunner.availableRam);
                runningIds.push(scriptRunner.runScript(scriptPath, usedThreads, ...scriptArgs));
                isScriptRun = true;

                if (limitToOneHost) {
                    break;
                }
            }
        } else if (hostname in this.hosts) {
            runningIds.push(this.hosts[hostname].runScript(scriptPath, numThreads, ...scriptArgs));
            isScriptRun = true;
        } else {
            this.invalidHostname(hostname);
        }

        if (!isScriptRun) {
            this.ns.printf("Unable to find host to run: %s with num threads: %d", scriptPath, numThreads);
            throw Error("Couldn't find a host to run the script. See log.");
        }

        if (!awaitFinish) {
            return runningIds;
        } else {
            while (runningIds.some(id => this.ns.isRunning(id))) {
                await this.ns.sleep(100);
            }
            return [];
        }
    }
}