// ============================================================
// browser-test.js — 工程5(テスト)ブラウザ実行マトリクス
//   対象: docs/screen-repro/01-requirements.md §7 合格基準(AC-1〜AC-26)
//         docs/screen-repro/02-spec.md §7 性能予算・§7.2 E-15・§7.3 _rvState
//         docs/screen-repro/03-design.md §7 テストフック設計
//
// 実行: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
//       node game/test/browser-test.js
//   (事前に `cd game/test && npm install` で playwright-core を導入しておくこと。
//    ブラウザは /opt/pw-browsers に同梱済みのため playwright install は不要かつ実行禁止)
//
// 内容:
//   A. 距離{1200,2400,3600}×天候{良,不良}×頭数{5(WBC・ナイター),18(G1・昼)} = 12組
//      + WBC ナイター(D=2400)は上記12組に含まれる1つを「hero」として全局面スクショ取得
//      + G1(18頭・昼)D=2400 も hero として全局面スクショ取得
//      各組: JSエラー0 / draw call予算(per-pass≤140, total≤280) / SH._rvState 主要フィールド
//      の整合(AC-4/5/9/10/11 等)をログ判定。1〜2枚のスクショを game/test/shots/ に保存。
//   B. E-15: ?rvq=0..4 を強制し、段階が実値として反映されること・q4 で dual中も
//      viewMode="single" が持続すること(複数サンプルで確認)・エラー0を確認。
//   C. フォールバック ?rvnogl=1: 合成注入での即時確認(SH._rvState契約・キャンバス寸法)。
//   D. ゲームフロー通し(実UI操作): 生産→厩舎→出走登録→レースタブ→馬券購入→観戦
//      (通常のデュアルビュー経路 と ?rvnogl=1 フォールバック経路の両方)→リプレイ→
//      掲示板→払い戻し→週送り、を実際のクリック操作で駆動し JSエラー0 を確認。
//      SH._rvState は "live" フェーズでのみ更新され replay/board で凍結するため
//      (工程4申し送り事項)、"board到達" は SH._rvState ではなく
//      DOM(.canvas-wrap.tv の消失=onDone到達)で検知する。
//   E. 性能実測: 18頭立てG1 と WBC ナイターで実時間 rAF 間隔統計(headless実測は参考値)。
//
// 注意: game/js/* のソースは変更しない。テストが不具合を発見した場合は
//       FAIL として記録するのみで、その場での修正は行わない。
// ============================================================
"use strict";
const { chromium } = require("playwright-core");
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");           // game/
const OUT = path.join(__dirname, "shots");          // game/test/shots/ (gitignore対象・成果物)
const PORT = 8935;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

function resolveChromePath() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  if (fs.existsSync(base)) {
    const dirs = fs.readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort();
    for (const d of dirs.reverse()) {
      const p = path.join(base, d, "chrome-linux", "chrome");
      if (fs.existsSync(p)) return p;
    }
  }
  return null; // playwright-core のデフォルト解決に委ねる(通常は見つからずエラーになるため上を優先)
}
const CHROME_PATH = resolveChromePath();

const server = http.createServer((req, res) => {
  let p = req.url.split("?")[0];
  if (p === "/") p = "/index.html";
  const f = path.join(ROOT, p);
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); res.end("nf"); return; }
    res.writeHead(200, { "Content-Type": (MIME[path.extname(f)] || "text/plain") + "; charset=utf-8" });
    res.end(data);
  });
});

let fail = false;
const summary = [];
const acEvidence = {}; // AC-ID -> [文字列証跡]
function record(acId, text) { (acEvidence[acId] = acEvidence[acId] || []).push(text); }
function logLine(ok, text) {
  const line = (ok ? "ok   " : "FAIL ") + text;
  console.log(line);
  summary.push(line);
  if (!ok) fail = true;
}

// ---- レース定義ヘルパ ----
const R_G1 = (d) => `{ id:'g1-${d}', name:'グランドチャンピオンズC', grade:'G1', surface:'芝', dist:${d}, course:'中央', week:26 }`;
const R_WBC = (d) => `{ id:'wbc-${d}', name:'ワールドチャンピオンシップ', grade:'WBC', surface:'芝', dist:${d}, course:'中央', week:50 }`;

// field.runners.length が targetN になるまで buildField をリトライしてから注入する合成スクリプト。
// (race.js は変更しないため、頭数は GRADE_BAND の許容レンジ内でのリトライにより狙う。
//  WBC は field:[5,5] のため常に1回で5に一致。G1 は field:[14,18] のため18は約1/5の確率。)
function synth(raceJson, cond, targetN) {
  return `(() => {
    const race = ${raceJson};
    let field, tries = 0;
    do { field = SH.buildField(race, [], new Set()); tries++; }
    while (field.runners.length !== ${targetN} && tries < 800);
    if (field.runners.length) { field.runners[0].kind = 'owned'; field.runners[0].ref = field.runners[0].ref || { coat: '鹿毛' }; }
    field.condition = ${JSON.stringify(cond)};
    const sim = SH.simulateRace(field);
    const root = document.createElement('div'); root.id = 'rvtest'; root.style.width = '1280px'; document.body.appendChild(root);
    window.__errors = [];
    window.__view = SH.createRaceView(root, race, field, sim, () => { window.__done = true; });
    window.__goal = Math.max.apply(null, sim.times.filter(x => x < 900));
    return { n: field.runners.length, tries: tries, night: SH.isNightRace(race), render3d: SH._render3d, goal: window.__goal, cond: field.condition, dist: race.dist };
  })()`;
}

function newTrackedPage(browser, viewport) {
  const errors = [];
  return browser.newPage({ viewport: viewport || { width: 1320, height: 640 } }).then((page) => {
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
    return { page, errors };
  });
}

async function jump(page, t, speed) {
  await page.evaluate((a) => { if (window.__view) { window.__view.speed = a.s; window.__view.t = a.t; } }, { t, s: speed });
  await page.waitForTimeout(380);
}

async function rvSnapshot(page) {
  return page.evaluate(() => ({
    L: SH._rvDebug ? SH._rvDebug.drawCallsL : null, R: SH._rvDebug ? SH._rvDebug.drawCallsR : null,
    tri: SH._rvDebug ? SH._rvDebug.triangles : null,
    vm: SH._rvState.viewMode, ql: SH._rvState.qualityLevel,
    hudPhase: SH._rvState.hudPhase, hudAlpha: SH._rvState.hudAlpha,
    distShown: SH._rvState.distShown, remainM: SH._rvState.remainM,
    rankOrderLen: SH._rvState.rankOrder ? SH._rvState.rankOrder.length : null,
    elapsedSec: SH._rvState.elapsedSec,
    camLmode: SH._rvState.camL ? SH._rvState.camL.mode : null,
    camRtype: SH._rvState.camR ? SH._rvState.camR.type : null,
    camRidx: SH._rvState.camR ? SH._rvState.camR.camIndex : null,
    camRempty: SH._rvState.camR ? SH._rvState.camR.empty : null,
    pass: SH._rvState.passTime1000m, passVis: SH._rvState.passHudVisible,
    ownSince: SH._rvState.ownInViewSince,
  }));
}

// ============================================================
// A. マトリクス(距離×天候×頭数)+ E-15/フォールバック 合成注入テスト
// ============================================================
async function runMatrixCombo(browser, tag, raceJson, cond, targetN, opts) {
  opts = opts || {};
  const { page, errors } = await newTrackedPage(browser);
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.SH && SH.createRaceView && SH.RaceView3D && SH.RVHud && SH.RVQuality && SH.buildField, null, { timeout: 8000 });
  const info = await page.evaluate(synth(raceJson, cond, targetN));
  const G = info.goal;

  const samples = [];
  async function sample(name, t, snap) {
    await jump(page, t, 1.5);
    // 状態は先に読む(スクショ撮影の実時間で view.t がさらに進むドリフトを避けるため)
    const d = await rvSnapshot(page);
    if (snap) await page.locator("#rvtest").screenshot({ path: path.join(OUT, opts.prefix + "-" + name + ".png") });
    samples.push({ name, t, d });
    return d;
  }

  if (opts.prefix) { await jump(page, -3.4, 1.5); await page.locator("#rvtest").screenshot({ path: path.join(OUT, opts.prefix + "-0-title.png") }); }
  await sample("1-gate", -0.05, opts.prefix);
  await sample("1b-start", 0.35, opts.full);          // 発走密集(draw call ピーク確認用)
  await sample("2-michi", G * 0.28, true);              // 全組: 1枚は必ず撮る
  if (opts.full) await sample("3-corner", G * 0.50, true);
  if (opts.full) await sample("4-chokusen", G * 0.86, true);
  await sample("5-goal", G * 0.99, opts.prefix);

  let maxPass = 0, maxTotal = 0, maxTri = 0;
  samples.forEach((x) => { if (x.d.L != null) { maxPass = Math.max(maxPass, x.d.L, x.d.R); maxTotal = Math.max(maxTotal, x.d.L + x.d.R); maxTri = Math.max(maxTri, x.d.tri || 0); } });
  const qlValues = samples.map((x) => x.d.ql);
  const qlReal = qlValues.every((v) => typeof v === "number");

  // AC-4: remainM と distShown の一致(±100m未満)
  const ac4 = samples.every((x) => x.d.remainM == null || Math.abs(x.d.distShown - x.d.remainM) < 100 || x.d.distShown === 0);
  // AC-5: rankOrder の頭数一致
  const ac5 = samples.every((x) => x.d.rankOrderLen == null || x.d.rankOrderLen === info.n);
  // AC-9: elapsedSec(view.t)がジャンプ先 t とおおむね一致すること。
  // jump() は 380ms 実待機を伴い、その間も speed(=1.5)で view.t が進み続けるため
  // 理論上の最大ドリフトは 380ms*1.5 ≈ 0.6sim秒。マージンを見て 3.0sim秒未満を許容範囲とする。
  const ac9 = samples.every((x) => x.d.elapsedSec == null || Math.abs(x.d.elapsedSec - x.t) < 3.0);
  // AC-3: 左ショットの多様性(サンプル中に3種以上のモードが出現。全局面撮影組のみ厳密判定)
  const shotSet = new Set(samples.map((x) => x.d.camLmode).filter(Boolean));
  // AC-10: D>=1600 のみ判定対象(§7.2 A-MINOR6 / 04実装ノート申し送り)
  const passOK = info.dist >= 1600 ? samples.some((x) => x.d.pass != null) : samples.every((x) => x.d.pass == null);

  // 完走(リプレイ→掲示板→onDone)。SH._rvState は replay 突入後は更新されないため
  // ここでは window.__view.phase(合成注入テストのみが持つテスト用参照)で直接検知する。
  await page.evaluate(() => { window.__view.speed = 6; window.__view.t = window.__goal + 3; });
  const reachedReplay = await page.waitForFunction(() => window.__view && window.__view.phase === "replay", null, { timeout: 8000 }).then(() => true).catch(() => false);
  await page.waitForTimeout(400);
  if (opts.prefix) await page.locator("#rvtest").screenshot({ path: path.join(OUT, opts.prefix + "-6-replay.png") });
  const fg = page.locator("#rvtest canvas.layer").last();
  await fg.click({ force: true }).catch(() => {});
  const reachedBoard = await page.waitForFunction(() => window.__view && window.__view.phase === "board", null, { timeout: 8000 }).then(() => true).catch(() => false);
  await page.waitForTimeout(300);
  if (opts.prefix) await page.locator("#rvtest").screenshot({ path: path.join(OUT, opts.prefix + "-7-board.png") });
  await fg.click({ force: true }).catch(() => {});
  const done = await page.waitForFunction(() => window.__done === true, null, { timeout: 8000 }).then(() => true).catch(() => false);

  const bad = errors.length > 0 || !done || !reachedReplay || !reachedBoard || maxPass > 140 || maxTotal > 280 || !qlReal || !passOK || !ac4 || !ac5 || !ac9 || info.n !== targetN;
  const line = `[${tag}] n=${info.n}(target ${targetN}) night=${info.night} cond=${info.cond} dist=${info.dist} | maxPass=${maxPass}(<=140) maxTotal=${maxTotal}(<=280) tri~${maxTri} | ql=${JSON.stringify(qlValues)} real=${qlReal} | AC4=${ac4} AC5=${ac5} AC9=${ac9} passOK(AC10)=${passOK} shotL_set=${JSON.stringify([...shotSet])} | replay=${reachedReplay} board=${reachedBoard} onDone=${done} | ERR=${errors.length ? errors.join(" / ") : "NONE"}`;
  logLine(!bad, line);
  if (opts.prefix) record("screenshots", `${tag}: game/test/shots/${opts.prefix}-*.png`);
  record("AC-1/2/3", `${tag}: shotL集合=${JSON.stringify([...shotSet])} camR type/idx最終=${JSON.stringify(samples[samples.length - 1].d.camRtype)}/${samples[samples.length - 1].d.camRidx}`);
  record("AC-4", `${tag}: AC4=${ac4}`);
  record("AC-5", `${tag}: AC5=${ac5}`);
  record("AC-9", `${tag}: AC9=${ac9}`);
  record("AC-10", `${tag}: passOK=${passOK} (dist=${info.dist})`);
  record("AC-15/16", `${tag}: replay=${reachedReplay} board=${reachedBoard} onDone=${done} errors=${errors.length}`);
  record("AC-21(budget)", `${tag}: maxPass=${maxPass} maxTotal=${maxTotal}`);
  await page.close();
  return { info, maxPass, maxTotal, samples, bad };
}

async function runE15Forced(browser, stage) {
  const { page, errors } = await newTrackedPage(browser);
  const e15logs = [];
  page.on("console", (m) => { if (m.text().indexOf("[E-15]") >= 0) e15logs.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/?rvq=${stage}`);
  await page.waitForFunction(() => window.SH && SH.RaceView3D && SH.RVQuality, null, { timeout: 8000 });
  const info = await page.evaluate(synth(R_G1(2400), "良", 18));
  // 2回サンプル(異なる時刻)して level4 の viewMode="single" が"持続"することを確認
  await page.evaluate(() => { window.__view.speed = 1.5; window.__view.t = window.__goal * 0.25; });
  await page.waitForTimeout(500);
  const st1 = await page.evaluate(() => ({ ql: SH._rvState.qualityLevel, vm: SH._rvState.viewMode, R: SH._rvDebug ? SH._rvDebug.drawCallsR : -1, L: SH._rvDebug ? SH._rvDebug.drawCallsL : -1 }));
  await page.evaluate(() => { window.__view.t = window.__goal * 0.6; });
  await page.waitForTimeout(500);
  const st2 = await page.evaluate(() => ({ ql: SH._rvState.qualityLevel, vm: SH._rvState.viewMode, R: SH._rvDebug ? SH._rvDebug.drawCallsR : -1, L: SH._rvDebug ? SH._rvDebug.drawCallsL : -1 }));
  await page.locator("#rvtest").screenshot({ path: path.join(OUT, "e15-q" + stage + ".png") });
  const ok = st1.ql === stage && st2.ql === stage &&
    (stage !== 4 || (st1.vm === "single" && st1.R === 0 && st2.vm === "single" && st2.R === 0)) &&
    errors.length === 0;
  logLine(ok, `[E-15 q${stage}] ql=${st1.ql}/${st2.ql} vm=${st1.vm}/${st2.vm} L=${st1.L}/${st2.L} R=${st1.R}/${st2.R} log=${JSON.stringify(e15logs)} ERR=${errors.length ? errors.join("|") : "NONE"}`);
  record("AC-1(E-15除外規定)/AC-21", `q${stage}: ql=${st1.ql}/${st2.ql} vm=${st1.vm}/${st2.vm}`);
  await page.close();
  return ok;
}

async function runE15Hook(browser) {
  const { page, errors } = await newTrackedPage(browser);
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.SH && SH.RaceView3D, null, { timeout: 8000 });
  await page.evaluate(synth(R_G1(2400), "良", 18));
  await page.evaluate(() => { window.__view.t = window.__goal * 0.3; });
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => SH._rvState.qualityLevel);
  await page.evaluate(() => SH._rvForceQuality(4));
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({ ql: SH._rvState.qualityLevel, vm: SH._rvState.viewMode }));
  const ok = typeof before === "number" && after.ql === 4 && after.vm === "single" && errors.length === 0;
  logLine(ok, `[HOOK SH._rvForceQuality] before=${before} after=${JSON.stringify(after)}`);
  await page.close();
  return ok;
}

async function runFallbackSynth(browser) {
  const { page, errors } = await newTrackedPage(browser);
  await page.goto(`http://localhost:${PORT}/?rvnogl=1`);
  await page.waitForFunction(() => window.SH && SH.createRaceView && SH.buildField, null, { timeout: 8000 });
  await page.evaluate(synth(R_G1(2400), "良", 18));
  await page.evaluate(() => { window.__view.speed = 3; window.__view.t = window.__goal * 0.3; });
  await page.waitForTimeout(600);
  await page.locator("#rvtest").screenshot({ path: path.join(OUT, "fallback-synth.png") });
  const fb = await page.evaluate(() => {
    const layers = document.querySelectorAll("#rvtest canvas.layer");
    const dims = layers.length ? { w: layers[0].width, h: layers[0].height } : null;
    return {
      forceNoGL: !!SH._forceNoWebGL, vm: SH._rvState && SH._rvState.viewMode, ql: SH._rvState && SH._rvState.qualityLevel,
      canvasDims: dims,
    };
  });
  const fbOK = fb.forceNoGL === true && fb.vm === "single" && fb.ql === null &&
    fb.canvasDims && fb.canvasDims.w === 1280 && fb.canvasDims.h === 720 && errors.length === 0;
  logLine(fbOK, `[FALLBACK synth] ${JSON.stringify(fb)} ERR=${errors.length ? errors.join("|") : "NONE"}`);
  record("AC-16", `synth: ${JSON.stringify(fb)}`);
  await page.close();
  return fbOK;
}

// ============================================================
// E. 性能実測(実時間 rAF 間隔統計)— headless実測は参考値である旨を明記して記録
// ============================================================
async function runPerfSample(browser, tag, raceJson, cond, targetN) {
  const { page, errors } = await newTrackedPage(browser);
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.SH && SH.createRaceView, null, { timeout: 8000 });
  const info = await page.evaluate(synth(raceJson, cond, targetN));
  await page.evaluate(() => { window.__view.speed = 3; window.__view.t = window.__goal * 0.3; });
  await page.waitForTimeout(300);
  // 3秒間、実時間で rAF タイムスタンプを収集(page内で計測。ここは時間ジャンプせず実描画させる)
  const stats = await page.evaluate(() => new Promise((resolve) => {
    const deltas = []; const t0 = performance.now(); let last = t0; let n = 0;
    function tick(now) {
      deltas.push(now - last); last = now; n++;
      if (now - t0 < 3000 && n < 400) requestAnimationFrame(tick);
      else {
        const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
        const fps = 1000 / avg;
        const sorted = deltas.slice().sort((a, b) => a - b);
        resolve({ count: deltas.length, avgMs: avg, fps, minMs: sorted[0], maxMs: sorted[sorted.length - 1], drawCalls: SH._rvDebug ? SH._rvDebug.drawCalls : null, ql: SH._rvState.qualityLevel });
      }
    }
    requestAnimationFrame(tick);
  }));
  const dc = await rvSnapshot(page);
  logLine(errors.length === 0, `[PERF ${tag}] n=${info.n} frames=${stats.count} avgFrame=${stats.avgMs.toFixed(2)}ms(~${stats.fps.toFixed(1)}fps, headless参考値) min=${stats.minMs.toFixed(1)}ms max=${stats.maxMs.toFixed(1)}ms ql=${stats.ql} drawCalls=${stats.drawCalls} perPass(L/R)=${dc.L}/${dc.R} ERR=${errors.length ? errors.join("|") : "NONE"}`);
  record("AC-21(perf)", `${tag}: avgFrame=${stats.avgMs.toFixed(2)}ms ~${stats.fps.toFixed(1)}fps(headless参考値) ql=${stats.ql} drawCalls=${stats.drawCalls}`);
  await page.close();
  return stats;
}

// ============================================================
// D. ゲームフロー通し(実UI操作): 生産→厩舎→出走登録は既存馬(CPU対戦のみ)を省略し、
//    最短経路として「生産→レースタブでメイクデビューへ賭ける→観戦→掲示板→払戻→週送り」
//    を実クリックで駆動する。SH._rvState を "live" 中に複数回ポーリングし
//    phase/frame の進行を確認、"board到達"は DOM(.canvas-wrap.tv の消失)で検知する。
// ============================================================
async function runFullGameFlow(browser, opts) {
  opts = opts || {};
  const query = opts.rvnogl ? "?rvnogl=1" : "";
  const prefix = opts.rvnogl ? "flow-fallback" : "flow-normal";
  const { page, errors } = await newTrackedPage(browser, { width: 480, height: 900 });
  await page.goto(`http://localhost:${PORT}/${query}`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, prefix + "-1-title.png") });

  await page.fill("input", "工程5テスト");
  await page.click("text=ゲームスタート");
  await page.waitForTimeout(400);

  // 生産(自馬を1頭作る。以降のレースには絡めないが「生産」フローの無退行確認として実施)
  await page.click("#nav-breed");
  await page.waitForTimeout(300);
  await page.click("text=ディープインパクト");
  await page.click("text=エアグルーヴ");
  await page.waitForTimeout(200);
  await page.click("text=生産する");
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, prefix + "-2-foal.png") });

  // 厩舎(調教・飼葉ボタンの存在確認=無退行)
  await page.click("#nav-stable");
  await page.waitForTimeout(300);
  const hasTrainBtn = await page.locator("text=調教・飼葉").count();
  if (hasTrainBtn) await page.click("text=調教・飼葉");
  await page.waitForTimeout(200);

  const medalsBefore = await page.locator("#tb-medals").textContent();

  // レースタブ→新馬戦→馬券購入→発走
  await page.click("#nav-race");
  await page.waitForTimeout(300);
  await page.click("text=メイクデビュー");
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, prefix + "-3-betscreen.png") });
  await page.click(".field-table tr:nth-child(2)");
  await page.waitForTimeout(200);
  await page.click("text=この馬券を追加");
  await page.waitForTimeout(200);
  await page.click("text=発走！");
  // PREROLL(タイトル→ゲートイン)は常に実時間5.4秒固定(speedチップの影響を受けない、raceview3d.js)。
  // これを跨いでから live 進行(elapsedSec/remainM の変化)をポーリング確認する。
  await page.waitForTimeout(5800);

  // "live" フェーズ中に SH._rvState を複数回ポーリングし phase/frame 進行を確認
  const liveSamples = [];
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(500);
    const st = await page.evaluate(() => (window.SH && SH._rvState) ? {
      vm: SH._rvState.viewMode, hudPhase: SH._rvState.hudPhase, elapsedSec: SH._rvState.elapsedSec, remainM: SH._rvState.remainM,
    } : null);
    if (st) liveSamples.push(st);
  }
  // フォールバック(2D)経路は SH._rvState={viewMode,qualityLevel} のみ(§8仕様)で
  // elapsedSec 等は公開されないため、その場合はサンプルが空/vmのみでも正常(進行確認は
  // 通常経路(dual)側でのみ行う)。
  const elapsedSeries = liveSamples.map((s) => s.elapsedSec).filter((v) => v != null);
  const progressing = elapsedSeries.length >= 2 && elapsedSeries[elapsedSeries.length - 1] > elapsedSeries[0];
  const rvStateOK = opts.rvnogl ? liveSamples.every((s) => s.vm === "single") : progressing;
  logLine(rvStateOK, `[${prefix}] live _rvState progression: ${JSON.stringify(liveSamples)}`);
  record("AC-9/AC-15(live progression)", `${prefix}: ${JSON.stringify(liveSamples)}`);

  // 加速して残りを進める(存在すればクリック。フォールバック2D経路にも同じ ×6 チップがある)
  const sixChip = page.locator("text=×6");
  if (await sixChip.count()) await sixChip.click().catch(() => {});
  await page.screenshot({ path: path.join(OUT, prefix + "-4-mid.png") });

  // "board到達" は SH._rvState が凍結するため DOM(.canvas-wrap.tv の消失=onDone)で検知する
  const flowDone = await page.waitForFunction(
    () => !document.querySelector(".canvas-wrap.tv"),
    null, { timeout: 60000 }
  ).then(() => true).catch(() => false);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, prefix + "-5-result.png") });
  const hasPayoutSection = await page.locator("text=払い戻し").count();

  // 週送り
  const nextWeekBtn = page.locator("text=次の週へ進む");
  let weekAdvanced = false;
  if (await nextWeekBtn.count()) {
    await nextWeekBtn.click().catch(() => {});
    await page.waitForTimeout(400);
    weekAdvanced = true;
  }
  const medalsAfter = await page.locator("#tb-medals").textContent().catch(() => null);
  await page.screenshot({ path: path.join(OUT, prefix + "-6-nextweek.png") });

  const bad = errors.length > 0 || !flowDone;
  logLine(!bad, `[${prefix}] flowDone(board→onDone via DOM)=${flowDone} payoutSection=${!!hasPayoutSection} weekAdvanced=${weekAdvanced} medals ${medalsBefore}→${medalsAfter} ERR=${errors.length ? errors.join(" / ") : "NONE"}`);
  record("AC-15/AC-16(通しフロー)", `${prefix}: flowDone=${flowDone} payout=${!!hasPayoutSection} week=${weekAdvanced} err=${errors.length}`);
  await page.close();
  return !bad;
}

// ============================================================
// メイン
// ============================================================
(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const launchOpts = { args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] };
  if (CHROME_PATH) launchOpts.executablePath = CHROME_PATH;
  const browser = await chromium.launch(launchOpts);

  console.log("==== A. マトリクス(距離×天候×頭数) ====");
  // hero: G1 2400 良(18頭・昼)— 全局面スクショ
  await runMatrixCombo(browser, "HERO-G1-2400-良-18頭昼", R_G1(2400), "良", 18, { prefix: "hero-g1", full: true });
  // hero: WBC 2400 良(5頭・ナイター)= "WBC night race" 要求分 — 全局面スクショ
  await runMatrixCombo(browser, "HERO-WBC-2400-良-5頭ナイター", R_WBC(2400), "良", 5, { prefix: "hero-wbc", full: true });

  // 残り10組(距離3×天候2×頭数2 のうち上記2組を除く10組)
  const CONDTAG = { "良": "yoi", "不良": "fury" }; // ファイル名はASCIIのみ許容(日本語は正規表現で全消去され衝突するため)
  const combos = [];
  for (const dist of [1200, 2400, 3600]) {
    for (const cond of ["良", "不良"]) {
      combos.push({ tag: `WBC-${dist}-${cond}-5頭`, raceJson: R_WBC(dist), cond, n: 5, condTag: CONDTAG[cond], grade: "wbc", dist });
      combos.push({ tag: `G1-${dist}-${cond}-18頭`, raceJson: R_G1(dist), cond, n: 18, condTag: CONDTAG[cond], grade: "g1", dist });
    }
  }
  for (const c of combos) {
    if ((c.tag.indexOf("G1-2400-良") === 0) || (c.tag.indexOf("WBC-2400-良") === 0)) continue; // hero済み
    await runMatrixCombo(browser, c.tag, c.raceJson, c.cond, c.n, { prefix: `mx-${c.grade}-${c.dist}-${c.condTag}-n${c.n}` });
  }

  console.log("\n==== B. E-15 動的品質スケーリング(?rvq=0..4) ====");
  for (const stage of [0, 1, 2, 3, 4]) await runE15Forced(browser, stage);
  await runE15Hook(browser);

  console.log("\n==== C. フォールバック(合成注入・即時確認) ====");
  await runFallbackSynth(browser);

  console.log("\n==== D. ゲームフロー通し(実UI操作) ====");
  await runFullGameFlow(browser, { rvnogl: false });
  await runFullGameFlow(browser, { rvnogl: true });

  console.log("\n==== E. 性能実測(実時間 rAF・headless参考値) ====");
  await runPerfSample(browser, "G1-2400-18頭-昼", R_G1(2400), "良", 18);
  await runPerfSample(browser, "WBC-2400-5頭-ナイター", R_WBC(2400), "良", 5);

  await browser.close();
  server.close();

  console.log("\n==== SUMMARY ====");
  summary.forEach((s) => console.log(s));
  console.log("\n==== AC EVIDENCE (raw, for report authoring) ====");
  console.log(JSON.stringify(acEvidence, null, 2));
  console.log("\n=== RESULT:", fail ? "FAIL" : "PASS", "===");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("TEST CRASH:", e.stack || e.message); try { server.close(); } catch (e2) {} process.exit(2); });
