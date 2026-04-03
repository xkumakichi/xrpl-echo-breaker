const xrpl = require('xrpl');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ==================== 設定 ====================
const TESTNET_URL = "wss://s.altnet.rippletest.net:51233";

const GENESIS = {
  txHash: "D84341CC154F2CFDA59F5791D93982F7FF7167B589F6FC95EBDD5FB35FBD4DBC",
  founder: "Hiro.T",
  wallet: "rnioHtjC7xQVAkXpmDPtanq7qypPyN64ui"
};

const DRY_RUN = process.argv.includes("--dry-run");
const QUERY = process.argv.filter(a => a !== "--dry-run").slice(2)[0]
  || "ビットコインの中央集権化リスクは実際どの程度存在するのか？";

const RECORDS_DIR = path.join(__dirname, 'records');
const ARCHIVE_DIR = path.join(__dirname, 'archive');

// =============================================

// v0.31形式の連番ファイルパターン
const RECORD_PATTERN = /^record-\d{3}\.json$/;

function archiveOldFiles() {
  if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR);

  const oldFiles = fs.readdirSync(RECORDS_DIR).filter(f =>
    !RECORD_PATTERN.test(f) && !f.startsWith('record-') || f.includes('bitcoin-centralization')
  ).filter(f => f !== 'index.md');

  // record-NNN.md は残す、それ以外の非連番ファイルをアーカイブ
  const toArchive = fs.readdirSync(RECORDS_DIR).filter(f => {
    if (f === 'index.md') return false;
    if (RECORD_PATTERN.test(f)) return false;
    if (/^record-\d{3}\.md$/.test(f)) return false;
    return true;
  });

  toArchive.forEach(file => {
    fs.renameSync(path.join(RECORDS_DIR, file), path.join(ARCHIVE_DIR, file));
    console.log(`📦 アーカイブ移動: ${file}`);
  });
}

function getExistingRecords() {
  return fs.readdirSync(RECORDS_DIR)
    .filter(f => RECORD_PATTERN.test(f))
    .sort();
}

function calcPrevHash(existingFiles) {
  if (existingFiles.length === 0) return GENESIS.txHash;
  const lastFile = existingFiles[existingFiles.length - 1];
  const rawContent = fs.readFileSync(path.join(RECORDS_DIR, lastFile), 'utf8');
  return crypto.createHash('sha256').update(rawContent).digest('hex');
}

function generateIndex() {
  const files = getExistingRecords().reverse(); // 新しい順

  let content = `# XRPL Echo Breaker\n\n`;
  content += `エコーチェンバーを破壊し、多角的視点を永久保存する純粋利他的プロトコル。\n\n`;
  content += `**Founder**: ${GENESIS.founder}\n`;
  content += `**Genesis Tx**: \`${GENESIS.txHash}\`\n`;
  content += `**Wallet**: \`${GENESIS.wallet}\`\n\n`;
  content += `## Protocol Rules\n\n`;
  content += `- 証拠第一（結論を強制しない）\n`;
  content += `- 多角的視点（主流・逆張り・少数）\n`;
  content += `- 権力バイアスの明示（who_benefits）\n`;
  content += `- 不確実性の記録（unknowns）\n`;
  content += `- 反証可能性の義務化（falsifiability）\n`;
  content += `- 報酬ゼロ・純粋利他的\n\n`;
  content += `---\n\n`;
  content += `## Records (${files.length}件)\n\n`;

  files.forEach(file => {
    const data = JSON.parse(fs.readFileSync(path.join(RECORDS_DIR, file), 'utf8'));
    const mainView = data.views.find(v => v.type === "mainstream");
    const summary = mainView ? mainView.summary : "";
    const short = summary.length > 100 ? summary.substring(0, 100) + "..." : summary;
    const rawContent = fs.readFileSync(path.join(RECORDS_DIR, file), 'utf8');
    const hash = crypto.createHash('sha256').update(rawContent).digest('hex');

    content += `### Record #${data.record_number}\n`;
    content += `- **クエリ**: ${data.query}\n`;
    content += `- **日時**: ${data.timestamp}\n`;
    content += `- **Mainstream要約**: ${short}\n`;
    content += `- **分散スコア**: ${data.diversity_score}/100\n`;
    content += `- **Hash**: \`${hash.slice(0, 16)}...\`\n\n`;
  });

  content += `---\n\n`;
  content += `> このプロトコルは Hiro.T によって Genesis が刻まれ、知識の鎖として成長しています。\n`;
  content += `> 各記録は prev_hash で前の記録に連鎖し、SHA-256 で改ざん検知が可能です。\n`;

  fs.writeFileSync(path.join(RECORDS_DIR, 'index.md'), content);
}

async function main() {
  console.log("🚀 XRPL Echo Breaker v0.4 起動...\n");
  console.log(`クエリ: ${QUERY}`);
  console.log(`モード: ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

  if (!fs.existsSync(RECORDS_DIR)) fs.mkdirSync(RECORDS_DIR);

  // v0.2時代の旧ファイルをarchiveに移動
  archiveOldFiles();

  const existingFiles = getExistingRecords();
  const nextNumber = String(existingFiles.length + 1).padStart(3, '0');
  const prevHash = calcPrevHash(existingFiles);

  const client = new xrpl.Client(TESTNET_URL);
  await client.connect();
  console.log("✅ XRPLテストネットに接続");

  console.log("💰 ウォレット作成中...");
  const { wallet } = await client.fundWallet();
  console.log(`📍 アドレス: ${wallet.address}\n`);

  // ==================== 多角的検証 ====================
  console.log("🔍 多角的検証を開始...\n");

  const views = [
    {
      type: "mainstream",
      summary: "ハッシュレート上位プールや機関投資家（ETF経由）の影響で、中央集権化リスクは中程度に存在するとされる。",
      evidence: ["https://btc.com/stats/pool", "https://glassnode.com/"],
      probability: 65,
      who_benefits: "大手マイニング企業、取引所、機関投資家",
      falsifiability: {
        level: "high",
        condition: "マイニングプール上位3社のシェアが70%を超え、51%攻撃が実行された場合に強化される"
      },
      unknowns: "分散型マイニング技術（Stratum V2など）の普及速度"
    },
    {
      type: "contrarian",
      summary: "ビットコインのプロトコル設計自体は非中央集権的。集中は市場の一時的な現象で、インセンティブにより長期的に分散化する可能性が高い。",
      evidence: ["https://bitcoin.org/bitcoin.pdf", "https://github.com/bitcoin/bitcoin"],
      probability: 45,
      who_benefits: "ビットコイン純粋主義者、分散型思想を重視する層",
      falsifiability: {
        level: "medium",
        condition: "長期的にハッシュレートの分散傾向が見られず、特定のエンティティによる支配が固定化された場合に弱まる"
      },
      unknowns: "51%攻撃の実現可能性とその経済的影響"
    },
    {
      type: "minority",
      summary: "すでにかなりの中央集権化が進んでおり、特定の勢力や隠れたネットワークの影響が背景にある可能性が指摘される。",
      evidence: [],
      probability: 25,
      who_benefits: "ビットコイン懐疑派、代替通貨推進勢力",
      falsifiability: {
        level: "low",
        condition: "具体的な影響力ネットワークの証拠が公開・検証された場合にのみ判定可能"
      },
      unknowns: "隠れた影響力の詳細とその実態",
      verification_status: "unverified"
    }
  ];

  const diversity_score = views.length * 25;
  const consensus_score = 55;

  const fullRecord = {
    type: "record",
    record_number: nextNumber,
    query: QUERY,
    timestamp: new Date().toISOString(),
    views: views,
    consensus_score,
    diversity_score,
    origin: {
      protocol: "XRPL Echo Breaker",
      genesis_tx: GENESIS.txHash,
      founder: GENESIS.founder,
      founder_wallet: GENESIS.wallet
    },
    prev_hash: prevHash,
    meta: {
      ai_agents: ["grok-mainstream", "grok-contrarian", "grok-minority"],
      version: "v0.4"
    }
  };

  const fullJson = JSON.stringify(fullRecord, null, 2);
  const contentHash = crypto.createHash('sha256').update(fullJson).digest('hex');

  const lightSummary = {
    n: nextNumber,
    q: QUERY,
    t: fullRecord.timestamp,
    v: views.map(v => `${v.type}:${v.probability}`),
    ds: diversity_score,
    cs: consensus_score,
    f: GENESIS.founder,
    h: contentHash
  };

  console.log(`📝 Record #${nextNumber}`);
  console.log(`   Prev Hash: ${prevHash.slice(0, 16)}...`);
  console.log(`   Content Hash: ${contentHash.slice(0, 16)}...`);

  let txHash = "(dry-run)";

  if (!DRY_RUN) {
    const memo = {
      Memo: {
        MemoType: xrpl.convertStringToHex("EchoBreaker"),
        MemoData: xrpl.convertStringToHex(JSON.stringify(lightSummary))
      }
    };

    const tx = await client.submitAndWait({
      TransactionType: "AccountSet",
      Account: wallet.address,
      Memos: [memo]
    }, { wallet });

    txHash = tx.result.hash;
    console.log(`✅ XRPL記録完了！ Tx: ${txHash}`);
  } else {
    console.log("🧪 DRY RUNモード — 書き込みスキップ");
  }

  // JSON保存
  fs.writeFileSync(path.join(RECORDS_DIR, `record-${nextNumber}.json`), fullJson);
  console.log(`💾 JSON: record-${nextNumber}.json`);

  // Markdown保存
  let md = `# Record #${nextNumber}\n\n`;
  md += `**クエリ**: ${QUERY}\n`;
  md += `**記録日時**: ${fullRecord.timestamp}\n`;
  md += `**Tx Hash**: ${txHash}\n`;
  md += `**Founder**: ${GENESIS.founder} (\`${GENESIS.wallet}\`)\n`;
  md += `**Prev Hash**: \`${prevHash}\`\n`;
  md += `**Content Hash**: \`${contentHash}\`\n\n`;

  md += `## 多角的視点\n\n`;
  views.forEach(view => {
    md += `### ${view.type.charAt(0).toUpperCase() + view.type.slice(1)} (${view.probability}%)\n`;
    md += `${view.summary}\n\n`;
    md += `- 誰が得する？ ${view.who_benefits}\n`;
    md += `- 反証可能性: ${view.falsifiability.level} (${view.falsifiability.condition})\n`;
    md += `- 不確実性: ${view.unknowns}\n`;
    if (view.verification_status) md += `- 検証ステータス: ${view.verification_status}\n`;
    md += `\n`;
  });

  md += `**分散スコア**: ${diversity_score}/100 | **合意スコア**: ${consensus_score}/100\n\n`;
  md += `> prev_hash で前の記録に連鎖。Hiro.T が Genesis を刻んだ XRPL Echo Breaker の一部。\n`;

  fs.writeFileSync(path.join(RECORDS_DIR, `record-${nextNumber}.md`), md);
  console.log(`📄 Markdown: record-${nextNumber}.md`);

  // index.md 自動生成
  generateIndex();
  console.log(`📋 index.md 更新完了`);

  await client.disconnect();
  console.log("\n🎉 v0.4 完了！ プロトコルの入口ができました。");
}

main().catch(console.error);
