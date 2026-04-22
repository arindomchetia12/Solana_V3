import { getMarketFeatures } from "./ai/features.js";
import { decideRoute } from "./ai/decisionEngine.js";
import { getQuote, getSwapTx } from "./execution/jupiter.js";
import { executeSwap } from "./execution/swap.js";

async function main() {
    console.log("--- AI Solana Router CLI Test ---");
    const priceBefore = 100;
    const priceNow = 95;

    const features = getMarketFeatures(priceNow, priceBefore);
    const decision = decideRoute(features);

    console.log("AI Decision:", decision);

    const inputMint = "So11111111111111111111111111111111111111112"; // SOL
    const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // USDC

    try {
        const quote = await getQuote(
            inputMint,
            outputMint,
            10000000,
            decision.slippageBps
        );

        console.log("Quote received successfully");

        // Use a dummy public key for testing the transaction creation
        const swapData = await getSwapTx(quote, "EsV5Wpn2mCs6RNjW6na62BAGFutwWZQunE8KL6sF3iN7");
        
        await executeSwap(swapData.swapTransaction);
        console.log("Transaction successfully built and ready for signing.");
    } catch (error) {
        console.error("CLI Test Error:", error.message);
    }
}

main();