"""① テクニカル分析エージェント（Sonnet 5）。"""
from __future__ import annotations

from ..data.providers import StockData
from ..data import indicators as ind
from ..llm import complete_json
from ..schemas import AgentView, TECHNICAL_SCHEMA
from .base import Agent

SYSTEM = (
    "あなたは日本株のテクニカルアナリストです。"
    "与えられた移動平均・RSI・騰落率から、短〜中期のトレンドを判定してください。"
    "stance は bullish/bearish/neutral、score は -1..1、confidence は 0..1、"
    "rationale は日本語で簡潔に。"
)


class TechnicalAgent(Agent):
    name = "technical"

    def analyze(self, data: StockData) -> AgentView:
        prices = data.prices
        sma25, sma75 = ind.sma(prices, 25), ind.sma(prices, 75)
        rsi14 = ind.rsi(prices, 14)
        chg = ind.pct_change(prices, 20)

        facts = {
            "last": round(data.last_price, 1), "sma25": sma25, "sma75": sma75,
            "rsi14": None if rsi14 is None else round(rsi14, 1),
            "chg20d_pct": None if chg is None else round(chg, 1),
        }

        def offline() -> dict:
            score = 0.0
            if sma25 and sma75:
                score += 0.5 if sma25 > sma75 else -0.5
            if rsi14 is not None:
                if rsi14 > 70:
                    score -= 0.3
                elif rsi14 < 30:
                    score += 0.3
            if chg is not None:
                score += max(-0.3, min(0.3, chg / 30.0))
            score = max(-1.0, min(1.0, score))
            stance = "bullish" if score > 0.15 else "bearish" if score < -0.15 else "neutral"
            return {
                "stance": stance, "score": round(score, 2), "confidence": 0.6,
                "rationale": f"SMA25={sma25}, SMA75={sma75}, RSI={facts['rsi14']} からの判定。",
            }

        out = complete_json(
            mode=self.mode, agent_model=self.model, system=SYSTEM,
            user=f"テクニカル指標: {facts}", schema=TECHNICAL_SCHEMA, offline_fn=offline,
        )
        return AgentView(agent=self.name, **out)
