// ゲームのドメイン型。DB保存形と画面で共有する。

export const STAT_KEYS = ["speed", "stamina", "power", "guts", "wit"] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type Stats = Record<StatKey, number>;

export const STAT_LABELS: Record<StatKey, string> = {
  speed: "スピード",
  stamina: "スタミナ",
  power: "パワー",
  guts: "根性",
  wit: "賢さ",
};

export const STAT_MAX = 1200;

// 距離適性カテゴリ
export const DISTANCE_KEYS = ["short", "mile", "middle", "long"] as const;
export type DistanceKey = (typeof DISTANCE_KEYS)[number];
export type DistanceApt = Record<DistanceKey, number>; // 0..1

export const DISTANCE_LABELS: Record<DistanceKey, string> = {
  short: "短距離",
  mile: "マイル",
  middle: "中距離",
  long: "長距離",
};

// 馬場
export const SURFACE_KEYS = ["turf", "dirt"] as const;
export type SurfaceKey = (typeof SURFACE_KEYS)[number];
export type SurfaceApt = Record<SurfaceKey, number>; // 0..1

export const SURFACE_LABELS: Record<SurfaceKey, string> = {
  turf: "芝",
  dirt: "ダート",
};

// 脚質
export const STYLE_KEYS = ["nige", "senko", "sashi", "oikomi"] as const;
export type StyleKey = (typeof STYLE_KEYS)[number];
export type StyleApt = Record<StyleKey, number>; // 0..1

export const STYLE_LABELS: Record<StyleKey, string> = {
  nige: "逃げ",
  senko: "先行",
  sashi: "差し",
  oikomi: "追込",
};

export interface Aptitudes {
  distance: DistanceApt;
  surface: SurfaceApt;
  style: StyleApt;
}

// 種馬マスタ（独自データ。実名・実データは使わない）
export interface SireDam {
  id: string;
  name: string;
  sex: "sire" | "dam";
  // 子に受け継ぐ能力ポテンシャルの基準値
  potential: Stats;
  aptitudes: Aptitudes;
  temperament: number; // 0..1（高いほど変動が大きい/気性難寄り）
  note?: string;
}

// レースマスタ
export interface RaceDef {
  id: string;
  name: string;
  grade: "G1" | "G2" | "G3" | "OP" | "条件";
  distance: number; // メートル
  distanceKey: DistanceKey;
  surface: SurfaceKey;
  fieldSize: number;
  prize: number; // 1着賞金（万円）
  // 相手の基準性能（perfスケールの絶対値）。simulateRace/suggestions が共有。
  rivalPerf: number;
}

// プレイヤーが作成・育成する馬
export interface PlayerHorse {
  id: string; // ULID
  schema_version: number;
  name: string;
  sireId: string;
  damId: string;
  sireName: string;
  damName: string;
  generation: number;
  stats: Stats; // 現在値
  potential: Stats; // 成長上限（遺伝で決定）
  aptitudes: Aptitudes;
  temperament: number;
  energy: number; // 0..100（育成のコンディション）
  turn: number; // 経過ターン
  maxTurns: number; // 育成期間
  createdAt: number;
  retired: boolean;
}

export type TrainingAction =
  | "speed"
  | "stamina"
  | "power"
  | "guts"
  | "wit"
  | "rest";

export interface TrainingLogEntry {
  id: string;
  schema_version: number;
  horseId: string;
  turn: number;
  action: TrainingAction;
  delta: Partial<Stats>; // 各能力の変動
  energyAfter: number;
  at: number;
}

export interface RaceResult {
  position: number;
  fieldSize: number;
  timeSeconds: number;
  performance: number;
  prize: number; // 獲得賞金（万円）
}

export interface RaceEntry {
  id: string;
  schema_version: number;
  horseId: string;
  raceId: string;
  style: StyleKey;
  seed: number;
  result: RaceResult;
  at: number;
}

export interface UsageMeta {
  id: "singleton";
  schema_version: number;
  suggestionWeekKey: string; // 例 "2026-W23"
  suggestionCount: number;
  proUntil: number | null; // epoch ms。null=無料
  lastCheckedAt: number;
}
