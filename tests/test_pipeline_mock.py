"""オフライン・モックでパイプライン全体が通ることを検証。"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from jp_stock_ai.config import RunConfig
from jp_stock_ai.orchestrator import Orchestrator


def test_pipeline_offline_mock(tmp_path):
    cfg = RunConfig(llm_mode="offline", provider="mock",
                    state_path=str(tmp_path / "state.json"))
    orch = Orchestrator(cfg)
    results = orch.run(["7203.T", "6758.T", "9984.T"])

    assert len(results) == 3
    for r in results:
        assert r.decision.action in {"BUY", "SELL", "HOLD"}
        assert r.decision.quantity % 100 == 0
        assert 0.0 <= r.decision.confidence <= 1.0
        # 各銘柄に 4 つの見解（分析3 + リスク1）が付く
        assert len(r.decision.views) == 4


def test_risk_veto_blocks_buy(tmp_path):
    """急落銘柄はリスク非承認で新規買いされないこと（決定論的モックで検証）。"""
    cfg = RunConfig(llm_mode="offline", provider="mock",
                    state_path=str(tmp_path / "state.json"))
    orch = Orchestrator(cfg)
    res = orch.run_ticker("9984.T")  # 下降トレンド・高ボラ設定
    assert res.decision.action in {"HOLD", "SELL"}
