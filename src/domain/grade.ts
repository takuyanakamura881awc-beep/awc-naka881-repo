// 適性値(0..1)を表示用のグレード(S..G)に変換する。

const THRESHOLDS: [number, string][] = [
  [0.9, "S"],
  [0.8, "A"],
  [0.7, "B"],
  [0.55, "C"],
  [0.4, "D"],
  [0.25, "E"],
  [0.12, "F"],
  [0, "G"],
];

export function toGrade(value: number): string {
  for (const [min, label] of THRESHOLDS) {
    if (value >= min) return label;
  }
  return "G";
}
