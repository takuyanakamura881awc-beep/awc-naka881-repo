import { describe, expect, it } from "vitest";
import { createRng, hashSeed } from "./rng";
import { breed, sireDamGenes } from "./genetics";
import { applyTraining, DEFAULT_MAX_TURNS } from "./training";
import { simulateRace } from "./raceSim";
import { SCHEMA_VERSION } from "../db/schema";
import { SIRES, DAMS } from "../data/sires_dams";
import { RACES } from "../data/races";
import { STAT_KEYS, type PlayerHorse } from "./types";

function makeHorse(seed = "horse-1"): PlayerHorse {
  const bred = breed(sireDamGenes(SIRES[2]), sireDamGenes(DAMS[2]), seed);
  return {
    id: seed,
    schema_version: SCHEMA_VERSION,
    name: "テスト",
    sireId: SIRES[2].id,
    damId: DAMS[2].id,
    sireName: SIRES[2].name,
    damName: DAMS[2].name,
    generation: bred.generation,
    stats: bred.stats,
    potential: bred.potential,
    aptitudes: bred.aptitudes,
    temperament: bred.temperament,
    energy: 100,
    turn: 0,
    maxTurns: DEFAULT_MAX_TURNS,
    createdAt: 0,
    retired: false,
  };
}

describe("rng", () => {
  it("同一シードで同一系列", () => {
    const a = createRng(123);
    const b = createRng(123);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });
  it("hashSeedは安定", () => {
    expect(hashSeed("abc")).toBe(hashSeed("abc"));
  });
});

describe("genetics", () => {
  it("同一シード入力で再現", () => {
    const x = breed(sireDamGenes(SIRES[0]), sireDamGenes(DAMS[0]), "seed-X");
    const y = breed(sireDamGenes(SIRES[0]), sireDamGenes(DAMS[0]), "seed-X");
    expect(x).toEqual(y);
  });
  it("初期能力はポテンシャル以下、範囲内", () => {
    const b = breed(sireDamGenes(SIRES[0]), sireDamGenes(DAMS[1]), "seed-Y");
    for (const k of STAT_KEYS) {
      expect(b.stats[k]).toBeLessThanOrEqual(b.potential[k]);
      expect(b.potential[k]).toBeLessThanOrEqual(1200);
      expect(b.stats[k]).toBeGreaterThan(0);
    }
  });
  it("継承potencyで子のポテンシャルが底上げされ、世代が進む", () => {
    const base = breed(sireDamGenes(SIRES[1]), sireDamGenes(DAMS[1]), "seed-Z");
    const a = { ...sireDamGenes(SIRES[1]), potency: 0.08 };
    const b = { ...sireDamGenes(DAMS[1]), potency: 0.08 };
    const boosted = breed(a, b, "seed-Z");
    const sum = (s: Record<string, number>) =>
      STAT_KEYS.reduce((x, k) => x + s[k], 0);
    expect(sum(boosted.potential)).toBeGreaterThan(sum(base.potential));
    expect(base.generation).toBe(1);
  });
});

describe("training", () => {
  it("対象能力が伸び、エネルギーが減る", () => {
    const h = makeHorse();
    const before = h.stats.speed;
    const out = applyTraining(h, "speed");
    expect(out.horse.stats.speed).toBeGreaterThanOrEqual(before);
    expect(out.energyAfter).toBeLessThan(h.energy);
    expect(out.horse.turn).toBe(1);
  });
  it("休養でエネルギー回復", () => {
    const h = { ...makeHorse(), energy: 30 };
    const out = applyTraining(h, "rest");
    expect(out.energyAfter).toBeGreaterThan(30);
  });
  it("maxTurnsで育成完了", () => {
    let h = makeHorse();
    for (let i = 0; i < DEFAULT_MAX_TURNS; i++) {
      h = applyTraining(h, "speed").horse;
    }
    expect(h.retired).toBe(true);
    expect(h.turn).toBe(DEFAULT_MAX_TURNS);
  });
});

describe("raceSim", () => {
  it("同一シードで同一結果（再現性）", () => {
    const h = makeHorse();
    const r1 = simulateRace(h, RACES[3], "senko", 999);
    const r2 = simulateRace(h, RACES[3], "senko", 999);
    expect(r1).toEqual(r2);
  });
  it("着順はフィールド内に収まる", () => {
    const h = makeHorse();
    for (const race of RACES) {
      const r = simulateRace(h, race, "senko", 42);
      expect(r.position).toBeGreaterThanOrEqual(1);
      expect(r.position).toBeLessThanOrEqual(race.fieldSize);
    }
  });
});
