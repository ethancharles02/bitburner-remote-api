/**
 * Global type extensions for BitBurner
 * These augment the global namespace with BitBurner-specific APIs
 */

declare global {
  /**
   * AutocompleteData interface for script autocomplete functions
   */
  interface AutocompleteData {
    /**
     * All server hostnames.
     *
     * Some servers are hidden until you satisfy their requirements. This array does not contain those servers if you do
     * not satisfy their requirements.
     */
    servers: string[];
    /** All scripts on the current server */
    scripts: string[];
    /** All text files on the current server */
    txts: string[];
    /** Netscript Enums */
    enums: NSEnums;
    /** Parses the flags schema on the already inputted flags */
    flags(schema: [string, string | number | boolean | string[]][]): { [key: string]: ScriptArg | string[] };
    /** The hostname of the server the script would be running on */
    hostname: string;
    /** The filename of the script about to be run */
    filename: string;
    /** The processes running on the host */
    processes: ProcessInfo[];
    /**
     * The raw command string that you have typed until you press [Tab] to use the autocomplete feature.
     *
     * For example, if you type `[Space]run test.js[Space][Space][Space][Press tab to use autocomplete]`, "command" will
     * contain all space characters (1 space character before "run" and 3 space characters after ".js").
     */
    command: string;
  }

  /**
   * BitBurner Set extensions
   */
  interface Set<T> {
    /** Returns a new set containing this set and all values from the provided iterable. */
    union(other: Iterable<T>): Set<T>;
  }
}

export {};
