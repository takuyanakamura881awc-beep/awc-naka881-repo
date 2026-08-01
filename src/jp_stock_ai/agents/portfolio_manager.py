"""⑤ ポートフォリオ・マネージャー（Opus 5 + adaptive thinking）。

全エージェントの見解＋リスク判定＋現在ポジションを統合し、最終売買を決める。
"""
from __future__ import annotations

from ..data.providers import StockData
from ..llm import complete_json
from ..schemas import AgentView, RiskView, Decision, DECISION_SCHEMA
from .base import Agent

SYSTEM = (
    "あなたは日本株のポートフォリオ・マネージャーです。テクニカル・ファンダメンタル・"
    "センチメントの見解と、リスク管理の判定、現在ポジションと資金制約を統合し、"
    "最終的な売買(action=BUY/SELL/HOLD)と株数(quantity, 100株単位)を決定してください。"
    "リスク管理が非承認(approved=false)なら新規買いは避けること。"
    "根拠(rationale)は日本語で、判断の決め手を簡潔に述べてください。"
)


class PortfolioManager(Agent):
    name = "portfolio_manager"

    def decide(
        self,
        data: StockData,
        views: list[AgentView],
        risk: RiskView,
        position: int,
        max_qty: int,
    ) -> Decision:
        consensus = sum(v.score * v.confidence for v in views)

        ctx = {
            "ticker": data.ticker, "name": data.name,
            "last_price": round(data.last_price, 1),
            "views": [v.to_dict() for v in views],
            "risk": risk.to_dict(),
            "current_position": position,
            "max_new_qty": max_qty,
        }

        def offline() -> dict:
            if not risk.approved:
                return {"action": "HOLD", "quantity": 0, "confidence": 0.6,
                        "rationale": f"リスク管理が非承認: {risk.rationale}"}
            qty_unit = 100
            if consensus > 0.3:
                qty = min(max_qty, int(max_qty * risk.max_score))
                qty = (qty // qty_unit) * qty_unit
                action = "BUY" if qty > 0 else "HOLD"
            elif consensus < -0.3 and position > 0:
                action, qty = "SELL", position
            else:
                action, qty = "HOLD", 0
            conf = min(1.0, 0.4 + abs(consensus) * 0.5)
            return {"action": action, "quantity": qty, "confidence": round(conf, 2),
                    "rationale": f"総合スコア {consensus:+.2f}、リスク係数 {risk.max_score}。"}

        out = complete_json(
            mode=self.mode, agent_model=self.model, system=SYSTEM,
            user=f"統合コンテキスト: {ctx}", schema=DECISION_SCHEMA, offline_fn=offline,
        )
        # 数量は 100 株単位・上限にクランプ（LLM 出力の安全化）
        qty = max(0, (int(out["quantity"]) // 100) * 100)
        if out["action"] == "BUY":
            qty = min(qty, max_qty)
        elif out["action"] == "SELL":
            qty = min(qty, position)
        else:
            qty = 0
        return Decision(
            ticker=data.ticker, action=out["action"], quantity=qty,
            confidence=float(out["confidence"]), rationale=out["rationale"],
            views=[v.to_dict() for v in views] + [risk.to_dict()],
        )
