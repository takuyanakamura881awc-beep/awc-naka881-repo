// 種馬マスタ（独自データ・架空。実名/実データは使わない）。
import type { Aptitudes, SireDam, Stats } from "../domain/types";

function stats(speed: number, stamina: number, power: number, guts: number, wit: number): Stats {
  return { speed, stamina, power, guts, wit };
}

function apt(
  distance: [number, number, number, number], // short, mile, middle, long
  surface: [number, number], // turf, dirt
  style: [number, number, number, number], // nige, senko, sashi, oikomi
): Aptitudes {
  return {
    distance: { short: distance[0], mile: distance[1], middle: distance[2], long: distance[3] },
    surface: { turf: surface[0], dirt: surface[1] },
    style: { nige: style[0], senko: style[1], sashi: style[2], oikomi: style[3] },
  };
}

export const SIRES: SireDam[] = [
  {
    id: "sire-tempest",
    name: "テンペストロード",
    sex: "sire",
    potential: stats(1120, 760, 980, 720, 820),
    aptitudes: apt([0.95, 0.85, 0.5, 0.2], [0.95, 0.55], [0.6, 0.9, 0.6, 0.4]),
    temperament: 0.55,
    note: "短距離〜マイルの快速血統。気性はやや激しい。",
  },
  {
    id: "sire-monolith",
    name: "モノリスエンペラー",
    sex: "sire",
    potential: stats(820, 1140, 760, 980, 840),
    aptitudes: apt([0.2, 0.55, 0.9, 0.98], [0.9, 0.5], [0.5, 0.7, 0.85, 0.7]),
    temperament: 0.3,
    note: "長距離の王道スタミナ血統。底力に優れる。",
  },
  {
    id: "sire-aurora",
    name: "オーロラブレイヴ",
    sex: "sire",
    potential: stats(960, 940, 880, 880, 900),
    aptitudes: apt([0.55, 0.85, 0.9, 0.7], [0.92, 0.6], [0.6, 0.8, 0.8, 0.6]),
    temperament: 0.35,
    note: "中距離万能型。バランスに優れた優等生。",
  },
  {
    id: "sire-graviton",
    name: "グラビトンギア",
    sex: "sire",
    potential: stats(900, 720, 1120, 860, 700),
    aptitudes: apt([0.7, 0.7, 0.6, 0.4], [0.55, 0.95], [0.65, 0.8, 0.6, 0.5]),
    temperament: 0.6,
    note: "ダート向きのパワー血統。",
  },
];

export const DAMS: SireDam[] = [
  {
    id: "dam-lumiere",
    name: "リュミエールノヴァ",
    sex: "dam",
    potential: stats(1040, 820, 860, 760, 880),
    aptitudes: apt([0.85, 0.95, 0.65, 0.3], [0.95, 0.5], [0.55, 0.85, 0.7, 0.45]),
    temperament: 0.45,
    note: "マイルの瞬発力に定評。",
  },
  {
    id: "dam-verdant",
    name: "ヴァーダントベル",
    sex: "dam",
    potential: stats(780, 1080, 720, 940, 860),
    aptitudes: apt([0.25, 0.5, 0.85, 0.95], [0.9, 0.55], [0.6, 0.7, 0.8, 0.75]),
    temperament: 0.3,
    note: "長距離の粘り強さを伝える。",
  },
  {
    id: "dam-seraph",
    name: "セラフィナ",
    sex: "dam",
    potential: stats(920, 900, 820, 900, 940),
    aptitudes: apt([0.6, 0.8, 0.88, 0.72], [0.9, 0.62], [0.6, 0.78, 0.82, 0.62]),
    temperament: 0.32,
    note: "中距離の堅実な万能型。賢さが高い。",
  },
  {
    id: "dam-cinder",
    name: "シンダーローズ",
    sex: "dam",
    potential: stats(880, 760, 1040, 820, 720),
    aptitudes: apt([0.75, 0.7, 0.55, 0.35], [0.5, 0.95], [0.7, 0.8, 0.6, 0.5]),
    temperament: 0.55,
    note: "ダートのパワーと先行力。",
  },
];

const BY_ID: Record<string, SireDam> = Object.fromEntries(
  [...SIRES, ...DAMS].map((s) => [s.id, s]),
);

export function getSireDam(id: string): SireDam | undefined {
  return BY_ID[id];
}
