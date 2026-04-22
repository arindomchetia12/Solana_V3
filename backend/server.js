import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSwapOrder } from './execution/jupiter.js';
import { getPredictiveParams } from './ai/predictiveEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 5000;

// In-memory transaction history for demo
const txHistory = [];

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);

    // ──────────────────────────────────────────────
    // POST /api/smart-swap  (single atomic endpoint)
    // ──────────────────────────────────────────────
    if (url.pathname === '/api/smart-swap' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const { inputMint, outputMint, amount, userPublicKey } = JSON.parse(body);

                console.log(`\n═══ Smart Swap Request ═══`);
                console.log(`  User: ${userPublicKey}`);
                console.log(`  ${inputMint?.slice(0,8)}... → ${outputMint?.slice(0,8)}...`);
                console.log(`  Amount: ${amount}`);

                // 1. AI Predictive Analysis
                const aiParams = await getPredictiveParams(inputMint, outputMint);
                console.log(`  AI Slippage: ${aiParams.slippageBps} bps | Network: ${aiParams.networkStatus}`);

                // 2. Get Jupiter V2 Order (includes transaction)
                const result = await getSwapOrder(inputMint, outputMint, amount, aiParams.slippageBps, userPublicKey);

                // 3. Record in transaction history
                txHistory.unshift({
                    id: result.orderInfo.requestId || Date.now().toString(),
                    time: new Date().toISOString(),
                    inputMint,
                    outputMint,
                    inAmount: result.orderInfo.inAmount,
                    outAmount: result.orderInfo.outAmount,
                    inUsd: result.orderInfo.inUsdValue,
                    outUsd: result.orderInfo.outUsdValue,
                    slippage: aiParams.slippageBps,
                    priceImpact: result.orderInfo.priceImpactPct,
                    router: result.orderInfo.router,
                    status: 'pending'
                });
                if (txHistory.length > 50) txHistory.pop();

                console.log(`  ✅ Order ready — returning transaction to frontend`);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    transaction: result.transaction,
                    aiParams,
                    orderInfo: result.orderInfo
                }));
            } catch (err) {
                console.error(`  ❌ Smart Swap Error: ${err.message}`);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // ──────────────────────────────────────────────
    // GET /api/ai-analysis
    // ──────────────────────────────────────────────
    if (url.pathname === '/api/ai-analysis') {
        try {
            const aiParams = await getPredictiveParams();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(aiParams));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // ──────────────────────────────────────────────
    // GET /api/tx-history
    // ──────────────────────────────────────────────
    if (url.pathname === '/api/tx-history') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(txHistory));
        return;
    }

    // ──────────────────────────────────────────────
    // Health check
    // ──────────────────────────────────────────────
    if (url.pathname === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
        return;
    }

    // Static fallback
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Solana AI Router Backend`);
    console.log(`   http://127.0.0.1:${PORT}`);
    console.log(`   Endpoints:`);
    console.log(`     POST /api/smart-swap`);
    console.log(`     GET  /api/ai-analysis`);
    console.log(`     GET  /api/tx-history`);
    console.log(`     GET  /api/health\n`);
});
