// ============================================================
// raceview3d.js — SH.RaceView3D: WebGL デュアルビュー観戦オーケストレータ
//  ・SH.RaceView3D.create(root, race, field, sim, onDone) → view / 失敗時 null
//  ・2560×720 キャンバス群 + デュアルビューポート描画(setViewport/setScissor×2)
//  ・番組フェーズ(タイトル/ゲート/ライブ/リプレイ/掲示板)= 既存様式を座標転記で再実装
//  ・SH._rvState を publishState で一元更新(§2.8)。馬は WS1 暫定(既存 createHorse)
// ============================================================
"use strict";
(function (SH) {
  const RV3 = {};
  SH.RaceView3D = RV3;

  const VW = 1280, VH = 720, DW = 2560, DH = 720;
  const PREROLL = 5.4, TITLE_END = -2.6;
  const P_HUD_ON = 0.085, DP_FADE = 0.020;

  // URL テストフック(1回解析)
  const _params = (function () { try { return new URLSearchParams(location.search); } catch (e) { return { get: function () { return null; } }; } })();
  if (_params.get("rvnogl") === "1") SH._forceNoWebGL = true;
  const FORCE_NIGHT = _params.get("rvnight") === "1";

  function fmtElapsed(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60), s = Math.floor(sec - m * 60);
    return (m > 0 ? m + "'" : "'") + (s < 10 ? "0" : "") + s;
  }
  function gradeLabel(g) {
    if (g === "WBC" || g === "G1" || g === "J-G1") return "GI";
    if (g === "G2" || g === "J-G2") return "GII";
    if (g === "G3" || g === "J-G3") return "GIII";
    return "";
  }

  RV3.create = function (root, race, field, sim, onDone) {
    if (typeof THREE === "undefined" || !SH.RVWorld || !SH.RV2D || !SH.RVCams) return null;

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
    const octx = fgCanvas.getContext("2d");
    (function () { const c = bgCanvas.getContext("2d"); c.fillStyle = "#0a0e14"; c.fillRect(0, 0, DW, DH); })();

    function cleanup() { try { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); } catch (e) {} }

    // ---- レンダラー / ワールド(失敗時は§1.2の後始末をして null) ----
    const renderer = SH.RVWorld.createRenderer(glCanvas);
    if (!renderer) { cleanup(); return null; }
    const q = Math.min(window.devicePixelRatio || 1, 1.0);
    renderer.setSize(DW * q, DH * q, false);

    let world;
    try {
      world = SH.RVWorld.build(renderer, race, field, { forceNight: FORCE_NIGHT });
    } catch (e) {
      try { renderer.dispose(); renderer.forceContextLoss(); } catch (e2) {}
      cleanup();
      if (window.console) console.warn("[RaceView3D] build failed → fallback:", e && e.message);
      return null;
    }
    const scene = world.scene;
    const night = world.night;

    // ---- 暫定馬(WS1: 既存 createHorse を n 体。WS2 で InstancedMesh へ置換) ----
    const COAT_POOL = ["鹿毛", "鹿毛", "鹿毛", "黒鹿毛", "黒鹿毛", "栗毛", "栗毛", "栃栗毛", "芦毛", "青毛"];
    const coatOf = field.runners.map(function (r, i) {
      if (r.kind === "owned") return COAT[r.ref.coat] || COAT["鹿毛"];
      return COAT[COAT_POOL[(i * 7 + r.name.length) % COAT_POOL.length]];
    });
    const horses3 = [];
    let ownIndex = -1;
    if (SH.Horse3D && SH.Horse3D.available()) {
      field.runners.forEach(function (r, i) {
        if (r.kind === "owned" && ownIndex < 0) ownIndex = i;
        const coatHex = parseInt(coatOf[i].slice(1), 16);
        const silksHex = parseInt(SH.WAKU_COLORS[r.waku - 1].slice(1), 16);
        const h3 = SH.Horse3D.createHorse(coatHex, silksHex, r.gate);
        h3.group.scale.setScalar(1.45);
        (world.horsesRoot || scene).add(h3.group);
        horses3.push(h3);
      });
    }
    const lat = [];
    for (let i = 0; i < n; i++) lat.push(-8 + 16 * (i / Math.max(1, n - 1)));

    // ---- カメラ ----
    const dirL = SH.RVCams.createL(course, D, world);
    const dirR = SH.RVCams.createR(course, D, world, ownIndex);

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

    // ---- ビネット(2560×720) ----
    const vig = document.createElement("canvas"); vig.width = DW; vig.height = DH;
    (function () { const c = vig.getContext("2d"); const g = c.createRadialGradient(DW / 2, DH / 2, DH * 0.5, DW / 2, DH / 2, DH * 1.05); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(8,10,16,.5)"); c.fillStyle = g; c.fillRect(0, 0, DW, DH); })();

    // ---- view 構造体 ----
    const view = {
      t: -PREROLL, speed: 3, raf: 0, done: false, phase: "live",
      lastOwnInView: null, passTime1000m: null, passHudUntil: 0,
      cancel: function () {
        view.done = true; cancelAnimationFrame(view.raf);
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

    // ---- 状態公開 ----
    SH._rvState = {
      viewMode: "single", qualityLevel: 0, hudPhase: "pre", hudAlpha: 0, elapsedSec: -PREROLL,
      remainM: D, distShown: D, rankOrder: field.runners.map(function (r, i) { return i; }),
      camL: null, camR: null, shotL: "L0", passTime1000m: null, passHudVisible: false, ownInViewSince: null,
    };
    function publishState(info) {
      const st = SH._rvState;
      st.viewMode = (info.dual) ? "dual" : "single";
      st.qualityLevel = 0;
      const p = info.p;
      st.hudPhase = p < P_HUD_ON ? "pre" : p < P_HUD_ON + DP_FADE ? "fadein" : "on";
      const u = SH.clamp((p - P_HUD_ON) / DP_FADE, 0, 1);
      st.hudAlpha = st.hudPhase === "pre" ? 0 : st.hudPhase === "on" ? 1 : 1 - (1 - u) * (1 - u);
      st.elapsedSec = view.t;
      st.remainM = info.R; st.distShown = Math.max(0, Math.ceil(info.R / 100) * 100);
      st.rankOrder = info.rankIdx.slice();
      st.camL = { mode: info.resL.mode, pos: info.resL.pos, tgt: info.resL.tgt, fl: info.resL.fl };
      st.camR = { type: info.resR.type, camIndex: info.resR.camIndex, pos: info.resR.pos, tgt: null, fl: info.resR.fl, empty: info.resR.empty };
      st.shotL = info.resL.mode;
      st.passTime1000m = view.passTime1000m;
      st.passHudVisible = (view.passTime1000m != null) && (view.t < view.passHudUntil) && (D >= 1600);
      st.ownInViewSince = view.lastOwnInView;
    }

    // ---- 3D 1フレーム描画 ----
    const _wd1 = new THREE.Vector3(), _wd2 = new THREE.Vector3();
    function render3D(t, dtWorld, replayFlag) {
      const pos = posAt(Math.max(0, t));
      const leadM = Math.max.apply(null, pos);
      const R = Math.max(0, D - leadM), p = D > 0 ? leadM / D : 0, packC = leadM - 8;
      const ownM = ownIndex >= 0 ? Math.min(pos[ownIndex], D + 40) : null;
      const rankIdx = pos.map(function (v, i) { return i; }).sort(function (a, b) { return pos[b] - pos[a]; });
      if (view.passTime1000m == null && leadM >= 1000) { view.passTime1000m = t; view.passHudUntil = t + 10.0; }

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

      // 馬(暫定)
      const targetLat = new Array(n);
      rankIdx.forEach(function (hi, rank) { targetLat[hi] = 7.5 - 15 * (rank / Math.max(1, n - 1)) * (t < 0 ? 1 : 0.85); });
      for (let i = 0; i < n; i++) lat[i] += (targetLat[i] - lat[i]) * 0.02;
      for (let i = 0; i < n; i++) {
        const h3 = horses3[i]; if (!h3) continue;
        const m = Math.min(pos[i], D + 40);
        const wp = course.pos(m, lat[i], 0);
        const running = t >= 0 && sim.times[i] > t;
        const phase = (m / 3.4) + i * 1.7;
        const h = course.heading(m);
        h3.group.visible = true;
        h3.pose(phase, running);
        h3.group.position.x = wp.x; h3.group.position.z = wp.z;
        h3.group.rotation.y = Math.atan2(-h.z, h.x);
      }

      world.updateVisibility(resL.camera.position, resR.camera.position);
      if (world.sOfM) world.applyTone(world.sOfM(leadM));
      world.scrollFx(dtWorld);

      const dual = (t >= 0 && !replayFlag);
      renderer.setScissorTest(true);
      if (dual) {
        resL.camera.aspect = VW / VH; resL.camera.updateProjectionMatrix();
        renderer.setViewport(0, 0, VW * q, DH * q); renderer.setScissor(0, 0, VW * q, DH * q);
        renderer.render(scene, resL.camera);
        renderer.setViewport(VW * q, 0, VW * q, DH * q); renderer.setScissor(VW * q, 0, VW * q, DH * q);
        renderer.render(scene, resR.camera);
      } else {
        resL.camera.aspect = DW / DH; resL.camera.updateProjectionMatrix();
        renderer.setViewport(0, 0, DW * q, DH * q); renderer.setScissor(0, 0, DW * q, DH * q);
        renderer.render(scene, resL.camera);
      }
      return { pos: pos, leadM: leadM, R: R, p: p, rankIdx: rankIdx, resL: resL, resR: resR, dual: dual };
    }

    // ============================================================
    // HUD / 番組フェーズ(2560×720。既存様式を座標転記)
    // ============================================================
    function banner(text, bg, fg) {
      octx.font = "bold 46px sans-serif";
      const tw = octx.measureText(text).width, bx = DW / 2 - tw / 2 - 30, by = 300;
      octx.fillStyle = bg; octx.fillRect(bx, by, tw + 60, 70);
      octx.strokeStyle = "rgba(255,255,255,.8)"; octx.lineWidth = 2.5; octx.strokeRect(bx, by, tw + 60, 70);
      octx.fillStyle = fg; octx.textAlign = "left"; octx.fillText(text, DW / 2 - tw / 2, by + 50);
    }

    function drawLiveHUD(info, dual) {
      octx.clearRect(0, 0, DW, DH);
      const p = info.p, R = info.R;
      const hudPhase = p < P_HUD_ON ? "pre" : p < P_HUD_ON + DP_FADE ? "fadein" : "on";
      const u = SH.clamp((p - P_HUD_ON) / DP_FADE, 0, 1);
      const a = hudPhase === "pre" ? 0 : hudPhase === "on" ? 1 : 1 - (1 - u) * (1 - u);

      // セパレータ(デュアル時のみ)
      if (dual) { octx.fillStyle = "#0a0e12"; octx.fillRect(1278, 0, 4, DH); }

      // H-1 上部帯
      if (a > 0) {
        const g = octx.createLinearGradient(0, 0, 0, 60); g.addColorStop(0, "#2f8f3a"); g.addColorStop(1, "#256f2c");
        octx.globalAlpha = 0.82 * a; octx.fillStyle = g; octx.fillRect(0, 0, DW, 60);
        octx.globalAlpha = 0.5 * a; octx.fillStyle = "rgba(180,230,170,1)"; octx.fillRect(0, 57, DW, 3);
        octx.globalAlpha = 1;
        // 残距離(帯右側)
        if (R > 0) {
          const show = Math.ceil(R / 100) * 100;
          octx.font = "bold 46px sans-serif"; octx.textAlign = "left"; octx.globalAlpha = a;
          octx.fillStyle = "#e03131"; octx.fillRect(1470, 8, 7, 44);
          octx.fillStyle = "#fff"; octx.fillRect(1470, 8, 7, 15); octx.fillRect(1470, 37, 7, 15);
          octx.lineWidth = 5; octx.strokeStyle = "#0c2a12"; octx.strokeText(String(show), 1490, 48);
          octx.fillStyle = "#fff"; octx.fillText(String(show), 1490, 48);
          octx.globalAlpha = 1;
        }
        // H-8 レース名(帯右端)
        octx.font = "bold 34px serif"; octx.textAlign = "right"; octx.globalAlpha = a;
        octx.fillStyle = "#fff"; octx.fillText(race.name + " 【" + gradeLabel(race.grade) + "】", DW - 24, 44);
        octx.textAlign = "left"; octx.globalAlpha = 1;
      }

      // H-6 経過タイム(左下)
      octx.font = "bold 40px sans-serif"; octx.fillStyle = "#fff"; octx.textAlign = "left";
      octx.shadowColor = "rgba(0,0,0,.55)"; octx.shadowBlur = 4;
      octx.fillText(fmtElapsed(Math.min(view.t, winTime)), 40, DH - 110);
      octx.shadowBlur = 0;

      // 隊列チップ(中央下・順位順)
      const Nchip = Math.min(n, 8), cw = 44, gap = 6, chH = 38, cy = DH - 58;
      const total = Nchip * (cw + gap);
      let x0 = DW / 2 - total / 2;
      octx.font = "bold 26px sans-serif"; octx.textAlign = "center";
      for (let s = 0; s < Nchip; s++) {
        const i = info.rankIdx[s]; if (i == null) continue; const r = field.runners[i]; const x = x0 + s * (cw + gap);
        octx.fillStyle = SH.WAKU_COLORS[r.waku - 1]; octx.fillRect(x, cy, cw, chH);
        if (r.kind === "owned") { octx.fillStyle = "#f76707"; octx.fillRect(x, cy - 18, cw, 18); octx.fillStyle = "#fff"; octx.font = "bold 16px sans-serif"; octx.fillText(String(s + 1), x + cw / 2, cy - 4); octx.font = "bold 26px sans-serif"; }
        octx.strokeStyle = "rgba(0,0,0,.45)"; octx.lineWidth = 1.5; octx.strokeRect(x, cy, cw, chH);
        octx.fillStyle = SH.WAKU_TEXT[r.waku - 1]; octx.fillText(String(r.gate), x + cw / 2, cy + 28);
      }
      octx.textAlign = "left";

      // 実況テロップ
      if (lastStory && view.t - lastStory.at < 4.5 && view.t > 0.4) {
        octx.font = "bold 28px sans-serif"; const tw = octx.measureText(lastStory.text).width; const bx = DW / 2 - tw / 2 - 18, by = DH - 120;
        octx.fillStyle = "rgba(6,10,18,.78)"; octx.fillRect(bx, by, tw + 36, 44);
        octx.fillStyle = "#ffd43b"; octx.fillRect(bx, by, 6, 44);
        octx.fillStyle = "#fff"; octx.fillText(lastStory.text, DW / 2 - tw / 2, by + 32);
      }

      octx.drawImage(vig, 0, 0);
      if (flash > 0) { octx.fillStyle = "rgba(255,255,255," + flash + ")"; octx.fillRect(0, 0, DW, DH); flash -= 0.06; }

      // フェーズバナー(全幅中央)
      if (view.t > winTime) {
        if (photoFinish && view.t < winTime + 1.8) banner("写真判定", "#fff", "#1a1a1a");
        else { const wr = field.runners[sim.order[0]]; banner("1着  " + wr.gate + " " + wr.name, SH.WAKU_COLORS[wr.waku - 1], SH.WAKU_TEXT[wr.waku - 1]); }
      } else if (view.t < 0) banner("各馬ゲートイン", "rgba(0,0,0,.6)", "#fff");
      else if (view.t < 1.2) banner("スタート！", "rgba(0,0,0,.6)", "#ffd43b");
    }

    function drawTitleCard(t) {
      octx.clearRect(0, 0, DW, DH);
      octx.save(); octx.translate((DW - 1280) / 2, 0);
      const W = 1280;
      octx.fillStyle = "rgba(8,12,22,.92)"; octx.fillRect(-640, 0, DW, DH);
      const gradeCol = race.grade === "G1" || race.grade === "WBC" || race.grade === "J-G1" ? "#1c7ed6" : race.grade === "G2" || race.grade === "J-G2" ? "#e03131" : race.grade === "G3" || race.grade === "J-G3" ? "#2f9e44" : "#555f6a";
      octx.fillStyle = gradeCol; octx.fillRect(0, 150, W, 8); octx.fillRect(0, 340, W, 8);
      octx.font = "bold 34px sans-serif"; octx.textAlign = "center"; octx.fillStyle = gradeCol === "#555f6a" ? "#c8d2dc" : gradeCol;
      octx.fillText(race.grade, W / 2, 205);
      octx.fillStyle = "#fff"; octx.font = "bold 62px sans-serif"; octx.fillText(race.name, W / 2, 285);
      octx.font = "26px sans-serif"; octx.fillStyle = "#c8d2dc";
      octx.fillText(race.course + "競馬場  " + race.surface + " " + race.dist + "m  馬場:" + field.condition + "  " + n + "頭立て" + (night ? "  (ナイター)" : ""), W / 2, 328);
      const mx = W / 2, my = 480, rx = 240, ry = 105;
      octx.strokeStyle = "rgba(255,255,255,.25)"; octx.lineWidth = 30; octx.beginPath(); octx.ellipse(mx, my, rx, ry, 0, 0, Math.PI * 2); octx.stroke();
      octx.strokeStyle = race.surface === "ダート" ? "#a5814a" : "#3f9142"; octx.lineWidth = 22; octx.beginPath(); octx.ellipse(mx, my, rx, ry, 0, 0, Math.PI * 2); octx.stroke();
      if (Math.sin(t * 5) > -0.3) { octx.fillStyle = "#ffd43b"; octx.font = "bold 30px sans-serif"; octx.fillText("まもなく発走", W / 2, 630); }
      octx.textAlign = "left"; octx.restore();
    }

    function drawReplayMark(t) {
      octx.fillStyle = "rgba(10,14,18,.82)"; octx.fillRect(DW - 258, 16, 240, 58);
      if (Math.sin(t * 6) > -0.2) { octx.fillStyle = "#e03131"; octx.beginPath(); octx.arc(DW - 228, 45, 11, 0, Math.PI * 2); octx.fill(); }
      octx.fillStyle = "#fff"; octx.font = "bold 32px sans-serif"; octx.textAlign = "left"; octx.fillText("REPLAY", DW - 204, 57);
    }

    function drawBoard(bt) {
      octx.clearRect(0, 0, DW, DH);
      octx.save(); octx.translate((DW - 1280) / 2, 0); const W = 1280, H = 720;
      octx.fillStyle = "rgba(5,9,20,.95)"; octx.fillRect(-640, 0, DW, DH);
      octx.fillStyle = "#101a30"; octx.fillRect(140, 60, W - 280, 78);
      octx.strokeStyle = "#3a4a66"; octx.lineWidth = 2; octx.strokeRect(140, 60, W - 280, 78);
      if (Math.sin(bt * 4) > -0.4) { octx.fillStyle = "#e03131"; octx.fillRect(170, 80, 96, 40); octx.fillStyle = "#fff"; octx.font = "bold 28px sans-serif"; octx.textAlign = "center"; octx.fillText("確定", 218, 110); }
      octx.fillStyle = "#fff"; octx.font = "bold 36px sans-serif"; octx.textAlign = "center"; octx.fillText(race.name + "  レース結果", W / 2 + 40, 112);
      octx.textAlign = "left";
      octx.fillStyle = "#ffd43b"; octx.font = "bold 30px sans-serif"; octx.fillText("勝ちタイム " + SH.RV2D.fmtTime(winTime), 170, 190);
      const rows = Math.min(5, sim.order.length);
      for (let k = 0; k < rows; k++) {
        const idx = sim.order[k], r = field.runners[idx], y = 226 + k * 84;
        octx.fillStyle = r.kind === "owned" ? "rgba(255,212,59,.12)" : "rgba(255,255,255,.05)"; octx.fillRect(140, y, W - 280, 72);
        octx.fillStyle = k === 0 ? "#ffd43b" : "#fff"; octx.font = "bold 42px sans-serif"; octx.textAlign = "center"; octx.fillText(String(k + 1), 190, y + 50);
        octx.fillStyle = SH.WAKU_COLORS[r.waku - 1]; octx.fillRect(240, y + 14, 46, 46);
        octx.fillStyle = SH.WAKU_TEXT[r.waku - 1]; octx.font = "bold 28px sans-serif"; octx.fillText(String(r.gate), 263, y + 48);
        octx.textAlign = "left"; octx.fillStyle = r.kind === "owned" ? "#ffd43b" : "#fff"; octx.font = "bold 32px sans-serif"; octx.fillText(r.name + (r.kind === "owned" ? " ★" : ""), 316, y + 48);
        octx.fillStyle = "#dbe4ee"; octx.font = "bold 26px sans-serif"; octx.fillText(SH.RV2D.fmtTime(sim.times[idx]), 830, y + 47);
        if (k > 0) { const d = sim.times[idx] - sim.times[sim.order[k - 1]]; octx.fillStyle = "#98a6b6"; octx.font = "24px sans-serif"; octx.fillText(SH.RV2D.marginLabel(d), 990, y + 47); }
      }
      octx.fillStyle = "#98a6b6"; octx.font = "22px sans-serif"; octx.textAlign = "center";
      if (Math.sin(bt * 3) > -0.3) octx.fillText("画面タップで払い戻しへ ▶", W / 2, 680);
      octx.textAlign = "left"; octx.restore();
    }

    // ---- 再生ループ ----
    let flash = 0, last = performance.now(), goalFlashed = false, replayT = 0, boardT = 0;
    function loop(now) {
      if (view.done) return;
      const el = Math.min(0.1, (now - last) / 1000); last = now;
      if (view.phase === "live") {
        let sp = view.speed;
        const posNow = posAt(Math.max(0, view.t)), leadNow = Math.max.apply(null, posNow);
        if (view.t >= 0 && D - leadNow < 90 && view.t < winTime) sp *= 0.32;
        if (view.t < 0) sp = 1;
        const dtWorld = el * sp; view.t += dtWorld;
        if (view.t < TITLE_END) {
          drawTitleCard(view.t);
        } else {
          const info = render3D(view.t, dtWorld, false);
          drawLiveHUD(info, info.dual);
          publishState(info);
        }
        pushStory(view.t + 0.8);
        if (!goalFlashed && view.t >= winTime) { flash = 0.85; goalFlashed = true; }
        const endT = goalTime + (photoFinish ? 3.4 : 2.4);
        if (view.t >= endT) { view.phase = "replay"; replayT = REPLAY_FROM; SH._rvState.viewMode = "single"; }
      } else if (view.phase === "replay") {
        const dtWorld = el * 1.2; replayT += dtWorld;
        render3D(replayT, dtWorld, true);
        octx.clearRect(0, 0, DW, DH); octx.drawImage(vig, 0, 0); drawReplayMark(replayT);
        if (replayT >= winTime + 0.8) { view.phase = "board"; boardT = 0; }
      } else {
        boardT += el; drawBoard(boardT);
        if (boardT >= 7) { view.done = true; setTimeout(onDone, 200); return; }
      }
      view.raf = requestAnimationFrame(loop);
    }
    view.raf = requestAnimationFrame(loop);
    return view;
  };
})(window.SH);
