import { describe, expect, it } from "vitest";
import { canInherit, horseAlerts, summarize } from "./lifecycle";
import { SCHEMA_VERSION } from "../db/schema";
import type { Horse, RaceLog } from "./types";

function horse(over: Partial<Horse> = {}): Horse {
  return {
    id: "h1",
    schema_version: SCHEMA_VERSION,
    name: "テスト",
    sex: "牡",
    generation: 1,
    password: "",
    sire: { kind: "none" },
    sireName: "",
    dam: { kind: "none" },
    damName: "",
    inheritType: "堅実",
    soshitsu: "MAX中",
    leg: "先行",
    growth: "普通",
    distance: "中距離",
    dirtApt: "不明",
    mudApt: "不明",
    startApt: "不明",
    temper: "普通",
    coat: "鹿毛",
    birthComment: "",
    abilityNote: "",
    trainGrade: "-",
    trainStyle: "-",
    weightStyle: "-",
    first: 0,
    second: 0,
    third: 0,
    unplaced: 0,
    g1Wins: 0,
    wbcWins: 0,
    prizeMedals: 0,
    weeksLeft: 100,
    maxWeeks: 120,
    status: "育成中",
    note: "",
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

function log(over: Partial<RaceLog> = {}): RaceLog {
  return {
    id: "l1",
    schema_version: SCHEMA_VERSION,
    horseId: "h1",
    raceId: null,
    raceName: "テストレース",
    grade: "G1",
    distanceM: 2000,
    surface: "芝",
    status: "完了",
    position: 1,
    fieldSize: 18,
    odds: 3,
    popularity: 1,
    prize: 1000,
    condition: "良",
    weightKg: 480,
    jockey: "武豊",
    atWeek: null,
    note: "",
    at: 0,
    ...over,
  };
}

describe("lifecycle", () => {
  it("G1勝利 or 残80週以下で継承可", () => {
    expect(canInherit(horse({ g1Wins: 0, weeksLeft: 100 }))).toBe(false);
    expect(canInherit(horse({ g1Wins: 1, weeksLeft: 100 }))).toBe(true);
    expect(canInherit(horse({ g1Wins: 0, weeksLeft: 80 }))).toBe(true);
  });

  it("残り週わずかで警告、0週で緊急", () => {
    expect(horseAlerts(horse({ weeksLeft: 8 })).some((a) => a.level === "warn")).toBe(true);
    expect(horseAlerts(horse({ weeksLeft: 0 })).some((a) => a.level === "urgent")).toBe(true);
    // 引退済みはアラートなし
    expect(horseAlerts(horse({ status: "引退", weeksLeft: 0 }))).toHaveLength(0);
  });

  it("成績集計：勝利・複勝・G1・賞金", () => {
    const logs = [
      log({ id: "a", position: 1, grade: "G1", prize: 1000 }),
      log({ id: "b", position: 3, grade: "G2", prize: 200 }),
      log({ id: "c", position: 8, grade: "OP", prize: 0 }),
      log({ id: "d", position: null, status: "予定", prize: null }),
    ];
    const rec = summarize(logs);
    expect(rec.starts).toBe(3); // 予定は除外
    expect(rec.wins).toBe(1);
    expect(rec.top3).toBe(2);
    expect(rec.g1Wins).toBe(1);
    expect(rec.prize).toBe(1200);
  });
});
