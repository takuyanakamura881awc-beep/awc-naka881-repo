// CPU馬マスタ（配合で父・母に選べる種牡馬・繁殖牝馬）。
// スタホRのロスター（実名ベース）。継承型は実機での確認が必要なため既定「不明」。
// 出典: ぽにょのスタホR日記（CPU馬の継承型）ほか。値はユーザーが実機で補正可能。
import type { InheritType, Sex } from "../domain/types";

export interface CpuHorse {
  id: string;
  name: string;
  sex: Sex;
  inheritType: InheritType;
}

function h(id: string, name: string, sex: Sex, inheritType: InheritType = "不明"): CpuHorse {
  return { id, name, sex, inheritType };
}

export const CPU_SIRES: CpuHorse[] = [
  h("s-deep", "ディープインパクト", "牡"),
  h("s-king-kamehameha", "キングカメハメハ", "牡"),
  h("s-symboli-rudolf", "シンボリルドルフ", "牡"),
  h("s-tokai-teio", "トウカイテイオー", "牡"),
  h("s-narita-brian", "ナリタブライアン", "牡"),
  h("s-silence-suzuka", "サイレンススズカ", "牡"),
  h("s-stay-gold", "ステイゴールド", "牡"),
  h("s-hearts-cry", "ハーツクライ", "牡"),
  h("s-t-m-opera-o", "テイエムオペラオー", "牡"),
  h("s-tap-dance-city", "タップダンスシチー", "牡"),
  h("s-opera-house", "オペラハウス", "牡"),
  h("s-oguri-cap", "オグリキャップ", "牡"),
  h("s-mejiro-mcqueen", "メジロマックイーン", "牡"),
  h("s-sakura-bakushinoh", "サクラバクシンオー", "牡"),
  h("s-fuji-kiseki", "フジキセキ", "牡"),
  h("s-dance-in-the-dark", "ダンスインザダーク", "牡"),
  h("s-tanino-gimlet", "タニノギムレット", "牡"),
  h("s-agnes-digital", "アグネスデジタル", "牡"),
  h("s-brians-time", "ブライアンズタイム", "牡"),
  h("s-tony-bin", "トニービン", "牡"),
  h("s-afleet", "アフリート", "牡"),
  h("s-war-emblem", "ウォーエンブレム", "牡"),
  h("s-elisio", "エリシオ", "牡"),
  h("s-rahy", "ラムタラ", "牡"),
  h("s-yamanin-zephyr", "ヤマニンゼファー", "牡"),
  h("s-narita-top-road", "ナリタトップロード", "牡"),
];

export const CPU_DAMS: CpuHorse[] = [
  h("d-air-groove", "エアグルーヴ", "牝"),
  h("d-vodka", "ウオッカ", "牝"),
  h("d-line-craft", "ラインクラフト", "牝"),
  h("d-still-in-love", "スティルインラブ", "牝"),
  h("d-mejiro-ramonu", "メジロラモーヌ", "牝"),
  h("d-mejiro-dober", "メジロドーベル", "牝"),
  h("d-hokuto-vega", "ホクトベガ", "牝"),
  h("d-hishi-amazon", "ヒシアマゾン", "牝"),
  h("d-heavenly-romance", "ヘヴンリーロマンス", "牝"),
  h("d-to-the-victory", "トゥザヴィクトリー", "牝"),
  h("d-nishino-flower", "ニシノフラワー", "牝"),
  h("d-seeking-the-pearl", "シーキングザパール", "牝"),
  h("d-daiichi-ruby", "ダイイチルビー", "牝"),
  h("d-pacificus", "パシフィカス", "牝"),
  h("d-tanino-sister", "タニノシスター", "牝"),
];

const BY_ID: Record<string, CpuHorse> = Object.fromEntries(
  [...CPU_SIRES, ...CPU_DAMS].map((c) => [c.id, c]),
);

export function getCpuHorse(id: string): CpuHorse | undefined {
  return BY_ID[id];
}
