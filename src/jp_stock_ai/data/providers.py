"""市況・財務・ニュースのデータ供給層。

DataProvider を差し替えることで、擬似データ / 実データ / 証券会社 API 等に対応する。
PoC 既定は決定論的な MockProvider（外部依存なしで動く）。
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Protocol


@dataclass
class StockData:
    """1 銘柄ぶんのスナップショット。"""

    ticker: str
    name: str
    prices: list[float]                 # 日次終値（古い→新しい）
    volume: list[int] = field(default_factory=list)
    fundamentals: dict[str, float] = field(default_factory=dict)  # per, pbr, roe...
    news: list[str] = field(default_factory=list)                 # 材料の見出し

    @property
    def last_price(self) -> float:
        return self.prices[-1]


class DataProvider(Protocol):
    def fetch(self, ticker: str) -> StockData: ...


# ── Mock: 決定論的な擬似市況 ───────────────────────────────────
_MOCK_META: dict[str, dict] = {
    "7203.T": {
        "name": "トヨタ自動車", "base": 3100, "trend": 0.02, "amp": 0.03,
        "fund": {"per": 10.5, "pbr": 1.1, "roe": 9.8, "div_yield": 2.6},
        "news": ["通期増益見通しを上方修正", "北米販売が堅調"],
    },
    "6758.T": {
        "name": "ソニーグループ", "base": 13500, "trend": 0.01, "amp": 0.045,
        "fund": {"per": 18.2, "pbr": 2.3, "roe": 13.5, "div_yield": 0.7},
        "news": ["ゲーム部門の減速懸念", "為替の追い風"],
    },
    "9984.T": {
        "name": "ソフトバンクグループ", "base": 9000, "trend": -0.015, "amp": 0.07,
        "fund": {"per": 0.0, "pbr": 1.5, "roe": -2.0, "div_yield": 0.5},
        "news": ["保有ファンドの評価損を計上", "自社株買いを発表"],
    },
}

_DEFAULT_META = {
    "name": "サンプル銘柄", "base": 2000, "trend": 0.0, "amp": 0.04,
    "fund": {"per": 15.0, "pbr": 1.4, "roe": 8.0, "div_yield": 1.5},
    "news": ["特段の材料なし"],
}


class MockProvider:
    """サイン波＋トレンドで擬似的な株価系列を生成（乱数なしで再現可能）。"""

    def __init__(self, days: int = 120) -> None:
        self.days = days

    def fetch(self, ticker: str) -> StockData:
        m = _MOCK_META.get(ticker, {**_DEFAULT_META, "name": f"{ticker}"})
        prices: list[float] = []
        volume: list[int] = []
        for i in range(self.days):
            trend = m["base"] * (1 + m["trend"] * i / self.days)
            wave = 1 + m["amp"] * math.sin(i / 7.0)
            prices.append(round(trend * wave, 1))
            volume.append(int(1_000_000 * (1 + 0.3 * math.sin(i / 5.0))))
        return StockData(
            ticker=ticker, name=m["name"], prices=prices, volume=volume,
            fundamentals=dict(m["fund"]), news=list(m["news"]),
        )


# ── yfinance: 実データ（任意）─────────────────────────────────
class YFinanceProvider:
    """yfinance 経由の実データ取得。`pip install yfinance` と外部NWが必要。"""

    def __init__(self, period: str = "6mo") -> None:
        self.period = period

    def fetch(self, ticker: str) -> StockData:
        import yfinance as yf  # 遅延 import

        t = yf.Ticker(ticker)
        hist = t.history(period=self.period)
        prices = [float(x) for x in hist["Close"].tolist()]
        volume = [int(x) for x in hist["Volume"].tolist()]
        info = getattr(t, "info", {}) or {}
        fund = {
            "per": float(info.get("trailingPE") or 0.0),
            "pbr": float(info.get("priceToBook") or 0.0),
            "roe": float((info.get("returnOnEquity") or 0.0) * 100),
            "div_yield": float((info.get("dividendYield") or 0.0) * 100),
        }
        name = info.get("shortName") or ticker
        return StockData(ticker=ticker, name=name, prices=prices,
                         volume=volume, fundamentals=fund, news=[])


def get_provider(name: str) -> DataProvider:
    if name == "yfinance":
        return YFinanceProvider()
    return MockProvider()
