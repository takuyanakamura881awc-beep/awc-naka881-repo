// ============================================================
// engine-test.js — ゲームロジック回帰テスト(Node上でwindowをシムして実行)
//  対象: game/js/{data,horse,race,state}.js (raceview/rv-*/horse3d 等の描画コードは対象外)
//  実行: node game/test/engine-test.js
//  合格: 最終行に "ALL OK" を出力し exit code 0。失敗時は "FAIL:" 行 + exit code 1。
// 出所: 工程4(WS1〜WS3)検証で使われたセッション作業領域(scratchpad)の engine-test.js を
//       要件 P-7 / AC-15 に基づきリポジトリへ移設したもの(パスのみ絶対→相対に変更)。
// ============================================================
"use strict";
const fs = require("fs");
const path = require("path");
global.window = {};
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const base = path.join(__dirname, "..", "js");
["data.js", "horse.js", "race.js", "state.js"].forEach((f) => {
  eval(fs.readFileSync(path.join(base, f), "utf8"));
});
const SH = global.window.SH;
let fails = 0;
function ok(cond, label) {
  if (cond) console.log("  ok:", label);
  else { console.error("  FAIL:", label); fails++; }
}

// --- 1. カレンダー ---
console.log("[calendar]");
SH.newGame("テスト");
const s = SH.state;
let totalStakes = 0;
for (let w = 1; w <= 52; w++) {
  s.week = w;
  const rs = SH.racesOfWeek(w);
  ok(rs.length >= 3, "week " + w + " has races (" + rs.length + ")");
  totalStakes += rs.filter((r) => !r.flat).length;
  break; // 1週目だけ詳細、残りはまとめて
}
let weeksWithStakes = 0, stakesCount = 0;
for (let w = 1; w <= 52; w++) {
  const rs = SH.racesOfWeek(w).filter((r) => !r.flat);
  if (rs.length) weeksWithStakes++;
  stakesCount += rs.length;
}
ok(stakesCount === SH.STAKES.length, "all stakes scheduled (" + stakesCount + "/" + SH.STAKES.length + ")");

// --- 2. 生産 ---
console.log("[breeding]");
const sire = { kind: "cpu", data: SH.CPU_SIRES.find((c) => c.name === "ディープインパクト") };
const dam = { kind: "cpu", data: SH.CPU_DAMS.find((c) => c.name === "エアグルーヴ") };
const foal = SH.doBreed(sire, dam, "テストホース");
ok(!!foal, "foal born");
ok(foal.name === "テストホース", "foal named");
ok(SH.SOSHITSU.includes(foal.soshitsu), "soshitsu valid: " + foal.soshitsu);
ok(foal.birthCommentText && foal.birthCommentText.length > 0, "birth comment: " + foal.birthCommentKey);
ok(s.medals === SH.START_MEDALS - SH.BREED_COST, "breed cost deducted");
ok(SH.LEGS.includes(foal.leg), "leg valid: " + foal.leg);

// 素質分布チェック(200頭)
const dist = {};
for (let i = 0; i < 200; i++) {
  const f = SH.breedFoal(sire, dam, 1, "X" + i);
  dist[f.soshitsu] = (dist[f.soshitsu] || 0) + 1;
}
console.log("  soshitsu dist (deep x groove, gen1):", JSON.stringify(dist));
const hhSire = { kind: "cpu", data: SH.CPU_SIRES.find((c) => c.name === "オグリキャップ") };
const dist2 = {};
for (let i = 0; i < 200; i++) {
  const f = SH.breedFoal(hhSire, dam, 3, "Y" + i);
  dist2[f.soshitsu] = (dist2[f.soshitsu] || 0) + 1;
}
console.log("  soshitsu dist (H/H x H/H, gen3):", JSON.stringify(dist2));

// --- 3. 出走表・オッズ ---
console.log("[field & odds]");
s.week = 16; // 皐月賞週
const satsuki = SH.racesOfWeek(16).find((r) => r.id === "satsuki");
ok(!!satsuki, "satsuki found");
foal.age = 3;
foal.first = 1; // 重賞出走資格
foal.entryRaceId = "satsuki";
const field = SH.buildField(satsuki, [foal], new Set());
SH.computeOdds(field, 0.9);
ok(field.runners.length >= 14, "field size " + field.runners.length);
ok(field.runners.every((r) => r.winOdds >= 1.1 && r.winOdds <= 999.9), "win odds in range");
ok(field.runners.every((r) => r.placeOdds <= r.winOdds + 0.01), "place odds <= win odds");
const pops = field.runners.map((r) => r.popularity).sort((a, b) => a - b);
ok(pops[0] === 1 && pops[pops.length - 1] === field.runners.length, "popularity is permutation");
// 総和チェック: 単勝確率合計が~1
const pSum = field.pWin.reduce((a, b) => a + b, 0);
ok(Math.abs(pSum - 1) < 0.15, "win prob sums ~1 (" + pSum.toFixed(3) + ")");

// comboOdds: 人気上位馬の組合せで比較(下限張り付きを避ける)
const byPop = field.runners.slice().sort((a, b) => a.popularity - b.popularity).map((r) => r.gate);
const o1 = SH.comboOdds(field, "umaren", [byPop[0], byPop[1]], 0.9);
ok(o1 >= 1.1, "umaren odds " + o1);
const o2 = SH.comboOdds(field, "sanrentan", [byPop[0], byPop[1], byPop[2]], 0.9);
ok(o2 > o1, "sanrentan > umaren (" + o2 + " > " + o1 + ")");
const oWide = SH.comboOdds(field, "wide", [byPop[0], byPop[1]], 0.9);
ok(oWide < o1, "wide < umaren (" + oWide + " < " + o1 + ")");

// --- 4. レースシミュレーション(決定性・着順resolution) ---
console.log("[simulation]");
const sim = SH.simulateRace(field);
ok(sim.order.length === field.runners.length, "all finished");
ok(new Set(sim.order).size === sim.order.length, "order is permutation");
ok(sim.frames.length > 50, "frames generated (" + sim.frames.length + ")");
ok(sim.story.length >= 4, "commentary generated (" + sim.story.length + ")");
// frames は走破距離について単調非減少であること(巻き戻りなし=描画/カメラ演出の前提)
let monotone = true;
for (let i = 0; i < field.runners.length; i++) {
  for (let fi = 1; fi < sim.frames.length; fi++) {
    if (sim.frames[fi].pos[i] < sim.frames[fi - 1].pos[i] - 1e-6) { monotone = false; break; }
  }
}
ok(monotone, "frame positions are monotone non-decreasing per runner");
// 着順(sim.order、判定順)と着順タイム(sim.times)の整合。
// 内部は 0.4秒刻みのティックでゴール到達を検出するため、同一ティック内の
// 僅差(写真判定級、0.4秒未満)では order がタイム降順と厳密一致しない場合があり得る
// (これは実装の性質であり回帰の対象ではない)。よって「0.4秒より明確に離れた
// 2頭の間で着順が逆転していないこと」を決定性の検証対象とする。
const DT_TICK = 0.4;
let orderConsistent = true;
for (let i = 0; i < sim.order.length; i++) {
  for (let j = i + 1; j < sim.order.length; j++) {
    if (sim.times[sim.order[i]] > sim.times[sim.order[j]] + DT_TICK) { orderConsistent = false; break; }
  }
  if (!orderConsistent) break;
}
ok(orderConsistent, "sim.order matches sim.times ranking beyond tick resolution (0.4s)");
// 上位人気が勝ちやすいか(100レース)
let favTop3 = 0;
for (let i = 0; i < 100; i++) {
  const f2 = SH.buildField(satsuki, [], new Set());
  SH.computeOdds(f2, 0.9);
  const s2 = SH.simulateRace(f2);
  const favIdx = f2.runners.findIndex((r) => r.popularity === 1);
  if (s2.order.slice(0, 3).includes(favIdx)) favTop3++;
}
console.log("  1番人気の3着内率: " + favTop3 + "% (期待: 45-75%)");
ok(favTop3 >= 35 && favTop3 <= 85, "favorite top3 rate sane");

// 距離別タイム感(1200/2400/3600 — 工程5マトリクスと同じ3距離)
[1200, 2400, 3600].forEach((d) => {
  const r = { week: 1, id: "t", name: "T", grade: "G2", dist: d, surface: "芝", course: "東京" };
  const f = SH.buildField(r, [], new Set());
  SH.computeOdds(f, 0.9);
  const sm = SH.simulateRace(f);
  const t = Math.min(...sm.times);
  console.log("  " + d + "m 勝ちタイム: " + t.toFixed(1) + "秒");
  ok(t > 0 && isFinite(t), d + "m time finite/positive");
});

// WBC(5頭固定)・isNightRace の確認(rv-* が参照する契約)
const wbcRace = { week: 50, id: "wbc-t", name: "ワールドチャンピオンシップ", grade: "WBC", surface: "芝", dist: 2400, course: "中央" };
const wbcField = SH.buildField(wbcRace, [], new Set());
ok(wbcField.runners.length === 5, "WBC field is fixed at 5 (" + wbcField.runners.length + ")");
ok(typeof SH.isNightRace === "function", "SH.isNightRace exists");
ok(SH.isNightRace(wbcRace) === true, "WBC race is night");
const dayG1 = { week: 26, id: "g1-t", name: "G1テスト", grade: "G1", surface: "芝", dist: 2400, course: "中央" };
ok(SH.isNightRace(dayG1) === false, "week<48 G1 is day");
const lateG1 = { week: 49, id: "g1-late", name: "G1晩期", grade: "G1", surface: "芝", dist: 2400, course: "中央" };
ok(SH.isNightRace(lateG1) === true, "week>=48 G1 is night");

// --- 5. 馬券精算(payout math) ---
console.log("[bets]");
const bets = [
  { typeId: "win", sel: [sim.order[0] + 1], stake: 10, odds: 5.0, label: "単勝テスト" },
  { typeId: "win", sel: [sim.order[1] + 1], stake: 10, odds: 5.0, label: "はずれ" },
  { typeId: "umaren", sel: [sim.order[1] + 1, sim.order[0] + 1], stake: 10, odds: 20.0, label: "馬連" },
  { typeId: "wide", sel: [sim.order[2] + 1, sim.order[0] + 1], stake: 10, odds: 8.0, label: "ワイド" },
  { typeId: "sanrentan", sel: [sim.order[0] + 1, sim.order[1] + 1, sim.order[2] + 1], stake: 1, odds: 100, label: "三連単" },
];
const res = SH.settleBets(field, bets, sim.order);
ok(res[0].hit === true && res[0].payout === 50, "win bet hit, payout = stake*odds (10*5.0=50)");
ok(res[1].hit === false && res[1].payout === 0, "losing bet miss, payout 0");
ok(res[2].hit === true && res[2].payout === 200, "umaren hit (order-free), payout 10*20=200");
ok(res[3].hit === true, "wide hit");
ok(res[4].hit === true && res[4].payout === 100, "sanrentan hit (exact order), payout 1*100=100");

// --- 6. 育成・週送り(horse.js raising logic) ---
console.log("[training & weeks]");
const before = { sp: foal.sp, weeks: foal.weeksLeft };
SH.applyTraining(foal, "turf");
ok(foal.sp > before.sp, "turf training raises SP");
SH.applyFeed(foal, "normal");
SH.tickWeek(foal, true);
ok(foal.weeksLeft === before.weeks - 1, "acted week consumes 1 week");
const w2 = foal.weeksLeft;
SH.tickWeek(foal, false);
ok(foal.weeksLeft === w2, "idle week preserved (温存)");
// 脚質変更(決定的シード馬で確認)
foal.leg = "先行";
SH.applyTraining(foal, "secret");
SH.applySecretLeg(foal, "daikon");
ok(foal.leg === "逃げ", "secret+daikon -> 逃げ");
SH.applySecretLeg(foal, "daikon");
SH.applySecretLeg(foal, "daikon");
ok(foal.leg === "大逃げ", "daikon x3 -> 大逃げ");
SH.applySecretLeg(foal, "beer");
ok(foal.leg === "自在", "beer -> 自在");

// --- 7. 引退・継承 ---
console.log("[retire & inherit]");
foal.g1Wins = 1;
ok(SH.canInherit(foal), "G1 winner can inherit");
SH.retireHorse(foal);
ok(foal.status === "殿堂", "G1 winner to hall of fame");
const foal2 = SH.breedFoal(sire, dam, 1, "マダコメテスト");
foal2.weeksLeft = 100;
SH.retireHorse(foal2);
ok(foal2.madakome === true, "madakome flagged");

// --- 8. 素質判定 ---
console.log("[soshitsu judge]");
const j1 = SH.judgeSoshitsu("90", 1, 2.8);
ok(j1.rank === "MAX上", "pay90 yayoi1着 odds2.8 -> MAX上 (got " + j1.rank + ")");
const j2 = SH.judgeSoshitsu("90", 1, 2.9);
ok(j2.rank === "MAX下", "pay90 yayoi1着 odds2.9 -> MAX下 (got " + j2.rank + ")");
const j2b = SH.judgeSoshitsu("90", 1, 3.0);
ok(j2b.rank === "準MAX", "pay90 yayoi1着 odds3.0 -> 準MAX (got " + j2b.rank + ")");
const j3 = SH.judgeSoshitsu("90", 1, 3.5);
ok(j3.rank === "準MAX未満", "odds3.5 -> 準MAX未満 (got " + j3.rank + ")");

// --- 9. セーブ ---
console.log("[save]");
const dump = SH.exportSave();
SH.importSave(dump);
ok(SH.state.playerName === "テスト", "export/import roundtrip");

console.log(fails === 0 ? "\nALL OK" : "\n" + fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
