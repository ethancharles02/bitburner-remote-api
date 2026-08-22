import { NS } from "@ns";

// NOTES:
// The type of password security appears to be based on the model:
// CloudBlare(tm): "Type the numbers to prove you are human"
// DeskMemo_3.1: "The secret hint is {password}" (Seems like you can just split the last part of the string and make that the password)
// BellaCuore: The password is the value of the number 'CCCLXX' (ie. Roman numeral: 370)
// OctantVoxel: Hint: the password is the base 12 number 38 in base 10
// ZeroLogon: No password
// FreshInstall_1.0: Hint: I never changed the password ("password". Sometimes the length is numeric 5 so it may be different defaults "12345")
// Pr0verFl0: (alphanumeric)Hint: Warning: password buffer is 6 bytes

// Hint: It's the dog's name
// Length: 3
// Format: alphabetic
// Model: Laika4

export async function main(ns: NS) {
    // let doBuyNeuroGov = true;
    // if (ns.args.length == 1) {
    //     doBuyNeuroGov = String(ns.args[0]) == "1";
    // }
    // buyAugments(ns, doBuyNeuroGov);
}