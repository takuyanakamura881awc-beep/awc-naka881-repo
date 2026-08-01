"""④ リスク管理エージェント（Opus 5 + adaptive thinking）。

拒否権(approved=False)とポジション圧縮係数(max_score)を持つ最重要ゲート。
"""
from __future__ import annotations

from ..data.providers import StockData
from ..data import indicators as ind
from ..llm import complete_json
from ..schemas import AgentView, RiskView, RISK_SCHEMA
from .base import Agent

SYSTEM = (
    "あなたは日本株のリスク管理責任者です。ボラティリティ・流動性・"
    "急落リスク・材料の悪化を点検し、発注可否(approved)とポジション圧縮係数"
    "(max_score, 0..1)を決めてください。安全側に倒し、疑わしきは拒否してください。"
    "rationale は日本語で簡潔に。"
)


def _volatility(prices: list[float], window: int = 20) -> float:
    """直近 window 日の日次リターン標準偏差(%)。"""
    if len(prices) <= window:
        return 0.0
    rets = []
    for a, b in zip(prices[-window - 1:-1], prices[-window:]):
        if a:
            rets.append((b - a) / a)
    if not rets:
        return 0.0
    mean = sum(rets) / len(rets)
    var = sum((r - mean) ** 2 for r in rets) / len(rets)
    return (var ** 0.5) * 100.0


class RiskAgent(Agent):
    name = "risk"

    def assess(self, data: StockData, views: list[AgentView]) -> RiskView:
        vol = _volatility(data.prices)
        drawdown = ind.pct_change(data.prices, 5) or 0.0
        avg_vol = sum(data.volume[-20:]) / 20 if len(data.volume) >= 20 else 0

        facts = {
            "volatility_pct": round(vol, 2),
            "chg5d_pct": round(drawdown, 2),
            "avg_volume_20d": int(avg_vol),
            "views": [f"{v.agent}:{v.stance}({v.score})" for v in views],
        }

        def offline() -> dict:
            approved = True
            max_score = 1.0
            reasons = []
            if vol > 5.0:
                max_score *= 0.5
                reasons.append("高ボラティリティ")
            if drawdown < -8.0:
                approved = False
                reasons.append("直近急落")
            if avg_vol and avg_vol < 100_000:
                max_score *= 0.5
                reasons.append("流動性低")
            if not reasons:
                reasons.append("特段のリスクなし")
            return {
                "approved": approved, "max_score": round(max_score, 2),
                "rationale": "・".join(reasons) + f"（ボラ{vol:.1f}%）",
            }

        out = complete_json(
            mode=self.mode, agent_model=self.model, system=SYSTEM,
            user=f"リスク指標: {facts}", schema=RISK_SCHEMA, offline_fn=offline,
        )
        return RiskView(**out)
