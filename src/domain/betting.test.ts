import { describe, expect, it } from "vitest";
import { summarizeBets, supportProgress } from "./betting";
import { pairSpread } from "./breeding";
import { SCHEMA_VERSION } from "../db/schema";
import type { Bet } from "./types";

function bet(over: Partial<Bet> = {}): Bet {
  return {
    id: "b1",
    schema_version: SCHEMA_VERSION,
    horseId: "h1",
    raceName: "テスト",
    betType: "単勝",
    stake: 100,
    hit: false,
    payout: 0,
    note: "",
    at: 0,
    ...over,
  };
}

describe("betting", () => {
  it("収支と的中率を集計", () => {
    const s = summarizeBets([
      bet({ id: "a", stake: 100, hit: true, payout: 300 }),
      bet({ id: "b", stake: 200, hit: false, payout: 0 }),
    ]);
    expect(s.staked).toBe(300);
    expect(s.returned).toBe(300);
    expect(s.net).toBe(0);
    expect(s.hits).toBe(1);
    expect(s.hitRate).toBeCloseTo(0.5);
  });

  it("累計ベットで応援アイテム解放、次の閾値を提示", () => {
    const p0 = supportProgress(50);
    expect(p0.unlocked).toHaveLength(0);
    expect(p0.next?.threshold).toBe(100);
    expect(p0.remaining).toBe(50);

    const p1 = supportProgress(1200);
    expect(p1.unlocked.map((i) => i.threshold)).toEqual([100, 300, 1000]);
    expect(p1.next?.threshold).toBe(3000);
  });
});

describe("breeding", () => {
  it("継承型の組み合わせでブレ幅を判定", () => {
    expect(pairSpread("H/H", "堅実").level).toBe("wide");
    expect(pairSpread("堅実", "堅実").level).toBe("stable");
    expect(pairSpread("平均", "堅実").level).toBe("mid");
    expect(pairSpread("不明", "平均").level).toBe("unknown");
  });
});
