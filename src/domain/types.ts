// スタホR（StarHorse PROGRESS Returns）コンパニオン/管理ツールのドメイン型。
// 実機の公式仕様に準拠（脚質4・成長3・距離6区分・ダート/道悪適性・気性3・毛色）。
// 出典: 店舗設置の公式攻略ボード（馬データ/レーシングプログラム/ベット説明）。

// 性別
export const SEX_KEYS = ["牡", "牝", "セン"] as const;
export type Sex = (typeof SEX_KEYS)[number];

// 脚質（通常4＋特殊3＝7種。大逃げ/まくり/自在は特殊脚質）
export const LEG_KEYS = ["逃げ", "先行", "差し", "追込", "大逃げ", "まくり", "自在"] as const;
export type Leg = (typeof LEG_KEYS)[number];

// 成長タイプ
export const GROWTH_KEYS = ["早熟", "普通", "晩成", "不明"] as const;
export type Growth = (typeof GROWTH_KEYS)[number];

// 距離適性区分（実機の表記。括弧は目安距離）
export const DISTANCE_KEYS = [
  "短距離", // 〜1600m
  "中短距離", // 1200〜2000m
  "中距離", // 1800〜2200m
  "中長距離", // 1800m〜
  "長距離", // 2300m〜
  "万能", // 全距離
  "不明",
] as const;
export type Distance = (typeof DISTANCE_KEYS)[number];

export const DISTANCE_HINT: Record<Distance, string> = {
  短距離: "〜1600m",
  中短距離: "1200〜2000m",
  中距離: "1800〜2200m",
  中長距離: "1800m〜",
  長距離: "2300m〜",
  万能: "全距離",
  不明: "",
};

// 適性ランク（実機表記：ダート/重馬場/スタート）
export const APTITUDE_KEYS = ["得意", "普通", "不得意", "不明"] as const;
export type Aptitude = (typeof APTITUDE_KEYS)[number];

// レースの馬場種別（コース）
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

// 気性（実機3種）
export const TEMPER_KEYS = ["穏やか", "普通", "荒い", "不明"] as const;
export type Temper = (typeof TEMPER_KEYS)[number];

// 毛色
export const COAT_KEYS = [
  "鹿毛",
  "黒鹿毛",
  "栗毛",
  "栃栗毛",
  "芦毛",
  "青毛",
  "白毛",
  "不明",
] as const;
export type Coat = (typeof COAT_KEYS)[number];

// 馬の状態
export const STATUS_KEYS = ["育成中", "引退", "殿堂"] as const;
export type HorseStatus = (typeof STATUS_KEYS)[number];

// グレード（J-G=障害、WBC=架空最上位）
export const GRADE_KEYS = [
  "G1",
  "G2",
  "G3",
  "OP",
  "J-G1",
  "J-G2",
  "J-G3",
  "WBC",
  "条件",
  "未勝利",
  "新馬",
] as const;
export type Grade = (typeof GRADE_KEYS)[number];

// 馬場状態
export const CONDITION_KEYS = ["良", "稍重", "重", "不良"] as const;
export type TrackCondition = (typeof CONDITION_KEYS)[number];

// ベット種別（実機）
export const BET_TYPE_KEYS = ["単勝", "複勝", "馬連", "ワイド", "ライド", "サイド"] as const;
export type BetType = (typeof BET_TYPE_KEYS)[number];

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
  password: string; // 放牧パスワード（保存・再開用コード）
  // 血統
  sire: ParentRef;
  sireName: string;
  dam: ParentRef;
  damName: string;
  inheritType: InheritType; // この馬の継承型（次代の親に使うとき用）
  // 能力・適性（「馬の情報」画面に準拠）
  soshitsu: Soshitsu;
  leg: Leg;
  growth: Growth;
  distance: Distance; // 得意距離
  dirtApt: Aptitude; // ダート
  mudApt: Aptitude; // 重馬場
  startApt: Aptitude; // スタート
  temper: Temper; // 気性
  coat: Coat; // 毛色
  birthComment: string; // 誕生/評価コメント（素質示唆）
  abilityNote: string; // 表パラ等の自由メモ
  // 通算成績スナップショット（引退/継承時に確認できる値）
  first: number; // 1着
  second: number; // 2着
  third: number; // 3着
  unplaced: number; // 着外
  g1Wins: number; // GI勝（継承条件の判定に使用）
  wbcWins: number; // WBC勝（別カウント）
  prizeMedals: number; // 獲得賞金（枚）
  // 寿命・状態
  weeksLeft: number; // 残り週
  maxWeeks: number; // 寿命（要実機確認。既定120）
  status: HorseStatus;
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
  distanceM: number; // 距離(m)
  surface: Surface;
  status: "予定" | "完了";
  // 結果（完了時）
  position: number | null; // 着順
  fieldSize: number | null;
  odds: number | null;
  popularity: number | null; // 人気
  prize: number | null; // 獲得メダル
  condition: TrackCondition | null;
  weightKg: number | null; // 馬体重
  jockey: string; // 騎手
  atWeek: number | null; // その時の残り週
  note: string;
  at: number;
}

// ベット記録（この馬に何枚投じたか）
export interface Bet {
  id: string;
  schema_version: number;
  horseId: string; // 対象の所有馬（サイド/応援の集計対象）
  raceName: string;
  betType: BetType;
  stake: number; // 投入メダル枚数
  hit: boolean; // 的中
  payout: number; // 払い戻し（メダル）
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
