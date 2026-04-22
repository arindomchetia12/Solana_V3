import { VersionedTransaction } from "@solana/web3.js";
import { connection } from "../config/solana.js";

export async function executeSwap(txBase64) {
    const tx = VersionedTransaction.deserialize(
        Buffer.from(txBase64, "base64")
    );

    console.log("Transaction ready (NOT signed):", tx);
}