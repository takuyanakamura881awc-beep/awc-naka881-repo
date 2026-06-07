// フリーミアムのゲート（純粋ロジック）。UsageMeta を入出力する。
// 無料：厩舎枠2頭・提案 週2回 / 有料：厩舎枠30頭・提案 無制限。

import type { UsageMeta } from "./types";

export const FREE_STABLE_LIMIT = 2;
export const PRO_STABLE_LIMIT = 30;
export const FREE_WEEKLY_SUGGESTIONS = 2;
// 課金状態のオフライン猶予（最終確認からの許容期間）。
export const OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export function isPro(meta: UsageMeta, now: number): boolean {
  return meta.proUntil !== null && meta.proUntil > now;
}

export function stableLimit(meta: UsageMeta, now: number): number {
  return isPro(meta, now) ? PRO_STABLE_LIMIT : FREE_STABLE_LIMIT;
}

export function canCreateHorse(
  meta: UsageMeta,
  currentCount: number,
  now: number,
): boolean {
  return currentCount < stableLimit(meta, now);
}

// ISO 8601 の週キー（"YYYY-Www"）。週は月曜始まり。
export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function suggestionsRemaining(meta: UsageMeta, now: number): number {
  if (isPro(meta, now)) return Infinity;
  const wk = isoWeekKey(new Date(now));
  const used = meta.suggestionWeekKey === wk ? meta.suggestionCount : 0;
  return Math.max(0, FREE_WEEKLY_SUGGESTIONS - used);
}

export interface ConsumeResult {
  allowed: boolean;
  meta: UsageMeta;
}

// 提案を1回消費。週が変わっていればカウンタをリセット。有料は無制限。
export function consumeSuggestion(meta: UsageMeta, now: number): ConsumeResult {
  if (isPro(meta, now)) {
    return { allowed: true, meta };
  }
  const wk = isoWeekKey(new Date(now));
  const used = meta.suggestionWeekKey === wk ? meta.suggestionCount : 0;
  if (used >= FREE_WEEKLY_SUGGESTIONS) {
    return {
      allowed: false,
      meta: { ...meta, suggestionWeekKey: wk, suggestionCount: used },
    };
  }
  return {
    allowed: true,
    meta: { ...meta, suggestionWeekKey: wk, suggestionCount: used + 1 },
  };
}
