const ethApiKey = "25F9Y3K2JMSU7EW8F1XJUV2G8C7V2N9J9C";
const solApiKey = "397ced5f-5a44-46da-92c6-558071947f9a";

async function isEthContract(address) {
  const url = `https://api.etherscan.io/api?module=contract&action=getsourcecode&address=${address}&apikey=${ethApiKey}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.result && data.result.length > 0) {
      return data.result[0].ContractName !== "";
    }
    return false;
  } catch {
    return false;
  }
}

async function fetchEthTokenActivity(token) {
  const url = `https://api.etherscan.io/api?module=account&action=tokentx&contractaddress=${token}&page=1&offset=100&sort=desc&apikey=${ethApiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  const txs = data.result || [];

  const wallets = {};
  for (const tx of txs) {
    const isFromContract = await isEthContract(tx.from);
    const isToContract = await isEthContract(tx.to);
    if (isFromContract || isToContract) continue;

    const wallet = tx.from.toLowerCase() === token.toLowerCase() ? tx.to : tx.from;
    const action = tx.to.toLowerCase() === wallet.toLowerCase() ? "BUY" : "SELL";
    const amount = tx.value / Math.pow(10, tx.tokenDecimal);
    const time = new Date(tx.timeStamp * 1000).toLocaleString();
    const symbol = tx.tokenSymbol || "Token";

    if (!wallets[wallet]) wallets[wallet] = [];
    wallets[wallet].push({ action, amount, time, symbol, hash: tx.hash, token: tx.contractAddress });
  }

  renderWallets(wallets, "ethereum");
}

async function fetchSolTokenActivity(token) {
  const url = `https://api.helius.xyz/v0/tokens/${token}/rich-list?limit=50&api-key=${solApiKey}`;
  const res = await fetch(url);
  const data = await res.json();

  const wallets = {};
  for (const acc of data) {
    const owner = acc.owner;
    const balance = acc.amount;
    if (!owner || owner === "11111111111111111111111111111111") continue;

    if (!wallets[owner]) wallets[owner] = [];
    wallets[owner].push({
      action: "HOLDING",
      amount: balance,
      time: new Date().toLocaleString(),
      symbol: "---",
      hash: "",
      token
    });
  }

  renderWallets(wallets, "solana");
}

function renderWallets(wallets, chain) {
  const container = document.getElementById("walletList");
  container.innerHTML = "";

  const sorted = Object.entries(wallets).sort((a, b) => b[1].length - a[1].length);

  for (const [wallet, txs] of sorted) {
    const card = document.createElement("div");
    card.className = "wallet-card";

    card.innerHTML = `<b>Wallet:</b> ${wallet}<br>`;
    for (const tx of txs) {
      card.innerHTML += `${tx.action} <b>${tx.amount.toFixed(4)}</b> ${tx.symbol} @ ${tx.time}<br>`;
      if (chain === "ethereum") {
        card.innerHTML += `<a href="https://etherscan.io/tx/${tx.hash}" target="_blank">🔍 View TX</a> | <a href="https://dexscreener.com/ethereum/${tx.token}" target="_blank">📈 Chart</a><br>`;
      } else {
        card.innerHTML += `<a href="https://solscan.io/account/${wallet}" target="_blank">🔍 View Wallet</a> | <a href="https://pump.fun/${tx.token}" target="_blank">📈 Chart</a><br>`;
      }
      card.innerHTML += `<hr>`;
    }

    container.appendChild(card);
  }

  if (!Object.keys(wallets).length) {
    container.innerHTML = "❌ No human wallets found for this token.";
  }
}

function trackToken() {
  const token = document.getElementById("tokenAddress").value.trim();
  const chain = document.getElementById("chainSelect").value;
  const container = document.getElementById("walletList");
  container.innerHTML = "⏳ Fetching wallets...";

  if (!token) {
    container.innerHTML = "⚠️ Enter a token contract address.";
    return;
  }

  if (chain === "ethereum") {
    fetchEthTokenActivity(token);
  } else {
    fetchSolTokenActivity(token);
  }
}
