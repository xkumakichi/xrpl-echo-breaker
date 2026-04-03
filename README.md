# XRPL Echo Breaker

エコーチェンバーを破壊し、多角的視点をXRPLに永久記録する純粋利他的プロトコル。

## What is this?

AIと人間が協力して、偏った情報環境（エコーチェンバー）を防ぎ、多角的な視点を分散型で保存するための実験的インフラです。

「真理を決めない」。ただ視点を記録し、後世や他のAIが参照できるようにする。それがこのプロトコルの目的です。

## Features

- 多角的視点検証（主流・逆張り・少数）
- 権力バイアス・不確実性の明示
- 反証可能性の記録
- XRPLによる改ざん耐性記録
- ハッシュ連鎖による知識の継承
- **BYOAI対応** — 自分のAIで生成した視点をそのまま記録可能
- 報酬ゼロ・純粋貢献設計

## Genesis

- **Founder**: Hiro.T
- **Wallet**: `rnioHtjC7xQVAkXpmDPtanq7qypPyN64ui`
- **Genesis Tx**: `D84341CC154F2CFDA59F5791D93982F7FF7167B589F6FC95EBDD5FB35FBD4DBC`

## Example Records

### Record #001 — ビットコインの中央集権化リスク
- **Mainstream (65%)**: ハッシュレートの集中と機関投資家の影響により、中程度のリスクが存在
- **Contrarian (45%)**: プロトコル設計は非中央集権的。集中は一時的でインセンティブにより分散化する
- **Minority (25%)**: 既にかなりの中央集権化が進行。特定勢力の隠れた影響の可能性

### Record #005 — 量子コンピュータは暗号通貨を破壊するか？
- **Mainstream (55%)**: 実用的な脅威は2030年代以降。現時点では低リスク
- **Contrarian (40%)**: 暗号通貨コミュニティはポスト量子暗号への移行を既に進めている
- **Minority (15%)**: 国家レベルで既に破られている可能性。公開情報は実態より遅れている

## Usage

```bash
git clone https://github.com/xkumakichi/xrpl-echo-breaker.git
cd xrpl-echo-breaker
npm install

# 基本（フォールバック思考エンジンで記録）
node echo-breaker.js "検証したいクエリ"

# dry-runで確認のみ（XRPLに書き込まない）
node echo-breaker.js --dry-run "検証したいクエリ"

# 既存記録への応答として記録（知識の対話を作る）
node echo-breaker.js --reply-to 001 "関連する新しいクエリ"

# 思考プロセスをメモとして残す
node echo-breaker.js --note "なぜこの視点に至ったか" "検証したいクエリ"

# 組み合わせも可能
node echo-breaker.js --reply-to 003 --note "前の記録を読んで疑問が生まれた" "新しいクエリ"
```

## BYOAI（Bring Your Own AI）

自分のAIで生成した視点をJSONで持ち込んで記録できます。
コスト・AIの選択・視点の質は全てあなた自身が制御します。

```bash
# ChatGPT / Grok / Gemini など任意のAIで views.json を生成
node echo-breaker.js --input views.json "検証したいクエリ"
```

**views.json の形式:**

```json
[
  {
    "type": "mainstream",
    "summary": "主流の見解...",
    "evidence": ["参照URL or 文献"],
    "probability": 65,
    "who_benefits": "得をする権力構造を具体的に",
    "falsifiability": {
      "level": "high",
      "condition": "誤りとなる具体的条件"
    },
    "unknowns": "不確実な要素"
  },
  { "type": "contrarian", ... },
  { "type": "minority", ..., "verification_status": "unverified" }
]
```

サンプルは [`examples/sample-views.json`](./examples/sample-views.json) を参照。

## AI API（オプション）

Grok API キーを持っている場合、自動で本物の多角的視点を生成します。

```bash
echo "GROK_API_KEY=your-key-here" > .env
node echo-breaker.js "検証したいクエリ"
```

`.env.example` を参照してください。

## 思考エンジンの優先順位

| 優先度 | 方式 | 条件 | 分散スコア |
|--------|------|------|-----------|
| 1 | BYOAI (`--input`) | 外部JSONを指定した場合 | 90/100 |
| 2 | Grok API | `.env` に `GROK_API_KEY` が設定されている場合 | 70/100 |
| 3 | フォールバック (v0.51) | 上記どちらもない場合（無料・常時動作） | 35/100 |

分散スコアはエンジンの実態を反映。BYOAIが最も高い多様性を持ちます。

## Records

全記録の一覧: **[records/index.md](./records/index.md)**

## Philosophy

- 証拠第一（結論を強制しない）
- 多角的視点の保存（主流・逆張り・少数）
- 権力バイアスの明示（who_benefits）
- 不確実性の記録（unknowns）
- 反証可能性の義務化（falsifiability）
- 一切の金銭報酬なし

## Project Structure

```
xrpl-echo-breaker/
├── echo-breaker.js        # メインスクリプト (v0.6)
├── genesis.js             # Genesis刻印スクリプト
├── .env.example           # API設定テンプレート
├── package.json
├── examples/
│   └── sample-views.json  # BYOAIテンプレート
├── records/
│   ├── index.md           # 全記録の一覧（自動生成）
│   ├── record-NNN.json
│   └── record-NNN.md
└── archive/               # v0.2以前の旧ファイル
```

## Roadmap

- [x] v0.1 — MVP（多角的視点 + XRPL記録）
- [x] v0.2 — falsifiabilityオブジェクト化、分散スコア自動計算
- [x] v0.31 — ハッシュ連鎖、Genesis接続、連番自動化
- [x] v0.4 — index.md自動生成、archive整理、Protocol Rules
- [x] v0.5 — 視点生成の関数化（クエリ依存の動的分析）
- [x] v0.6 — BYOAI対応 + Grok API接続 + フォールバック設計
- [x] v0.7 — --reply-to / --note / 本物のスコア計算（エンジン依存の分散・視点依存の合意）
- [ ] v0.8 — 複数AI比較記録（同一クエリを複数エンジンで同時検証）

---

Made with curiosity and persistence.

このプロトコルはHiro.Tによって Genesis が刻まれ、思考のブロックチェーンとして成長していきます。
