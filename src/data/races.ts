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
  fieldStrength: number,
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
    fieldStrength,
  };
}

export const RACES: RaceDef[] = [
  race("r-maiden-turf", "新緑メイクデビュー", "条件", 1600, "turf", 12, 50, 0.42),
  race("r-maiden-dirt", "黎明ダートデビュー", "条件", 1400, "dirt", 12, 50, 0.42),
  race("r-sprint-op", "スプリングダッシュOP", "OP", 1200, "turf", 14, 180, 0.62),
  race("r-mile-g3", "クリアスカイ記念", "G3", 1600, "turf", 16, 380, 0.72),
  race("r-dirt-g3", "サンドストームC", "G3", 1800, "dirt", 16, 380, 0.72),
  race("r-middle-g2", "エメラルドステークス", "G2", 2000, "turf", 16, 650, 0.8),
  race("r-long-g2", "ロングホープ賞", "G2", 2600, "turf", 16, 650, 0.8),
  race("r-sprint-g1", "ソニックブースト杯", "G1", 1200, "turf", 18, 1500, 0.88),
  race("r-mile-g1", "ルミナスマイル", "G1", 1600, "turf", 18, 1600, 0.9),
  race("r-classic-g1", "オーロラクラシック", "G1", 2400, "turf", 18, 2000, 0.92),
  race("r-dirt-g1", "ダストクラウンC", "G1", 2000, "dirt", 16, 1500, 0.88),
];

const BY_ID: Record<string, RaceDef> = Object.fromEntries(RACES.map((r) => [r.id, r]));

export function getRace(id: string): RaceDef | undefined {
  return BY_ID[id];
}
