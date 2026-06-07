// 提案（ルールベース・権威ソース）：ゲーム設計から導いた最適化ロジック。
// 他人のプレイデータ集約は不要。レース評価は raceSim と同じ関数を共有。

import { bestStyle, estimatePerformance } from "./raceSim";
import {
  DISTANCE_LABELS,
  STAT_LABELS,
  STAT_MAX,
  STAT_KEYS,
  type DistanceKey,
  type PlayerHorse,
  type RaceDef,
  type StatKey,
  type TrainingAction,
} from "./types";

// 距離カテゴリごとの重要能力（提案の根拠）。
const DISTANCE_FOCUS: Record<DistanceKey, StatKey[]> = {
  short: ["speed", "power"],
  mile: ["speed", "stamina"],
  middle: ["stamina", "speed"],
  long: ["stamina", "guts"],
};

export interface TrainingSuggestion {
  action: TrainingAction;
  reason: string;
}

export function bestDistance(horse: PlayerHorse): DistanceKey {
  const d = horse.aptitudes.distance;
  return (Object.keys(d) as DistanceKey[]).reduce((a, b) => (d[b] > d[a] ? b : a));
}

export function suggestTraining(horse: PlayerHorse): TrainingSuggestion {
  if (horse.energy < 30) {
    return {
      action: "rest",
      reason: `コンディションが低下しています（${horse.energy}）。休養で立て直しましょう。`,
    };
  }
  const dist = bestDistance(horse);
  const focus = DISTANCE_FOCUS[dist];

  // 重要能力ほど、伸びしろ(headroom)が大きいほど価値が高い。
  let bestKey: StatKey = STAT_KEYS[0];
  let bestValue = -Infinity;
  for (const k of STAT_KEYS) {
    const headroom = (horse.potential[k] - horse.stats[k]) / horse.potential[k];
    const importance = focus.includes(k) ? 1.5 : 1;
    const value = headroom * importance;
    if (value > bestValue) {
      bestValue = value;
      bestKey = k;
    }
  }

  const reason = focus.includes(bestKey)
    ? `${DISTANCE_LABELS[dist]}適性を活かすには${STAT_LABELS[bestKey]}が鍵。まだ伸びしろがあります。`
    : `${STAT_LABELS[bestKey]}に伸びしろが大きく、効率よく強化できます。`;

  return { action: bestKey, reason };
}

export interface RaceSuggestion {
  race: RaceDef;
  ratio: number; // 期待性能 / 相手基準
  note: string;
}

export function suggestRaces(
  horse: PlayerHorse,
  races: RaceDef[],
  limit = 3,
): RaceSuggestion[] {
  const style = bestStyle(horse);
  const scored = races.map((race) => {
    const perf = estimatePerformance(horse, race, style);
    const ratio = perf / race.rivalPerf;
    return { race, ratio, note: noteForRatio(ratio) };
  });
  return scored
    .filter((s) => s.ratio >= 0.85)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, limit);
}

function noteForRatio(ratio: number): string {
  if (ratio >= 1.1) return "勝ち負け濃厚";
  if (ratio >= 1.0) return "好勝負";
  if (ratio >= 0.92) return "上位を狙える";
  return "挑戦";
}

// 総合力の目安（0..100の見やすい指標）。
export function ratingScore(horse: PlayerHorse): number {
  const total = STAT_KEYS.reduce((s, k) => s + horse.stats[k], 0);
  return Math.round((total / (STAT_MAX * STAT_KEYS.length)) * 100);
}
