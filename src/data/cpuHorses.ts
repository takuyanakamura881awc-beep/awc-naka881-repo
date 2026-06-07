// CPU馬マスタ（配合で父・母に選べる種牡馬・繁殖牝馬）。
// 攻略ボードの「繁殖牡馬/繁殖牝馬一覧」より。継承型・成長・距離・ダート・気性・毛色を保持。
// 写真からの読み取りのため不確実な項目は「不明」。実機で補正可能。
import type {
  Aptitude,
  Coat,
  Distance,
  Growth,
  InheritType,
  Sex,
  Temper,
} from "../domain/types";

export interface CpuHorse {
  id: string;
  name: string;
  sex: Sex;
  inheritType: InheritType;
  growth: Growth;
  distance: Distance;
  dirtApt: Aptitude;
  temper: Temper;
  coat: Coat;
}

interface CpuInput {
  inheritType?: InheritType;
  growth?: Growth;
  distance?: Distance;
  dirtApt?: Aptitude;
  temper?: Temper;
  coat?: Coat;
}

function h(id: string, name: string, sex: Sex, v: CpuInput = {}): CpuHorse {
  return {
    id,
    name,
    sex,
    inheritType: v.inheritType ?? "不明",
    growth: v.growth ?? "不明",
    distance: v.distance ?? "不明",
    dirtApt: v.dirtApt ?? "不明",
    temper: v.temper ?? "不明",
    coat: v.coat ?? "不明",
  };
}

export const CPU_SIRES: CpuHorse[] = [
  // 攻略ボードから読み取れた値を反映。
  h("s-agnes-world", "アグネスワールド", "牡", { inheritType: "平均", growth: "早熟", distance: "中短距離", coat: "栗毛" }),
  h("s-agnes-digital", "アグネスデジタル", "牡", { inheritType: "堅実", growth: "普通", distance: "中短距離", dirtApt: "得意", temper: "普通", coat: "栗毛" }),
  h("s-afleet", "アフリート", "牡", { inheritType: "H/H", distance: "中距離", temper: "荒い", coat: "黒鹿毛" }),
  h("s-war-emblem", "ウォーエンブレム", "牡", { inheritType: "H/H", growth: "普通", distance: "中長距離", temper: "普通", coat: "鹿毛" }),
  h("s-elisio", "エリシオ", "牡", { inheritType: "平均", growth: "普通", distance: "中長距離", temper: "普通", coat: "鹿毛" }),
  // 以下はロスター名のみ（数値は要実機確認）。
  h("s-deep", "ディープインパクト", "牡"),
  h("s-king-kamehameha", "キングカメハメハ", "牡"),
  h("s-symboli-rudolf", "シンボリルドルフ", "牡"),
  h("s-tokai-teio", "トウカイテイオー", "牡"),
  h("s-narita-brian", "ナリタブライアン", "牡"),
  h("s-silence-suzuka", "サイレンススズカ", "牡"),
  h("s-stay-gold", "ステイゴールド", "牡"),
  h("s-mejiro-mcqueen", "メジロマックイーン", "牡"),
  h("s-sakura-bakushinoh", "サクラバクシンオー", "牡"),
  h("s-tanino-gimlet", "タニノギムレット", "牡"),
  h("s-brians-time", "ブライアンズタイム", "牡"),
  h("s-tony-bin", "トニービン", "牡"),
];

export const CPU_DAMS: CpuHorse[] = [
  h("d-air-groove", "エアグルーヴ", "牝"),
  h("d-vodka", "ウオッカ", "牝"),
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
];

const BY_ID: Record<string, CpuHorse> = Object.fromEntries(
  [...CPU_SIRES, ...CPU_DAMS].map((c) => [c.id, c]),
);

export function getCpuHorse(id: string): CpuHorse | undefined {
  return BY_ID[id];
}
