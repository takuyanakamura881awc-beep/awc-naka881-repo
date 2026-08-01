"""② ファンダメンタル分析エージェント（Sonnet 5）。"""
from __future__ import annotations

from ..data.providers import StockData
from ..llm import complete_json
from ..schemas import AgentView, FUNDAMENTAL_SCHEMA
from .base import Agent

SYSTEM = (
    "あなたは日本株のファンダメンタルズ・アナリストです。"
    "PER/PBR/ROE/配当利回りから割安・妥当・割高を評価してください。"
    "stance は undervalued/fair/overvalued、score は割安ほど正(-1..1)、"
    "confidence は 0..1、rationale は日本語で簡潔に。"
)


class FundamentalAgent(Agent):
    name = "fundamental"

    def analyze(self, data: StockData) -> AgentView:
        f = data.fundamentals
        per, pbr = f.get("per", 0.0), f.get("pbr", 0.0)
        roe, div = f.get("roe", 0.0), f.get("div_yield", 0.0)

        def offline() -> dict:
            score = 0.0
            if per and per > 0:
                score += 0.4 if per < 12 else -0.4 if per > 25 else 0.0
            else:
                score -= 0.2  # 赤字(PER算出不能)は減点
            if pbr:
                score += 0.2 if pbr < 1.0 else -0.2 if pbr > 3.0 else 0.0
            if roe:
                score += 0.2 if roe > 10 else -0.2 if roe < 0 else 0.0
            if div:
                score += min(0.2, div / 15.0)
            score = max(-1.0, min(1.0, score))
            stance = "undervalued" if score > 0.15 else "overvalued" if score < -0.15 else "fair"
            return {
                "stance": stance, "score": round(score, 2), "confidence": 0.55,
                "rationale": f"PER={per}, PBR={pbr}, ROE={roe}%, 利回り={div}% による評価。",
            }

        out = complete_json(
            mode=self.mode, agent_model=self.model, system=SYSTEM,
            user=f"財務指標: PER={per}, PBR={pbr}, ROE={roe}%, 配当利回り={div}%",
            schema=FUNDAMENTAL_SCHEMA, offline_fn=offline,
        )
        return AgentView(agent=self.name, **out)
