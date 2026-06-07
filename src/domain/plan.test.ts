import { describe, expect, it } from "vitest";
import {
  canCreateHorse,
  consumeSuggestion,
  isPro,
  isoWeekKey,
  stableLimit,
  suggestionsRemaining,
} from "./plan";
import { SCHEMA_VERSION } from "../db/schema";
import type { UsageMeta } from "./types";

const NOW = Date.UTC(2026, 5, 7); // 2026-06-07 (日曜)

function meta(over: Partial<UsageMeta> = {}): UsageMeta {
  return {
    id: "singleton",
    schema_version: SCHEMA_VERSION,
    suggestionWeekKey: isoWeekKey(new Date(NOW)),
    suggestionCount: 0,
    proUntil: null,
    lastCheckedAt: NOW,
    ...over,
  };
}

describe("plan gating", () => {
  it("無料は厩舎枠2頭・PROは30頭", () => {
    expect(stableLimit(meta(), NOW)).toBe(2);
    expect(stableLimit(meta({ proUntil: NOW + 1000 }), NOW)).toBe(30);
  });

  it("厩舎枠の上限で作成不可", () => {
    expect(canCreateHorse(meta(), 1, NOW)).toBe(true);
    expect(canCreateHorse(meta(), 2, NOW)).toBe(false);
    expect(canCreateHorse(meta({ proUntil: NOW + 1000 }), 2, NOW)).toBe(true);
  });

  it("期限切れPROは無料扱い", () => {
    expect(isPro(meta({ proUntil: NOW - 1 }), NOW)).toBe(false);
    expect(isPro(meta({ proUntil: NOW + 1 }), NOW)).toBe(true);
  });

  it("提案は無料で週2回まで、3回目は不可", () => {
    let m = meta();
    const r1 = consumeSuggestion(m, NOW);
    expect(r1.allowed).toBe(true);
    const r2 = consumeSuggestion(r1.meta, NOW);
    expect(r2.allowed).toBe(true);
    const r3 = consumeSuggestion(r2.meta, NOW);
    expect(r3.allowed).toBe(false);
    expect(suggestionsRemaining(r2.meta, NOW)).toBe(0);
  });

  it("週が変わるとカウンタはリセット", () => {
    const used = meta({ suggestionCount: 2 });
    const nextWeek = NOW + 7 * 24 * 60 * 60 * 1000;
    expect(suggestionsRemaining(used, nextWeek)).toBe(2);
    expect(consumeSuggestion(used, nextWeek).allowed).toBe(true);
  });

  it("PROは提案無制限", () => {
    const m = meta({ proUntil: NOW + 1000, suggestionCount: 99 });
    expect(suggestionsRemaining(m, NOW)).toBe(Infinity);
    expect(consumeSuggestion(m, NOW).allowed).toBe(true);
  });
});
