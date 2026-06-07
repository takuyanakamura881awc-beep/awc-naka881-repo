// スタホR（StarHorse PROGRESS Returns）コンパニオン/管理ツールのドメイン型。
// 実機でプレイした内容を「選択式」で記録・管理する。

// 性別
export const SEX_KEYS = ["牡", "牝", "セン"] as const;
export type Sex = (typeof SEX_KEYS)[number];

// 脚質（スタホR：通常4＋特殊3）
export const LEG_KEYS = [
  "逃げ",
  "先行",
  "差し",
  "追込",
  "大逃げ",
  "まくり",
  "自在",
] as const;
export type Leg = (typeof LEG_KEYS)[number];

// 距離適性区分
export const DISTANCE_KEYS = ["短距離", "マイル", "中距離", "長距離"] as const;
export type Distance = (typeof DISTANCE_KEYS)[number];

// 馬場適性
export const SURFACE_KEYS = ["芝", "ダート", "芝・ダート"] as const;
export type Surface = (typeof SURFACE_KEYS)[number];

// 素質ランク（皐月賞オッズ等で判定する隠しグレード）
export const SOSHITSU_KEYS = [
  "MAX上",
  "MAX中",
  "MAX下",
  "準MAX",
  "2落ち",
  "3落ち",
  "4落ち",
  "不明",
] as const;
export type Soshitsu = (typeof SOSHITSU_KEYS)[number];

// 継承型（配合時のブレ幅）
export const INHERIT_KEYS = ["H/H", "平均", "堅実", "不明"] as const;
export type InheritType = (typeof INHERIT_KEYS)[number];

// 気性
export const TEMPER_KEYS = ["穏やか", "普通", "荒い", "激しい", "不明"] as const;
export type Temper = (typeof TEMPER_KEYS)[number];

// 馬の状態
export const STATUS_KEYS = ["育成中", "引退", "殿堂"] as const;
export type HorseStatus = (typeof STATUS_KEYS)[number];

// グレード
export const GRADE_KEYS = ["G1", "G2", "G3", "OP", "条件", "未勝利", "新馬", "障害", "WBC", "SWBC"] as const;
export type Grade = (typeof GRADE_KEYS)[number];

// 馬場状態
export const CONDITION_KEYS = ["良", "稍重", "重", "不良"] as const;
export type TrackCondition = (typeof CONDITION_KEYS)[number];

// 親の指定（CPUマスタ馬 or 自分の所有馬）
export type ParentRef =
  | { kind: "cpu"; id: string }
  | { kind: "owned"; id: string }
  | { kind: "none" };

// 所有馬カルテ
export interface Horse {
  id: string;
  schema_version: number;
  name: string;
  sex: Sex;
  generation: number; // 代
  // 血統
  sire: ParentRef;
  sireName: string;
  dam: ParentRef;
  damName: string;
  inheritType: InheritType; // この馬の継承型（次代の親に使うとき用）
  // 能力・適性
  soshitsu: Soshitsu;
  leg: Leg;
  distance: Distance;
  surface: Surface;
  temper: Temper;
  abilityNote: string; // 表パラ（SP/ST/パワー等）の自由メモ
  // 寿命・状態
  weeksLeft: number; // 残り週
  maxWeeks: number; // 寿命（実機値が不確実なため可変。既定120）
  status: HorseStatus;
  g1Wins: number; // 継承条件の判定に使用
  note: string;
  createdAt: number;
  updatedAt: number;
}

// 出走記録／ローテ予定（status で区別）
export interface RaceLog {
  id: string;
  schema_version: number;
  horseId: string;
  raceId: string | null; // レースマスタ参照（無ければnull）
  raceName: string;
  grade: Grade;
  distance: Distance;
  surface: Surface;
  status: "予定" | "完了";
  // 結果（完了時）
  position: number | null; // 着順
  fieldSize: number | null;
  odds: number | null;
  popularity: number | null; // 人気
  prize: number | null; // 獲得メダル
  condition: TrackCondition | null;
  atWeek: number | null; // その時の残り週
  note: string;
  at: number;
}

// 課金/利用メタ（singleton）
export interface UsageMeta {
  id: "singleton";
  schema_version: number;
  proUntil: number | null;
  lastCheckedAt: number;
}
