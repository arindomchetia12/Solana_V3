import './App.css';
import { useState, useEffect, useCallback } from "react";
import { Connection, VersionedTransaction } from "@solana/web3.js";

const API = "http://127.0.0.1:5000";
const connection = new Connection("https://api.mainnet-beta.solana.com");

// Token registry
const TOKENS = {
  SOL:  { mint: "So11111111111111111111111111111111111111112",  symbol: "SOL",  name: "Solana",    decimals: 9, icon: "◎" },
  USDC: { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", symbol: "USDC", name: "USD Coin",  decimals: 6, icon: "$" },
  USDT: { mint: "Es9vMFrzaCERmJfrF4H2FYzV4mWwfvX2gYdExgkt1",     symbol: "USDT", name: "Tether",    decimals: 6, icon: "₮" },
};

function App() {
  // ── State ──
  const [wallet, setWallet] = useState(null);
  const [balance, setBalance] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [aiData, setAiData] = useState(null);
  const [networkData, setNetworkData] = useState(null);
  const [txHistory, setTxHistory] = useState([]);
  const [swapResult, setSwapResult] = useState(null);
  const [inputToken, setInputToken] = useState("SOL");
  const [outputToken, setOutputToken] = useState("USDC");
  const [amount, setAmount] = useState("0.05");
  const [statusMsg, setStatusMsg] = useState("");

  // ── Fetch AI network analysis on load ──
  useEffect(() => {
    const fetchAI = async () => {
      try {
        const res = await fetch(`${API}/api/ai-analysis`);
        if (res.ok) setNetworkData(await res.json());
      } catch (e) { console.warn("Backend not ready yet"); }
    };
    fetchAI();
    const interval = setInterval(fetchAI, 8000);
    return () => clearInterval(interval);
  }, []);

  // ── Fetch balance when wallet connects ──
  useEffect(() => {
    if (!wallet) return;
    const fetchBal = async () => {
      try {
        const bal = await connection.getBalance(new (await import("@solana/web3.js")).PublicKey(wallet));
        setBalance((bal / 1e9).toFixed(4));
      } catch { setBalance("—"); }
    };
    fetchBal();
    const i = setInterval(fetchBal, 15000);
    return () => clearInterval(i);
  }, [wallet]);

  // ── Wallet Connect ──
  const connectWallet = useCallback(async () => {
    try {
      const { solana } = window;
      if (!solana?.isPhantom) {
        window.open("https://phantom.app/", "_blank");
        return;
      }
      const resp = await solana.connect();
      setWallet(resp.publicKey.toString());
      setStatusMsg("Wallet connected securely");
      setTimeout(() => setStatusMsg(""), 3000);
    } catch (err) {
      setStatusMsg("Connection rejected");
      setTimeout(() => setStatusMsg(""), 3000);
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    window.solana?.disconnect();
    setWallet(null);
    setBalance(null);
    setAiData(null);
    setSwapResult(null);
    setStatusMsg("");
  }, []);

  // ── Execute Smart Swap ──
  const handleSwap = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    setSwapResult(null);
    setAiData(null);
    setStatusMsg("🧠 AI analyzing network & assembling TX...");

    try {
      const inToken = TOKENS[inputToken];
      const outToken = TOKENS[outputToken];
      const atomicAmount = Math.floor(parseFloat(amount) * Math.pow(10, inToken.decimals));

      // 1. Call our AI backend
      const res = await fetch(`${API}/api/smart-swap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputMint: inToken.mint,
          outputMint: outToken.mint,
          amount: atomicAmount.toString(),
          userPublicKey: wallet
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }

      const data = await res.json();
      setAiData(data.aiParams);
      setStatusMsg("✅ Assembly complete. Please sign in Phantom...");

      // 2. Deserialize & sign
      const txBuf = Buffer.from(data.transaction, "base64");
      const tx = VersionedTransaction.deserialize(txBuf);
      const signedTx = await window.solana.signTransaction(tx);

      setStatusMsg("📡 Broadcasting to Solana Mainnet...");

      // 3. Send
      const txid = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: true,
        maxRetries: 3
      });

      setSwapResult({
        txid,
        inAmount: data.orderInfo.inAmount,
        outAmount: data.orderInfo.outAmount,
        inUsd: data.orderInfo.inUsdValue || data.orderInfo.inUsd,
        outUsd: data.orderInfo.outUsdValue || data.orderInfo.outUsd,
        priceImpact: data.orderInfo.priceImpactPct || data.orderInfo.priceImpact,
        router: data.orderInfo.router
      });

      setTxHistory(prev => [{
        id: txid,
        time: new Date().toLocaleTimeString(),
        from: inputToken,
        to: outputToken,
        amount: amount,
        inUsd: data.orderInfo.inUsdValue || data.orderInfo.inUsd,
        status: "Confirmed"
      }, ...prev].slice(0, 20));

      setStatusMsg(`✅ Swap Confirmed! TX: ${txid.slice(0,8)}...`);
      setTimeout(() => setStatusMsg(""), 6000);
    } catch (err) {
      console.error("Swap error:", err);
      setStatusMsg(`❌ ${err.message}`);
      setTimeout(() => setStatusMsg(""), 6000);
    } finally {
      setLoading(false);
    }
  }, [wallet, inputToken, outputToken, amount]);

  // ── Swap token direction ──
  const flipTokens = () => {
    setInputToken(outputToken);
    setOutputToken(inputToken);
  };

  // Helper for network dots
  const getNetworkColor = (status) => {
    if (status === "Optimal") return "dot-green";
    if (status === "Busy") return "dot-yellow";
    return "dot-red";
  };
  const getNetworkTextColor = (status) => {
    if (status === "Optimal") return "text-green";
    if (status === "Busy") return "text-yellow";
    return "text-red";
  };

  // ═══════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════
  return (
    <div className="app">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">◎</div>
          <span className="logo-text">SolAI</span>
        </div>

        <nav className="sidebar-nav">
          <button className={`nav-item ${tab === "dashboard" ? "active" : ""}`} onClick={() => setTab("dashboard")}>
            <span className="nav-icon">◫</span> Dashboard
          </button>
          <button className={`nav-item ${tab === "swap" ? "active" : ""}`} onClick={() => setTab("swap")}>
            <span className="nav-icon">⇄</span> AI Swap
          </button>
          <button className={`nav-item ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>
            <span className="nav-icon">☰</span> History
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="network-pill">
            <span>Mainnet</span>
            <div className="status-indicator">
              <span className={`dot ${getNetworkColor(networkData?.networkStatus)}`}></span>
              {networkData?.networkStatus || "Connecting"}
            </div>
          </div>
          <div className="tps-display">
            {networkData?.tps || "—"} <span>TPS</span>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="main">
        {/* ── Header ── */}
        <header className="header">
          <div className="header-left">
            <h1 className="page-title">
              {tab === "dashboard" && "Network Dashboard"}
              {tab === "swap" && "AI-Powered Swap"}
              {tab === "history" && "Transaction History"}
            </h1>
            <p className="page-subtitle">Predictive execution engine for zero-failure transactions</p>
          </div>
          <div className="header-right">
            {!wallet ? (
              <button className="btn-connect" onClick={connectWallet}>
                Connect Phantom
              </button>
            ) : (
              <div className="wallet-chip">
                <span className="wallet-bal">{balance ?? "..."} SOL</span>
                <span className="wallet-addr">{wallet.slice(0, 4)}...{wallet.slice(-4)}</span>
                <button className="btn-disconnect" onClick={disconnectWallet}>✕</button>
              </div>
            )}
          </div>
        </header>

        {/* ── Status Bar ── */}
        {statusMsg && <div className="status-bar">{statusMsg}</div>}

        {/* ══════════════ DASHBOARD TAB ══════════════ */}
        {tab === "dashboard" && (
          <div className="dashboard-layout">
            <div className="dash-card glow-primary">
              <div className="card-header">
                <div className="card-icon">⚡</div>
                <h3>Live Network Status</h3>
              </div>
              <div className={`big-status ${getNetworkTextColor(networkData?.networkStatus)}`}>
                {networkData?.networkStatus || "—"}
              </div>
              <p className="dash-sub">Current Solana mainnet health</p>
            </div>
            
            <div className="dash-card">
              <div className="card-header">
                <div className="card-icon">📊</div>
                <h3>Transactions / Sec</h3>
              </div>
              <div className="big-number text-primary">{networkData?.tps || "—"}</div>
              <p className="dash-sub">Real-time throughput metrics</p>
            </div>
            
            <div className="dash-card glow-accent">
              <div className="card-header">
                <div className="card-icon">🧠</div>
                <h3>AI Confidence Score</h3>
              </div>
              <div className="big-number text-green">{networkData ? `${(networkData.confidenceScore * 100).toFixed(0)}%` : "—"}</div>
              <p className="dash-sub">Probability of successful inclusion</p>
            </div>
            
            <div className="dash-card wide">
              <div className="card-header">
                <div className="card-icon">⛽</div>
                <h3>Dynamic Priority Fee</h3>
              </div>
              <div className="big-number text-yellow">{networkData?.priorityFeeLamports || "—"} <small>lamports</small></div>
              <p className="dash-sub">Adaptive fee algorithm analyzing global congestion to guarantee transaction inclusion in the next block.</p>
            </div>
          </div>
        )}

        {/* ══════════════ SWAP TAB ══════════════ */}
        {tab === "swap" && (
          <div className="swap-layout">
            {/* Swap Card */}
            <div className="swap-card">
              <div className="swap-card-header">
                <h2>Swap</h2>
                <span className="badge-ai">✦ AI Auto-Routed</span>
              </div>

              {/* From */}
              <div className="swap-input-group">
                <label>You Pay</label>
                <div className="swap-input-row">
                  <input
                    type="number"
                    className="swap-amount"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                  <select className="token-select" value={inputToken} onChange={e => setInputToken(e.target.value)}>
                    {Object.keys(TOKENS).map(t => <option key={t} value={t}>{TOKENS[t].icon} {t}</option>)}
                  </select>
                </div>
              </div>

              {/* Flip */}
              <button className="flip-btn" onClick={flipTokens}>↕</button>

              {/* To */}
              <div className="swap-input-group">
                <label>You Receive</label>
                <div className="swap-input-row">
                  <input 
                    type="text" 
                    className="swap-amount" 
                    value={swapResult ? (swapResult.outAmount / Math.pow(10, TOKENS[outputToken].decimals)).toFixed(4) : ""} 
                    readOnly 
                    placeholder="—" 
                  />
                  <select className="token-select" value={outputToken} onChange={e => setOutputToken(e.target.value)}>
                    {Object.keys(TOKENS).map(t => <option key={t} value={t}>{TOKENS[t].icon} {t}</option>)}
                  </select>
                </div>
              </div>

              {/* Swap Button */}
              {!wallet ? (
                <button className="btn-swap" onClick={connectWallet}>Connect Wallet</button>
              ) : (
                <button className="btn-swap" onClick={handleSwap} disabled={loading || !amount || inputToken === outputToken}>
                  {loading ? "⏳ AI Assembling..." : `Swap ${inputToken} to ${outputToken}`}
                </button>
              )}

              {/* Swap Result */}
              {swapResult && (
                <div className="swap-result">
                  <div className="result-row"><span>TX Signature</span><a href={`https://solscan.io/tx/${swapResult.txid}`} target="_blank" rel="noreferrer">{swapResult.txid.slice(0,12)}... ↗</a></div>
                  <div className="result-row"><span>Price Impact</span><span className="text-green">{swapResult.priceImpact}%</span></div>
                  <div className="result-row"><span>Router</span><span>{swapResult.router}</span></div>
                  <div className="result-row"><span>Est. USD Value</span><span>${Number(swapResult.inUsd).toFixed(2)} → ${Number(swapResult.outUsd).toFixed(2)}</span></div>
                </div>
              )}
            </div>

            {/* AI Insights Panel */}
            <div className="ai-panel">
              <h3 className="panel-title">🧠 Execution Strategy</h3>
              {aiData ? (
                <div className="ai-grid">
                  <div className="ai-stat">
                    <span className="ai-stat-label">Slippage</span>
                    <span className="ai-stat-value text-primary">{(aiData.slippageBps / 100).toFixed(2)}%</span>
                    <span className="ai-stat-note">AI optimized</span>
                  </div>
                  <div className="ai-stat">
                    <span className="ai-stat-label">Confidence</span>
                    <span className="ai-stat-value text-green">{(aiData.confidenceScore * 100).toFixed(0)}%</span>
                    <span className="ai-stat-note">Success prob.</span>
                  </div>
                  <div className="ai-stat">
                    <span className="ai-stat-label">Priority Fee</span>
                    <span className="ai-stat-value text-yellow">{(aiData.priorityFeeLamports / 1e9).toFixed(5)}</span>
                    <span className="ai-stat-note">SOL</span>
                  </div>
                  <div className="ai-stat">
                    <span className="ai-stat-label">Network</span>
                    <span className={`ai-stat-value ${getNetworkTextColor(aiData.networkStatus)}`}>
                      {aiData.networkStatus}
                    </span>
                    <span className="ai-stat-note">At execution</span>
                  </div>
                </div>
              ) : (
                <div className="ai-grid" style={{ opacity: 0.3 }}>
                  <div className="ai-stat"><span className="ai-stat-label">Slippage</span><span className="ai-stat-value">—</span></div>
                  <div className="ai-stat"><span className="ai-stat-label">Confidence</span><span className="ai-stat-value">—</span></div>
                  <div className="ai-stat"><span className="ai-stat-label">Priority Fee</span><span className="ai-stat-value">—</span></div>
                  <div className="ai-stat"><span className="ai-stat-label">Network</span><span className="ai-stat-value">—</span></div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════ HISTORY TAB ══════════════ */}
        {tab === "history" && (
          <div className="history-layout">
            {txHistory.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📝</div>
                <h3>No Recent Transactions</h3>
                <p style={{ color: "var(--text-muted)", marginTop: "8px" }}>Your AI-routed swap history will appear here.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="tx-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Assets Swapped</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Explorer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txHistory.map((tx, i) => (
                      <tr key={i}>
                        <td style={{ color: "var(--text-muted)" }}>{tx.time}</td>
                        <td>
                          <div className="token-pair">
                            <div className="token-icons">
                              <span className="t-icon in">{TOKENS[tx.from]?.icon}</span>
                              <span className="t-icon out">{TOKENS[tx.to]?.icon}</span>
                            </div>
                            <span>{tx.from} to {tx.to}</span>
                          </div>
                        </td>
                        <td>
                          <span className="tx-amount">{tx.amount} {tx.from}</span>
                          {tx.inUsd && <span className="tx-usd">≈ ${Number(tx.inUsd).toFixed(2)}</span>}
                        </td>
                        <td><span className="status-pill confirmed">{tx.status}</span></td>
                        <td><a href={`https://solscan.io/tx/${tx.id}`} className="tx-link" target="_blank" rel="noreferrer">{tx.id.slice(0,8)}... ↗</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
