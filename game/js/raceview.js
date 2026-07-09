// ============================================================
// raceview.js — 擬似3Dレース観戦ビュー(Canvas 2D + 透視投影)
//  ・楕円コースを3D空間として定義し、ピンホールカメラで投影
//  ・カメラ切替: ゲート正面 → 並走トラッキング → 直線正面 → ゴール定点
//  ・馬は向きで3種スプライト(横/正面/後ろ姿)を距離スケールで描画
//  ・中継オーバーレイ(レース名/残り距離/コースマップ/隊列)
// ============================================================
"use strict";
(function (SH) {
  const W = 960, H = 540;
  const PREROLL = 2.6;
  const FL = 620; // 焦点距離(px)

  // ---------- 3Dベクトル ----------
  function v3(x, y, z) { return { x: x, y: y, z: z }; }
  function vsub(a, b) { return v3(a.x - b.x, a.y - b.y, a.z - b.z); }
  function vdot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
  function vcross(a, b) { return v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x); }
  function vnorm(a) { const l = Math.sqrt(vdot(a, a)) || 1; return v3(a.x / l, a.y / l, a.z / l); }
  function vlerp(a, b, t) { return v3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t); }

  // ---------- コース幾何(反時計回りの楕円: 直線2+半円2) ----------
  const TRACK_HALF = 11;   // 馬場半幅(m)
  function makeCourse(D) {
    const R = 120, S = 450;
    const lap = 2 * S + 2 * Math.PI * R;
    const finishWS = S * 0.82;              // ゴール=ホームストレッチ終盤
    const startWS = finishWS - D;           // スタート(負値可・mod lapで解決)
    // 走破距離m(0..D) → コース上の点と進行方向
    function at(m) {
      let s = ((startWS + m) % lap + lap) % lap;
      if (s < S) return { x: -S / 2 + s, z: 0, hx: 1, hz: 0, s: s };
      s -= S;
      if (s < Math.PI * R) {
        const a = s / R;
        return { x: S / 2 + R * Math.sin(a), z: R - R * Math.cos(a), hx: Math.cos(a), hz: Math.sin(a), s: s + S };
      }
      s -= Math.PI * R;
      if (s < S) return { x: S / 2 - s, z: 2 * R, hx: -1, hz: 0, s: s + S + Math.PI * R };
      s -= S;
      const a = s / R;
      return { x: -S / 2 - R * Math.sin(a), z: R + R * Math.cos(a), hx: -Math.cos(a), hz: -Math.sin(a), s: 0 };
    }
    // 位置m・横位置lat(＋=内側)・高さy → ワールド座標
    function pos(m, lat, y) {
      const p = at(m);
      // 左法線(内馬場側): (-hz, hx)
      return v3(p.x - p.hz * lat, y || 0, p.z + p.hx * lat);
    }
    function heading(m) { const p = at(m); return v3(p.hx, 0, p.hz); }
    function lapFrac(m) { return (((startWS + m) % lap + lap) % lap) / lap; }
    return { at: at, pos: pos, heading: heading, lap: lap, lapFrac: lapFrac, finishFrac: finishWS / lap };
  }

  // ---------- 配色 ----------
  const COAT = {
    "鹿毛": "#8a5a2b", "黒鹿毛": "#5a3a1e", "栗毛": "#a86a2f", "栃栗毛": "#7c4a1d",
    "芦毛": "#c9c9cc", "青毛": "#3a3a42", "白毛": "#e8e4dc",
  };
  const COAT_KEYS = Object.keys(COAT);
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = SH.clamp((n >> 16) + amt, 0, 255), g = SH.clamp(((n >> 8) & 255) + amt, 0, 255), b = SH.clamp((n & 255) + amt, 0, 255);
    return "rgb(" + r + "," + g + "," + b + ")";
  }
  function skyColors(cond) {
    if (cond === "不良") return { top: "#3d4653", bot: "#6b7684", rain: 2 };
    if (cond === "重") return { top: "#5a6572", bot: "#8b95a0", rain: 1 };
    if (cond === "稍重") return { top: "#7891a8", bot: "#b8c4cc", rain: 0 };
    return { top: "#4f9fe0", bot: "#bfe3ff", rain: 0 };
  }
  function turfColors(surface, cond) {
    const wet = cond === "重" || cond === "不良";
    if (surface === "ダート") return { a: wet ? "#75563a" : "#b08d57", b: wet ? "#6a4d31" : "#a5814a", grass: wet ? "#2c6a33" : "#37853c" };
    return { a: wet ? "#2f7136" : "#3f9142", b: wet ? "#2a6530" : "#379036", grass: wet ? "#2c6a33" : "#37853c" };
  }

  // ---------- 馬スプライト(3方向) ----------
  // いずれも接地点(0,0)基準・馬体高さ≈40単位。scale=px/単位 flip=左向き
  function spriteSide(ctx, sc, flip, phase, coat, silks, gate, running) {
    ctx.save(); ctx.scale(flip ? -sc : sc, sc);
    const bob = running ? Math.sin(phase) * 2.2 : 0;
    ctx.fillStyle = "rgba(0,0,0,.28)";
    ctx.beginPath(); ctx.ellipse(0, -1, 30, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(0, -24 + bob);
    const dk = shade(coat, -28);
    function leg(ox, oy, ph, hind, col) {
      const a1 = Math.sin(ph) * (running ? 0.9 : 0.15) + (hind ? 0.35 : -0.25);
      const kx = ox + Math.sin(a1) * 9, ky = oy + Math.cos(a1) * 9;
      const a2 = a1 + Math.sin(ph + 1.2) * (running ? 0.8 : 0.1) * (hind ? 1 : -1);
      ctx.strokeStyle = col; ctx.lineWidth = 3.4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(kx, ky); ctx.lineTo(kx + Math.sin(a2) * 9, ky + Math.cos(a2) * 9); ctx.stroke();
    }
    leg(-14, 8, phase + Math.PI + 0.4, true, dk);
    leg(13, 8, phase + 0.9, false, dk);
    ctx.strokeStyle = dk; ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-24, -4); ctx.quadraticCurveTo(-33, -2 + Math.sin(phase * 0.7) * 3, -36, 6); ctx.stroke();
    ctx.fillStyle = coat;
    ctx.beginPath(); ctx.ellipse(0, -2, 25, 10.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-16, -3, 11, 9.5, 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(15, -4, 10, 9, -0.1, 0, Math.PI * 2); ctx.fill();
    const ny = running ? -10 : -14;
    ctx.beginPath();
    ctx.moveTo(16, -10); ctx.quadraticCurveTo(26, ny - 6, 33, ny - 2); ctx.lineTo(36, ny + 4);
    ctx.quadraticCurveTo(26, ny + 6, 18, 2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(37, ny + 1, 7.5, 4.2, 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(33, ny - 5); ctx.lineTo(35, ny - 10); ctx.lineTo(37, ny - 4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = dk; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(18, -9); ctx.quadraticCurveTo(27, ny - 5, 33, ny - 4); ctx.stroke();
    leg(-11, 8, phase + Math.PI, true, coat);
    leg(16, 8, phase, false, coat);
    // 騎手
    ctx.fillStyle = silks;
    ctx.beginPath(); ctx.moveTo(-2, -12); ctx.quadraticCurveTo(3, -24, 12, -20); ctx.lineTo(12, -13);
    ctx.quadraticCurveTo(4, -10, -2, -9); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = silks; ctx.lineWidth = 3.2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(9, -18); ctx.lineTo(20, -13); ctx.stroke();
    ctx.strokeStyle = "#f2f2f2"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(2, -11); ctx.lineTo(0, -2); ctx.stroke();
    ctx.fillStyle = "#e8c39e"; ctx.beginPath(); ctx.arc(12, -24, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = silks; ctx.beginPath(); ctx.arc(12, -25.5, 3.6, Math.PI, Math.PI * 2); ctx.fill();
    // ゼッケン
    ctx.fillStyle = "rgba(255,255,255,.95)"; ctx.fillRect(-12, -8, 13, 11);
    ctx.fillStyle = "#1a1a1a"; ctx.font = "bold 9px sans-serif"; ctx.textAlign = "center";
    ctx.save(); if (flip) { ctx.translate(-5.5, 1); ctx.scale(-1, 1); ctx.fillText(String(gate), 0, 0); }
    else ctx.fillText(String(gate), -5.5, 1);
    ctx.restore();
    ctx.textAlign = "left";
    ctx.restore();
  }

  function spriteFront(ctx, sc, phase, coat, silks, gate, running) {
    ctx.save(); ctx.scale(sc, sc);
    const sway = running ? Math.sin(phase) * 1.6 : 0;
    ctx.fillStyle = "rgba(0,0,0,.28)";
    ctx.beginPath(); ctx.ellipse(0, -1, 13, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(sway * 0.4, -22);
    const dk = shade(coat, -28);
    // 前脚(交互)
    ctx.strokeStyle = coat; ctx.lineWidth = 3.6; ctx.lineCap = "round";
    const l1 = running ? Math.sin(phase) * 4 : 0, l2 = running ? Math.sin(phase + Math.PI) * 4 : 0;
    ctx.beginPath(); ctx.moveTo(-5, 4); ctx.lineTo(-6 + l1 * 0.3, 20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5, 4); ctx.lineTo(6 + l2 * 0.3, 20); ctx.stroke();
    // 胸・胴
    ctx.fillStyle = coat;
    ctx.beginPath(); ctx.ellipse(0, 0, 13, 12, 0, 0, Math.PI * 2); ctx.fill();
    // 首・頭(正面)
    ctx.beginPath(); ctx.ellipse(0, -12, 7, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -16, 4.4, 7.5, 0, 0, Math.PI * 2); ctx.fill();
    // 鼻筋・耳
    ctx.fillStyle = shade(coat, 18);
    ctx.fillRect(-1.4, -20, 2.8, 9);
    ctx.fillStyle = coat;
    ctx.beginPath(); ctx.moveTo(-4, -22); ctx.lineTo(-5.5, -28); ctx.lineTo(-2, -23); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(4, -22); ctx.lineTo(5.5, -28); ctx.lineTo(2, -23); ctx.closePath(); ctx.fill();
    // 騎手(頭と肩が馬体の上に見える)
    ctx.fillStyle = silks;
    ctx.beginPath(); ctx.ellipse(0, -26, 8, 5.5, 0, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e8c39e"; ctx.beginPath(); ctx.arc(0, -30, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = silks; ctx.beginPath(); ctx.arc(0, -31.2, 3.6, Math.PI, Math.PI * 2); ctx.fill();
    // ゼッケン(胸前)
    ctx.fillStyle = "rgba(255,255,255,.95)"; ctx.fillRect(-6, 3, 12, 9);
    ctx.fillStyle = "#1a1a1a"; ctx.font = "bold 8px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(String(gate), 0, 10.5);
    ctx.textAlign = "left";
    ctx.restore();
  }

  function spriteRear(ctx, sc, phase, coat, silks, gate, running) {
    ctx.save(); ctx.scale(sc, sc);
    const sway = running ? Math.sin(phase) * 1.6 : 0;
    ctx.fillStyle = "rgba(0,0,0,.28)";
    ctx.beginPath(); ctx.ellipse(0, -1, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(sway * 0.4, -22);
    const dk = shade(coat, -28);
    ctx.strokeStyle = coat; ctx.lineWidth = 3.8; ctx.lineCap = "round";
    const l1 = running ? Math.sin(phase) * 4 : 0;
    ctx.beginPath(); ctx.moveTo(-6, 4); ctx.lineTo(-7 - l1 * 0.3, 20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6, 4); ctx.lineTo(7 + l1 * 0.3, 20); ctx.stroke();
    // 臀部
    ctx.fillStyle = coat;
    ctx.beginPath(); ctx.ellipse(0, 0, 14.5, 12.5, 0, 0, Math.PI * 2); ctx.fill();
    // 尾
    ctx.strokeStyle = dk; ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.quadraticCurveTo(sway, 6, sway * 1.5, 16); ctx.stroke();
    // 首の後ろ・頭頂
    ctx.fillStyle = coat;
    ctx.beginPath(); ctx.ellipse(0, -13, 6, 7, 0, 0, Math.PI * 2); ctx.fill();
    // 騎手の背中
    ctx.fillStyle = silks;
    ctx.beginPath(); ctx.ellipse(0, -24, 8.5, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e8c39e"; ctx.beginPath(); ctx.arc(0, -32, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = silks; ctx.beginPath(); ctx.arc(0, -33, 3.5, Math.PI, Math.PI * 2); ctx.fill();
    // ゼッケン(尻横)
    ctx.fillStyle = "rgba(255,255,255,.95)"; ctx.fillRect(-14, -6, 9, 9);
    ctx.fillStyle = "#1a1a1a"; ctx.font = "bold 8px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(String(gate), -9.5, 1);
    ctx.textAlign = "left";
    ctx.restore();
  }

  // ---------- ビュー本体 ----------
  SH.createRaceView = function (root, race, field, sim, onDone) {
    const canvas = SH.el("canvas", { width: String(W), height: String(H) });
    const wrap = SH.el("div", { class: "canvas-wrap tv" }, canvas);
    root.appendChild(wrap);
    const commentBox = SH.el("div", { class: "commentary" });
    root.appendChild(commentBox);
    const ctrl = SH.el("div", { class: "row" });
    root.appendChild(ctrl);

    const ctx = canvas.getContext("2d");
    const D = race.dist;
    const n = field.runners.length;
    const frames = sim.frames;
    const dtSim = frames.length > 1 ? frames[1].t - frames[0].t : 0.4;
    const sky = skyColors(field.condition);
    const turf = turfColors(race.surface, field.condition);
    const course = makeCourse(D);

    const coatOf = field.runners.map(function (r, i) {
      if (r.kind === "owned") return COAT[r.ref.coat] || COAT["鹿毛"];
      return COAT[COAT_KEYS[(i * 5 + r.name.length) % COAT_KEYS.length]];
    });
    // 横位置(＋=内ラチ側)。順位で内へ寄る
    const lat = [];
    for (let i = 0; i < n; i++) lat.push(-8 + 16 * (i / Math.max(1, n - 1)));

    let storyIdx = 0;
    function pushStory(upTo) {
      while (storyIdx < sim.story.length && sim.story[storyIdx].t <= upTo) {
        commentBox.insertBefore(SH.el("div", { class: "cline", text: "🎙 " + sim.story[storyIdx].text }), commentBox.firstChild);
        storyIdx++;
      }
    }

    const view = {
      t: -PREROLL, speed: 3, raf: 0, done: false,
      cancel: function () { view.done = true; cancelAnimationFrame(view.raf); },
    };
    [["×1.5", 1.5], ["×3", 3], ["×6", 6]].forEach(function (p) {
      ctrl.appendChild(SH.el("button", {
        class: "chip" + (view.speed === p[1] ? " on" : ""), text: p[0],
        onclick: function (e) {
          view.speed = p[1];
          SH.$$(".chip", ctrl).forEach(function (c) { c.classList.toggle("on", c === e.target); });
        },
      }));
    });
    ctrl.appendChild(SH.el("button", { class: "btn ghost", text: "スキップ ▶▶", onclick: function () { view.cancel(); onDone(); } }));

    function posAt(t) {
      if (t <= 0) return frames[0].pos.map(function () { return 0; });
      const fi = t / dtSim;
      const i0 = SH.clamp(Math.floor(fi), 0, frames.length - 1);
      const i1 = SH.clamp(i0 + 1, 0, frames.length - 1);
      const a = fi - i0;
      return frames[i0].pos.map(function (p, k) { return p + (frames[i1].pos[k] - p) * a; });
    }

    const finiteTimes = sim.times.filter(function (x) { return x < 900; });
    const goalTime = Math.max.apply(null, finiteTimes);
    const winTime = Math.min.apply(null, sim.times);
    const sorted = sim.times.slice().sort(function (a, b) { return a - b; });
    const photoFinish = (sorted[1] - sorted[0]) < 0.10;

    // ---------- カメラ ----------
    let camPos = null, camTgt = null, camMode = "";
    function computeCam(t, pos, leadM) {
      const remain = D - leadM;
      let mode, p, tg;
      if (t < 0) {
        mode = "gate";
        p = course.pos(16, 2, 2.4); tg = course.pos(0, 0, 1.4);
      } else if (remain > 520) {
        mode = "track";
        const packC = leadM - 8;
        p = course.pos(packC + 4, 42, 12); tg = course.pos(packC, 0, 1.5);
      } else if (remain > 130) {
        mode = "stretch";
        p = course.pos(D + 60, 7, 3.4); tg = course.pos(Math.min(leadM + 15, D + 20), 0, 1.8);
      } else {
        mode = "goal";
        p = course.pos(D - 34, 40, 10); tg = course.pos(Math.min(leadM, D + 12), 0, 1.5);
      }
      if (mode !== camMode) { camMode = mode; camPos = p; camTgt = tg; } // ハードカット
      else { camPos = vlerp(camPos, p, 0.14); camTgt = vlerp(camTgt, tg, 0.2); }
      // 基底
      const f = vnorm(vsub(camTgt, camPos));
      const up = v3(0, 1, 0);
      const r = vnorm(vcross(up, f));
      const u = vcross(f, r);
      return { pos: camPos, f: f, r: r, u: u, mode: mode };
    }
    function project(cam, P) {
      const d = vsub(P, cam.pos);
      const z = vdot(d, cam.f);
      if (z < 1.2) return null;
      return { x: W / 2 + vdot(d, cam.r) * FL / z, y: H * 0.52 - vdot(d, cam.u) * FL / z, z: z, s: FL / z };
    }

    // ---------- シーン描画 ----------
    function draw(t) {
      const pos = posAt(Math.max(0, t));
      const leadM = Math.max.apply(null, pos);
      const remain = Math.max(0, D - leadM);
      const cam = computeCam(t, pos, leadM);

      // 空
      const horizon = (function () {
        const fh = vnorm(v3(cam.f.x, 0, cam.f.z));
        const pr = project(cam, v3(cam.pos.x + fh.x * 8000, 0, cam.pos.z + fh.z * 8000));
        return pr ? pr.y : H * 0.3;
      })();
      const g = ctx.createLinearGradient(0, 0, 0, Math.max(horizon, 40));
      g.addColorStop(0, sky.top); g.addColorStop(1, sky.bot);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, Math.max(horizon, 0));
      ctx.fillStyle = "rgba(255,255,255,.5)";
      for (let c = 0; c < 4; c++) {
        const cx = (c * 260 + 90) % W, cy = horizon * (0.18 + c * 0.16);
        if (cy > horizon - 12) continue;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 58, 11, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + 42, cy + 5, 38, 9, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // 地面(芝生)
      ctx.fillStyle = turf.grass;
      ctx.fillRect(0, Math.max(horizon, 0), W, H - Math.max(horizon, 0));

      // 可視レンジ(先頭基準)
      const packC = t < 0 ? 0 : leadM - 8;
      let mFrom, mTo;
      if (cam.mode === "stretch") { mFrom = leadM - 260; mTo = D + 90; }
      else if (cam.mode === "goal") { mFrom = leadM - 220; mTo = D + 120; }
      else if (cam.mode === "gate") { mFrom = -60; mTo = 300; }
      else { mFrom = packC - 200; mTo = packC + 330; }

      // 馬場リボン(10m刻みの台形)
      for (let m = Math.floor(mFrom / 10) * 10; m < mTo; m += 10) {
        const q = [
          project(cam, course.pos(m, TRACK_HALF, 0)),
          project(cam, course.pos(m, -TRACK_HALF, 0)),
          project(cam, course.pos(m + 10.6, -TRACK_HALF, 0)),
          project(cam, course.pos(m + 10.6, TRACK_HALF, 0)),
        ];
        if (q.some(function (p) { return !p; })) continue;
        ctx.fillStyle = (Math.floor(m / 10) % 2 === 0) ? turf.a : turf.b;
        ctx.beginPath();
        ctx.moveTo(q[0].x, q[0].y);
        for (let k = 1; k < 4; k++) ctx.lineTo(q[k].x, q[k].y);
        ctx.closePath(); ctx.fill();
      }
      // 決勝線(白帯)
      (function () {
        const q = [
          project(cam, course.pos(D, TRACK_HALF, 0.02)),
          project(cam, course.pos(D, -TRACK_HALF, 0.02)),
          project(cam, course.pos(D + 0.9, -TRACK_HALF, 0.02)),
          project(cam, course.pos(D + 0.9, TRACK_HALF, 0.02)),
        ];
        if (q.some(function (p) { return !p; })) return;
        ctx.fillStyle = "rgba(255,255,255,.92)";
        ctx.beginPath(); ctx.moveTo(q[0].x, q[0].y);
        for (let k = 1; k < 4; k++) ctx.lineTo(q[k].x, q[k].y);
        ctx.closePath(); ctx.fill();
      })();

      // ラチ(内外の白柵: 支柱+上下2本のレール)
      [TRACK_HALF + 0.6, -(TRACK_HALF + 0.6)].forEach(function (railLat) {
        let prevTop = null, prevMid = null;
        for (let m = Math.floor(mFrom / 8) * 8; m < mTo; m += 8) {
          const base = project(cam, course.pos(m, railLat, 0));
          const top = project(cam, course.pos(m, railLat, 1.25));
          const mid = project(cam, course.pos(m, railLat, 0.7));
          if (base && top) {
            ctx.strokeStyle = "rgba(245,245,245,.95)"; ctx.lineWidth = Math.max(1, top.s * 0.08);
            ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke();
            if (prevTop) {
              ctx.beginPath(); ctx.moveTo(prevTop.x, prevTop.y); ctx.lineTo(top.x, top.y); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(prevMid.x, prevMid.y); ctx.lineTo(mid.x, mid.y); ctx.stroke();
            }
          }
          prevTop = top; prevMid = mid;
        }
      });

      // 収集して奥→手前に描くビルボード群
      const bills = [];

      // スタンド(ホームストレッチ外側)・内馬場の木
      for (let m = Math.floor(mFrom / 40) * 40; m < mTo; m += 40) {
        const fr = course.lapFrac(m);
        // ホームストレッチ判定(コース頭のS区間)
        const onHome = course.at(m).s < 450;
        if (onHome) {
          bills.push({ kind: "stand", m: m });
        } else if (Math.floor(m / 40) % 2 === 0) {
          bills.push({ kind: "tree", m: m });
        }
      }
      // ハロン棒(残り200mごと・内側)
      for (let k = 200; k < D; k += 200) {
        const m = D - k;
        if (m > mFrom && m < mTo) bills.push({ kind: "furlong", m: m, label: k });
      }
      // ゴール板
      if (D > mFrom && D < mTo) bills.push({ kind: "goalboard", m: D });
      // 発馬機
      if (0 > mFrom - 40 && 0 < mTo) bills.push({ kind: "gate", m: 0 });

      // 馬
      const rankIdx = pos.map(function (p, i) { return i; }).sort(function (a, b) { return pos[b] - pos[a]; });
      const targetLat = new Array(n);
      rankIdx.forEach(function (hi, rank) {
        targetLat[hi] = 7.5 - 15 * (rank / Math.max(1, n - 1)) * (t < 0 ? 1 : 0.85);
      });
      for (let i = 0; i < n; i++) lat[i] += (targetLat[i] - lat[i]) * 0.02;
      for (let i = 0; i < n; i++) bills.push({ kind: "horse", i: i, m: Math.min(pos[i], D + 40) });

      // 深度計算・ソート
      bills.forEach(function (b) {
        const wp = b.kind === "horse" ? course.pos(b.m, lat[b.i], 0) : course.pos(b.m, 0, 0);
        b.depth = vdot(vsub(wp, cam.pos), cam.f);
      });
      bills.sort(function (a, b) { return b.depth - a.depth; });

      bills.forEach(function (b) {
        if (b.kind === "stand") drawStand(cam, b.m);
        else if (b.kind === "tree") drawTree(cam, b.m);
        else if (b.kind === "furlong") drawFurlong(cam, b.m, b.label);
        else if (b.kind === "goalboard") drawGoalboard(cam);
        else if (b.kind === "gate") drawGates(cam, t);
        else drawRunner(cam, b.i, pos, rankIdx, t);
      });

      // 雨
      if (sky.rain) {
        ctx.strokeStyle = "rgba(220,230,240," + (sky.rain === 2 ? 0.5 : 0.3) + ")";
        ctx.lineWidth = 1;
        for (let i = 0; i < sky.rain * 70; i++) {
          const rx = Math.random() * W, ry = Math.random() * H;
          ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 4, ry + 14); ctx.stroke();
        }
      }

      drawOverlay(t, pos, rankIdx, remain);

      if (flash > 0) {
        ctx.fillStyle = "rgba(255,255,255," + flash + ")";
        ctx.fillRect(0, 0, W, H);
        flash -= 0.06;
      }
      if (t > winTime) {
        if (photoFinish && t < winTime + 1.8) banner("写真判定", "#fff", "#1a1a1a");
        else {
          const wr = field.runners[sim.order[0]];
          banner("1着  " + wr.gate + " " + wr.name, SH.WAKU_COLORS[wr.waku - 1], SH.WAKU_TEXT[wr.waku - 1]);
        }
      } else if (t < 0) banner("各馬ゲートイン", "rgba(0,0,0,.6)", "#fff");
      else if (t < 1.2) banner("スタート！", "rgba(0,0,0,.6)", "#ffd43b");
    }

    // ---------- 各種3Dオブジェクト ----------
    function drawStand(cam, m) {
      // 外側に観客スタンドの箱
      const c = [
        project(cam, course.pos(m, -(TRACK_HALF + 6), 0)),
        project(cam, course.pos(m + 38, -(TRACK_HALF + 6), 0)),
        project(cam, course.pos(m + 38, -(TRACK_HALF + 6), 13)),
        project(cam, course.pos(m, -(TRACK_HALF + 6), 13)),
      ];
      if (c.some(function (p) { return !p; })) return;
      ctx.fillStyle = "#70707e";
      ctx.beginPath(); ctx.moveTo(c[0].x, c[0].y);
      for (let k = 1; k < 4; k++) ctx.lineTo(c[k].x, c[k].y);
      ctx.closePath(); ctx.fill();
      // 屋根
      ctx.fillStyle = "#d9dade";
      ctx.beginPath();
      ctx.moveTo(c[3].x, c[3].y); ctx.lineTo(c[2].x, c[2].y);
      ctx.lineTo(c[2].x, c[2].y - c[2].s * 2.2); ctx.lineTo(c[3].x, c[3].y - c[3].s * 2.2);
      ctx.closePath(); ctx.fill();
      // 観客ドット(決定的配置)
      const x0 = Math.min(c[0].x, c[1].x), x1 = Math.max(c[0].x, c[1].x);
      const yTop = Math.min(c[2].y, c[3].y), yBot = Math.max(c[0].y, c[1].y);
      if (x1 - x0 > 30 && yBot - yTop > 14) {
        const cols = ["#e5c07b", "#bf616a", "#88c0d0", "#a3be8c", "#d8dee9", "#b48ead"];
        for (let i = 0; i < 90; i++) {
          const fx = ((i * 37 + m * 13) % 97) / 97, fy = ((i * 53 + m * 7) % 89) / 89;
          ctx.fillStyle = cols[i % 6];
          ctx.fillRect(x0 + fx * (x1 - x0), yTop + 4 + fy * (yBot - yTop - 8), 2, 2.6);
        }
      }
    }
    function drawTree(cam, m) {
      const base = project(cam, course.pos(m, TRACK_HALF + 16, 0));
      if (!base) return;
      const s = base.s;
      ctx.fillStyle = "#5a3d20";
      ctx.fillRect(base.x - s * 0.18, base.y - s * 2.4, s * 0.36, s * 2.4);
      ctx.fillStyle = "#2e6b34";
      ctx.beginPath(); ctx.ellipse(base.x, base.y - s * 3.6, s * 1.7, s * 1.9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#357a3c";
      ctx.beginPath(); ctx.ellipse(base.x - s * 0.7, base.y - s * 3.1, s * 1.0, s * 1.1, 0, 0, Math.PI * 2); ctx.fill();
    }
    function drawFurlong(cam, m, label) {
      const base = project(cam, course.pos(m, TRACK_HALF + 1.6, 0));
      const top = project(cam, course.pos(m, TRACK_HALF + 1.6, 2.6));
      if (!base || !top) return;
      ctx.strokeStyle = "#fff"; ctx.lineWidth = Math.max(1.5, top.s * 0.10);
      ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke();
      ctx.fillStyle = "#d33333";
      ctx.beginPath(); ctx.arc(top.x, top.y - top.s * 0.32, Math.max(2.5, top.s * 0.34), 0, Math.PI * 2); ctx.fill();
      if (top.s > 7) {
        ctx.fillStyle = "#fff"; ctx.font = "bold " + Math.max(9, top.s * 0.5) + "px sans-serif";
        ctx.fillText(String(label), top.x + top.s * 0.4, top.y - top.s * 0.2);
      }
    }
    function drawGoalboard(cam) {
      const base = project(cam, course.pos(D, TRACK_HALF + 2.2, 0));
      const top = project(cam, course.pos(D, TRACK_HALF + 2.2, 4.2));
      if (!base || !top) return;
      const s = top.s;
      ctx.strokeStyle = "#c9312e"; ctx.lineWidth = Math.max(2, s * 0.14);
      ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.fillRect(top.x - s * 1.7, top.y - s * 1.1, s * 3.4, s * 1.1);
      ctx.strokeStyle = "#c9312e"; ctx.lineWidth = 1.5;
      ctx.strokeRect(top.x - s * 1.7, top.y - s * 1.1, s * 3.4, s * 1.1);
      ctx.fillStyle = "#c9312e"; ctx.font = "bold " + Math.max(8, s * 0.72) + "px sans-serif";
      ctx.textAlign = "center"; ctx.fillText("GOAL", top.x, top.y - s * 0.28); ctx.textAlign = "left";
    }
    function drawGates(cam, t) {
      // 発馬機: 各枠のボックス
      const open = t >= 0 ? Math.min(1, t * 3) : 0;
      for (let i = 0; i < n; i++) {
        const gl = -8 + 16 * (i / Math.max(1, n - 1));
        const base = project(cam, course.pos(-1.2, gl, 0));
        const top = project(cam, course.pos(-1.2, gl, 2.1));
        if (!base || !top) continue;
        const s = top.s;
        ctx.fillStyle = "rgba(150,158,168,.9)";
        ctx.fillRect(top.x - s * 0.75, top.y, s * 1.5, base.y - top.y);
        ctx.strokeStyle = "#7d858e"; ctx.lineWidth = Math.max(1, s * 0.06);
        ctx.strokeRect(top.x - s * 0.75, top.y, s * 1.5, base.y - top.y);
        if (open < 1) { // 扉
          ctx.fillStyle = "rgba(190,196,204," + (1 - open) + ")";
          ctx.fillRect(top.x - s * 0.75 + open * s * 0.7, top.y, s * 0.4, base.y - top.y);
        }
      }
    }

    function drawRunner(cam, i, pos, rankIdx, t) {
      const r = field.runners[i];
      const m = Math.min(pos[i], D + 40);
      const wp = course.pos(m, lat[i], 0);
      const pr = project(cam, wp);
      if (!pr || pr.x < -120 || pr.x > W + 120) return;
      const running = t >= 0 && sim.times[i] > t;
      const phase = (m / 3.4) + i * 1.7;
      const h = course.heading(m);
      const frontness = vdot(h, cam.f);        // -1=こちらへ向かってくる
      const sideness = vdot(h, cam.r);         // +=画面右へ進む
      const sc = pr.s * 0.062;                 // 馬体高さ≈2.5m→40単位
      ctx.save();
      ctx.translate(pr.x, pr.y);
      if (frontness < -0.72) spriteFront(ctx, sc, phase, coatOf[i], SH.WAKU_COLORS[r.waku - 1], r.gate, running);
      else if (frontness > 0.72) spriteRear(ctx, sc, phase, coatOf[i], SH.WAKU_COLORS[r.waku - 1], r.gate, running);
      else spriteSide(ctx, sc, sideness < 0, phase, coatOf[i], SH.WAKU_COLORS[r.waku - 1], r.gate, running);
      ctx.restore();
      // 馬名(先頭3頭+自馬)
      const rank = rankIdx.indexOf(i);
      if ((rank < 3 || r.kind === "owned") && t >= 0 && pr.s > 5) {
        ctx.font = "bold 15px sans-serif";
        const tw = ctx.measureText(r.name).width;
        const ny = pr.y - 46 * sc - 10;
        ctx.fillStyle = "rgba(0,0,0,.55)";
        ctx.fillRect(pr.x - tw / 2 - 5, ny - 15, tw + 10, 20);
        ctx.fillStyle = r.kind === "owned" ? "#ffd43b" : "#fff";
        ctx.fillText(r.name, pr.x - tw / 2, ny);
      }
    }

    // ---------- オーバーレイ ----------
    function banner(text, bg, fg) {
      ctx.font = "bold 34px sans-serif";
      const tw = ctx.measureText(text).width;
      const bx = W / 2 - tw / 2 - 24, by = 210;
      ctx.fillStyle = bg; ctx.fillRect(bx, by, tw + 48, 54);
      ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, tw + 48, 54);
      ctx.fillStyle = fg; ctx.fillText(text, W / 2 - tw / 2, by + 39);
    }

    function drawOverlay(t, pos, rankIdx, remain) {
      const gradeCol = race.grade === "G1" || race.grade === "WBC" || race.grade === "J-G1" ? "#1c7ed6"
        : race.grade === "G2" || race.grade === "J-G2" ? "#e03131"
          : race.grade === "G3" || race.grade === "J-G3" ? "#2f9e44" : "#555f6a";
      ctx.font = "bold 22px sans-serif";
      const nameW = ctx.measureText(race.name).width;
      ctx.fillStyle = "rgba(10,14,18,.82)";
      ctx.fillRect(14, 12, Math.max(330, nameW + 130), 66);
      ctx.fillStyle = gradeCol;
      ctx.fillRect(14, 12, 7, 66);
      ctx.fillRect(30, 20, 58, 26);
      ctx.fillStyle = "#fff"; ctx.font = "bold 18px sans-serif";
      ctx.fillText(race.grade, 38, 40);
      ctx.font = "bold 22px sans-serif";
      ctx.fillText(race.name, 98, 41);
      ctx.font = "15px sans-serif"; ctx.fillStyle = "#c8d2dc";
      ctx.fillText(race.course + " " + race.surface + race.dist + "m  馬場:" + field.condition, 30, 68);

      if (t < 0) return;
      ctx.fillStyle = "rgba(10,14,18,.82)";
      ctx.fillRect(W - 196, 12, 182, 46);
      ctx.fillStyle = "#ffd43b"; ctx.font = "bold 27px sans-serif";
      const remShow = remain <= 0 ? "GOAL" : "残り " + (Math.ceil(remain / 10) * 10) + "m";
      ctx.fillText(remShow, W - 184, 45);

      // コースマップ(コース幾何と連動)
      const mx = W - 96, my = 128, rx = 70, ry = 34;
      ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.ellipse(mx, my, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.78)"; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.ellipse(mx, my, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      function mapTheta(frac) { return Math.PI / 2 + frac * Math.PI * 2; } // ホーム直線=下辺
      const fTh = mapTheta(course.finishFrac);
      ctx.fillStyle = "#c9312e";
      ctx.save();
      ctx.translate(mx + rx * Math.cos(fTh), my + ry * Math.sin(fTh));
      ctx.fillRect(-2, -7, 4, 14);
      ctx.restore();
      for (let k = Math.min(n, 18) - 1; k >= 0; k--) {
        const i = rankIdx[k];
        const th = mapTheta(course.lapFrac(pos[i]));
        const r = field.runners[i];
        ctx.fillStyle = SH.WAKU_COLORS[r.waku - 1];
        ctx.beginPath(); ctx.arc(mx + rx * Math.cos(th), my + ry * Math.sin(th), k === 0 ? 5 : 4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 1; ctx.stroke();
      }

      // 現在の隊列チップ
      const show = Math.min(n, 18);
      const cw = 30, ch = 30, pad = 4;
      const total = show * (cw + pad);
      const x0 = W / 2 - total / 2;
      ctx.fillStyle = "rgba(10,14,18,.75)";
      ctx.fillRect(x0 - 10, H - 46, total + 20, 40);
      ctx.font = "bold 15px sans-serif";
      for (let k = 0; k < show; k++) {
        const i = rankIdx[k];
        const r = field.runners[i];
        const x = x0 + k * (cw + pad);
        ctx.fillStyle = SH.WAKU_COLORS[r.waku - 1];
        ctx.fillRect(x, H - 40, cw, ch);
        if (r.kind === "owned") { ctx.strokeStyle = "#ffd43b"; ctx.lineWidth = 3; ctx.strokeRect(x, H - 40, cw, ch); }
        ctx.fillStyle = SH.WAKU_TEXT[r.waku - 1];
        const s2 = String(r.gate);
        ctx.fillText(s2, x + cw / 2 - ctx.measureText(s2).width / 2, H - 19);
      }
      ctx.fillStyle = "#b8c2cc"; ctx.font = "11px sans-serif";
      ctx.fillText("現在の隊列 →", x0 - 8, H - 50);
    }

    // ---------- 再生ループ ----------
    let flash = 0;
    let last = performance.now();
    let goalFlashed = false;
    function loop(now) {
      if (view.done) return;
      const el = Math.min(0.1, (now - last) / 1000);
      last = now;
      let sp = view.speed;
      const posNow = posAt(Math.max(0, view.t));
      const leadNow = Math.max.apply(null, posNow);
      if (view.t >= 0 && D - leadNow < 90 && view.t < winTime) sp *= 0.32; // ゴール前スロー
      if (view.t < 0) sp = 1;
      view.t += el * sp;

      draw(view.t);
      pushStory(view.t + 0.8);

      if (!goalFlashed && view.t >= winTime) { flash = 0.85; goalFlashed = true; }

      const endT = goalTime + (photoFinish ? 3.4 : 2.4);
      if (view.t >= endT) {
        view.done = true;
        setTimeout(onDone, 300);
        return;
      }
      view.raf = requestAnimationFrame(loop);
    }
    view.raf = requestAnimationFrame(loop);
    return view;
  };
})(window.SH);
