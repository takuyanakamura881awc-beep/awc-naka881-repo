// ベット集計と応援アイテム解放（純粋ロジック）。
// 応援アイテムは「1頭への累計ベット枚数」で解放される（出典: 公式攻略ボード）。
// 名称・しきい値は攻略ボードの読み取り。実機で補正可能。
import type { Bet } from "./types";

export interface SupportItem {
  threshold: number; // 累計ベット枚数
  name: string;
}

// 出典: ぽにょのスタホ日記「基本情報」(応援餌)。他サテライトからの累計ベット枚数で解放。
// ※1枠（味噌汁枠）に入ると必要ベット数が約1/6に軽減される。
export const SUPPORT_ITEMS: SupportItem[] = [
  { threshold: 100, name: "応援ミルク" },
  { threshold: 500, name: "応援飲料" },
  { threshold: 1000, name: "応援ゼリー" },
  { threshold: 2000, name: "応援味噌汁" },
  { threshold: 5000, name: "応援カクテル" },
];

export interface BetSummary {
  count: number; // ベット回数
  staked: number; // 累計投入枚数
  returned: number; // 累計払い戻し
  net: number; // 収支
  hits: number; // 的中回数
  hitRate: number; // 的中率(0-1)
}

export function summarizeBets(bets: Bet[]): BetSummary {
  let staked = 0, returned = 0, hits = 0;
  for (const b of bets) {
    staked += b.stake;
    returned += b.payout;
    if (b.hit) hits++;
  }
  return {
    count: bets.length,
    staked,
    returned,
    net: returned - staked,
    hits,
    hitRate: bets.length ? hits / bets.length : 0,
  };
}

export interface SupportProgress {
  unlocked: SupportItem[];
  next: SupportItem | null;
  remaining: number; // 次の解放まで残り枚数
}

export function supportProgress(totalStaked: number): SupportProgress {
  const unlocked = SUPPORT_ITEMS.filter((i) => totalStaked >= i.threshold);
  const next = SUPPORT_ITEMS.find((i) => totalStaked < i.threshold) ?? null;
  return {
    unlocked,
    next,
    remaining: next ? next.threshold - totalStaked : 0,
  };
}
