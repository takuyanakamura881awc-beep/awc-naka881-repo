"""③ ニュース/センチメント分析エージェント（Haiku 4.5）。"""
from __future__ import annotations

from ..data.providers import StockData
from ..llm import complete_json
from ..schemas import AgentView, SENTIMENT_SCHEMA
from .base import Agent

SYSTEM = (
    "あなたは日本株の材料・地合いを判定するアナリストです。"
    "ニュース見出し群からポジティブ/ネガティブ/中立を判定してください。"
    "stance は positive/negative/neutral、score は -1..1、confidence は 0..1、"
    "rationale は日本語で簡潔に。"
)

_POS = ["上方修正", "増益", "増配", "自社株買い", "堅調", "好調", "追い風", "最高益"]
_NEG = ["下方修正", "減益", "減配", "評価損", "懸念", "減速", "赤字", "不振"]


class SentimentAgent(Agent):
    name = "sentiment"

    def analyze(self, data: StockData) -> AgentView:
        headlines = data.news or ["特段の材料なし"]

        def offline() -> dict:
            score = 0.0
            for h in headlines:
                score += sum(0.4 for w in _POS if w in h)
                score -= sum(0.4 for w in _NEG if w in h)
            score = max(-1.0, min(1.0, score))
            stance = "positive" if score > 0.15 else "negative" if score < -0.15 else "neutral"
            return {
                "stance": stance, "score": round(score, 2), "confidence": 0.5,
                "rationale": "・".join(headlines[:2]) + " などから判定。",
            }

        out = complete_json(
            mode=self.mode, agent_model=self.model, system=SYSTEM,
            user="ニュース見出し:\n- " + "\n- ".join(headlines),
            schema=SENTIMENT_SCHEMA, offline_fn=offline, max_tokens=512,
        )
        return AgentView(agent=self.name, **out)
