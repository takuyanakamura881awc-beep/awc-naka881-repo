# 日本株 AI 自律売買ツール（PoC）

AI が **自律的・総合的に判断**して日本株の売買シグナルを生成するツールの Proof of Concept です。
複数の専門エージェントを **ハーネス（オーケストレーター）** で束ね、それぞれに **役割に応じた Claude モデル**を割り当てるマルチエージェント設計を採用しています。

> ⚠️ **重要 / 免責**
> 本 PoC は **ペーパートレード（仮想売買）専用**です。実口座への発注機能は含みません。
> 出力は投資助言ではなく、あくまで技術検証用のシミュレーションです。実運用は自己責任かつ関連法令（金商法等）の遵守が前提です。

---

## 1. ハーネス設計（エージェント構成とモデル割り当て）

「総合判断」を単一プロンプトで行わず、**専門分化 → 集約**の 2 段構えにしています。
各エージェントは独立した Claude 呼び出しで、**判断の難易度とコストに応じてモデルを使い分け**ます。

```
                ┌─────────────────────────────────────────────┐
                │        Orchestrator (ハーネス本体)          │
                │   銘柄ごとに各エージェントを並列/順次実行   │
                └───────────────┬─────────────────────────────┘
   データ収集                   │
  ┌──────────────┐              │  各エージェントの見解(JSON)を集約
  │ DataProvider │──市況/財務/  │
  │ (非LLM)      │  ニュース──▶ ├─▶ ① テクニカル分析     (Sonnet 5)
  └──────────────┘              ├─▶ ② ファンダメンタル分析(Sonnet 5)
                                ├─▶ ③ ニュース/センチメント(Haiku 4.5)
                                ├─▶ ④ リスク管理         (Opus 5)
                                │
                                ▼
                       ⑤ ポートフォリオ・マネージャー (Opus 5)
                          = 最終意思決定（BUY/SELL/HOLD + 数量 + 根拠）
                                │
                                ▼
                       ⑥ 執行エージェント (非LLM / PaperBroker)
                          = 仮想約定・ポジション更新
```

### エージェントとモデルの対応表

| # | エージェント | 役割 | 割り当てモデル | 理由 |
|---|--------------|------|----------------|------|
| ① | テクニカル分析 | 移動平均・RSI・出来高等からトレンド判定 | `claude-sonnet-5` | 定型的な数値解釈。速度・コスト重視 |
| ② | ファンダメンタル分析 | PER/PBR/成長性/財務健全性の評価 | `claude-sonnet-5` | 中程度の推論。バランス型 |
| ③ | ニュース/センチメント | 材料・地合いのポジ/ネガ判定 | `claude-haiku-4-5` | 短文分類中心。最安・最速 |
| ④ | リスク管理 | 下振れ・流動性・集中度の点検、拒否権 | `claude-opus-5` | 誤りコストが高い。最重要判断 |
| ⑤ | ポートフォリオ・マネージャー | 全見解を統合し最終売買を決定 | `claude-opus-5` | 長期的整合性が必要な統合判断 |
| ⑥ | 執行（PaperBroker） | 仮想発注・約定・記帳 | LLM 不使用 | 決定論的処理 |

- 重要判断（④⑤）には **adaptive thinking + effort=high** を適用。
- 分析系（①②③）は `output_config.format`（構造化出力）で JSON を強制し、集約を安定化。
- モデル ID は Anthropic 公式の最新世代（Opus 5 / Sonnet 5 / Haiku 4.5）を使用。

---

## 2. ディレクトリ構成

```
src/jp_stock_ai/
├── config.py            # エージェント→モデルのマッピング、実行設定
├── schemas.py           # シグナル/判断のデータ構造とJSONスキーマ
├── llm.py               # Claude 呼び出しラッパ（online / offline 両対応）
├── data/
│   ├── providers.py     # DataProvider 抽象 + Mock / yfinance 実装
│   └── indicators.py    # SMA / RSI 等のテクニカル指標
├── agents/
│   ├── base.py          # エージェント基底
│   ├── technical.py     # ①
│   ├── fundamental.py   # ②
│   ├── sentiment.py     # ③
│   ├── risk.py          # ④
│   └── portfolio_manager.py  # ⑤
├── execution/
│   └── paper_broker.py  # ⑥ 仮想売買
├── orchestrator.py      # ハーネス本体
└── cli.py               # コマンドライン実行
```

---

## 3. セットアップと実行

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

### オフラインで試す（API キー不要・すぐ動く）

LLM 呼び出しをヒューリスティックで代替し、パイプライン全体を通します。

```bash
export LLM_MODE=offline
python -m jp_stock_ai.cli --tickers 7203.T 6758.T 9984.T
```

### 実際に Claude で判断させる

```bash
export ANTHROPIC_API_KEY=sk-ant-...   # または `ant auth login`
export LLM_MODE=online
python -m jp_stock_ai.cli --tickers 7203.T 6758.T
```

> データソースは既定で `mock`（決定論的な擬似市況）。`--provider yfinance` で実データ取得を試せます（`pip install yfinance` と外部ネットワークが必要）。

出力例（銘柄ごと）:

```
[7203.T] 決定: BUY 100株  信頼度: 0.72
  テクニカル : bullish (SMA25>SMA75, RSI 58)
  ファンダ   : neutral  (PER 割安圏)
  センチ     : positive (増配観測)
  リスク     : approved (下値限定的)
  根拠: 押し目からの反発局面。財務健全でリスク許容内...
```

---

## 4. 拡張ポイント（本番化に向けて）

- **データ**: J-Quants API（JPX 公式）や証券会社 API への `DataProvider` 追加
- **執行**: PaperBroker を実ブローカー API へ差し替え（要ライセンス・多重の承認ゲート）
- **監査**: 全エージェントの入出力ログ・意思決定トレースの永続化
- **バックテスト**: `orchestrator` を過去データでループさせる評価基盤
- **ヒューマン・イン・ザ・ループ**: リスク管理④で `always_ask` 相当の承認ゲート
