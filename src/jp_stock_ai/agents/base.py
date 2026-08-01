"""エージェント基底。"""
from __future__ import annotations

from ..config import AGENT_MODELS, AgentModel


class Agent:
    """全エージェント共通の土台。`name` に対応するモデル設定を持つ。"""

    name: str = "agent"

    def __init__(self, mode: str) -> None:
        self.mode = mode  # "online" | "offline"

    @property
    def model(self) -> AgentModel:
        return AGENT_MODELS[self.name]
