"""⑥ 執行エージェント（ペーパートレード）。

実発注は一切行わない。仮想現金・ポジションを更新し、JSON で永続化する。
本番化する場合はここを実ブローカー API へ差し替える（多重承認ゲート必須）。
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, asdict, field

from ..schemas import Decision


@dataclass
class Position:
    quantity: int = 0
    avg_price: float = 0.0


@dataclass
class Portfolio:
    cash: float = 1_000_000.0
    positions: dict[str, Position] = field(default_factory=dict)


class PaperBroker:
    """仮想売買のみ。実口座には接続しない。"""

    def __init__(self, cash: float, state_path: str) -> None:
        self.state_path = state_path
        self.pf = self._load(cash)

    # ── 永続化 ──────────────────────────────────────────────
    def _load(self, cash: float) -> Portfolio:
        if os.path.exists(self.state_path):
            with open(self.state_path, encoding="utf-8") as f:
                raw = json.load(f)
            positions = {k: Position(**v) for k, v in raw.get("positions", {}).items()}
            return Portfolio(cash=raw.get("cash", cash), positions=positions)
        return Portfolio(cash=cash)

    def save(self) -> None:
        data = {"cash": self.pf.cash,
                "positions": {k: asdict(v) for k, v in self.pf.positions.items()}}
        with open(self.state_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    # ── 参照 ────────────────────────────────────────────────
    def position_qty(self, ticker: str) -> int:
        return self.pf.positions.get(ticker, Position()).quantity

    # ── 約定 ────────────────────────────────────────────────
    def execute(self, decision: Decision, price: float) -> str:
        """決定を仮想約定。結果メッセージを返す。"""
        if decision.action == "HOLD" or decision.quantity <= 0:
            return "見送り（発注なし）"

        pos = self.pf.positions.setdefault(decision.ticker, Position())
        cost = price * decision.quantity

        if decision.action == "BUY":
            if cost > self.pf.cash:
                return f"資金不足で発注不可（必要 {cost:,.0f}円 > 現金 {self.pf.cash:,.0f}円）"
            new_qty = pos.quantity + decision.quantity
            pos.avg_price = (pos.avg_price * pos.quantity + cost) / new_qty
            pos.quantity = new_qty
            self.pf.cash -= cost
            return f"買 {decision.quantity}株 @ {price:,.0f}円（-{cost:,.0f}円）"

        if decision.action == "SELL":
            qty = min(decision.quantity, pos.quantity)
            if qty <= 0:
                return "保有なしのため売却不可"
            proceeds = price * qty
            pos.quantity -= qty
            self.pf.cash += proceeds
            if pos.quantity == 0:
                pos.avg_price = 0.0
            return f"売 {qty}株 @ {price:,.0f}円（+{proceeds:,.0f}円）"

        return "不明なアクション"

    def equity(self, marks: dict[str, float]) -> float:
        """現金＋保有時価の合計。"""
        total = self.pf.cash
        for tk, pos in self.pf.positions.items():
            total += pos.quantity * marks.get(tk, pos.avg_price)
        return total
