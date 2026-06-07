// 配合（代重ね）支援の純粋ロジック。
// 継承型の組み合わせから、産駒の能力ブレ幅の目安を出す。
// H/H=ハイリスク・ハイリターン、堅実=安定、平均=中庸（出典: 攻略情報）。
import type { InheritType } from "./types";

export type SpreadLevel = "wide" | "mid" | "stable" | "unknown";

export interface SpreadHint {
  level: SpreadLevel;
  label: string;
  desc: string;
}

export function pairSpread(sire: InheritType, dam: InheritType): SpreadHint {
  if (sire === "不明" || dam === "不明") {
    return { level: "unknown", label: "不明", desc: "親の継承型が未設定です。" };
  }
  if (sire === "H/H" || dam === "H/H") {
    return {
      level: "wide",
      label: "ブレ大（ハイリスク）",
      desc: "大当たり／大外れの振れ幅が大きい配合。素質MAXを狙うなら有力。",
    };
  }
  if (sire === "堅実" && dam === "堅実") {
    return {
      level: "stable",
      label: "安定",
      desc: "能力が安定しやすい堅実な配合。事故が少ない反面、上振れも控えめ。",
    };
  }
  return {
    level: "mid",
    label: "中庸",
    desc: "バランス型の配合。平均的な振れ幅が見込める。",
  };
}
