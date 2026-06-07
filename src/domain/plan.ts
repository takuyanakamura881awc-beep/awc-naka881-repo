// フリーミアムのゲート（純粋ロジック）。
// 無料：管理できる馬 2頭まで ／ 有料(PRO)：30頭まで。
import type { UsageMeta } from "./types";

export const FREE_HORSE_LIMIT = 2;
export const PRO_HORSE_LIMIT = 30;
// 課金状態のオフライン猶予（最終確認からの許容期間）。
export const OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export function isPro(meta: UsageMeta, now: number): boolean {
  return meta.proUntil !== null && meta.proUntil > now;
}

export function horseLimit(meta: UsageMeta, now: number): number {
  return isPro(meta, now) ? PRO_HORSE_LIMIT : FREE_HORSE_LIMIT;
}

export function canAddHorse(meta: UsageMeta, currentCount: number, now: number): boolean {
  return currentCount < horseLimit(meta, now);
}
