// 育成（ターン制）：行動を選ぶと能力が変動する。シード乱数で再現可能・自動記録。

import { createRng, hashSeed } from "./rng";
import {
  STAT_KEYS,
  STAT_MAX,
  type PlayerHorse,
  type Stats,
  type StatKey,
  type TrainingAction,
} from "./types";

export const DEFAULT_MAX_TURNS = 24;
const TRAIN_ENERGY_COST = 18;
const REST_ENERGY_GAIN = 55;
const BASE_GAIN = 135;

// 主能力に対する波及先（相互強化）。
const SPILLOVER: Record<StatKey, StatKey> = {
  speed: "power",
  power: "speed",
  stamina: "guts",
  guts: "stamina",
  wit: "speed",
};

export interface TrainingOutcome {
  horse: PlayerHorse;
  delta: Partial<Stats>;
  energyAfter: number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function energyFactor(energy: number): number {
  if (energy >= 50) return 1;
  if (energy <= 0) return 0.45;
  return 0.45 + (energy / 50) * 0.55;
}

export function isTrainable(horse: PlayerHorse): boolean {
  return !horse.retired && horse.turn < horse.maxTurns;
}

export function applyTraining(
  horse: PlayerHorse,
  action: TrainingAction,
): TrainingOutcome {
  const rng = createRng(hashSeed(`${horse.id}:${horse.turn}:${action}`));
  const stats: Stats = { ...horse.stats };
  const delta: Partial<Stats> = {};
  let energy = horse.energy;

  if (action === "rest") {
    energy = clamp(energy + REST_ENERGY_GAIN, 0, 100);
    // 休養でわずかに賢さ・根性が伸びる。
    const g = Math.round(rng.range(2, 6));
    stats.wit = clamp(stats.wit + g, 0, STAT_MAX);
    stats.guts = clamp(stats.guts + Math.round(g / 2), 0, STAT_MAX);
    delta.wit = g;
    delta.guts = Math.round(g / 2);
  } else {
    const key = action as StatKey;
    const headroom = clamp((horse.potential[key] - stats[key]) / horse.potential[key], 0, 1);
    const witF = 0.8 + (stats.wit / STAT_MAX) * 0.4;
    const eF = energyFactor(energy);
    const rand = rng.range(0.85, 1.15);
    const gain = Math.max(1, Math.round(BASE_GAIN * headroom * witF * eF * rand));
    const capped = Math.min(gain, horse.potential[key] - stats[key]);
    stats[key] = clamp(stats[key] + capped, 0, STAT_MAX);
    delta[key] = capped;

    // 波及（25%）。
    const spillKey = SPILLOVER[key];
    const spillRoom = horse.potential[spillKey] - stats[spillKey];
    const spill = Math.min(Math.round(capped * 0.25), Math.max(0, spillRoom));
    if (spill > 0) {
      stats[spillKey] = clamp(stats[spillKey] + spill, 0, STAT_MAX);
      delta[spillKey] = (delta[spillKey] ?? 0) + spill;
    }

    energy = clamp(energy - TRAIN_ENERGY_COST, 0, 100);
  }

  const updated: PlayerHorse = {
    ...horse,
    stats,
    energy,
    turn: horse.turn + 1,
    retired: horse.turn + 1 >= horse.maxTurns,
  };
  return { horse: updated, delta, energyAfter: energy };
}

// 能力値合計（総合力の簡易指標）。
export function statTotal(stats: Stats): number {
  return STAT_KEYS.reduce((sum, k) => sum + stats[k], 0);
}
