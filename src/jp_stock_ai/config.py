"""エージェント→モデルのマッピングと実行設定。

役割の難易度・誤りコスト・レイテンシに応じて Claude モデルを使い分ける。
（`shared/models.md` の最新世代 ID を使用）
"""
from __future__ import annotations

import os
from dataclasses import dataclass


# ── モデル ID（Anthropic 最新世代）─────────────────────────────
OPUS = "claude-opus-5"       # 統合判断・リスク（最重要）
SONNET = "claude-sonnet-5"   # 分析系（バランス）
HAIKU = "claude-haiku-4-5"   # 短文分類（最安・最速）


@dataclass(frozen=True)
class AgentModel:
    """1 エージェントのモデル設定。"""

    model: str
    # adaptive thinking を使うか（重要判断のみ有効化）
    thinking: bool = False
    # output_config.effort。thinking=True のときのみ意味を持つ
    effort: str = "high"


# エージェント名 → モデル設定
AGENT_MODELS: dict[str, AgentModel] = {
    "technical": AgentModel(SONNET),
    "fundamental": AgentModel(SONNET),
    "sentiment": AgentModel(HAIKU),
    "risk": AgentModel(OPUS, thinking=True, effort="high"),
    "portfolio_manager": AgentModel(OPUS, thinking=True, effort="high"),
}


@dataclass
class RunConfig:
    """1 回の実行全体の設定。"""

    llm_mode: str = os.getenv("LLM_MODE", "offline")  # "online" | "offline"
    provider: str = "mock"                            # "mock" | "yfinance"
    cash: float = 1_000_000.0                         # 初期資金（円）
    max_position_yen: float = 500_000.0               # 1 銘柄あたり上限
    state_path: str = "paper_state.json"
