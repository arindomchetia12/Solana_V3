import logo from './logo.svg';
import './App.css';
import { useState } from "react";
import { Connection, VersionedTransaction } from "@solana/web3.js";

const connection = new Connection("https://api.mainnet-beta.solana.com");

function App() {
  const [wallet, setWallet] = useState(null);

  const connectWallet = async () => {
    try {
      const { solana } = window;

      if (solana && solana.isPhantom) {
        const response = await solana.connect();
        console.log("Connected with Public Key:", response.publicKey.toString());
        setWallet(response.publicKey.toString());
      } else {
        alert("Solana object not found! Get a Phantom Wallet 👻");
      }
    } catch (error) {
      console.error("Error connecting to wallet:", error);
      alert("Error connecting to wallet: " + error.message);
    }
  };

  async function handleSwap() {
    const { solana } = window;
    if (!solana || !solana.isPhantom || !wallet) {
      alert("Please connect your wallet first!");
      return;
    }

    try {
      // 1. Get quote
      console.log("Fetching quote from Jupiter...");
      let quoteRes;
      try {
        quoteRes = await fetch(
          `http://localhost:5000/api/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=Es9vMFrzaCERmJfrF4H2FYzV4mWwfvX2gYdExgkt1&amount=10000000&slippageBps=100`
        );
      } catch (e) {
        throw new Error("Network error while calling backend on port 5000. Ensure backend is running.");
      }

      if (!quoteRes.ok) {
        const errorText = await quoteRes.text();
        throw new Error(`Quote API error (${quoteRes.status}): ${errorText}`);
      }
      const quote = await quoteRes.json();
      console.log("Quote received:", quote);

      // 2. Get swap tx
      console.log("Fetching swap transaction...");
      let swapRes;
      try {
        swapRes = await fetch("http://localhost:5000/api/swap", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            quoteResponse: quote,
            userPublicKey: wallet,
            wrapAndUnwrapSol: true
          })
        });
      } catch (e) {
        throw new Error("Network error while calling backend port 5000 for swap. Ensure backend is running.");
      }

      if (!swapRes.ok) {
        const errorData = await swapRes.json().catch(() => ({ error: "Unknown swap error" }));
        throw new Error(errorData.error || `Swap API error (${swapRes.status})`);
      }
      const { swapTransaction } = await swapRes.json();

      // 3. Deserialize
      console.log("Deserializing transaction...");
      const tx = VersionedTransaction.deserialize(
        Buffer.from(swapTransaction, "base64")
      );

      // 4. SIGN with Phantom
      console.log("Signing transaction...");
      const signedTx = await solana.signTransaction(tx);

      // 5. SEND
      console.log("Sending transaction to Solana mainnet...");
      const txid = await connection.sendRawTransaction(
        signedTx.serialize()
      );

      console.log("TX ID:", txid);
      alert("Transaction successful! ID: " + txid);
    } catch (error) {
      console.error("Swap Error Details:", error);
      alert("Swap failed: " + error.message);
    }
  }

  return (
    <div className="App">
      <div className="card">
        <div className="logo-container">
          <svg className="phantom-logo" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M64 0C28.656 0 0 28.656 0 64s28.656 64 64 64 64-28.656 64-64S99.344 0 64 0zm33.152 83.2c-5.184 10.368-16.32 16.32-28.8 16.32-21.312 0-38.656-17.344-38.656-38.656 0-21.312 17.344-38.656 38.656-38.656 12.48 0 23.616 5.952 28.8 16.32l-11.52 5.76C82.88 38.4 74.24 34.56 64.352 34.56c-14.4 0-26.112 11.712-26.112 26.112s11.712 26.112 26.112 26.112c9.888 0 18.528-3.84 22.272-9.6l11.52 5.76l-.032.256z" fill="#9945FF"/>
          </svg>
        </div>
        <h1>AI Solana Router</h1>
        <p className="subtitle">Instant SOL to USDC Swaps via Jupiter</p>

        {!wallet ? (
          <>
            <div className="status-badge status-disconnected">
              <span>●</span> Not Connected
            </div>
            <button className="btn btn-primary" onClick={connectWallet}>
              Connect Phantom Wallet
            </button>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '16px' }}>
              Ensure you have the Phantom extension installed
            </p>
          </>
        ) : (
          <>
            <div className="status-badge status-connected">
              <span>●</span> Connected
            </div>
            <div className="wallet-info">
              {wallet.slice(0, 6)}...{wallet.slice(-6)}
            </div>
            <button className="btn btn-primary" onClick={handleSwap}>
              Swap 0.01 SOL → USDC
            </button>
            <button className="btn btn-secondary" onClick={() => setWallet(null)}>
              Disconnect
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
