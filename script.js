const apis = {
  ethereum: {
    label: "Ethereum",
    key: "25F9Y3K2JMSU7EW8F1XJUV2G8C7V2N9J9C",
    url: "https://api.etherscan.io/api"
  },
  bsc: {
    label: "BNB Chain",
    key: "CXTB4IUT31N836G93ZI3YQBEWBQEGGH5QS",
    url: "https://api.bscscan.com/api"
  },
  polygon: {
    label: "Polygon",
    key: "U7IUT7CI3N8369QBWBEGS2Z93ZI3YGXTHG",
    url: "https://api.polygonscan.com/api"
  },
  arbitrum: {
    label: "Arbitrum",
    key: "G93ZI3YGXTHG9QBEWBQEGG75CXTB4IUT3",
    url: "https://api.arbiscan.io/api"
  }
};

const heliusKey = "397ced5f-5a44-46da-92c6-558071947f9a";

function isSolana(address) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address) && !address.startsWith("0x");
}

function isEvm(address) {
  return address.startsWith("0x") && address.length === 42;
}

async function isContract(chain, address) {
  try {
    const { key, url } = apis[chain];
    const res = await fetch(`${url}?module=contract&action=getsourcecode&address=${address}&apikey=${key}`);
    const data = await res.json();
    return data.result[0]?.ContractName !== "";
  } catch {
    return false;
  }
}

async function fetchEvmData(wallet) {
  const tasks = Object.entries(apis).map(async ([chain, { key, url, label }]) => {
    const txURL = `${url}?module=account&action=tokentx&address=${wallet}&page=1&offset=25&sort=desc&apikey=${key}`;
    try {
      const res = await fetch(txURL);
      const data = await res.json();
      if (!data.result || data.result.length === 0) return [];

      return data.result.map(tx => ({
        chain: label,
        action: tx.to.toLowerCase() === wallet.toLowerCase() ? "BUY" : "SELL",
        amount: (Number(tx.value) / Math.pow(10, tx.tokenDecimal || 18)).toFixed(4),
        date: new Date(tx.timeStamp * 1000).toLocaleString(),
        token: tx.tokenSymbol || "TOKEN",
        hash: tx.hash,
        explorer: `https://${chain === "bsc" ? "bscscan" : chain + "scan"}.com/tx/${tx.hash}`
      }));
    } catch {
      return [];
    }
  });

  const allTx = (await Promise.all(tasks)).flat();
  const isHuman = !(await isContract("ethereum", wallet));
  const type = isHuman ? "🧍 Human" : "🤖 Bot";

  return allTx.map(tx => ({ ...tx, type }));
}

async function fetchSolanaData(wallet) {
  const url = `https://api.helius.xyz/v0/addresses/${wallet}/tokens?api-key=${heliusKey}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data || data.length === 0) return [];

    return data.map(token => ({
      chain: "Solana",
      action: "HOLDING",
      amount: token.amount,
      date: new Date().toLocaleString(),
      token: token.tokenName || token.mint,
      explorer: `https://solscan.io/account/${wallet}`,
      type: "🧍 Assumed"
    }));
  } catch {
    return [];
  }
}

async function trackWallet() {
  const wallet = document.getElementById("walletInput").value.trim();
  const box = document.getElementById("results");

  if (!wallet) return (box.innerHTML = "⚠️ Enter a wallet address.");

  box.innerHTML = "⏳ Detecting and fetching data...";

  let allData = [];
  if (isSolana(wallet)) {
    allData = await fetchSolanaData(wallet);
  } else if (isEvm(wallet)) {
    allData = await fetchEvmData(wallet);
  } else {
    box.innerHTML = "❌ Unknown or unsupported wallet format.";
    return;
  }

  if (!allData.length) {
    box.innerHTML = "❌ No activity found for this wallet.";
    return;
  }

  let html = `<h2>Activity for ${wallet}</h2><hr>`;
  for (const tx of allData) {
    html += `
      <div class="entry">
        <b>Chain:</b> ${tx.chain}<br>
        <b>Action:</b> ${tx.action}<br>
        <b>Token:</b> ${tx.token}<br>
        <b>Amount:</b> ${tx.amount}<br>
        <b>Date:</b> ${tx.date}<br>
        <b>Type:</b> ${tx.type}<br>
        <a href="${tx.explorer}" target="_blank">🔍 View</a>
      </div>
    `;
  }

  box.innerHTML = html;
}
