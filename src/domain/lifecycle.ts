// 残り週（寿命）・引退/継承アラート・ローテ支援（純粋ロジック）。
// 寿命/継承条件の実機値は不確実なため定数化（既定はシリーズ一般値。設定で変更可）。
import type { Horse, RaceLog } from "./types";

export const DEFAULT_MAX_WEEKS = 120; // 厩舎在籍の上限（要実機確認）
export const INHERIT_WEEKS_THRESHOLD = 80; // 残りこの週以下の古馬は継承可（要実機確認）
export const RETIRE_SOON_WEEKS = 12; // 「残りわずか」警告のしきい値
export const ROTATION_GAP_WEEKS = 3; // 中2週（レース→調教2回→レース）

// G1勝利、または残り週が一定以下で継承（次代の親に）できる。
export function canInherit(horse: Horse): boolean {
  return horse.g1Wins > 0 || horse.wbcWins > 0 || horse.weeksLeft <= INHERIT_WEEKS_THRESHOLD;
}

// 通算成績スナップショットから出走数・連対率を求める。
export function careerStarts(h: Horse): number {
  return h.first + h.second + h.third + h.unplaced;
}
export function rensRate(h: Horse): number {
  const s = careerStarts(h);
  return s > 0 ? (h.first + h.second) / s : 0;
}

export type AlertLevel = "info" | "warn" | "urgent";
export interface Alert {
  level: AlertLevel;
  message: string;
}

// 1頭ぶんのアラート（重要度順）。
export function horseAlerts(horse: Horse): Alert[] {
  const out: Alert[] = [];
  if (horse.status !== "育成中") return out;

  if (horse.weeksLeft <= 0) {
    out.push({ level: "urgent", message: "残り0週。引退手続きをしましょう" });
  } else if (horse.weeksLeft <= RETIRE_SOON_WEEKS) {
    out.push({ level: "warn", message: `残り${horse.weeksLeft}週。ローテに注意` });
  }
  if (canInherit(horse)) {
    const why = horse.g1Wins > 0 ? "G1勝利" : `残${horse.weeksLeft}週`;
    out.push({ level: "info", message: `継承可能（${why}）。次代の親に使えます` });
  }
  return out;
}

// 厩舎全体で対応が必要な馬がいるか。
export function hasActionableAlert(horses: Horse[]): boolean {
  return horses.some((h) => horseAlerts(h).some((a) => a.level !== "info"));
}

// 次走の目安週（中2週）。残り週は出走で減る前提の単純計算。
export function suggestedNextRaceWeek(currentWeeksLeft: number): number {
  return Math.max(0, currentWeeksLeft - ROTATION_GAP_WEEKS);
}

// 出走記録から成績サマリを作る。
export interface RaceRecord {
  starts: number;
  wins: number;
  top3: number;
  prize: number;
  g1Wins: number;
}

export function summarize(logs: RaceLog[]): RaceRecord {
  const done = logs.filter((l) => l.status === "完了" && l.position != null);
  let wins = 0, top3 = 0, prize = 0, g1Wins = 0;
  for (const l of done) {
    const pos = l.position as number;
    if (pos === 1) wins++;
    if (pos <= 3) top3++;
    prize += l.prize ?? 0;
    if (pos === 1 && (l.grade === "G1" || l.grade === "J-G1" || l.grade === "WBC")) g1Wins++;
  }
  return { starts: done.length, wins, top3, prize, g1Wins };
}
