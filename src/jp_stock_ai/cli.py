"""コマンドライン・エントリポイント。

例:
    LLM_MODE=offline python -m jp_stock_ai.cli --tickers 7203.T 6758.T 9984.T
"""
from __future__ import annotations

import argparse

from .config import RunConfig
from .orchestrator import Orchestrator, TickerResult


_STANCE_JP = {
    "bullish": "強気", "bearish": "弱気", "neutral": "中立",
    "undervalued": "割安", "fair": "妥当", "overvalued": "割高",
    "positive": "ポジ", "negative": "ネガ",
}


def _print_result(r: TickerResult) -> None:
    d = r.decision
    print(f"\n[{r.data.ticker}] {r.data.name}  終値 {r.data.last_price:,.1f}円")
    print(f"  決定: {d.action} {d.quantity}株  信頼度 {d.confidence:.2f}")
    for v in d.views:
        agent = v.get("agent", "?")
        if agent == "risk":
            ok = "承認" if v.get("approved") else "非承認"
            print(f"    リスク       : {ok} (係数 {v.get('max_score')}) — {v.get('rationale')}")
        else:
            label = {"technical": "テクニカル", "fundamental": "ファンダ",
                     "sentiment": "センチ"}.get(agent, agent)
            stance = _STANCE_JP.get(v.get("stance", ""), v.get("stance", ""))
            print(f"    {label:<11}: {stance} (score {v.get('score')}) — {v.get('rationale')}")
    print(f"  執行: {r.fill}")
    print(f"  根拠: {d.rationale}")


def main() -> None:
    p = argparse.ArgumentParser(description="日本株 AI 自律売買ツール（PoC / ペーパートレード）")
    p.add_argument("--tickers", nargs="+", default=["7203.T", "6758.T", "9984.T"],
                   help="対象銘柄（例: 7203.T 6758.T）")
    p.add_argument("--provider", choices=["mock", "yfinance"], default="mock",
                   help="データソース（既定: mock）")
    p.add_argument("--mode", choices=["online", "offline"], default=None,
                   help="LLM モード（未指定なら環境変数 LLM_MODE）")
    p.add_argument("--cash", type=float, default=1_000_000.0, help="初期資金(円)")
    args = p.parse_args()

    cfg = RunConfig(provider=args.provider, cash=args.cash)
    if args.mode:
        cfg.llm_mode = args.mode

    print(f"=== 日本株 AI 売買 PoC | LLM={cfg.llm_mode} / data={cfg.provider} ===")
    print("⚠️ ペーパートレード（仮想売買）。実発注は行いません。")

    orch = Orchestrator(cfg)
    results = orch.run(args.tickers)

    for r in results:
        _print_result(r)

    marks = {r.data.ticker: r.data.last_price for r in results}
    print(f"\n--- ポートフォリオ ---")
    print(f"  現金        : {orch.broker.pf.cash:,.0f}円")
    print(f"  評価額(合計): {orch.broker.equity(marks):,.0f}円")
    for tk, pos in orch.broker.pf.positions.items():
        if pos.quantity:
            print(f"  {tk}: {pos.quantity}株 @ 平均 {pos.avg_price:,.0f}円")


if __name__ == "__main__":
    main()
