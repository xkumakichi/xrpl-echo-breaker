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

### Record #002 — AIは人間の創造性を超える可能性があるか？
- 同じクエリに対して3視点を生成し、XRPLに永久記録
- 各視点に「誰が得するか」「反証条件」「不確実性」を明示

## Usage

```bash
git clone https://github.com/xkumakichi/xrpl-echo-breaker.git
cd xrpl-echo-breaker
npm install

# 記録を作成（XRPLテストネットに書き込み）
node echo-breaker.js "検証したいクエリ"

# dry-runで確認のみ
node echo-breaker.js --dry-run "検証したいクエリ"
```

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
├── echo-breaker.js    # メインスクリプト (v0.4)
├── genesis.js         # Genesis刻印スクリプト
├── package.json
├── records/
│   ├── index.md       # 全記録の一覧（自動生成）
│   ├── record-NNN.json
│   └── record-NNN.md
└── archive/           # v0.2以前の旧ファイル
```

## Roadmap

- [x] v0.1 — MVP（多角的視点 + XRPL記録）
- [x] v0.2 — falsifiabilityオブジェクト化、分散スコア自動計算
- [x] v0.31 — ハッシュ連鎖、Genesis接続、連番自動化
- [x] v0.4 — index.md自動生成、archive整理、Protocol Rules
- [ ] v0.5 — 視点生成の関数化（クエリ依存の動的分析）
- [ ] v0.6 — AI API接続（半自動化）
- [ ] v0.7 — 完全自動化

---

Made with curiosity and persistence.

このプロトコルはHiro.Tによって Genesis が刻まれ、思考のブロックチェーンとして成長していきます。
