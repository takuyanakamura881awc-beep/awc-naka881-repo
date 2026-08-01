"""テクニカル指標の基本テスト。"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from jp_stock_ai.data import indicators as ind


def test_sma_basic():
    assert ind.sma([1, 2, 3, 4, 5], 5) == 3.0
    assert ind.sma([1, 2], 5) is None


def test_rsi_all_gains_is_100():
    assert ind.rsi([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]) == 100.0


def test_pct_change():
    assert ind.pct_change([100, 110], 1) == 10.0
    assert ind.pct_change([100], 5) is None
