"""ハーネス本体（オーケストレーター）。

銘柄ごとに以下を実行する:
  データ取得 → ①②③ 分析 → ④ リスク点検 → ⑤ 最終決定 → ⑥ 仮想約定
"""
from __future__ import annotations

from dataclasses import dataclass

from .config import RunConfig
from .data.providers import get_provider, StockData
from .agents.technical import TechnicalAgent
from .agents.fundamental import FundamentalAgent
from .agents.sentiment import SentimentAgent
from .agents.risk import RiskAgent
from .agents.portfolio_manager import PortfolioManager
from .execution.paper_broker import PaperBroker
from .schemas import Decision


@dataclass
class TickerResult:
    data: StockData
    decision: Decision
    fill: str


class Orchestrator:
    def __init__(self, cfg: RunConfig) -> None:
        self.cfg = cfg
        self.provider = get_provider(cfg.provider)
        mode = cfg.llm_mode
        self.technical = TechnicalAgent(mode)
        self.fundamental = FundamentalAgent(mode)
        self.sentiment = SentimentAgent(mode)
        self.risk = RiskAgent(mode)
        self.pm = PortfolioManager(mode)
        self.broker = PaperBroker(cfg.cash, cfg.state_path)

    def run_ticker(self, ticker: str) -> TickerResult:
        data = self.provider.fetch(ticker)

        # ①②③ 専門分析（PoC は順次。本番は並列化可能）
        views = [
            self.technical.analyze(data),
            self.fundamental.analyze(data),
            self.sentiment.analyze(data),
        ]

        # ④ リスク点検
        risk = self.risk.assess(data, views)

        # ⑤ 最終決定（資金・ポジション制約を反映）
        position = self.broker.position_qty(ticker)
        max_qty = self._max_new_qty(data.last_price)
        decision = self.pm.decide(data, views, risk, position, max_qty)

        # ⑥ 仮想約定
        fill = self.broker.execute(decision, data.last_price)
        return TickerResult(data=data, decision=decision, fill=fill)

    def run(self, tickers: list[str]) -> list[TickerResult]:
        results = [self.run_ticker(t) for t in tickers]
        self.broker.save()
        return results

    def _max_new_qty(self, price: float) -> int:
        """1 銘柄あたり上限金額と現金から、100 株単位の新規上限株数を算出。"""
        budget = min(self.cfg.max_position_yen, self.broker.pf.cash)
        if price <= 0:
            return 0
        return max(0, int(budget / price // 100) * 100)
