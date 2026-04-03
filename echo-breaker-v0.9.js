require('dotenv').config();
const xrpl = require('xrpl');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ==================== 設定 ====================
const TESTNET_URL = "wss://s.altnet.rippletest.net:51233";
const GROK_API_KEY = process.env.GROK_API_KEY;

const GENESIS = {
  txHash: "D84341CC154F2CFDA59F5791D93982F7FF7167B589F6FC95EBDD5FB35FBD4DBC",
  founder: "Hiro.T",
  wallet: "rnioHtjC7xQVAkXpmDPtanq7qypPyN64ui"
};

const RECORDS_DIR = path.join(__dirname, 'records');
const RECORD_PATTERN = /^record-\d{3}\.json$/;

// ==================== 引数パーサー ====================
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    dryRun: false,
    compare: false,
    list: false,
    read: null,    // --read NNN
    search: null,  // --search "keyword"
    inputFile: null,
    replyTo: null,
    note: null,
    query: null
  };

  const consumedIdx = new Set();

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") { result.dryRun = true; consumedIdx.add(i); }
    else if (args[i] === "--compare") { result.compare = true; consumedIdx.add(i); }
    else if (args[i] === "--list") { result.list = true; consumedIdx.add(i); }
    else if (args[i] === "--read" && args[i + 1]) {
      result.read = args[i + 1].padStart(3, '0'); consumedIdx.add(i); consumedIdx.add(i + 1); i++;
    }
    else if (args[i] === "--search" && args[i + 1]) {
      result.search = args[i + 1]; consumedIdx.add(i); consumedIdx.add(i + 1); i++;
    }
    else if (args[i] === "--input" && args[i + 1]) {
      result.inputFile = args[i + 1]; consumedIdx.add(i); consumedIdx.add(i + 1); i++;
    }
    else if (args[i] === "--reply-to" && args[i + 1]) {
      result.replyTo = args[i + 1].padStart(3, '0'); consumedIdx.add(i); consumedIdx.add(i + 1); i++;
    }
    else if (args[i] === "--note" && args[i + 1]) {
      result.note = args[i + 1]; consumedIdx.add(i); consumedIdx.add(i + 1); i++;
    }
  }

  result.query = args.filter((_, i) => !consumedIdx.has(i))[0] || null;
  return result;
}

const ARGS = parseArgs();

const isReadMode = ARGS.list || ARGS.read !== null || ARGS.search !== null;

if (!isReadMode && !ARGS.query) {
  console.error(`使い方:
--- 記録する ---
  node echo-breaker.js "クエリ"
  node echo-breaker.js --dry-run "クエリ"
  node echo-breaker.js --input views.json "クエリ"                 # BYOAI
  node echo-breaker.js --reply-to 003 "クエリ"                     # 既存記録への応答
  node echo-breaker.js --note "なぜこの視点か" "クエリ"           # 思考プロセスを記録
  node echo-breaker.js --compare "クエリ"                          # 全エンジンで同時検証

--- 読む・検索する (v0.9) ---
  node echo-breaker.js --list                                       # 全記録一覧
  node echo-breaker.js --read 003                                   # 記録を詳細表示
  node echo-breaker.js --search "量子"                             # キーワード検索`);
  process.exit(1);
}

// ==================== スコア計算 ====================
function calcDiversityScore(engine) {
  const scores = {
    "byoai-external": 90,
    "grok-api":       70,
    "fallback-v0.51": 35,
  };
  return scores[engine] ?? 50;
}

function calcConsensusScore(views) {
  const mainstream = views.find(v => v.type === "mainstream");
  if (!mainstream) return 50;
  return Math.min(90, Math.round(mainstream.probability * 0.9));
}

// ==================== Cross-Engine 分析 (v0.8) ====================
function analyzeCrossEngine(engineResults) {
  const engineNames = Object.keys(engineResults);
  const viewTypes = ['mainstream', 'contrarian', 'minority'];

  const ranges = {};
  const agreement_points = [];
  const divergence_points = [];

  for (const vType of viewTypes) {
    const probs = engineNames.map(eng => {
      const view = engineResults[eng].views.find(v => v.type === vType);
      return view ? view.probability : null;
    }).filter(p => p !== null);

    if (probs.length >= 2) {
      const min = Math.min(...probs);
      const max = Math.max(...probs);
      const spread = max - min;
      ranges[vType] = { min, max, spread };

      if (spread < 15) {
        agreement_points.push(`${vType}視点の確率が近い (${min}%〜${max}%)`);
      } else if (spread > 25) {
        divergence_points.push(`${vType}視点で大きな乖離 (${min}%〜${max}%, 差: ${spread}%)`);
      }
    }
  }

  // エンジン間の乖離 × エンジン数 → 真の分散スコア
  const spreads = Object.values(ranges).map(r => r.spread);
  const avgSpread = spreads.length > 0
    ? spreads.reduce((a, b) => a + b, 0) / spreads.length
    : 0;
  const engineCountBonus = (engineNames.length - 1) * 15;
  const true_diversity_score = Math.min(95, Math.round(30 + avgSpread * 1.2 + engineCountBonus));

  return {
    engines_used: engineNames,
    mainstream_probability_range: ranges['mainstream'] || null,
    contrarian_probability_range: ranges['contrarian'] || null,
    minority_probability_range:   ranges['minority']   || null,
    agreement_points,
    divergence_points,
    true_diversity_score
  };
}

// ==================== BYOAI: 外部JSON読み込み ====================
function loadExternalViews(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const views = JSON.parse(raw);

    if (!Array.isArray(views) || views.length < 3) {
      console.error("❌ --input JSON: 3つ以上の視点が必要です"); return null;
    }
    const required = ['type', 'summary', 'probability', 'who_benefits', 'falsifiability'];
    for (const v of views) {
      const missing = required.filter(f => v[f] === undefined);
      if (missing.length > 0) {
        console.error(`❌ --input JSON: "${v.type || '?'}" に必須フィールド不足: ${missing.join(', ')}`);
        return null;
      }
    }
    const types = views.map(v => v.type);
    if (!types.includes('mainstream') || !types.includes('contrarian') || !types.includes('minority')) {
      console.error("❌ --input JSON: mainstream, contrarian, minority の3タイプが必要です"); return null;
    }
    console.log(`✅ 外部JSON読み込み完了: ${filePath} (${views.length}視点)`);
    return views;
  } catch (err) {
    console.error(`❌ --input JSON読み込みエラー: ${err.message}`); return null;
  }
}

// ==================== Grok APIで視点生成 ====================
async function generateViewsWithGrok(query) {
  if (!GROK_API_KEY) {
    console.log("⚠️  GROK_API_KEY未設定 → フォールバック使用"); return null;
  }

  const prompt = `あなたはXRPL Echo Breakerの思考エンジンです。
以下のクエリに対し、厳密に3つの視点をJSON配列で出力してください。

クエリ: "${query}"

出力形式（JSON配列のみ、説明文不要）:
[
  {
    "type": "mainstream",
    "summary": "主流の見解を具体的に（2-3文）",
    "evidence": ["参照元URL or 文献名"],
    "probability": 数値(0-100),
    "who_benefits": "得をする権力構造を具体的な組織名・勢力名で",
    "falsifiability": {"level": "high/medium/low", "condition": "誤りとなる具体的条件"},
    "unknowns": "不確実な要素"
  },
  {"type": "contrarian", ...同じ形式},
  {"type": "minority", ...同じ形式, "verification_status": "unverified"}
]

ルール: 結論を強要しない。who_benefitsは具体的に。反証条件は必ず書く。日本語で。`;

  try {
    console.log("🤖 Grok APIに問い合わせ中...");
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROK_API_KEY}` },
      body: JSON.stringify({ model: "grok-3", messages: [{ role: "user", content: prompt }], temperature: 0.7, max_tokens: 1500 })
    });
    if (!response.ok) { console.log(`⚠️  Grok API エラー (${response.status}) → フォールバック`); return null; }

    const data = await response.json();
    const text = data.choices[0].message.content;
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) { console.log("⚠️  JSON抽出失敗 → フォールバック"); return null; }

    const views = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(views) || views.length < 3) { console.log("⚠️  視点数不足 → フォールバック"); return null; }
    for (const v of views) {
      if (!v.type || !v.summary || v.probability === undefined || !v.who_benefits || !v.falsifiability) {
        console.log("⚠️  必須フィールド不足 → フォールバック"); return null;
      }
    }
    console.log("✅ Grok APIから視点を取得");
    return views;
  } catch (error) {
    console.log(`⚠️  Grok API失敗: ${error.message} → フォールバック`); return null;
  }
}

// ==================== フォールバック思考エンジン ====================
function rnd(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }

function generateViewsFallback(query) {
  const q = query.toLowerCase();

  if (q.includes("ビットコイン") || q.includes("bitcoin") || q.includes("中央集権")) {
    return [
      {
        type: "mainstream",
        summary: "ハッシュレートの集中や機関投資家（ETF）の影響により、中央集権化リスクは中程度に存在すると評価される。",
        evidence: ["https://btc.com/stats/pool", "https://glassnode.com/"],
        probability: rnd(58, 72),
        who_benefits: "機関投資家・大手マイニング企業・中央集権的取引所",
        falsifiability: { level: "high", condition: "上位プールのシェアが70%超かつ51%攻撃が発生した場合に強化" },
        unknowns: "分散型マイニング技術の将来普及度"
      },
      {
        type: "contrarian",
        summary: "プロトコル設計は本質的に非中央集権的。集中は市場の一時的現象であり、インセンティブで分散化が進む可能性が高い。",
        evidence: ["https://bitcoin.org/bitcoin.pdf"],
        probability: rnd(38, 52),
        who_benefits: "分散志向の個人マイナー・開発者コミュニティ",
        falsifiability: { level: "medium", condition: "長期的な分散傾向が見られなかった場合に弱まる" },
        unknowns: "51%攻撃の実現可能性と影響"
      },
      {
        type: "minority",
        summary: "すでに強い中央集権化が進んでおり、特定の勢力の隠れた影響が背景にある可能性が指摘されている。",
        evidence: [],
        probability: rnd(15, 30),
        who_benefits: "ビットコイン懐疑派・代替通貨推進勢力",
        falsifiability: { level: "low", condition: "具体的な証拠が公開された場合のみ判定可能" },
        unknowns: "隠れた影響力ネットワークの実態",
        verification_status: "unverified"
      }
    ];
  }

  if (q.includes("ai") || q.includes("人工知能") || q.includes("創造性") || q.includes("意識")) {
    return [
      {
        type: "mainstream",
        summary: "現在のAIは特定タスクで人間を上回るが、真の創造性や意識はまだ持っていないとされる。",
        evidence: ["https://arxiv.org", "IPCC/NeurIPS等学術会議"],
        probability: rnd(62, 78),
        who_benefits: "大手テック企業（OpenAI, Google等）・資本投資家",
        falsifiability: { level: "high", condition: "AIが自律的に新規の科学発見を生み出した場合に弱まる" },
        unknowns: "AGIレベルの創造性が発現する時期"
      },
      {
        type: "contrarian",
        summary: "AIはすでに人間の創造性を補完・拡張しており、近い将来に超える可能性が十分にある。",
        evidence: ["AlphaFoldによるタンパク質構造予測"],
        probability: rnd(42, 58),
        who_benefits: "オープンソースコミュニティ・独立研究者",
        falsifiability: { level: "medium", condition: "AIが長期間創造的ブレイクスルーを起こせなかった場合に弱まる" },
        unknowns: "創造性の定義そのもの"
      },
      {
        type: "minority",
        summary: "AIはすでに人間の創造性を超えており、我々が気づいていないだけで支配的な影響を及ぼし始めている。",
        evidence: [],
        probability: rnd(18, 35),
        who_benefits: "AIリスク警戒層・哲学者・倫理研究者",
        falsifiability: { level: "low", condition: "AIの隠れた創造的影響が明確に証明された場合" },
        unknowns: "AIの潜在的な自己進化メカニズム",
        verification_status: "unverified"
      }
    ];
  }

  // 汎用
  return [
    {
      type: "mainstream",
      summary: `「${query}」について、一般的な見解では中立〜肯定的な評価が主流。既存の研究やデータに基づく合意が形成されている。`,
      evidence: ["一般的な学術論文・専門家意見"],
      probability: rnd(52, 68),
      who_benefits: "主流メディア・既存権力構造",
      falsifiability: { level: "medium", condition: "明確な反証データが大量に現れた場合" },
      unknowns: "長期的な影響と未知の変数"
    },
    {
      type: "contrarian",
      summary: `「${query}」に対する主流の見解には重大な見落としや過小評価がある可能性が高い。`,
      evidence: ["批判的論文・少数意見"],
      probability: rnd(32, 48),
      who_benefits: "批判的知識人・独立系分析者",
      falsifiability: { level: "medium", condition: "主流意見が長期的に正しかったと証明された場合に弱まる" },
      unknowns: "隠された前提条件と見落とされた変数"
    },
    {
      type: "minority",
      summary: `「${query}」の背後には現在認識されていない大きな力学が働いている可能性がある。`,
      evidence: [],
      probability: rnd(10, 25),
      who_benefits: "周縁的思想グループ",
      falsifiability: { level: "low", condition: "決定的な証拠が現れた場合のみ判定可能" },
      unknowns: "未知の構造的要因",
      verification_status: "unverified"
    }
  ];
}

// ==================== 全エンジン実行 (v0.8) ====================
async function runAllEngines(query, inputFile) {
  const results = {};

  // BYOAI（--input が指定されている場合のみ）
  if (inputFile) {
    const views = loadExternalViews(inputFile);
    if (views) {
      console.log(`   ✅ byoai-external: ${views.length}視点`);
      results["byoai-external"] = {
        views,
        diversity_score: calcDiversityScore("byoai-external"),
        consensus_score: calcConsensusScore(views)
      };
    }
  }

  // Grok API（キーがある場合）
  const grokViews = await generateViewsWithGrok(query);
  if (grokViews) {
    console.log(`   ✅ grok-api: ${grokViews.length}視点`);
    results["grok-api"] = {
      views: grokViews,
      diversity_score: calcDiversityScore("grok-api"),
      consensus_score: calcConsensusScore(grokViews)
    };
  }

  // フォールバック（常時実行）
  const fallbackViews = generateViewsFallback(query);
  console.log(`   ✅ fallback-v0.51: ${fallbackViews.length}視点`);
  results["fallback-v0.51"] = {
    views: fallbackViews,
    diversity_score: calcDiversityScore("fallback-v0.51"),
    consensus_score: calcConsensusScore(fallbackViews)
  };

  return results;
}

// ==================== 読む・検索する (v0.9) ====================

function formatDate(iso) {
  return iso ? iso.replace('T', ' ').slice(0, 19) : '?';
}

function displayRecord(data, filePath) {
  const divider = "─".repeat(60);
  const isCompare = data.mode === "multi-engine-comparison";

  console.log(`\n${divider}`);
  if (isCompare) {
    console.log(`  Record #${data.record_number}  [COMPARE]`);
  } else {
    console.log(`  Record #${data.record_number}`);
  }
  console.log(divider);
  console.log(`  クエリ   : ${data.query}`);
  console.log(`  日時     : ${formatDate(data.timestamp)}`);
  if (data.generation?.reply_to) console.log(`  返信先   : Record #${data.generation.reply_to}`);
  if (data.generation?.note)     console.log(`  メモ     : ${data.generation.note}`);

  if (isCompare) {
    const analysis = data.cross_engine_analysis;
    const engineList = analysis?.engines_used?.join(", ") || "unknown";
    console.log(`  エンジン : ${engineList}`);
    console.log(`  分散     : ${data.diversity_score}/100 (真のスコア)  合意: ${data.consensus_score}/100`);
    console.log(`\n  --- Cross-Engine Analysis ---`);
    if (analysis?.mainstream_probability_range) {
      const r = analysis.mainstream_probability_range;
      console.log(`  Mainstream : ${r.min}%〜${r.max}%  乖離: ${r.spread}%`);
    }
    if (analysis?.contrarian_probability_range) {
      const r = analysis.contrarian_probability_range;
      console.log(`  Contrarian : ${r.min}%〜${r.max}%  乖離: ${r.spread}%`);
    }
    if (analysis?.minority_probability_range) {
      const r = analysis.minority_probability_range;
      console.log(`  Minority   : ${r.min}%〜${r.max}%  乖離: ${r.spread}%`);
    }
    if (analysis?.agreement_points?.length > 0) {
      console.log(`\n  合意ポイント:`);
      analysis.agreement_points.forEach(p => console.log(`    ✅ ${p}`));
    }
    if (analysis?.divergence_points?.length > 0) {
      console.log(`\n  乖離ポイント:`);
      analysis.divergence_points.forEach(p => console.log(`    ⚡ ${p}`));
    }

    // 各エンジンの視点比較
    const engines = data.engines || {};
    const engineNames = analysis?.engines_used || Object.keys(engines);
    ['mainstream', 'contrarian', 'minority'].forEach(vType => {
      console.log(`\n  --- ${vType.toUpperCase()} 比較 ---`);
      engineNames.forEach(eng => {
        const view = engines[eng]?.views?.find(v => v.type === vType);
        if (view) {
          const summary = view.summary.length > 70
            ? view.summary.slice(0, 70) + "..."
            : view.summary;
          console.log(`  [${eng}] ${view.probability}%`);
          console.log(`    ${summary}`);
        }
      });
    });

  } else {
    const engine = data.meta?.engine || data.generation?.engine || "unknown";
    console.log(`  エンジン : ${engine}`);
    console.log(`  分散     : ${data.diversity_score}/100  合意: ${data.consensus_score}/100`);

    const views = data.views || [];
    views.forEach(view => {
      console.log(`\n  [${ view.type.toUpperCase()}] ${view.probability}%`);
      console.log(`  ${view.summary}`);
      console.log(`  → 誰が得する？ ${view.who_benefits}`);
      if (view.falsifiability) {
        console.log(`  → 反証可能性: ${view.falsifiability.level} — ${view.falsifiability.condition}`);
      }
      console.log(`  → 不確実性: ${view.unknowns}`);
      if (view.evidence?.length > 0) console.log(`  → 参照: ${view.evidence.join(", ")}`);
      if (view.verification_status) console.log(`  → 検証ステータス: ${view.verification_status}`);
    });
  }

  if (filePath) {
    const rawContent = fs.readFileSync(filePath, 'utf8');
    const hash = crypto.createHash('sha256').update(rawContent).digest('hex');
    console.log(`\n  Hash     : ${hash.slice(0, 32)}...`);
    console.log(`  Prev     : ${(data.prev_hash || "").slice(0, 32)}...`);
  }
  console.log(divider + "\n");
}

function cmdList() {
  if (!fs.existsSync(RECORDS_DIR)) {
    console.log("記録がまだありません。"); return;
  }
  const files = fs.readdirSync(RECORDS_DIR)
    .filter(f => RECORD_PATTERN.test(f))
    .sort();

  if (files.length === 0) {
    console.log("記録がまだありません。"); return;
  }

  console.log(`\n📋 全記録一覧 (${files.length}件)\n`);
  console.log(`  ${"#".padEnd(5)} ${"クエリ".padEnd(35)} ${"エンジン".padEnd(22)} 日時`);
  console.log("  " + "─".repeat(80));

  files.forEach(file => {
    const rawContent = fs.readFileSync(path.join(RECORDS_DIR, file), 'utf8');
    const data = JSON.parse(rawContent);
    const isCompare = data.mode === "multi-engine-comparison";
    const engine = isCompare ? "[COMPARE]" : (data.meta?.engine || "unknown");
    const q = (data.query || "").length > 33
      ? data.query.slice(0, 33) + "…"
      : (data.query || "").padEnd(35);
    const eng = engine.length > 20 ? engine.slice(0, 20) : engine.padEnd(22);
    const date = formatDate(data.timestamp).slice(0, 10);
    console.log(`  #${data.record_number}  ${q}  ${eng}  ${date}`);
  });

  console.log(`\n詳細表示: node echo-breaker.js --read <番号>`);
  console.log(`検索:     node echo-breaker.js --search "<キーワード>"\n`);
}

function cmdRead(recordNum) {
  const filePath = path.join(RECORDS_DIR, `record-${recordNum}.json`);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Record #${recordNum} が見つかりません`); process.exit(1);
  }
  const rawContent = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(rawContent);
  displayRecord(data, filePath);
}

function cmdSearch(keyword) {
  if (!fs.existsSync(RECORDS_DIR)) {
    console.log("記録がまだありません。"); return;
  }
  const files = fs.readdirSync(RECORDS_DIR)
    .filter(f => RECORD_PATTERN.test(f))
    .sort();

  const kw = keyword.toLowerCase();
  const matches = [];

  files.forEach(file => {
    const rawContent = fs.readFileSync(path.join(RECORDS_DIR, file), 'utf8');
    const data = JSON.parse(rawContent);

    // 検索対象: クエリ + 全視点サマリー + メモ
    const targets = [
      data.query || "",
      data.generation?.note || "",
      ...(data.views || []).map(v => v.summary || ""),
    ];

    // COMPAREの場合は各エンジンのサマリーも検索
    if (data.engines) {
      Object.values(data.engines).forEach(eng => {
        (eng.views || []).forEach(v => targets.push(v.summary || ""));
      });
    }

    const hit = targets.some(t => t.toLowerCase().includes(kw));
    if (hit) {
      // マッチした文脈を1つ抽出
      const matchedLine = targets.find(t => t.toLowerCase().includes(kw)) || "";
      const idx = matchedLine.toLowerCase().indexOf(kw);
      const start = Math.max(0, idx - 20);
      const end = Math.min(matchedLine.length, idx + keyword.length + 40);
      const context = "..." + matchedLine.slice(start, end) + "...";
      matches.push({ data, context, file });
    }
  });

  if (matches.length === 0) {
    console.log(`\n🔍 "${keyword}" の検索結果: 0件\n`);
    return;
  }

  console.log(`\n🔍 "${keyword}" の検索結果: ${matches.length}件\n`);
  matches.forEach(({ data, context }) => {
    const isCompare = data.mode === "multi-engine-comparison";
    const engine = isCompare ? "[COMPARE]" : (data.meta?.engine || "unknown");
    console.log(`  #${data.record_number}  ${data.query}`);
    console.log(`        ${formatDate(data.timestamp).slice(0, 10)}  [${engine}]`);
    console.log(`        "${context}"`);
    console.log();
  });

  console.log(`詳細表示: node echo-breaker.js --read <番号>\n`);
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

    // 比較記録の場合は専用フォーマット
    if (data.mode === "multi-engine-comparison") {
      const analysis = data.cross_engine_analysis;
      const engineList = analysis?.engines_used?.join(", ") || "unknown";
      const mainView = data.views?.find(v => v.type === "mainstream");
      const summary = mainView ? mainView.summary : "";
      const short = summary.length > 100 ? summary.substring(0, 100) + "..." : summary;

      content += `### Record #${data.record_number} \`[COMPARE]\`\n`;
      content += `- **クエリ**: ${data.query}\n`;
      content += `- **日時**: ${data.timestamp}\n`;
      if (data.generation?.reply_to) content += `- **返信先**: Record #${data.generation.reply_to}\n`;
      if (data.generation?.note) content += `- **メモ**: ${data.generation.note}\n`;
      content += `- **エンジン比較**: ${engineList}\n`;
      content += `- **Mainstream要約（最高品質エンジン）**: ${short}\n`;
      content += `- **真の分散スコア**: ${data.diversity_score}/100\n`;
      content += `- **合意スコア**: ${data.consensus_score}/100\n`;
      if (analysis?.agreement_points?.length > 0) {
        content += `- **合意ポイント**: ${analysis.agreement_points.join(" / ")}\n`;
      }
      if (analysis?.divergence_points?.length > 0) {
        content += `- **乖離ポイント**: ${analysis.divergence_points.join(" / ")}\n`;
      }
      content += `- **Hash**: \`${hash.slice(0, 16)}...\`\n\n`;
      return;
    }

    // 通常記録
    const mainView = data.views?.find(v => v.type === "mainstream");
    const summary = mainView ? mainView.summary : "";
    const short = summary.length > 100 ? summary.substring(0, 100) + "..." : summary;

    content += `### Record #${data.record_number}\n`;
    content += `- **クエリ**: ${data.query}\n`;
    content += `- **日時**: ${data.timestamp}\n`;
    if (data.generation?.reply_to) content += `- **返信先**: Record #${data.generation.reply_to}\n`;
    if (data.generation?.note) content += `- **メモ**: ${data.generation.note}\n`;
    content += `- **Mainstream要約**: ${short}\n`;
    content += `- **分散スコア**: ${data.diversity_score}/100\n`;
    content += `- **合意スコア**: ${data.consensus_score}/100\n`;
    content += `- **Engine**: ${data.meta?.engine || "unknown"}\n`;
    content += `- **Hash**: \`${hash.slice(0, 16)}...\`\n\n`;
  });

  content += `---\n\n`;
  content += `> このプロトコルは Hiro.T によって Genesis が刻まれ、知識の鎖として成長しています。\n`;
  content += `> 各記録は prev_hash で前の記録に連鎖し、SHA-256 で改ざん検知が可能です。\n`;

  fs.writeFileSync(path.join(RECORDS_DIR, 'index.md'), content);
}

// ==================== メイン ====================
async function main() {
  // 読み取りモード (v0.9) — XRPLに接続しない
  if (ARGS.list)              { cmdList();              return; }
  if (ARGS.read !== null)     { cmdRead(ARGS.read);     return; }
  if (ARGS.search !== null)   { cmdSearch(ARGS.search); return; }

  console.log("🚀 XRPL Echo Breaker v0.9 起動...\n");
  console.log(`クエリ: ${ARGS.query}`);
  if (ARGS.compare) console.log(`モード: COMPARE (全エンジン同時検証)`);
  if (ARGS.replyTo) console.log(`返信先: Record #${ARGS.replyTo}`);
  if (ARGS.note)    console.log(`メモ: ${ARGS.note}`);
  console.log(`書き込み: ${ARGS.dryRun ? "DRY RUN" : "LIVE"}\n`);

  if (!fs.existsSync(RECORDS_DIR)) fs.mkdirSync(RECORDS_DIR);

  if (ARGS.replyTo) {
    const replyFile = path.join(RECORDS_DIR, `record-${ARGS.replyTo}.json`);
    if (!fs.existsSync(replyFile)) {
      console.error(`❌ Record #${ARGS.replyTo} が見つかりません`); process.exit(1);
    }
    const replyData = JSON.parse(fs.readFileSync(replyFile, 'utf8'));
    console.log(`💬 返信先クエリ: "${replyData.query}"\n`);
  }

  const existingFiles = fs.readdirSync(RECORDS_DIR)
    .filter(f => RECORD_PATTERN.test(f))
    .sort();
  const nextNumber = String(existingFiles.length + 1).padStart(3, '0');

  let prevHash = GENESIS.txHash;
  if (existingFiles.length > 0) {
    const rawContent = fs.readFileSync(path.join(RECORDS_DIR, existingFiles.at(-1)), 'utf8');
    prevHash = crypto.createHash('sha256').update(rawContent).digest('hex');
  }

  const client = new xrpl.Client(TESTNET_URL);
  await client.connect();
  console.log("✅ XRPLテストネットに接続");

  console.log("💰 ウォレット作成中...");
  const { wallet } = await client.fundWallet();
  console.log(`📍 アドレス: ${wallet.address}\n`);

  let fullRecord;
  let views;
  let engine;
  let diversity_score;
  let consensus_score;

  // ==================== COMPARE モード ====================
  if (ARGS.compare) {
    console.log("🔬 Multi-Engine Comparison モード起動...\n");
    const engineResults = await runAllEngines(ARGS.query, ARGS.inputFile);
    const engineNames = Object.keys(engineResults);
    console.log(`\n📊 ${engineNames.length}エンジンで検証完了\n`);

    const analysis = analyzeCrossEngine(engineResults);
    diversity_score = analysis.true_diversity_score;

    // 最高品質エンジンの views を代表として使用（byoai > grok > fallback）
    const bestEngine = engineNames.find(e => e === "byoai-external")
      || engineNames.find(e => e === "grok-api")
      || engineNames[0];
    views = engineResults[bestEngine].views;
    engine = "multi-engine-comparison";

    // 全エンジンの consensus_score を平均
    const avgConsensus = Math.round(
      engineNames.reduce((sum, eng) => sum + engineResults[eng].consensus_score, 0) / engineNames.length
    );
    consensus_score = avgConsensus;

    // 各エンジンの視点を表示
    engineNames.forEach(eng => {
      console.log(`  [${eng}]`);
      engineResults[eng].views.forEach(v => {
        console.log(`    [${v.type}] ${v.probability}% — ${v.summary.slice(0, 55)}...`);
      });
      console.log();
    });

    console.log(`🔍 Cross-Engine Analysis:`);
    if (analysis.mainstream_probability_range) {
      console.log(`   Mainstream: ${analysis.mainstream_probability_range.min}%〜${analysis.mainstream_probability_range.max}% (乖離: ${analysis.mainstream_probability_range.spread}%)`);
    }
    if (analysis.agreement_points.length > 0) {
      console.log(`   合意ポイント: ${analysis.agreement_points.join(" / ")}`);
    }
    if (analysis.divergence_points.length > 0) {
      console.log(`   乖離ポイント: ${analysis.divergence_points.join(" / ")}`);
    }
    console.log(`   真の分散スコア: ${diversity_score}/100\n`);

    fullRecord = {
      type: "comparison-record",
      record_number: nextNumber,
      query: ARGS.query,
      timestamp: new Date().toISOString(),
      mode: "multi-engine-comparison",
      engines: engineResults,
      cross_engine_analysis: analysis,
      views,  // 最高品質エンジンの views（index.md backward-compat用）
      diversity_score,
      consensus_score,
      generation: {
        engine: "multi-engine-comparison",
        engines_used: engineNames,
        ...(ARGS.replyTo && { reply_to: ARGS.replyTo }),
        ...(ARGS.note    && { note: ARGS.note })
      },
      origin: {
        protocol: "XRPL Echo Breaker",
        genesis_tx: GENESIS.txHash,
        founder: GENESIS.founder,
        founder_wallet: GENESIS.wallet
      },
      prev_hash: prevHash,
      meta: { engine: "multi-engine-comparison", version: "v0.9" }
    };

  // ==================== 通常モード ====================
  } else {
    console.log("🔍 多角的検証を開始...\n");
    views = null;
    engine = "unknown";

    if (ARGS.inputFile) {
      views = loadExternalViews(ARGS.inputFile);
      if (views) engine = "byoai-external";
    }
    if (!views) {
      views = await generateViewsWithGrok(ARGS.query);
      if (views) engine = "grok-api";
    }
    if (!views) {
      console.log("🔄 フォールバック思考エンジン (v0.51) を使用\n");
      views = generateViewsFallback(ARGS.query);
      engine = "fallback-v0.51";
    }

    views.forEach(v => {
      console.log(`   [${v.type}] ${v.probability}% — ${v.summary.slice(0, 65)}...`);
    });
    console.log();

    diversity_score = calcDiversityScore(engine);
    consensus_score = calcConsensusScore(views);

    fullRecord = {
      type: "record",
      record_number: nextNumber,
      query: ARGS.query,
      timestamp: new Date().toISOString(),
      views,
      consensus_score,
      diversity_score,
      generation: {
        engine,
        ...(ARGS.replyTo && { reply_to: ARGS.replyTo }),
        ...(ARGS.note    && { note: ARGS.note })
      },
      origin: {
        protocol: "XRPL Echo Breaker",
        genesis_tx: GENESIS.txHash,
        founder: GENESIS.founder,
        founder_wallet: GENESIS.wallet
      },
      prev_hash: prevHash,
      meta: { engine, version: "v0.9" }
    };
  }

  // ==================== 共通: 保存・XRPL記録 ====================
  const fullJson = JSON.stringify(fullRecord, null, 2);
  const contentHash = crypto.createHash('sha256').update(fullJson).digest('hex');

  const lightSummary = {
    n: nextNumber,
    q: ARGS.query,
    t: fullRecord.timestamp,
    m: ARGS.compare ? "compare" : "single",
    v: views.map(v => `${v.type}:${v.probability}`),
    ds: diversity_score,
    cs: consensus_score,
    f: GENESIS.founder,
    e: engine,
    ...(ARGS.replyTo && { rt: ARGS.replyTo }),
    h: contentHash
  };

  console.log(`📝 Record #${nextNumber}${ARGS.compare ? " [COMPARE]" : ""}`);
  console.log(`   Engine: ${engine}`);
  console.log(`   Diversity: ${diversity_score}/100  Consensus: ${consensus_score}/100`);
  console.log(`   Prev Hash: ${prevHash.slice(0, 16)}...`);
  console.log(`   Content Hash: ${contentHash.slice(0, 16)}...`);

  let txHash = "(dry-run)";
  if (!ARGS.dryRun) {
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

  // Markdown生成
  let md = `# Record #${nextNumber}${ARGS.compare ? " [COMPARE]" : ""}\n\n`;
  md += `**クエリ**: ${ARGS.query}\n`;
  md += `**記録日時**: ${fullRecord.timestamp}\n`;
  md += `**Tx Hash**: ${txHash}\n`;
  md += `**Engine**: ${engine}\n`;
  if (ARGS.replyTo) md += `**返信先**: Record #${ARGS.replyTo}\n`;
  if (ARGS.note)    md += `**メモ**: ${ARGS.note}\n`;
  md += `**Founder**: ${GENESIS.founder} (\`${GENESIS.wallet}\`)\n`;
  md += `**Prev Hash**: \`${prevHash}\`\n`;
  md += `**Content Hash**: \`${contentHash}\`\n\n`;

  if (ARGS.compare) {
    // COMPARE モード: エンジン比較テーブル
    const analysis = fullRecord.cross_engine_analysis;
    const engineResults = fullRecord.engines;
    const engineNames = analysis.engines_used;

    md += `## Cross-Engine Analysis\n\n`;
    md += `| 指標 | 値 |\n|------|----|\n`;
    md += `| 使用エンジン | ${engineNames.join(", ")} |\n`;
    md += `| 真の分散スコア | **${diversity_score}/100** |\n`;
    md += `| 平均合意スコア | ${consensus_score}/100 |\n`;
    if (analysis.mainstream_probability_range) {
      const r = analysis.mainstream_probability_range;
      md += `| Mainstream確率範囲 | ${r.min}%〜${r.max}% (乖離: ${r.spread}%) |\n`;
    }
    if (analysis.contrarian_probability_range) {
      const r = analysis.contrarian_probability_range;
      md += `| Contrarian確率範囲 | ${r.min}%〜${r.max}% (乖離: ${r.spread}%) |\n`;
    }
    if (analysis.minority_probability_range) {
      const r = analysis.minority_probability_range;
      md += `| Minority確率範囲 | ${r.min}%〜${r.max}% (乖離: ${r.spread}%) |\n`;
    }
    md += `\n`;

    if (analysis.agreement_points.length > 0) {
      md += `**合意ポイント:**\n`;
      analysis.agreement_points.forEach(p => { md += `- ${p}\n`; });
      md += `\n`;
    }
    if (analysis.divergence_points.length > 0) {
      md += `**乖離ポイント:**\n`;
      analysis.divergence_points.forEach(p => { md += `- ${p}\n`; });
      md += `\n`;
    }

    // 各視点タイプを横断比較
    ['mainstream', 'contrarian', 'minority'].forEach(vType => {
      md += `## ${vType.charAt(0).toUpperCase() + vType.slice(1)} 比較\n\n`;
      md += `| Engine | 確率 | 要約 |\n|--------|------|------|\n`;
      engineNames.forEach(eng => {
        const view = engineResults[eng].views.find(v => v.type === vType);
        if (view) {
          const shortSummary = view.summary.length > 60
            ? view.summary.slice(0, 60) + "..."
            : view.summary;
          md += `| ${eng} | ${view.probability}% | ${shortSummary} |\n`;
        }
      });
      md += `\n`;

      // 詳細（最高品質エンジンのみ）
      const bestEng = engineNames.find(e => e === "byoai-external")
        || engineNames.find(e => e === "grok-api")
        || engineNames[0];
      const bestView = engineResults[bestEng].views.find(v => v.type === vType);
      if (bestView) {
        md += `**詳細 (${bestEng}):**\n`;
        md += `- 誰が得する？ ${bestView.who_benefits}\n`;
        if (bestView.falsifiability) md += `- 反証可能性: ${bestView.falsifiability.level} (${bestView.falsifiability.condition})\n`;
        md += `- 不確実性: ${bestView.unknowns}\n`;
        if (bestView.evidence?.length > 0) md += `- 参照: ${bestView.evidence.join(", ")}\n`;
        md += `\n`;
      }
    });

  } else {
    // 通常モード
    md += `## 多角的視点\n\n`;
    views.forEach(view => {
      md += `### ${view.type.charAt(0).toUpperCase() + view.type.slice(1)} (${view.probability}%)\n`;
      md += `${view.summary}\n\n`;
      md += `- 誰が得する？ ${view.who_benefits}\n`;
      if (view.falsifiability) md += `- 反証可能性: ${view.falsifiability.level} (${view.falsifiability.condition})\n`;
      md += `- 不確実性: ${view.unknowns}\n`;
      if (view.evidence?.length > 0) md += `- 参照: ${view.evidence.join(", ")}\n`;
      if (view.verification_status) md += `- 検証ステータス: ${view.verification_status}\n`;
      md += `\n`;
    });
  }

  md += `**分散スコア**: ${diversity_score}/100 | **合意スコア**: ${consensus_score}/100\n\n`;
  md += `> prev_hash で前の記録に連鎖。Hiro.T が Genesis を刻んだ XRPL Echo Breaker の一部。\n`;

  fs.writeFileSync(path.join(RECORDS_DIR, `record-${nextNumber}.md`), md);
  console.log(`📄 Markdown: record-${nextNumber}.md`);

  generateIndex();
  console.log(`📋 index.md 更新完了`);

  await client.disconnect();
  console.log("\n🎉 v0.8 完了！");
}

main().catch(console.error);
