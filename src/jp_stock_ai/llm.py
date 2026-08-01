"""Claude 呼び出しラッパ。

- online  : Anthropic Messages API を `output_config.format`（構造化出力）で呼ぶ
- offline : LLM を使わず、各エージェントが渡すヒューリスティック関数で代替する
            （API キー不要でパイプライン全体を通せるようにするため）
"""
from __future__ import annotations

import json
from typing import Any, Callable

from .config import AgentModel

_client = None


def _get_client():
    global _client
    if _client is None:
        import anthropic  # 遅延 import（offline では不要）

        _client = anthropic.Anthropic()
    return _client


def complete_json(
    *,
    mode: str,
    agent_model: AgentModel,
    system: str,
    user: str,
    schema: dict[str, Any],
    offline_fn: Callable[[], dict[str, Any]],
    max_tokens: int = 1024,
) -> dict[str, Any]:
    """スキーマに従った JSON を返す。

    mode="offline" のときは `offline_fn()` の結果をそのまま返す。
    """
    if mode == "offline":
        return offline_fn()

    kwargs: dict[str, Any] = {
        "model": agent_model.model,
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": user}],
        "output_config": {"format": {"type": "json_schema", "schema": schema}},
    }
    if agent_model.thinking:
        kwargs["thinking"] = {"type": "adaptive"}
        kwargs["output_config"]["effort"] = agent_model.effort

    resp = _get_client().messages.create(**kwargs)

    if resp.stop_reason == "refusal":  # 安全分類による拒否をハンドリング
        raise RuntimeError(f"model refused: {getattr(resp, 'stop_details', None)}")

    text = next((b.text for b in resp.content if b.type == "text"), "")
    return json.loads(text)
