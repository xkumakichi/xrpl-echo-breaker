const xrpl = require('xrpl');

const TESTNET_URL = "wss://s.altnet.rippletest.net:51233";

async function main() {
  console.log("🌱 XRPL Echo Breaker — Genesis\n");

  const client = new xrpl.Client(TESTNET_URL);
  await client.connect();
  console.log("✅ XRPLテストネットに接続");

  console.log("💰 Genesisウォレットを作成中...");
  const { wallet } = await client.fundWallet();
  console.log(`📍 アドレス: ${wallet.address}`);
  console.log(`🔑 Secret: ${wallet.seed} (テストネット専用)\n`);

  // Genesis記録 — シンプルに刻む
  const genesis = {
    project: "XRPL Echo Breaker",
    founder: "Hiro.T",
    wallet: wallet.address,
    message: "Breaking the echo chamber. First stone laid.",
    timestamp: new Date().toISOString()
  };

  const memo = {
    Memo: {
      MemoType: xrpl.convertStringToHex("EchoBreaker/Genesis"),
      MemoData: xrpl.convertStringToHex(JSON.stringify(genesis))
    }
  };

  console.log("刻印中...");
  const tx = await client.submitAndWait({
    TransactionType: "AccountSet",
    Account: wallet.address,
    Memos: [memo]
  }, { wallet });

  console.log("\n=== Genesis 刻印完了 ===");
  console.log(`Founder:  Hiro.T`);
  console.log(`Address:  ${wallet.address}`);
  console.log(`Tx Hash:  ${tx.result.hash}`);
  console.log(`Explorer: https://testnet.xrpl.org/transactions/${tx.result.hash}`);
  console.log(`\nこの記録はXRPLテストネット上に永久に残ります。`);

  await client.disconnect();
}

main().catch(console.error);
