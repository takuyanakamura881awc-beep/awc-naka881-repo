// レースマスタ（スタホR 公式レーシングプログラム）。
// 出典: StarHorse PROGRESS Returns 公式サイト RACING PROGRAM。
// 23〜60週は公式表を精読、春のクラシック等は標準値。賞金/登録料は店舗設定で変動するため未収録。
// ※極東＝極東競馬場（WBC/FEGJ）。Dはダート。
import type { Grade, Surface } from "../domain/types";

export interface RaceDef {
  id: string;
  name: string;
  grade: Grade;
  distance: number; // m
  surface: Surface;
  course: string; // 競馬場
  cond?: string; // 出走条件（3歳馬/3歳牝馬/牝馬/古馬/招待）
}

function r(
  id: string,
  name: string,
  grade: Grade,
  distance: number,
  surface: Surface,
  course: string,
  cond?: string,
): RaceDef {
  return { id, name, grade, distance, surface, course, cond };
}

export const RACES: RaceDef[] = [
  // 〜春（クラシックまで／標準値）
  r("february-s", "フェブラリーステークス", "G1", 1600, "ダート", "東京"),
  r("nakayama-kinen", "中山記念", "G2", 1800, "芝", "中山"),
  r("kisaragi", "きさらぎ賞", "G3", 1800, "芝", "京都"),
  r("yayoi", "弥生賞", "G2", 2000, "芝", "中山", "3歳馬"),
  r("spring-s", "スプリングステークス", "G2", 1800, "芝", "中山", "3歳馬"),
  r("hanshin-daishoten", "阪神大賞典", "G2", 3000, "芝", "阪神"),
  r("takamatsu", "高松宮記念", "G1", 1200, "芝", "中京"),
  r("milers-cup", "マイラーズカップ", "G2", 1600, "芝", "京都"),
  r("oka", "桜花賞", "G1", 1600, "芝", "阪神", "3歳牝馬"),
  r("satsuki", "皐月賞", "G1", 2000, "芝", "中山", "3歳馬"),
  r("antares", "アンタレスステークス", "G3", 1800, "ダート", "阪神"),
  r("nakayama-grand-jump", "中山グランドジャンプ", "J-G1", 4250, "芝", "中山"),
  r("victoria-mile", "ヴィクトリアマイル", "G1", 1600, "芝", "東京", "牝馬"),
  // 23〜（公式表）
  r("kyoto-shimbun", "京都新聞杯", "G2", 2200, "芝", "京都", "3歳馬"),
  r("tenno-spring", "天皇賞（春）", "G1", 3200, "芝", "京都", "古馬"),
  r("nhk-mile", "NHKマイルカップ", "G1", 1600, "芝", "東京", "3歳馬"),
  r("keio-hai-sc", "京王杯スプリングカップ", "G2", 1400, "芝", "東京", "古馬"),
  r("oaks", "優駿牝馬（オークス）", "G1", 2400, "芝", "東京", "3歳牝馬"),
  r("tokai-s", "東海ステークス", "G2", 2300, "ダート", "中京"),
  r("far-east-grand-jump", "FAR EAST GRAND JUMP", "J-G1", 4000, "芝", "極東", "招待"),
  r("derby", "東京優駿（日本ダービー）", "G1", 2400, "芝", "東京", "3歳馬"),
  r("meguro", "目黒記念", "G2", 2500, "芝", "東京"),
  r("kinko", "金鯱賞", "G2", 2000, "芝", "中京"),
  r("yasuda", "安田記念", "G1", 1600, "芝", "東京"),
  r("epsom", "エプソムカップ", "G3", 1800, "芝", "東京"),
  r("procyon", "プロキオンステークス", "G3", 1400, "ダート", "阪神"),
  r("takarazuka", "宝塚記念", "G1", 2200, "芝", "阪神"),
  r("asahi-cc", "朝日チャレンジカップ", "G3", 2000, "芝", "阪神"),
  r("centaur", "セントウルステークス", "G2", 1200, "芝", "阪神"),
  r("all-comers", "オールカマー", "G2", 2200, "芝", "中山"),
  r("st-light", "セントライト記念", "G2", 2200, "芝", "中山", "3歳馬"),
  r("kobe-shimbun", "神戸新聞杯", "G2", 2000, "芝", "阪神", "3歳馬"),
  r("sprinters", "スプリンターズステークス", "G1", 1200, "芝", "中山"),
  r("wbc-classic", "WBC CLASSIC", "WBC", 2000, "芝", "極東", "招待"),
  r("mainichi-okan", "毎日王冠", "G2", 1800, "芝", "東京"),
  r("kyoto-daishoten", "京都大賞典", "G2", 2400, "芝", "京都"),
  r("shuka", "秋華賞", "G1", 2000, "芝", "京都", "3歳牝馬"),
  r("fuji-s", "富士ステークス", "G3", 1600, "芝", "東京"),
  r("kikuka", "菊花賞", "G1", 3000, "芝", "京都", "3歳馬"),
  r("swan", "スワンステークス", "G2", 1400, "芝", "京都"),
  r("tenno-autumn", "天皇賞（秋）", "G1", 2000, "芝", "東京"),
  r("musashino", "武蔵野ステークス", "G3", 1600, "ダート", "東京"),
  r("argentine", "アルゼンチン共和国杯", "G2", 2500, "芝", "東京"),
  r("queen-elizabeth", "エリザベス女王杯", "G1", 2200, "芝", "京都", "牝馬"),
  r("kyoto-jump", "京都ハイジャンプ", "J-G2", 3930, "芝", "京都"),
  r("mile-cs", "マイルチャンピオンシップ", "G1", 1600, "芝", "京都"),
  r("japan-cup", "ジャパンカップ", "G1", 2400, "芝", "東京"),
  r("stayers", "ステイヤーズステークス", "G2", 3600, "芝", "中山"),
  r("japan-cup-dirt", "ジャパンカップダート", "G1", 1800, "ダート", "阪神"),
  r("chunichi", "中日新聞杯", "G3", 1800, "芝", "中京"),
  r("hanshin-cup", "阪神カップ", "G2", 1400, "芝", "阪神"),
  r("nakayama-daishogai", "中山大障害", "J-G1", 4100, "芝", "中山"),
  r("arima", "有馬記念", "G1", 2500, "芝", "中山"),
  r("wbc-turf", "WBC TURF", "WBC", 2400, "芝", "極東", "招待"),
];

const BY_ID: Record<string, RaceDef> = Object.fromEntries(RACES.map((x) => [x.id, x]));

export function getRace(id: string): RaceDef | undefined {
  return BY_ID[id];
}
