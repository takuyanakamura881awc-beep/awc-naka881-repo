// レースマスタ（独自データ・架空）。出走レース選択肢の母体。
import type { DistanceKey, RaceDef } from "../domain/types";

function distanceKey(distance: number): DistanceKey {
  if (distance <= 1400) return "short";
  if (distance <= 1800) return "mile";
  if (distance <= 2200) return "middle";
  return "long";
}

function race(
  id: string,
  name: string,
  grade: RaceDef["grade"],
  distance: number,
  surface: RaceDef["surface"],
  fieldSize: number,
  prize: number,
  rivalPerf: number,
): RaceDef {
  return {
    id,
    name,
    grade,
    distance,
    distanceKey: distanceKey(distance),
    surface,
    fieldSize,
    prize,
    rivalPerf,
  };
}

// rivalPerf は perf スケールの相手基準（balance.ts で校正）。
// 勝てる階段：条件300 → OP360 → G3 420 → G2 475 → G1 540〜580。
export const RACES: RaceDef[] = [
  race("r-maiden-turf", "新緑メイクデビュー", "条件", 1600, "turf", 12, 50, 300),
  race("r-maiden-dirt", "黎明ダートデビュー", "条件", 1400, "dirt", 12, 50, 300),
  race("r-sprint-op", "スプリングダッシュOP", "OP", 1200, "turf", 14, 180, 360),
  race("r-mile-g3", "クリアスカイ記念", "G3", 1600, "turf", 16, 380, 420),
  race("r-dirt-g3", "サンドストームC", "G3", 1800, "dirt", 16, 380, 420),
  race("r-middle-g2", "エメラルドステークス", "G2", 2000, "turf", 16, 650, 475),
  race("r-long-g2", "ロングホープ賞", "G2", 2600, "turf", 16, 650, 475),
  race("r-sprint-g1", "ソニックブースト杯", "G1", 1200, "turf", 18, 1500, 540),
  race("r-mile-g1", "ルミナスマイル", "G1", 1600, "turf", 18, 1600, 550),
  race("r-classic-g1", "オーロラクラシック", "G1", 2400, "turf", 18, 2000, 580),
  race("r-dirt-g1", "ダストクラウンC", "G1", 2000, "dirt", 16, 1500, 540),
];

const BY_ID: Record<string, RaceDef> = Object.fromEntries(RACES.map((r) => [r.id, r]));

export function getRace(id: string): RaceDef | undefined {
  return BY_ID[id];
}
