// 素質判定：弥生賞(orスプリングS)の着順と皐月賞オッズ＋ペイ設定から、
// 馬の素質（準MAX/MAX下/MAX中/MAX上）を判定する。
// 出典: ぽにょのスタホ日記「MAXオッズの推移（ペイ90/88/84/80）」(2022-10-03)。
// ※初戦弥生賞(orスプリングS)→皐月賞のローテが前提。弥生→桜花賞は全閾値-0.1。
//   弥生→スプリングS→皐月、共同→弥生→皐月などは当てはまらない。
import type { Soshitsu } from "./types";

export const PAY_KEYS = ["90", "88", "84", "80"] as const;
export type Pay = (typeof PAY_KEYS)[number];

export const ROTATION_KEYS = ["弥生→皐月", "弥生→桜花"] as const;
export type Rotation = (typeof ROTATION_KEYS)[number];

// 弥生賞の結果区分。①1着 ②2着 ③3着 ④4〜5着 ⑥掲示板外(6着以下)
type YayoiRow = "1" | "2" | "3" | "4" | "6";

function yayoiRow(finish: number): YayoiRow {
  if (finish <= 1) return "1";
  if (finish === 2) return "2";
  if (finish === 3) return "3";
  if (finish <= 5) return "4";
  return "6";
}

// 各行は [準MAX, MAX下, MAX中, MAX上] の皐月賞判定オッズ（tenths＝×10の整数で保持）。
type Row = [number, number, number, number];
const T = (a: number, b: number, c: number, d: number): Row => [a, b, c, d];

const TABLES: Record<Pay, Record<YayoiRow, Row>> = {
  "90": {
    "1": T(30, 29, 28, 28),
    "2": T(31, 30, 29, 28),
    "3": T(32, 31, 30, 29),
    "4": T(34, 33, 32, 30),
    "6": T(35, 34, 33, 32),
  },
  "88": {
    "1": T(29, 28, 27, 27),
    "2": T(30, 29, 28, 27),
    "3": T(31, 30, 29, 28),
    "4": T(33, 32, 31, 30),
    "6": T(34, 33, 32, 31),
  },
  "84": {
    "1": T(28, 27, 26, 26),
    "2": T(29, 28, 27, 26),
    "3": T(30, 29, 28, 27),
    "4": T(32, 31, 30, 29),
    "6": T(33, 32, 31, 30),
  },
  "80": {
    "1": T(26, 25, 24, 24),
    "2": T(27, 26, 25, 24),
    "3": T(28, 27, 26, 25),
    "4": T(30, 29, 28, 27),
    "6": T(31, 30, 29, 28),
  },
};

export type SoshitsuResult = Soshitsu | "準MAX未満";

export interface JudgeInput {
  pay: Pay;
  rotation: Rotation;
  yayoiFinish: number; // 弥生賞の着順
  odds: number; // 皐月賞(or桜花賞)の単勝オッズ
}

export interface JudgeOutput {
  rank: SoshitsuResult;
  note: string;
}

// 皐月賞オッズから素質を判定。オッズが低いほど高素質。
export function judgeSoshitsu(input: JudgeInput): JudgeOutput {
  const { pay, rotation, yayoiFinish, odds } = input;
  const row = TABLES[pay][yayoiRow(yayoiFinish)];
  const adj = rotation === "弥生→桜花" ? -1 : 0; // 桜花は全閾値 -0.1
  const [jun, ge, chu, jo] = row.map((v) => v + adj) as unknown as Row;
  const o = Math.round(odds * 10);

  // 高素質側(上)から判定。閾値以下なら該当。
  let rank: SoshitsuResult;
  if (o <= jo) rank = "MAX上";
  else if (o <= chu) rank = "MAX中";
  else if (o <= ge) rank = "MAX下";
  else if (o <= jun) rank = "準MAX";
  else rank = "準MAX未満";

  let note = "";
  if (rotation === "弥生→桜花") note = "弥生→桜花のため閾値-0.1で判定。";
  if (jo === chu && (rank === "MAX上" || rank === "MAX中")) {
    note += "MAX中とMAX上の境界が重なる帯です。";
  }
  return { rank, note: note.trim() };
}
