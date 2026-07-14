// ============================================================
// raceview3d.js — SH.RaceView3D: WebGL デュアルビュー観戦オーケストレータ
//  ・SH.RaceView3D.create(root, race, field, sim, onDone) → view / 失敗時 null
//  ・2560×720 キャンバス群 + デュアルビューポート描画(setViewport/setScissor×2)
//  ・番組フェーズ(タイトル/ゲート/ライブ/リプレイ/掲示板)= SH.RVHud へ委譲(§2.9)
//  ・HUD 全要素 = SH.RVHud(§2.6)。品質制御 = SH.RVQuality(E-15・§2.7)を毎フレーム駆動
//  ・SH._rvState を publishState で一元更新(§2.8)。馬 = SH.RVHorses(§2.3)
// ============================================================
"use strict";
(function (SH) {
  const RV3 = {};
  SH.RaceView3D = RV3;

  const VW = 1280, VH = 720, DW = 2560, DH = 720;
  const PREROLL = 5.4, TITLE_END = -2.6;
  const P_HUD_ON = 0.085, DP_FADE = 0.020;

  // URL テストフック(1回解析・§7.2)
  const _params = (function () { try { return new URLSearchParams(location.search); } catch (e) { return { get: function () { return null; } }; } })();
  if (_params.get("rvnogl") === "1") SH._forceNoWebGL = true;
  const FORCE_NIGHT = _params.get("rvnight") === "1";
  const _rvq = _params.get("rvq");
  const FORCE_Q = (_rvq == null || _rvq === "") ? null : parseInt(_rvq, 10);

  RV3.create = function (root, race, field, sim, onDone) {
    if (typeof THREE === "undefined" || !SH.RVWorld || !SH.RV2D || !SH.RVCams || !SH.RVHorses || !SH.RVHud || !SH.RVQuality) return null;

    const D = race.dist;
    const n = field.runners.length;
    const frames = sim.frames;
    const dtSim = frames.length > 1 ? frames[1].t - frames[0].t : 0.4;
    const course = SH.RV2D.makeCourse(D);
    const COAT = SH.RV2D.COAT;

    // ---- レイヤー(§1.1) ----
    const bgCanvas = SH.el("canvas", { width: String(DW), height: String(DH) });
    const glCanvas = SH.el("canvas", { class: "layer" });
    const fgCanvas = SH.el("canvas", { class: "layer", width: String(DW), height: String(DH) });
    const wrap = SH.el("div", { class: "canvas-wrap tv" }, [bgCanvas, glCanvas, fgCanvas]);
    root.appendChild(wrap);
    const commentBox = SH.el("div", { class: "commentary" });
    root.appendChild(commentBox);
    const ctrl = SH.el("div", { class: "row" });
    root.appendChild(ctrl);
    (function () { const c = bgCanvas.getContext("2d"); c.fillStyle = "#0a0e14"; c.fillRect(0, 0, DW, DH); })();

    function cleanup() { try { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); } catch (e) {} }

    // ---- レンダラー(失敗時は§1.2の後始末をして null) ----
    const renderer = SH.RVWorld.createRenderer(glCanvas);
    if (!renderer) { cleanup(); return null; }

    // ---- ワールド / 馬 / カメラ / HUD / 品質(例外時は後始末して null=2Dフォールバック退避)----
    let world = null, herd = null, scene, night, coatOf, dirL, dirR, hud, quality;
    let ownIndex = -1;
    try {
      world = SH.RVWorld.build(renderer, race, field, { forceNight: FORCE_NIGHT });
      scene = world.scene;
      night = world.night;

      const COAT_POOL = ["鹿毛", "鹿毛", "鹿毛", "黒鹿毛", "黒鹿毛", "栗毛", "栗毛", "栃栗毛", "芦毛", "青毛"];
      coatOf = field.runners.map(function (r, i) {
        if (r.kind === "owned") return COAT[r.ref.coat] || COAT["鹿毛"];
        return COAT[COAT_POOL[(i * 7 + r.name.length) % COAT_POOL.length]];
      });
      for (let i = 0; i < n; i++) { if (field.runners[i].kind === "owned") { ownIndex = i; break; } }

      herd = SH.RVHorses.create(world.horsesRoot, field, sim, course, coatOf, D);
      if (!herd) throw new Error("RVHorses.create returned null");

      dirL = SH.RVCams.createL(course, D, world);
      dirR = SH.RVCams.createR(course, D, world, ownIndex);

      hud = SH.RVHud.create(fgCanvas, race, field, sim);

      // 品質制御(E-15)。apply() が renderer.setSize / world.set* / herd.setLowDetail を駆動
      quality = SH.RVQuality.create(renderer, world, herd, { dw: DW, dh: DH, forceLevel: FORCE_Q });
      SH._rvForceQuality = function (lv) { try { quality.force(lv); } catch (e) {} };
    } catch (e) {
      try { if (herd && herd.dispose) herd.dispose(); } catch (e2) {}
      try { if (world && world.dispose) world.dispose(); } catch (e2) {}
      try { renderer.dispose(); renderer.forceContextLoss(); } catch (e2) {}
      cleanup();
      if (window.console) console.warn("[RaceView3D] setup failed → fallback:", e && e.message);
      return null;
    }

    // ---- シム補間 ----
    function posAt(t) {
      if (t <= 0) return frames[0].pos.map(function () { return 0; });
      const fi = t / dtSim, i0 = SH.clamp(Math.floor(fi), 0, frames.length - 1), i1 = SH.clamp(i0 + 1, 0, frames.length - 1), a = fi - i0;
      return frames[i0].pos.map(function (p, k) { return p + (frames[i1].pos[k] - p) * a; });
    }
    const finiteTimes = sim.times.filter(function (x) { return x < 900; });
    const goalTime = Math.max.apply(null, finiteTimes);
    const winTime = Math.min.apply(null, sim.times);
    const sorted = sim.times.slice().sort(function (a, b) { return a - b; });
    const photoFinish = (sorted[1] - sorted[0]) < 0.10;
    const REPLAY_FROM = Math.max(0.5, winTime - 7);

    // ---- 実況 ----
    let storyIdx = 0, lastStory = null;
    function pushStory(upTo) {
      while (storyIdx < sim.story.length && sim.story[storyIdx].t <= upTo) {
        commentBox.insertBefore(SH.el("div", { class: "cline", text: "🎙 " + sim.story[storyIdx].text }), commentBox.firstChild);
        lastStory = { text: sim.story[storyIdx].text, at: upTo };
        storyIdx++;
      }
    }

    // ---- view 構造体 ----
    const view = {
      t: -PREROLL, speed: 3, raf: 0, done: false, phase: "live",
      lastOwnInView: null, passTime1000m: null, passHudUntil: 0,
      cancel: function () {
        view.done = true; cancelAnimationFrame(view.raf);
        try { if (herd && herd.dispose) herd.dispose(); } catch (e) {}
        try { if (world && world.dispose) world.dispose(); } catch (e) {}
        try { renderer.dispose(); renderer.forceContextLoss(); } catch (e) {}
      },
    };
    SH._render3d = true;

    [["×1.5", 1.5], ["×3", 3], ["×6", 6]].forEach(function (p) {
      ctrl.appendChild(SH.el("button", { class: "chip" + (view.speed === p[1] ? " on" : ""), text: p[0], onclick: function (e) { view.speed = p[1]; SH.$$(".chip", ctrl).forEach(function (c) { c.classList.toggle("on", c === e.target); }); } }));
    });
    ctrl.appendChild(SH.el("button", { class: "btn ghost", text: "スキップ ▶▶", onclick: function () { view.cancel(); onDone(); } }));

    fgCanvas.addEventListener("click", function () {
      if (view.phase === "live" && view.t < 0) view.t = -0.01;
      else if (view.phase === "replay") { view.phase = "board"; boardT = 0; }
      else if (view.phase === "board") { view.cancel(); onDone(); }
    });

    // ---- 状態公開(§2.8・全フィールド)----
    SH._rvState = {
      viewMode: "single", qualityLevel: quality.level, hudPhase: "pre", hudAlpha: 0, elapsedSec: -PREROLL,
      remainM: D, distShown: D, rankOrder: field.runners.map(function (r, i) { return i; }),
      camL: null, camR: null, shotL: "L0", passTime1000m: null, passHudVisible: false, ownInViewSince: null,
    };
    function publishState(info) {
      const st = SH._rvState;
      st.viewMode = quality.viewModeSingle ? "single" : (info.dual ? "dual" : "single");
      st.qualityLevel = quality.level;
      const ph = hud.phaseOf(info.p);
      st.hudPhase = ph.hudPhase; st.hudAlpha = ph.hudAlpha;
      st.elapsedSec = view.t;
      st.remainM = info.R; st.distShown = Math.max(0, Math.ceil(info.R / 100) * 100);
      st.rankOrder = info.rankIdx.slice();
      st.camL = { mode: info.resL.mode, pos: info.resL.pos, tgt: info.resL.tgt, fl: info.resL.fl };
      st.camR = { type: info.resR.type, camIndex: info.resR.camIndex, pos: info.resR.pos, tgt: info.resR.tgt || null, fl: info.resR.fl, empty: info.resR.empty };
      st.shotL = info.resL.mode;
      st.passTime1000m = view.passTime1000m;
      st.passHudVisible = (view.passTime1000m != null) && (view.t < view.passHudUntil) && (D >= 1600);
      st.ownInViewSince = view.lastOwnInView;
    }

    // ---- 3D 1フレーム描画 ----
    const _wd1 = new THREE.Vector3(), _wd2 = new THREE.Vector3();
    function render3D(t, dtWorld, replayFlag) {
      const q = quality.q;
      const pos = posAt(Math.max(0, t));
      const leadM = Math.max.apply(null, pos);
      const R = Math.max(0, D - leadM), p = D > 0 ? leadM / D : 0, packC = leadM - 8;
      const ownM = ownIndex >= 0 ? Math.min(pos[ownIndex], D + 40) : null;
      const rankIdx = pos.map(function (v, i) { return i; }).sort(function (a, b) { return pos[b] - pos[a]; });
      // 設計§7.2/A-MINOR6: D≥1600 のレースのみ確定(D<1600 は終始 null)
      if (view.passTime1000m == null && D >= 1600 && leadM >= 1000) { view.passTime1000m = t; view.passHudUntil = t + 10.0; }

      if (world.setGateOpen) world.setGateOpen(t >= 0 ? Math.min(1, t * 3) : 0);

      const ctxL = { t: t, p: p, R: R, leadM: leadM, packC: packC, ownM: ownM, D: D, dt: dtWorld, replay: replayFlag, lastOwnInView: view.lastOwnInView };
      const resL = dirL.update(ctxL);
      const lShotIsAway = resL.mode === "L4" || resL.mode === "L5";
      const ctxR = { t: t, dt: dtWorld, leadM: leadM, R: R, D: D, ownM: ownM, packC: packC, lShotIsAway: lShotIsAway, lastOwnInView: view.lastOwnInView };
      const resR = dirR.update(ctxR);
      view.lastOwnInView = (resL.ownInView || resR.ownInView) ? t : view.lastOwnInView;

      // 両ビュー共通制約(§3.3): 近接かつ同方向 → 右を次定点へ
      const dpx = resL.camera.position.distanceTo(resR.camera.position);
      resL.camera.getWorldDirection(_wd1); resR.camera.getWorldDirection(_wd2);
      if (dpx < 12 && _wd1.dot(_wd2) > 0.98) dirR.forceNext();

      // 馬(InstancedMesh・行列書込はフレーム1回で全馬・2パスで共有)
      herd.update(t, dtWorld, pos, null, resL.camera, resR.camera);

      world.updateVisibility(resL.camera.position, resR.camera.position);
      if (world.sOfM) world.applyTone(world.sOfM(leadM));
      world.scrollFx(dtWorld);

      // stage4(viewModeSingle)は 3D のみ単一全幅化(HUDレイアウトは不変・§2.7)
      const dual = (t >= 0 && !replayFlag && !quality.viewModeSingle);
      renderer.setScissorTest(true);
      let dcL = 0, dcR = 0, tri = 0;
      if (dual) {
        resL.camera.aspect = VW / VH; resL.camera.updateProjectionMatrix();
        renderer.setViewport(0, 0, VW * q, DH * q); renderer.setScissor(0, 0, VW * q, DH * q);
        renderer.render(scene, resL.camera);
        dcL = renderer.info.render.calls; tri = renderer.info.render.triangles;
        renderer.setViewport(VW * q, 0, VW * q, DH * q); renderer.setScissor(VW * q, 0, VW * q, DH * q);
        renderer.render(scene, resR.camera);
        dcR = renderer.info.render.calls; tri += renderer.info.render.triangles;
      } else {
        resL.camera.aspect = DW / DH; resL.camera.updateProjectionMatrix();
        renderer.setViewport(0, 0, DW * q, DH * q); renderer.setScissor(0, 0, DW * q, DH * q);
        renderer.render(scene, resL.camera);
        dcL = renderer.info.render.calls; tri = renderer.info.render.triangles;
      }
      // 開発補助(§7.2): draw call 実測。_rvState の仕様固定フィールドとは分離
      SH._rvDebug = { drawCallsL: dcL, drawCallsR: dcR, drawCalls: dcL + dcR, triangles: tri, emaMs: quality.emaMs, qualityLevel: quality.level };
      return { pos: pos, leadM: leadM, R: R, p: p, rankIdx: rankIdx, resL: resL, resR: resR, dual: dual };
    }

    // ---- 再生ループ ----
    let flash = 0, last = performance.now(), goalFlashed = false, replayT = 0, boardT = 0;
    function loop(now) {
      if (view.done) return;
      const frameMs = now - last;
      const el = Math.min(0.1, frameMs / 1000); last = now;
      if (view.phase === "live") {
        let sp = view.speed;
        const posNow = posAt(Math.max(0, view.t)), leadNow = Math.max.apply(null, posNow);
        if (view.t >= 0 && D - leadNow < 90 && view.t < winTime) sp *= 0.32;
        if (view.t < 0) sp = 1;
        const dtWorld = el * sp; view.t += dtWorld;
        if (view.t < TITLE_END) {
          hud.drawTitle(view.t, night);
        } else {
          const info = render3D(view.t, dtWorld, false);
          // H-10 バナー(全幅中央)
          let bText = null, bBg = null, bFg = null;
          if (view.t > winTime) {
            if (photoFinish && view.t < winTime + 1.8) { bText = "写真判定"; bBg = "#fff"; bFg = "#1a1a1a"; }
            else { const wr = field.runners[sim.order[0]]; bText = "1着  " + wr.gate + " " + wr.name; bBg = SH.WAKU_COLORS[wr.waku - 1]; bFg = SH.WAKU_TEXT[wr.waku - 1]; }
          } else if (view.t < 0) { bText = "各馬ゲートイン"; bBg = "rgba(0,0,0,.6)"; bFg = "#fff"; }
          else if (view.t < 1.2) { bText = "スタート！"; bBg = "rgba(0,0,0,.6)"; bFg = "#ffd43b"; }
          hud.drawLive({
            t: view.t, p: info.p, R: info.R, rankIdx: info.rankIdx, dual: info.dual, night: night,
            passTime1000m: view.passTime1000m, flash: flash, lastStory: lastStory,
            bannerText: bText, bannerBg: bBg, bannerFg: bFg,
          });
          if (flash > 0) flash -= 0.06;
          publishState(info);
        }
        pushStory(view.t + 0.8);
        if (!goalFlashed && view.t >= winTime) { flash = 0.85; goalFlashed = true; }
        const endT = goalTime + (photoFinish ? 3.4 : 2.4);
        if (view.t >= endT) { view.phase = "replay"; replayT = REPLAY_FROM; SH._rvState.viewMode = "single"; }
      } else if (view.phase === "replay") {
        const dtWorld = el * 1.2; replayT += dtWorld;
        render3D(replayT, dtWorld, true);
        hud.drawReplay(replayT);
        if (replayT >= winTime + 0.8) { view.phase = "board"; boardT = 0; }
      } else {
        boardT += el; hud.drawBoard(boardT);
        if (boardT >= 7) { view.done = true; setTimeout(onDone, 200); return; }
      }
      quality.sample(frameMs);
      view.raf = requestAnimationFrame(loop);
    }
    view.raf = requestAnimationFrame(loop);
    return view;
  };
})(window.SH);
