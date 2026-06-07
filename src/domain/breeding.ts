// 継承配合のヘルパ：引退馬の成績から配合強化ボーナス(potency)を算出する。
import { getRace } from "../data/races";
import type { RaceDef, RaceEntry } from "./types";

// 親の指定（マスタ種馬 or 引退した育成馬）。
export type ParentRef =
  | { kind: "master"; id: string }
  | { kind: "horse"; id: string };

function gradeScore(grade: RaceDef["grade"], position: number): number {
  const win = position === 1;
  const top3 = position <= 3;
  switch (grade) {
    case "G1":
      return win ? 0.08 : top3 ? 0.05 : 0.02;
    case "G2":
      return win ? 0.05 : top3 ? 0.035 : 0.015;
    case "G3":
      return win ? 0.035 : top3 ? 0.025 : 0.012;
    case "OP":
      return win ? 0.02 : 0.012;
    default:
      return win ? 0.015 : 0.01;
  }
}

// 最高成績に応じた potency（0.01〜0.08）。G1勝ちが最大。
export function breedingPotency(entries: RaceEntry[]): number {
  let best = 0.01;
  for (const e of entries) {
    const r = getRace(e.raceId);
    if (!r) continue;
    best = Math.max(best, gradeScore(r.grade, e.result.position));
  }
  return best;
}

// potency の表示ラベル（星の数）。
export function potencyStars(potency: number): string {
  const n = Math.max(1, Math.min(5, Math.round(potency / 0.016)));
  return "★".repeat(n) + "☆".repeat(5 - n);
}
