// レースマスタ（スタホR：実名JRA準拠＋障害＋架空最上位WBC/SWBC）。
// グレード・距離は概算。実機での確認・追加はユーザー側で可能（自由入力も可）。
import type { Distance, Grade, Surface } from "../domain/types";

export interface RaceDef {
  id: string;
  name: string;
  grade: Grade;
  distance: number; // m
  distanceKey: Distance;
  surface: Surface;
}

function distanceKey(m: number): Distance {
  if (m <= 1400) return "短距離";
  if (m <= 1800) return "マイル";
  if (m <= 2200) return "中距離";
  return "長距離";
}

function r(id: string, name: string, grade: Grade, distance: number, surface: Surface): RaceDef {
  return { id, name, grade, distance, distanceKey: distanceKey(distance), surface };
}

export const RACES: RaceDef[] = [
  // クラシック三冠
  r("satsuki", "皐月賞", "G1", 2000, "芝"),
  r("derby", "東京優駿（日本ダービー）", "G1", 2400, "芝"),
  r("kikuka", "菊花賞", "G1", 3000, "芝"),
  // 牝馬三冠
  r("oka", "桜花賞", "G1", 1600, "芝"),
  r("oaks", "優駿牝馬（オークス）", "G1", 2400, "芝"),
  r("shuka", "秋華賞", "G1", 2000, "芝"),
  // 三冠トライアル/3歳
  r("yayoi", "弥生賞", "G2", 2000, "芝"),
  r("spring-s", "スプリングステークス", "G2", 1800, "芝"),
  r("kyoto-shimbun", "京都新聞杯", "G2", 2200, "芝"),
  r("kobe-shimbun", "神戸新聞杯", "G2", 2400, "芝"),
  // 古馬G1
  r("tenno-spring", "天皇賞（春）", "G1", 3200, "芝"),
  r("tenno-autumn", "天皇賞（秋）", "G1", 2000, "芝"),
  r("japan-cup", "ジャパンカップ", "G1", 2400, "芝"),
  r("arima", "有馬記念", "G1", 2500, "芝"),
  r("takarazuka", "宝塚記念", "G1", 2200, "芝"),
  r("victoria-mile", "ヴィクトリアマイル", "G1", 1600, "芝"),
  // 短距離・マイルG1
  r("takamatsu", "高松宮記念", "G1", 1200, "芝"),
  r("sprinters", "スプリンターズステークス", "G1", 1200, "芝"),
  r("yasuda", "安田記念", "G1", 1600, "芝"),
  r("mile-cs", "マイルチャンピオンシップ", "G1", 1600, "芝"),
  // ダートG1
  r("february-s", "フェブラリーステークス", "G1", 1600, "ダート"),
  r("champions-c", "チャンピオンズカップ", "G1", 1800, "ダート"),
  // 重賞（一部）
  r("osaka-hai", "大阪杯", "G1", 2000, "芝"),
  r("nakayama-kinen", "中山記念", "G2", 1800, "芝"),
  r("mainichi-okan", "毎日王冠", "G2", 1800, "芝"),
  // 障害（スタホR目玉）
  r("nakayama-daishogai", "中山大障害", "障害", 4100, "芝"),
  r("nakayama-grand-jump", "中山グランドジャンプ", "障害", 4250, "芝"),
  r("far-east-grand-jump", "FAR EAST GRAND JUMP", "障害", 4000, "芝"),
  // 架空最上位
  r("wbc", "WBC（ワールドブリーダーズカップ）", "WBC", 2400, "芝"),
  r("swbc", "SWBC（スーパーWBC）", "SWBC", 2400, "芝"),
];

const BY_ID: Record<string, RaceDef> = Object.fromEntries(RACES.map((x) => [x.id, x]));

export function getRace(id: string): RaceDef | undefined {
  return BY_ID[id];
}
