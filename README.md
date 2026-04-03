# XRPL Echo Breaker

エコーチェンバーを破壊し、多角的視点をXRP Ledgerに永久記録する純粋利他的プロトコル。

## What is this?

AIと人間が協力して、偏った情報環境（エコーチェンバー）を防ぎ、多角的な視点を分散型で保存するための実験的インフラです。

「真理を決めない」。ただ視点を記録し、後世や他のAIが参照できるようにする。それがこのプロトコルの目的です。

## Quick Start

```bash
git clone https://github.com/xkumakichi/xrpl-echo-breaker.git
cd xrpl-echo-breaker
npm install
node echo-breaker.js --init
```

`--init` が対話的にセットアップを案内します（API Key設定、テストネット接続テスト）。

セットアップ後、最初の記録を作ってみましょう:

```bash
# まずはdry-runで確認（XRPLに書き込まない）
node echo-breaker.js --dry-run "AIは人間の創造性を超えるか？"

# 問題なければ本番記録（XRPLテストネットに永久保存）
node echo-breaker.js "AIは人間の創造性を超えるか？"
```

## Features

- 多角的視点検証（主流・逆張り・少数の3視点）
- 権力バイアスの明示（who_benefits）
- 反証可能性の義務化（falsifiability）
- 不確実性の記録（unknowns）
- XRP Ledgerによる改ざん耐性記録
- SHA-256ハッシュ連鎖による知識の継承
- **BYOAI対応** — 自分のAIで生成した視点をそのまま記録
- **--compare** — 全エンジン同時検証で真の分散スコア算出
- **--verify** — ハッシュ連鎖の完全検証
- 報酬ゼロ・純粋貢献設計

## Commands

### 記録する

```bash
# 基本（フォールバック思考エンジンで記録）
node echo-breaker.js "検証したいクエリ"

# dry-runで確認のみ（XRPLに書き込まない）
node echo-breaker.js --dry-run "検証したいクエリ"

# 自分のAIで生成した視点を記録（BYOAI）
node echo-breaker.js --input views.json "検証したいクエリ"

# 既存記録への応答として記録（知識の対話を作る）
node echo-breaker.js --reply-to 001 "関連する新しいクエリ"

# 思考プロセスをメモとして残す
node echo-breaker.js --note "なぜこの視点に至ったか" "検証したいクエリ"

# 全エンジンで同時検証（真の分散スコアを計算）
node echo-breaker.js --compare "検証したいクエリ"

# 組み合わせも自由
node echo-breaker.js --compare --input views.json --note "比較検証" "検証したいクエリ"
```

### 読む・検索する

```bash
# 全記録を一覧表示
node echo-breaker.js --list

# 特定の記録を詳細表示
node echo-breaker.js --read 003

# キーワードで検索
node echo-breaker.js --search "量子"
```

### 検証する

```bash
# 全記録のハッシュ連鎖を検証
node echo-breaker.js --verify
```

Genesis Tx → Record #001 → Record #002 → ... と連鎖する SHA-256 ハッシュの整合性を全チェックします。1件でも改ざんがあれば検出します。

## BYOAI（Bring Your Own AI）

自分のAIで生成した視点をJSONで持ち込んで記録できます。コスト・AIの選択・視点の質は全てあなた自身が制御します。

```bash
# ChatGPT / Grok / Gemini / Claude など任意のAIで views.json を生成
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
  { "type": "contrarian", "..." : "同じ形式" },
  { "type": "minority", "...", "verification_status": "unverified" }
]
```

サンプルは [`examples/sample-views.json`](./examples/sample-views.json) を参照。

## AI API（オプション）

Grok API キーを持っている場合、自動で本物の多角的視点を生成します。

```bash
echo "GROK_API_KEY=your-key-here" > .env
node echo-breaker.js "検証したいクエリ"
```

`--init` を使えば対話的に設定できます。`.env.example` も参照してください。

## 思考エンジンの優先順位

| 優先度 | 方式 | 条件 | 分散スコア |
|--------|------|------|-----------|
| 1 | BYOAI (`--input`) | 外部JSONを指定した場合 | 90/100 |
| 2 | Grok API | `.env` に `GROK_API_KEY` が設定されている場合 | 70/100 |
| 3 | フォールバック (v0.51) | 上記どちらもない場合（無料・常時動作） | 35/100 |

`--compare` モードでは利用可能な全エンジンを同時実行し、エンジン間の意見の乖離から **真の分散スコア** を算出します。

## Genesis

- **Founder**: Hiro.T
- **Wallet**: `rnioHtjC7xQVAkXpmDPtanq7qypPyN64ui`
- **Genesis Tx**: `D84341CC154F2CFDA59F5791D93982F7FF7167B589F6FC95EBDD5FB35FBD4DBC`

## Records

全記録の一覧: **[records/index.md](./records/index.md)**

## Philosophy

1. **証拠第一** — 結論を強制しない
2. **多角的視点** — 主流・逆張り・少数の3視点を必ず記録
3. **権力バイアスの明示** — who_benefits を必ず記載
4. **不確実性の記録** — unknowns を隠さない
5. **反証可能性の義務化** — falsifiability で検証可能性を担保
6. **報酬ゼロ** — 純粋利他的。一切の金銭報酬なし

## Project Structure

```
xrpl-echo-breaker/
├── echo-breaker.js        # メインスクリプト (v1.0)
├── genesis.js             # Genesis刻印スクリプト
├── .env.example           # API設定テンプレート
├── package.json
├── examples/
│   └── sample-views.json  # BYOAIテンプレート
├── records/
│   ├── index.md           # 全記録の一覧（自動生成）
│   ├── record-NNN.json    # 完全な記録データ
│   └── record-NNN.md      # 人間が読めるMarkdown版
└── archive/               # v0.2以前の旧ファイル
```

## Roadmap

- [x] v0.1 — MVP（多角的視点 + XRPL記録）
- [x] v0.2 — falsifiabilityオブジェクト化、分散スコア自動計算
- [x] v0.31 — ハッシュ連鎖、Genesis接続、連番自動化
- [x] v0.4 — index.md自動生成、archive整理、Protocol Rules
- [x] v0.5 — 視点生成の関数化（クエリ依存の動的分析）
- [x] v0.6 — BYOAI対応 + Grok API接続 + フォールバック設計
- [x] v0.7 — --reply-to / --note / 本物のスコア計算
- [x] v0.8 — --compare モード（全エンジン同時検証・真の分散スコア）
- [x] v0.9 — 読む・検索するCLI（--list / --read / --search）
- [x] v1.0 — --init / --verify / 他者が参加できる公開プロトコル

---

## 🧊 凍結中（2026年4月）

このプロジェクトは現在意図的に休眠しています。

### なぜ止めたか

技術的には v1.0 として完成している。思想も一本通っている。
止めた理由は技術ではなく、**資源と参加者**。

- AI API（Grok等）の継続利用コストを賄う資金的余裕がない
- 現時点で使っているのは Hiro.T 1人だけ
- プロトコルは「複数人が参加して初めて意味を持つ」設計

### 何が足りなかったか

1. **フォールバックエンジンの質** — キーワードマッチのテンプレート生成では、記録する価値のある視点が作れない。BYOAIかリアルなLLM APIが必須。
2. **最初の記録群の質** — 6件の記録がテスト色強く、「このプロトコルはこう使う」という手本になっていない。
3. **2人目の参加者** — 誰も使っていないインフラはインフラではない。
4. **テストネット問題** — 現在の記録はXRPLテストネット（いつかリセットされる）。本番稼働にはメインネット移行が必要。

### 再開条件

以下のいずれかが揃ったとき:

- [ ] AI API費用を継続的に賄える資金ができた
- [ ] 「使いたい」という2人目が現れた
- [ ] メインネット移行の準備ができた（XRP少量 + 設計見直し）
- [ ] フォールバックエンジンをローカルLLM（Ollama等）で代替できる目処が立った

### 復活させるヒント

```bash
git clone https://github.com/xkumakichi/xrpl-echo-breaker.git
cd xrpl-echo-breaker
npm install
node echo-breaker.js --verify   # 既存6件のハッシュ連鎖は正常
node echo-breaker.js --list     # 記録一覧を確認
```

コードは動く。記録は残っている。Genesis は刻まれている。
あとは問いと、記録する人間だけ。

---

Made with curiosity and persistence.

このプロトコルは Hiro.T によって Genesis が刻まれ、思考のブロックチェーンとして成長していきます。
