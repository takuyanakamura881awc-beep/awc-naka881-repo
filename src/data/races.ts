// レースマスタ（スタホR レーシングプログラム）。
// 出典: 店舗設置の公式攻略ボード（レーシングプログラム）。写真からの読み取りのため
// 距離・グレードは概算を含む。自由入力・追加も可能。
import type { Grade, Surface } from "../domain/types";

export interface RaceDef {
  id: string;
  name: string;
  grade: Grade;
  distance: number; // m
  surface: Surface;
  course: string; // 競馬場
}

function r(id: string, name: string, grade: Grade, distance: number, surface: Surface, course: string): RaceDef {
  return { id, name, grade, distance, surface, course };
}

export const RACES: RaceDef[] = [
  // 春：クラシックへ
  r("ajcc", "アメリカジョッキークラブカップ", "G2", 2200, "芝", "中山"),
  r("kisaragi", "きさらぎ賞", "G3", 1800, "芝", "京都"),
  r("february-s", "フェブラリーステークス", "G1", 1600, "ダート", "東京"),
  r("arlington", "アーリントンカップ", "G3", 1600, "芝", "阪神"),
  r("nakayama-kinen", "中山記念", "G2", 1800, "芝", "中山"),
  r("yayoi", "弥生賞", "G2", 2000, "芝", "中山"),
  r("hanshin-daishoten", "阪神大賞典", "G2", 3000, "芝", "阪神"),
  r("derby-kisho", "ダービー卿チャレンジトロフィー", "G3", 1600, "芝", "中山"),
  r("milers-cup", "マイラーズカップ", "G2", 1600, "芝", "京都"),
  // クラシック・春G1
  r("oka", "桜花賞", "G1", 1600, "芝", "阪神"),
  r("satsuki", "皐月賞", "G1", 2000, "芝", "中山"),
  r("nakayama-grand-jump", "中山グランドジャンプ", "J-G1", 4250, "芝", "中山"),
  r("antares", "アンタレスステークス", "G3", 1800, "ダート", "阪神"),
  r("nhk-mile", "NHKマイルカップ", "G1", 1600, "芝", "東京"),
  r("oaks", "優駿牝馬（オークス）", "G1", 2400, "芝", "東京"),
  r("tenno-spring", "天皇賞（春）", "G1", 3200, "芝", "京都"),
  r("aoba", "青葉賞", "G2", 2400, "芝", "東京"),
  r("victoria-mile", "ヴィクトリアマイル", "G1", 1600, "芝", "東京"),
  r("far-east-grand-jump", "FAR EAST GRAND JUMP", "J-G1", 4250, "芝", "中山"),
  r("derby", "東京優駿（日本ダービー）", "G1", 2400, "芝", "東京"),
  // 夏
  r("yasuda", "安田記念", "G1", 1600, "芝", "東京"),
  r("procyon", "プロキオンステークス", "G3", 1400, "ダート", "中京"),
  r("takarazuka", "宝塚記念", "G1", 2200, "芝", "阪神"),
  r("sapporo-kinen", "札幌記念", "G2", 2000, "芝", "札幌"),
  r("centaur", "セントウルステークス", "G2", 1200, "芝", "阪神"),
  // 秋
  r("sprinters", "スプリンターズステークス", "G1", 1200, "芝", "中山"),
  r("wbc-classic", "WBC CLASSIC", "WBC", 2000, "芝", "—"),
  r("kinko", "金鯱賞", "G2", 2000, "芝", "中京"),
  r("asahi-cc", "朝日チャレンジカップ", "G3", 2000, "芝", "阪神"),
  r("kyoto-daishoten", "京都大賞典", "G2", 2400, "芝", "京都"),
  r("mainichi-okan", "毎日王冠", "G2", 1800, "芝", "東京"),
  r("fuji-s", "富士ステークス", "G3", 1600, "芝", "東京"),
  r("kikuka", "菊花賞", "G1", 3000, "芝", "京都"),
  r("shuka", "秋華賞", "G1", 2000, "芝", "京都"),
  r("tenno-autumn", "天皇賞（秋）", "G1", 2000, "芝", "東京"),
  r("musashino", "武蔵野ステークス", "G3", 1600, "ダート", "東京"),
  r("queen-elizabeth", "エリザベス女王杯", "G1", 2200, "芝", "京都"),
  r("mile-cs", "マイルチャンピオンシップ", "G1", 1600, "芝", "京都"),
  // 秋〜暮れ
  r("japan-cup", "ジャパンカップ", "G1", 2400, "芝", "東京"),
  r("japan-cup-dirt", "ジャパンカップダート", "G1", 1800, "ダート", "中京"),
  r("hanshin-jf", "阪神ジュベナイルフィリーズ", "G1", 1600, "芝", "阪神"),
  r("hanshin-cup", "阪神カップ", "G2", 1400, "芝", "阪神"),
  r("arima", "有馬記念", "G1", 2500, "芝", "中山"),
  r("wbc-turf", "WBC TURF", "WBC", 2400, "芝", "—"),
  // 短距離G1（春）
  r("takamatsu", "高松宮記念", "G1", 1200, "芝", "中京"),
];

const BY_ID: Record<string, RaceDef> = Object.fromEntries(RACES.map((x) => [x.id, x]));

export function getRace(id: string): RaceDef | undefined {
  return BY_ID[id];
}
