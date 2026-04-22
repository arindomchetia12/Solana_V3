import fetch from "node-fetch";
import { Connection, VersionedTransaction, TransactionMessage, AddressLookupTableAccount, PublicKey, TransactionInstruction } from "@solana/web3.js";

const JUPITER_BASE = "https://api.jup.ag";

/**
 * Converts a Jupiter instruction JSON to a TransactionInstruction
 */
function jsonToInstruction(json) {
    if (!json) return null;
    try {
        if (!json.programId) throw new Error("Missing programId in instruction");
        
        return new TransactionInstruction({
            programId: new PublicKey(json.programId),
            keys: (json.accounts || []).map(a => {
                if (!a.pubkey) throw new Error("Missing pubkey in instruction account");
                return {
                    pubkey: new PublicKey(a.pubkey),
                    isSigner: !!a.isSigner,
                    isWritable: !!a.isWritable,
                };
            }),
            data: Buffer.from(json.data || "", "base64"),
        });
    } catch (e) {
        console.error("[Jupiter V2] Error parsing instruction:", json);
        throw e;
    }
}

/**
 * Gets a complete swap order from Jupiter V2.
 */
export async function getSwapOrder(inputMint, outputMint, amount, slippageBps, userPublicKey) {
    const rpcUrl = "https://api.mainnet-beta.solana.com"; // Use a stable RPC
    const connection = new Connection(rpcUrl, "confirmed");

    // ── Step 1: Try /order first ──
    const orderUrl = `${JUPITER_BASE}/swap/v2/order?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}&userPublicKey=${userPublicKey}`;
    console.log(`[Jupiter V2] Trying /order: ${orderUrl}`);

    const orderRes = await fetch(orderUrl);
    if (!orderRes.ok) {
        const text = await orderRes.text();
        throw new Error(`Jupiter /order error (${orderRes.status}): ${text}`);
    }

    const order = await orderRes.json();
    console.log(`[Jupiter V2] /order response — router: ${order.router}, mode: ${order.mode}`);

    // If /order returned a base64 transaction string, use it directly
    if (typeof order.transaction === "string" && order.transaction.length > 20) {
        console.log(`[Jupiter V2] ✅ Got transaction from /order`);
        return { transaction: order.transaction, orderInfo: order };
    }

    // ── Step 2: Fallback to /build ──
    console.log(`[Jupiter V2] /order transaction is null. Using /build fallback...`);
    
    // V2 /build expects 'taker' instead of 'userPublicKey' sometimes, but 'taker' is required for the build logic
    const buildUrl = `${JUPITER_BASE}/swap/v2/build?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}&taker=${userPublicKey}`;
    const buildRes = await fetch(buildUrl);
    
    if (!buildRes.ok) {
        const text = await buildRes.text();
        throw new Error(`Jupiter /build error (${buildRes.status}): ${text}`);
    }

    const buildData = await buildRes.json();
    
    // Assemble the transaction instructions
    const instructions = [];

    // 1. Compute Budget
    if (buildData.computeBudgetInstructions) {
        buildData.computeBudgetInstructions.forEach(ix => {
            const parsed = jsonToInstruction(ix);
            if (parsed) instructions.push(parsed);
        });
    }

    // 2. Setup
    if (buildData.setupInstructions) {
        buildData.setupInstructions.forEach(ix => {
            const parsed = jsonToInstruction(ix);
            if (parsed) instructions.push(parsed);
        });
    }

    // 3. Swap
    if (buildData.swapInstruction) {
        const parsed = jsonToInstruction(buildData.swapInstruction);
        if (parsed) instructions.push(parsed);
    }

    // 4. Cleanup
    if (buildData.cleanupInstruction) {
        const parsed = jsonToInstruction(buildData.cleanupInstruction);
        if (parsed) instructions.push(parsed);
    }

    // 5. Other
    if (buildData.otherInstructions) {
        buildData.otherInstructions.forEach(ix => {
            const parsed = jsonToInstruction(ix);
            if (parsed) instructions.push(parsed);
        });
    }

    // 6. Tip
    if (buildData.tipInstruction) {
        const parsed = jsonToInstruction(buildData.tipInstruction);
        if (parsed) instructions.push(parsed);
    }

    // Get blockhash
    const { blockhash } = await connection.getLatestBlockhash();

    // Load Lookup Tables
    const lookupTables = [];
    if (buildData.addressesByLookupTableAddress) {
        const tableAddresses = Object.keys(buildData.addressesByLookupTableAddress);
        console.log(`[Jupiter V2] Loading ${tableAddresses.length} lookup tables...`);
        
        const responses = await Promise.all(
            tableAddresses.map(addr => connection.getAddressLookupTable(new PublicKey(addr)))
        );
        
        responses.forEach(res => {
            if (res.value) lookupTables.push(res.value);
        });
    }

    // Compile message
    const messageV0 = new TransactionMessage({
        payerKey: new PublicKey(userPublicKey),
        recentBlockhash: blockhash,
        instructions,
    }).compileToV0Message(lookupTables);

    const versionedTx = new VersionedTransaction(messageV0);
    const txBase64 = Buffer.from(versionedTx.serialize()).toString("base64");

    console.log(`[Jupiter V2] ✅ Assembled transaction (${txBase64.length} chars)`);

    return {
        transaction: txBase64,
        orderInfo: {
            ...order, // use order info for metadata
            inAmount: buildData.inAmount || order.inAmount,
            outAmount: buildData.outAmount || order.outAmount,
        }
    };
}