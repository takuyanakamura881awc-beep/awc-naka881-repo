"""エージェント間で受け渡すデータ構造と、構造化出力用の JSON スキーマ。"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any


# ── 各分析エージェントの見解 ───────────────────────────────────
@dataclass
class AgentView:
    """分析エージェント 1 つの見解。"""

    agent: str                 # "technical" 等
    stance: str                # "bullish" | "bearish" | "neutral" 等
    score: float               # -1.0(弱気) .. +1.0(強気)
    confidence: float          # 0.0 .. 1.0
    rationale: str             # 根拠（日本語 1〜2 文）

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


# ── リスク管理の結果 ───────────────────────────────────────────
@dataclass
class RiskView:
    agent: str = "risk"
    approved: bool = True      # False なら発注拒否（拒否権）
    max_score: float = 1.0     # ポジション圧縮係数 0.0..1.0
    rationale: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


# ── 最終意思決定 ───────────────────────────────────────────────
@dataclass
class Decision:
    ticker: str
    action: str                # "BUY" | "SELL" | "HOLD"
    quantity: int              # 株数（100 株単位）
    confidence: float
    rationale: str
    views: list[dict[str, Any]] = field(default_factory=list)  # 参考: 各見解

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


# ── 構造化出力用 JSON スキーマ ─────────────────────────────────
def _analyst_schema(stances: list[str]) -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "stance": {"type": "string", "enum": stances},
            "score": {"type": "number"},
            "confidence": {"type": "number"},
            "rationale": {"type": "string"},
        },
        "required": ["stance", "score", "confidence", "rationale"],
        "additionalProperties": False,
    }


TECHNICAL_SCHEMA = _analyst_schema(["bullish", "bearish", "neutral"])
FUNDAMENTAL_SCHEMA = _analyst_schema(["undervalued", "fair", "overvalued"])
SENTIMENT_SCHEMA = _analyst_schema(["positive", "negative", "neutral"])

RISK_SCHEMA = {
    "type": "object",
    "properties": {
        "approved": {"type": "boolean"},
        "max_score": {"type": "number"},
        "rationale": {"type": "string"},
    },
    "required": ["approved", "max_score", "rationale"],
    "additionalProperties": False,
}

DECISION_SCHEMA = {
    "type": "object",
    "properties": {
        "action": {"type": "string", "enum": ["BUY", "SELL", "HOLD"]},
        "quantity": {"type": "integer"},
        "confidence": {"type": "number"},
        "rationale": {"type": "string"},
    },
    "required": ["action", "quantity", "confidence", "rationale"],
    "additionalProperties": False,
}
