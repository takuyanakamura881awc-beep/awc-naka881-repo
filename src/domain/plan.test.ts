import { describe, expect, it } from "vitest";
import { canAddHorse, horseLimit, isPro } from "./plan";
import { SCHEMA_VERSION } from "../db/schema";
import type { UsageMeta } from "./types";

const NOW = Date.UTC(2026, 5, 7);

function meta(over: Partial<UsageMeta> = {}): UsageMeta {
  return {
    id: "singleton",
    schema_version: SCHEMA_VERSION,
    proUntil: null,
    lastCheckedAt: NOW,
    ...over,
  };
}

describe("plan gating", () => {
  it("無料は2頭・PROは30頭", () => {
    expect(horseLimit(meta(), NOW)).toBe(2);
    expect(horseLimit(meta({ proUntil: NOW + 1000 }), NOW)).toBe(30);
  });

  it("枠の上限で追加不可", () => {
    expect(canAddHorse(meta(), 1, NOW)).toBe(true);
    expect(canAddHorse(meta(), 2, NOW)).toBe(false);
    expect(canAddHorse(meta({ proUntil: NOW + 1000 }), 2, NOW)).toBe(true);
    expect(canAddHorse(meta({ proUntil: NOW + 1000 }), 30, NOW)).toBe(false);
  });

  it("期限切れPROは無料扱い", () => {
    expect(isPro(meta({ proUntil: NOW - 1 }), NOW)).toBe(false);
    expect(isPro(meta({ proUntil: NOW + 1 }), NOW)).toBe(true);
  });
});
