// 遺伝：父・母から育成馬の初期能力・ポテンシャル・適性を決定する（シード乱数で再現可能）。

import { createRng, hashSeed, type Rng } from "./rng";
import {
  DISTANCE_KEYS,
  STAT_KEYS,
  STYLE_KEYS,
  SURFACE_KEYS,
  STAT_MAX,
  type Aptitudes,
  type SireDam,
  type Stats,
} from "./types";

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function inheritStat(sire: number, dam: number, rng: Rng): number {
  // 両親の平均にガウス変動。やや父母どちらかに寄ることもある。
  const base = (sire + dam) / 2;
  const bias = rng.range(-0.15, 0.15) * (sire - dam);
  const noise = rng.gaussian(0, STAT_MAX * 0.06);
  return clamp(Math.round(base + bias + noise), 80, STAT_MAX);
}

function inheritApt(sire: number, dam: number, rng: Rng): number {
  const base = (sire + dam) / 2;
  const noise = rng.gaussian(0, 0.08);
  return clamp(base + noise, 0, 1);
}

export interface BreedResult {
  potential: Stats;
  stats: Stats;
  aptitudes: Aptitudes;
  temperament: number;
  generation: number;
}

export function breed(
  sire: SireDam,
  dam: SireDam,
  seedInput: string,
): BreedResult {
  const rng = createRng(hashSeed(seedInput));

  const potential = {} as Stats;
  const stats = {} as Stats;
  for (const k of STAT_KEYS) {
    const p = inheritStat(sire.potential[k], dam.potential[k], rng);
    potential[k] = p;
    // 初期能力はポテンシャルの20〜32%（若駒・未調教）。
    stats[k] = Math.round(p * rng.range(0.2, 0.32));
  }

  const distance = {} as Aptitudes["distance"];
  for (const k of DISTANCE_KEYS) {
    distance[k] = inheritApt(sire.aptitudes.distance[k], dam.aptitudes.distance[k], rng);
  }
  const surface = {} as Aptitudes["surface"];
  for (const k of SURFACE_KEYS) {
    surface[k] = inheritApt(sire.aptitudes.surface[k], dam.aptitudes.surface[k], rng);
  }
  const style = {} as Aptitudes["style"];
  for (const k of STYLE_KEYS) {
    style[k] = inheritApt(sire.aptitudes.style[k], dam.aptitudes.style[k], rng);
  }

  const temperament = clamp(
    (sire.temperament + dam.temperament) / 2 + rng.gaussian(0, 0.08),
    0,
    1,
  );

  return {
    potential,
    stats,
    aptitudes: { distance, surface, style },
    temperament,
    generation: 1,
  };
}
