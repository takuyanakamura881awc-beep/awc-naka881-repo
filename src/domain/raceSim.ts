// レースシミュレーション：能力値・適性・レース条件＋シード乱数で着順・タイムを算出。
// 開発者がバランスを握るため、提案ロジック(suggestions.ts)と同じ評価関数を共有する。

import { createRng } from "./rng";
import {
  STAT_KEYS,
  STYLE_KEYS,
  type DistanceKey,
  type PlayerHorse,
  type RaceDef,
  type RaceResult,
  type StatKey,
  type StyleKey,
} from "./types";

// 距離カテゴリごとの能力ウェイト。
const DISTANCE_WEIGHTS: Record<DistanceKey, Record<StatKey, number>> = {
  short: { speed: 0.4, stamina: 0.1, power: 0.3, guts: 0.1, wit: 0.1 },
  mile: { speed: 0.33, stamina: 0.2, power: 0.22, guts: 0.13, wit: 0.12 },
  middle: { speed: 0.26, stamina: 0.3, power: 0.18, guts: 0.14, wit: 0.12 },
  long: { speed: 0.18, stamina: 0.4, power: 0.12, guts: 0.2, wit: 0.1 },
};

function weightedStats(horse: PlayerHorse, distanceKey: DistanceKey): number {
  const w = DISTANCE_WEIGHTS[distanceKey];
  let sum = 0;
  let wsum = 0;
  for (const k of STAT_KEYS) {
    sum += horse.stats[k] * w[k];
    wsum += w[k];
  }
  return sum / wsum;
}

export function bestStyle(horse: PlayerHorse): StyleKey {
  let best: StyleKey = STYLE_KEYS[0];
  for (const s of STYLE_KEYS) {
    if (horse.aptitudes.style[s] > horse.aptitudes.style[best]) best = s;
  }
  return best;
}

// 相手なしの素の能力評価（提案・期待値の見積もりに使用）。決定論的。
export function estimatePerformance(
  horse: PlayerHorse,
  race: RaceDef,
  style: StyleKey,
): number {
  const base = weightedStats(horse, race.distanceKey);
  const distMult = 0.55 + 0.45 * horse.aptitudes.distance[race.distanceKey];
  const surfMult = 0.55 + 0.45 * horse.aptitudes.surface[race.surface];
  const styleMult = 0.8 + 0.2 * horse.aptitudes.style[style];
  const energyMult = 0.9 + 0.1 * (horse.energy / 100);
  return base * distMult * surfMult * styleMult * energyMult;
}

export function simulateRace(
  horse: PlayerHorse,
  race: RaceDef,
  style: StyleKey,
  seed: number,
): RaceResult {
  const rng = createRng(seed);

  const basePerf = estimatePerformance(horse, race, style);
  // 気性が高いほどブレが大きい。
  const variance = 0.04 + horse.temperament * 0.08;
  const perf = Math.max(1, basePerf * rng.gaussian(1, variance));

  // 相手生成：グレード基準の強さ＋個体ばらつき。
  const opponentBase = race.fieldStrength * 1200;
  let beaten = 0;
  for (let i = 0; i < race.fieldSize - 1; i++) {
    const opp = opponentBase * rng.gaussian(1, 0.06);
    if (opp > perf) beaten++;
  }
  const position = beaten + 1;

  // タイム（演出用の概算）。
  const mps = 16 + (perf / 1200) * 4;
  const timeSeconds = Number((race.distance / mps + rng.range(-0.3, 0.3)).toFixed(1));

  const prize = prizeForPosition(position, race.prize);

  return {
    position,
    fieldSize: race.fieldSize,
    timeSeconds,
    performance: Math.round(perf),
    prize,
  };
}

function prizeForPosition(position: number, firstPrize: number): number {
  const rate = [1, 0.4, 0.25, 0.15, 0.1][position - 1];
  return rate ? Math.round(firstPrize * rate) : 0;
}
