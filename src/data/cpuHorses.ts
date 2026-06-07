// CPU馬マスタ（配合で父・母に選べる種牡馬・繁殖牝馬）。
// 継承型の出典: ぽにょのスタホ日記「スタホR初級講座（CPU馬の継承型）」(はっち氏情報)。
// ※継承型の正確性は非公式情報のため確証はない。成長/距離/ダート/気性/毛色は
//   攻略ボードで読み取れた一部のみ反映、残りは「不明」。実機で補正可能。
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

interface Extra {
  growth?: Growth;
  distance?: Distance;
  dirtApt?: Aptitude;
  temper?: Temper;
  coat?: Coat;
}

// 攻略ボードで読み取れた個体の追加情報（名前で適用）。
const EXTRA: Record<string, Extra> = {
  アグネスワールド: { growth: "早熟", distance: "中短距離", coat: "栗毛" },
  アグネスデジタル: { growth: "普通", distance: "中短距離", dirtApt: "得意", temper: "普通", coat: "栗毛" },
  アフリート: { distance: "中距離", temper: "荒い", coat: "黒鹿毛" },
  ウォーエンブレム: { growth: "普通", distance: "中長距離", temper: "普通", coat: "鹿毛" },
  エリシオ: { growth: "普通", distance: "中長距離", temper: "普通", coat: "鹿毛" },
};

// [馬名, 継承型]
const SIRE_DATA: [string, InheritType][] = [
  // 堅実型
  ["アグネスデジタル", "堅実"], ["アドマイヤドン", "堅実"], ["エンドスウィープ", "堅実"],
  ["キングカメハメハ", "堅実"], ["サクラバクシンオー", "堅実"], ["シーキングザゴールド", "堅実"],
  ["ジェイドロバリー", "堅実"], ["シングスピール", "堅実"], ["ダーレーアラビアン", "堅実"],
  ["タニノギムレット", "堅実"], ["タマモクロス", "堅実"], ["ダンスインザダーク", "堅実"],
  ["ディープインパクト", "堅実"], ["トニービン", "堅実"], ["ニホンピロウィナー", "堅実"],
  ["フジキセキ", "堅実"], ["ブライアンズタイム", "堅実"], ["マーベラスサンデー", "堅実"],
  ["メジロマックイーン", "堅実"], ["ライスシャワー", "堅実"],
  // 平均型
  ["アグネスタキオン", "平均"], ["エルコンドルパサー", "平均"], ["キングマンボ", "平均"],
  ["グラスワンダー", "平均"], ["クロフネ", "平均"], ["ゴドルフィンバルブ", "平均"],
  ["コマンダーインチーフ", "平均"], ["サッカーボーイ", "平均"], ["サドラーズウェルズ", "平均"],
  ["サンデーサイレンス", "平均"], ["ジャングルポケット", "平均"], ["シンボリクリスエス", "平均"],
  ["スペシャルウィーク", "平均"], ["タイキシャトル", "平均"], ["ダイワメジャー", "平均"],
  ["ダンシングブレーヴ", "平均"], ["ビワハヤヒデ", "平均"], ["フォーティナイナー", "平均"],
  ["メイショウドトウ", "平均"], ["メジロライアン", "平均"], ["アグネスワールド", "平均"],
  // H/H（一発型）
  ["アフリート", "H/H"], ["ウォーエンブレム", "H/H"], ["エリシオ", "H/H"],
  ["オグリキャップ", "H/H"], ["オペラハウス", "H/H"], ["オルコックアラビアン", "H/H"],
  ["カーリアン", "H/H"], ["サイレンススズカ", "H/H"], ["シンボリルドルフ", "H/H"],
  ["ステイゴールド", "H/H"], ["タップダンスシチー", "H/H"], ["テイエムオペラオー", "H/H"],
  ["デインヒル", "H/H"], ["トウカイテイオー", "H/H"], ["ナリタトップロード", "H/H"],
  ["ナリタブライアン", "H/H"], ["ハーツクライ", "H/H"], ["バイアリーターク", "H/H"],
  ["ヤマニンゼファー", "H/H"], ["ラムタラ", "H/H"], ["レインボークエスト", "H/H"],
  ["ローエングリン", "H/H"],
];

const DAM_DATA: [string, InheritType][] = [
  // 堅実型
  ["シーザリオ", "堅実"], ["ウインドインハーヘア", "堅実"], ["エアトゥーレ", "堅実"],
  ["シンコウラブリィ", "堅実"], ["ビワハイジ", "堅実"], ["ファインモーション", "堅実"],
  ["ベガ", "堅実"],
  // 平均型
  ["アグネスフローラ", "平均"], ["キョウエイマーチ", "平均"], ["スカーレットブーケ", "平均"],
  ["ダイナフェアリー", "平均"], ["ダンスパートナー", "平均"], ["チョウカイキャロル", "平均"],
  ["テイエムオーシャン", "平均"], ["ノースフライト", "平均"], ["ファビラスラフイン", "平均"],
  ["ファレノプシス", "平均"], ["ラインクラフト", "平均"],
  // H/H（一発型）
  ["エアグルーヴ", "H/H"], ["シーキングザパール", "H/H"], ["スティルインラブ", "H/H"],
  ["ダイイチルビー", "H/H"], ["タニノシスター", "H/H"], ["トゥザヴィクトリー", "H/H"],
  ["ニシノフラワー", "H/H"], ["パシフィカス", "H/H"], ["ヒシアマゾン", "H/H"],
  ["ヘヴンリーロマンス", "H/H"], ["ホクトベガ", "H/H"], ["メジロドーベル", "H/H"],
  ["メジロラモーヌ", "H/H"],
];

function build(data: [string, InheritType][], sex: Sex, prefix: string): CpuHorse[] {
  return data
    .map(([name, inheritType], i) => {
      const e = EXTRA[name] ?? {};
      return {
        id: `${prefix}${String(i + 1).padStart(3, "0")}`,
        name,
        sex,
        inheritType,
        growth: e.growth ?? "不明",
        distance: e.distance ?? "不明",
        dirtApt: e.dirtApt ?? "不明",
        temper: e.temper ?? "不明",
        coat: e.coat ?? "不明",
      } as CpuHorse;
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));
}

export const CPU_SIRES: CpuHorse[] = build(SIRE_DATA, "牡", "s");
export const CPU_DAMS: CpuHorse[] = build(DAM_DATA, "牝", "d");

const BY_ID: Record<string, CpuHorse> = Object.fromEntries(
  [...CPU_SIRES, ...CPU_DAMS].map((c) => [c.id, c]),
);

export function getCpuHorse(id: string): CpuHorse | undefined {
  return BY_ID[id];
}
