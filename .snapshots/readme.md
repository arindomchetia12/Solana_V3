# Snapshots Directory

This directory contains snapshots of your code for AI interactions. Each snapshot is a markdown file that includes relevant code context and project structure information.

## What's included in snapshots?
- Selected code files and their contents
- Project structure (if enabled)
- Your prompt/question for the AI
<!-- 
## Configuration
You can customize snapshot behavior in `config.json`. -->

# Build :- Google Maps for crypto Swaps. Swap is Crypto swap (crypto-to-crypto exchange) defines the direct exchange of one crypto for another without requiring a preliminary crypto-to-fiat exchange.
For example, assume that you hold some ETH and want BTC instead. Swapping crypto allows you to directly exchange your ETH for BTC of roughly equal value.

# Pre Requisites
bash install node -v </br>
npm -v </br>
npm init -y </br>
( npm installs, updates and manages downloads of dependencies of your project. Dependencies are pre-built pieces of code, such as libraries and packages, that your Node.js application needs to work.)

# Step1:- Create the project
mkdir ai-solana-router
cd ai-solana-router
npm init-y 
# Step2:- Install the Dependencies
npm install @solana/web.js node-fetch 
# step 3:- Enable Modules
In package .json : {
    "type": "module"
}
# Step the File Structure 
mkdir backend </br>
cd backend </br>
mk dir ai execution config </br>
touch index.js</br>
touch ai/decisionEngine.js ai/features.js</br>
touch execution/Jupiter.js execution/swap.js</br>
touch config/solana.js</br>

# Step 5 Connect To Solana 