"""テクニカル指標（依存ライブラリなしの素朴実装）。"""
from __future__ import annotations


def sma(values: list[float], window: int) -> float | None:
    """単純移動平均。データ不足なら None。"""
    if len(values) < window or window <= 0:
        return None
    return sum(values[-window:]) / window


def rsi(values: list[float], window: int = 14) -> float | None:
    """RSI (Relative Strength Index)。0..100。"""
    if len(values) <= window:
        return None
    gains, losses = 0.0, 0.0
    for prev, cur in zip(values[-window - 1:-1], values[-window:]):
        diff = cur - prev
        if diff >= 0:
            gains += diff
        else:
            losses -= diff
    if losses == 0:
        return 100.0
    rs = (gains / window) / (losses / window)
    return 100.0 - (100.0 / (1.0 + rs))


def pct_change(values: list[float], window: int) -> float | None:
    """window 日前からの騰落率(%)。"""
    if len(values) <= window:
        return None
    past = values[-window - 1]
    if past == 0:
        return None
    return (values[-1] - past) / past * 100.0
