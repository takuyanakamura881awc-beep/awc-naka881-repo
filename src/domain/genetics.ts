// 遺伝：2頭の親（マスタ種馬 or 引退した育成馬）から子の能力・ポテンシャル・適性を決定。
// 継承配合：親の成績に応じた potency ボーナスで子のポテンシャルが上振れし、
// 世代を重ねるほど強い馬を作れる（育成シムの中核フック）。シード乱数で再現可能。

import { createRng, hashSeed, type Rng } from "./rng";
import {
  DISTANCE_KEYS,
  STAT_KEYS,
  STYLE_KEYS,
  SURFACE_KEYS,
  STAT_MAX,
  type Aptitudes,
  type PlayerHorse,
  type SireDam,
  type Stats,
} from "./types";

// 親の遺伝情報（マスタ・引退馬を共通化）。
export interface ParentGenes {
  potential: Stats;
  aptitudes: Aptitudes;
  temperament: number;
  potency: number; // 配合強化ボーナス（0.01〜0.08程度）。子ポテンシャルを底上げ。
  generation: number; // マスタ=0、育成馬=その世代
}

export function sireDamGenes(sd: SireDam): ParentGenes {
  return {
    potential: sd.potential,
    aptitudes: sd.aptitudes,
    temperament: sd.temperament,
    potency: 0,
    generation: 0,
  };
}

export function horseGenes(horse: PlayerHorse, potency: number): ParentGenes {
  return {
    potential: horse.potential,
    aptitudes: horse.aptitudes,
    temperament: horse.temperament,
    potency,
    generation: horse.generation,
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function inheritStat(sire: number, dam: number, rng: Rng): number {
  const base = (sire + dam) / 2;
  const bias = rng.range(-0.15, 0.15) * (sire - dam);
  const noise = rng.gaussian(0, STAT_MAX * 0.06);
  return base + bias + noise;
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

export function breed(a: ParentGenes, b: ParentGenes, seedInput: string): BreedResult {
  const rng = createRng(hashSeed(seedInput));
  const potencyMult = 1 + (a.potency + b.potency) / 2;

  const potential = {} as Stats;
  const stats = {} as Stats;
  for (const k of STAT_KEYS) {
    const p = clamp(Math.round(inheritStat(a.potential[k], b.potential[k], rng) * potencyMult), 80, STAT_MAX);
    potential[k] = p;
    // 初期能力はポテンシャルの20〜32%（若駒・未調教）。
    stats[k] = Math.round(p * rng.range(0.2, 0.32));
  }

  const distance = {} as Aptitudes["distance"];
  for (const k of DISTANCE_KEYS) {
    distance[k] = inheritApt(a.aptitudes.distance[k], b.aptitudes.distance[k], rng);
  }
  const surface = {} as Aptitudes["surface"];
  for (const k of SURFACE_KEYS) {
    surface[k] = inheritApt(a.aptitudes.surface[k], b.aptitudes.surface[k], rng);
  }
  const style = {} as Aptitudes["style"];
  for (const k of STYLE_KEYS) {
    style[k] = inheritApt(a.aptitudes.style[k], b.aptitudes.style[k], rng);
  }

  const temperament = clamp(
    (a.temperament + b.temperament) / 2 + rng.gaussian(0, 0.08),
    0,
    1,
  );

  return {
    potential,
    stats,
    aptitudes: { distance, surface, style },
    temperament,
    generation: Math.max(a.generation, b.generation) + 1,
  };
}
