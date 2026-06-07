// 仔馬生産〜条件戦クリア時に出る「誕生/評価コメント」。
// 出典: ぽにょのスタホ日記（ユーザー提供の確定文言）。
// ・「上位3つ（名馬/天馬/神話）」は条件戦"無敗"でのみ出現。
// ・名馬コメは一定の素質がないと出ない（高素質の指標。尾花栗毛と同様）。
// ・天馬/神話コメは素質に関係なく出る（素質の指標ではない）。
export interface BirthComment {
  key: string; // 略称
  text: string; // 全文
  tier: number; // 序列（大きいほど上位レア）
  undefeatedOnly: boolean; // 条件戦無敗でのみ出現
  notable: boolean; // 「コメ付き」＝潜在コメ以上（注目）
  hint: string; // 素質・条件に関する注記
}

// 序列降順。tierが大きいほど上位。コメ付き＝潜在コメ(tier2)以上。
export const BIRTH_COMMENTS: BirthComment[] = [
  { key: "名馬コメ", text: "これほどの名馬にめぐり合えたことを神に感謝します", tier: 8, undefeatedOnly: true, notable: true, hint: "条件戦無敗＋一定の素質が必要（高素質の指標）" },
  { key: "天馬コメ", text: "スピード、スケール共に天馬の領域に達していますね", tier: 7, undefeatedOnly: true, notable: true, hint: "条件戦無敗で出現（素質とは無関係）" },
  { key: "神話コメ", text: "この馬なら新たな神話を創ることができるかもしれませんよ", tier: 6, undefeatedOnly: true, notable: true, hint: "条件戦無敗で出現（素質とは無関係）" },
  { key: "サラコメ", text: "この馬がサラブレッドの歴史を変えるかもしれません", tier: 5, undefeatedOnly: false, notable: true, hint: "" },
  { key: "三冠コメ", text: "この馬ならWBC３冠を狙えるかもしれません", tier: 4, undefeatedOnly: false, notable: true, hint: "" },
  { key: "WBCコメ", text: "この馬ならWBCを狙えるかもしれません", tier: 3, undefeatedOnly: false, notable: true, hint: "" },
  { key: "潜在コメ", text: "潜在能力は相当なものを持っています", tier: 2, undefeatedOnly: false, notable: true, hint: "コメ付きの最下位ライン（潜在コメ以上＝コメ付き）" },
  { key: "グレコメ", text: "いよいよグレードレースに出走です", tier: 1, undefeatedOnly: false, notable: false, hint: "通常の出走コメント（コメ付きではない）" },
];

export const BIRTH_COMMENT_TEXTS: string[] = BIRTH_COMMENTS.map((c) => c.text);

// 入力テキストから既知コメントを引く（前後の表記揺れを軽く吸収）。
export function findComment(text: string): BirthComment | undefined {
  const t = text.trim();
  if (!t) return undefined;
  return BIRTH_COMMENTS.find((c) => c.text === t || t.includes(c.text) || c.text.includes(t));
}
