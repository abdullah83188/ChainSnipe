const ethApiKey = "25F9Y3K2JMSU7EW8F1XJUV2G8C7V2N9J9C";
const solApiKey = "397ced5f-5a44-46da-92c6-558071947f9a";

// Fast check for ETH contract (with timeout fallback)
async function isEthContract(address) {
  const url = `https://api.etherscan.io/api?module=contract&action=getsourcecode&address=${address}&apikey=${ethApiKey}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000); // timeout in 2s
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    return data.result[0]?.ContractName !== "";
  } catch {
    return false; // fallback = human
  }
}

async function fetchEthTokenActivity(token) {
  const url = `https://api.etherscan.io/api?module=account&action=tokentx&contractaddress=${token}&page=1&offset=50&sort=desc&apikey=${ethApiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  const txs = data.result || [];

  const wallets = {};

  for (const tx of txs) {
    const from = tx.from.toLowerCase();
    const to = tx.to.toLowerCase();
    const wallet = from === token.toLowerCase() ? to : from;
    const action = to === wallet ? "BUY" : "SELL";
    const amount = tx.value / Math.pow(10, tx.tokenDecimal);
    const time = new Date(tx.timeStamp * 1000).toLocaleString();
    const symbol = tx.tokenSymbol || "Token";

    if (!wallets[wallet]) {
      const isHuman = !(await isEthContract(wallet));
      wallets[wallet] = {
        isHuman: isHuman ? "🧍 Human" : "🤖 Contract",
        txs: []
      };
    }

    wallets[wallet].txs.push({ action, amount, time, symbol, hash: tx.hash, token: tx.contractAddress });
  }

  renderWallets(wallets, "ethereum");
}

async function fetchSolTokenActivity(token) {
  const url = `https://api.helius.xyz/v0/tokens/${token}/rich-list?limit=50&api-key=${solApiKey}`;
  try {
    const res = await fetch(url);
    const data = await res.json();

    const wallets = {};
    for (const acc of data) {
      const owner = acc.owner;
      const balance = acc.amount;
      if (!owner || owner === "11111111111111111111111111111111") continue;

      if (!wallets[owner]) {
        wallets[owner] = {
          isHuman: "🧍 Assumed",
          txs: []
        };
      }

      wallets[owner].txs.push({
        action: "HOLDING",
        amount: balance,
        time: new Date().toLocaleString(),
        symbol: "---",
        hash: "",
        token
      });
    }

    renderWallets(wallets, "solana");
  } catch {
    document.getElementById("walletList").innerHTML = "❌ Error fetching Solana wallets.";
  }
}

function renderWallets(wallets, chain) {
  const container = document.getElementById("walletList");
  container.innerHTML = "";

  const entries = Object.entries(wallets);
  if (!entries.length) {
    container.innerHTML = "❌ No wallets found.";
    return;
  }

  for (const [wallet, data] of entries) {
    const card = document.createElement("div");
    card.className = "wallet-card";

    card.innerHTML = `<b>Wallet:</b> ${wallet} <span>${data.isHuman}</span><br><br>`;

    for (const tx of data.txs) {
      card.innerHTML += `
        ${tx.action} <b>${tx.amount.toFixed(4)}</b> ${tx.symbol} @ ${tx.time}<br>
        ${
          chain === "ethereum"
            ? `<a href="https://etherscan.io/tx/${tx.hash}" target="_blank">🔍 TX</a> | <a href="https://dexscreener.com/ethereum/${tx.token}" target="_blank">📈 Chart</a>`
            : `<a href="https://solscan.io/account/${wallet}" target="_blank">🔍 Wallet</a> | <a href="https://pump.fun/${tx.token}" target="_blank">📈 Chart</a>`
        }
        <br><hr>`;
    }

    container.appendChild(card);
  }
}

function trackToken() {
  const token = document.getElementById("tokenAddress").value.trim();
  const chain = document.getElementById("chainSelect").value;
  const container = document.getElementById("walletList");
  container.innerHTML = "⏳ Fetching wallet activity...";

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
