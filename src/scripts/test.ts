import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
    ns.run("/scripts/smartHack.js", 1, 0, 0.2, "home", 0, "target", "home", "home2", 10, 20)
}