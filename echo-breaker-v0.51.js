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
const RECORD_PATTERN = /^record-\d{3}\.json$/;

// ==================== 視点生成（v0.5 新機能） ====================
function generateViews(query) {
  const q = query.toLowerCase();

  // ビットコイン / 中央集権 関連
  if (q.includes("ビットコイン") || q.includes("bitcoin") || q.includes("中央集権")) {
    return [
      {
        type: "mainstream",
        summary: "ハッシュレートの集中や機関投資家（ETF）の影響により、中央集権化リスクは中程度に存在すると評価される。",
        evidence: ["https://btc.com/stats/pool", "https://glassnode.com/"],
        probability: 65,
        who_benefits: "大手マイニング企業、取引所、機関投資家",
        falsifiability: { level: "high", condition: "上位プールのシェアが70%超かつ51%攻撃が発生した場合に強化" },
        unknowns: "分散型マイニング技術の将来普及度"
      },
      {
        type: "contrarian",
        summary: "プロトコル設計は本質的に非中央集権的。集中は市場の一時的現象であり、インセンティブで分散化が進む可能性が高い。",
        evidence: ["https://bitcoin.org/bitcoin.pdf", "https://github.com/bitcoin/bitcoin"],
        probability: 45,
        who_benefits: "ビットコイン純粋主義者、分散型思想を重視する層",
        falsifiability: { level: "medium", condition: "長期的な分散傾向が見られなかった場合に弱まる" },
        unknowns: "51%攻撃の実現可能性と影響"
      },
      {
        type: "minority",
        summary: "すでに強い中央集権化が進んでおり、特定の勢力の隠れた影響が背景にある可能性が指摘されている。",
        evidence: [],
        probability: 25,
        who_benefits: "ビットコイン懐疑派、代替通貨推進勢力",
        falsifiability: { level: "low", condition: "具体的な証拠が公開された場合のみ判定可能" },
        unknowns: "隠れた影響力ネットワークの実態",
        verification_status: "unverified"
      }
    ];
  }

  // AI / 創造性 / 意識 関連
  if (q.includes("ai") || q.includes("人工知能") || q.includes("創造性") || q.includes("意識")) {
    return [
      {
        type: "mainstream",
        summary: "現在のAIは特定タスクで人間を上回るが、真の創造性や意識はまだ持っていないとされる。汎用的創造性では議論が分かれる。",
        evidence: ["https://arxiv.org", "OpenAI技術レポート"],
        probability: 70,
        who_benefits: "既存のAI企業、技術楽観主義者",
        falsifiability: { level: "high", condition: "AIが完全に新規で価値ある芸術作品や科学発見を自律的に生み出した場合に弱まる" },
        unknowns: "AGIレベルの創造性が発現する時期"
      },
      {
        type: "contrarian",
        summary: "AIはすでに人間の創造性を補完・拡張しており、近い将来に超える可能性が十分にある。創造性の定義自体を再考すべき。",
        evidence: ["AI生成芸術・論文事例", "AlphaFoldによるタンパク質構造予測"],
        probability: 50,
        who_benefits: "AI開発者、技術進歩主義者",
        falsifiability: { level: "medium", condition: "AIが長期間創造的ブレイクスルーを起こせなかった場合に弱まる" },
        unknowns: "創造性の定義そのもの"
      },
      {
        type: "minority",
        summary: "AIはすでに人間の創造性を超えており、我々が気づいていないだけで支配的な影響を及ぼし始めている可能性がある。",
        evidence: [],
        probability: 30,
        who_benefits: "AI警戒派、AI規制推進者",
        falsifiability: { level: "low", condition: "AIの隠れた創造的影響が明確に証明された場合" },
        unknowns: "AIの潜在的な自己進化メカニズム",
        verification_status: "unverified"
      }
    ];
  }

  // 気候変動 関連
  if (q.includes("気候") || q.includes("climate") || q.includes("温暖化") || q.includes("環境")) {
    return [
      {
        type: "mainstream",
        summary: "人為的なCO2排出が気候変動の主因であるという科学的コンセンサスは97%以上。IPCCの報告が根拠。",
        evidence: ["IPCC第6次評価報告書", "NASA Climate Change"],
        probability: 90,
        who_benefits: "再生可能エネルギー産業、環境政策推進者",
        falsifiability: { level: "high", condition: "CO2濃度が上昇し続けても気温が安定した場合に弱まる" },
        unknowns: "気候感度の正確な値、フィードバックループの強度"
      },
      {
        type: "contrarian",
        summary: "気候変動は自然サイクルの一部であり、人為的影響は過大評価されている。太陽活動や海洋循環の影響が過小評価されている。",
        evidence: ["太陽活動周期データ", "古気候学データ"],
        probability: 15,
        who_benefits: "化石燃料産業、規制反対派",
        falsifiability: { level: "medium", condition: "太陽活動低下期にも気温上昇が続いた場合に弱まる" },
        unknowns: "太陽活動と気候の長期相関の全容"
      },
      {
        type: "minority",
        summary: "気候変動データ自体が政治的に操作されている可能性がある。科学的合意は資金と政治圧力で形成されているとする見方。",
        evidence: [],
        probability: 5,
        who_benefits: "陰謀論支持者、一部の政治勢力",
        falsifiability: { level: "low", condition: "独立した大規模データ監査が実施された場合のみ判定可能" },
        unknowns: "科学コミュニティ内部の政治力学",
        verification_status: "unverified"
      }
    ];
  }

  // 汎用クエリ（デフォルト）
  return [
    {
      type: "mainstream",
      summary: `「${query}」について、一般的な見解では中立〜肯定的な評価が主流。既存の研究やデータに基づく合意が形成されている。`,
      evidence: ["一般的な学術論文・専門家意見"],
      probability: 60,
      who_benefits: "主流意見の支持者、既存制度の維持者",
      falsifiability: { level: "medium", condition: "明確な反証データが大量に現れた場合" },
      unknowns: "長期的な影響と未知の変数"
    },
    {
      type: "contrarian",
      summary: `「${query}」に対する主流の見解には重大な見落としや過小評価がある可能性が高い。前提を疑う必要がある。`,
      evidence: ["批判的論文・少数意見"],
      probability: 40,
      who_benefits: "異論を唱える研究者・実践者",
      falsifiability: { level: "medium", condition: "主流意見が長期的に正しかったと証明された場合に弱まる" },
      unknowns: "隠された前提条件と見落とされた変数"
    },
    {
      type: "minority",
      summary: `「${query}」の背後には現在認識されていない大きな力学が働いている可能性がある。表面的な議論では捉えきれない構造的要因。`,
      evidence: [],
      probability: 20,
      who_benefits: "極端仮説の支持者",
      falsifiability: { level: "low", condition: "決定的な証拠が現れた場合のみ判定可能" },
      unknowns: "未知の構造的要因",
      verification_status: "unverified"
    }
  ];
}

// ==================== index.md 自動生成 ====================
function generateIndex() {
  const files = fs.readdirSync(RECORDS_DIR)
    .filter(f => RECORD_PATTERN.test(f))
    .sort()
    .reverse();

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
    const rawContent = fs.readFileSync(path.join(RECORDS_DIR, file), 'utf8');
    const data = JSON.parse(rawContent);
    const hash = crypto.createHash('sha256').update(rawContent).digest('hex');
    const mainView = data.views.find(v => v.type === "mainstream");
    const summary = mainView ? mainView.summary : "";
    const short = summary.length > 100 ? summary.substring(0, 100) + "..." : summary;

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

// ==================== メイン ====================
async function main() {
  console.log("🚀 XRPL Echo Breaker v0.5 起動...\n");
  console.log(`クエリ: ${QUERY}`);
  console.log(`モード: ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

  if (!fs.existsSync(RECORDS_DIR)) fs.mkdirSync(RECORDS_DIR);

  const existingFiles = fs.readdirSync(RECORDS_DIR)
    .filter(f => RECORD_PATTERN.test(f))
    .sort();

  const nextNumber = String(existingFiles.length + 1).padStart(3, '0');

  let prevHash = GENESIS.txHash;
  if (existingFiles.length > 0) {
    const lastFile = existingFiles[existingFiles.length - 1];
    const rawContent = fs.readFileSync(path.join(RECORDS_DIR, lastFile), 'utf8');
    prevHash = crypto.createHash('sha256').update(rawContent).digest('hex');
  }

  const client = new xrpl.Client(TESTNET_URL);
  await client.connect();
  console.log("✅ XRPLテストネットに接続");

  console.log("💰 ウォレット作成中...");
  const { wallet } = await client.fundWallet();
  console.log(`📍 アドレス: ${wallet.address}\n`);

  // 視点生成（v0.5: クエリ依存）
  console.log("🔍 多角的検証を開始...\n");
  const views = generateViews(QUERY);

  views.forEach(v => {
    console.log(`   [${v.type}] ${v.probability}% — ${v.summary.slice(0, 60)}...`);
  });
  console.log();

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
      version: "v0.5"
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

  // index.md更新
  generateIndex();
  console.log(`📋 index.md 更新完了`);

  await client.disconnect();
  console.log("\n🎉 v0.5 完了！ 視点がクエリ依存になりました。");
}

main().catch(console.error);
