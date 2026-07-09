// ============================================================
// raceview.js — テレビ中継風レース観戦ビュー(Canvas 2D)
//  ・ギャロップアニメ付き馬スプライト(騎手は枠色の勝負服)
//  ・空/スタンド/ラチ/芝目の多層背景+パララックス
//  ・中継オーバーレイ(レース名/残り距離/隊列/コースマップ)
//  ・ゲートイン→スタート、直線ズーム、ゴール前スロー、写真判定
// ============================================================
"use strict";
(function (SH) {
  const W = 960, H = 540;              // 16:9(CSSで縮尺)
  const TRACK_TOP = 300;               // 馬場の上端(遠いラチ)
  const TRACK_BOT = 512;               // 馬場の下端(手前)
  const PREROLL = 2.6;                 // ゲートイン演出秒数

  // 毛色パレット
  const COAT = {
    "鹿毛": "#8a5a2b", "黒鹿毛": "#5a3a1e", "栗毛": "#a86a2f", "栃栗毛": "#7c4a1d",
    "芦毛": "#c9c9cc", "青毛": "#3a3a42", "白毛": "#e8e4dc",
  };
  const COAT_KEYS = Object.keys(COAT);

  // 空・馬場の配色(馬場状態別)
  function skyColors(cond) {
    if (cond === "不良") return { top: "#3d4653", bot: "#6b7684", rain: 2 };
    if (cond === "重") return { top: "#5a6572", bot: "#8b95a0", rain: 1 };
    if (cond === "稍重") return { top: "#7891a8", bot: "#b8c4cc", rain: 0 };
    return { top: "#5aa7e8", bot: "#bfe3ff", rain: 0 };
  }
  function turfColors(surface, cond) {
    if (surface === "ダート") {
      const wet = cond === "重" || cond === "不良";
      return { a: wet ? "#7a5a38" : "#b08d57", b: wet ? "#6e5030" : "#a6824c" };
    }
    const wet = cond === "重" || cond === "不良";
    return { a: wet ? "#2f7136" : "#3f9142", b: wet ? "#2a6530" : "#389038" };
  }

  // ---------- 馬スプライト ----------
  // x,y=接地基準点 scale=遠近 phase=歩様位相 coat=毛色 silks=勝負服色 capText=帽色文字
  function drawHorse(ctx, x, y, scale, phase, coat, silks, silksText, gate, running) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    const bob = running ? Math.sin(phase) * 2.2 : 0;

    // 影
    ctx.fillStyle = "rgba(0,0,0,.28)";
    ctx.beginPath(); ctx.ellipse(0, 3, 30, 5, 0, 0, Math.PI * 2); ctx.fill();

    ctx.translate(0, -22 + bob);

    // 脚(奥2本を先に描く) — 襲歩: 前脚と後脚で位相をずらす
    function leg(ox, oy, ph, hind, dark) {
      const a1 = Math.sin(ph) * (running ? 0.9 : 0.15) + (hind ? 0.35 : -0.25);
      const kx = ox + Math.sin(a1) * 9, ky = oy + Math.cos(a1) * 9;
      const a2 = a1 + Math.sin(ph + 1.2) * (running ? 0.8 : 0.1) * (hind ? 1 : -1);
      const fx = kx + Math.sin(a2) * 9, fy = ky + Math.cos(a2) * 9;
      ctx.strokeStyle = dark; ctx.lineWidth = 3.4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
    }
    const dk = shade(coat, -28);
    leg(-14, 8, phase + Math.PI + 0.4, true, dk);
    leg(13, 8, phase + 0.9, false, dk);

    // 尾
    ctx.strokeStyle = dk; ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-24, -4);
    ctx.quadraticCurveTo(-33, -2 + Math.sin(phase * 0.7) * 3, -36, 6);
    ctx.stroke();

    // 胴体
    ctx.fillStyle = coat;
    ctx.beginPath(); ctx.ellipse(0, -2, 25, 10.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-16, -3, 11, 9.5, 0.15, 0, Math.PI * 2); ctx.fill(); // 臀部
    ctx.beginPath(); ctx.ellipse(15, -4, 10, 9, -0.1, 0, Math.PI * 2); ctx.fill();   // 胸

    // 首・頭(走行時は前傾)
    const ny = running ? -10 : -14;
    ctx.beginPath();
    ctx.moveTo(16, -10);
    ctx.quadraticCurveTo(26, ny - 6, 33, ny - 2);
    ctx.lineTo(36, ny + 4);
    ctx.quadraticCurveTo(26, ny + 6, 18, 2);
    ctx.closePath(); ctx.fill();
    // 頭
    ctx.beginPath(); ctx.ellipse(37, ny + 1, 7.5, 4.2, 0.5, 0, Math.PI * 2); ctx.fill();
    // 耳
    ctx.beginPath(); ctx.moveTo(33, ny - 5); ctx.lineTo(35, ny - 10); ctx.lineTo(37, ny - 4); ctx.closePath(); ctx.fill();
    // たてがみ
    ctx.strokeStyle = dk; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(18, -9); ctx.quadraticCurveTo(27, ny - 5, 33, ny - 4); ctx.stroke();

    // 手前の脚2本
    leg(-11, 8, phase + Math.PI, true, coat);
    leg(16, 8, phase, false, coat);

    // 騎手(前傾姿勢・勝負服=枠色)
    ctx.fillStyle = silks;
    ctx.beginPath(); // 胴
    ctx.moveTo(-2, -12);
    ctx.quadraticCurveTo(3, -24, 12, -20);
    ctx.lineTo(12, -13);
    ctx.quadraticCurveTo(4, -10, -2, -9);
    ctx.closePath(); ctx.fill();
    // 腕
    ctx.strokeStyle = silks; ctx.lineWidth = 3.2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(9, -18); ctx.lineTo(20, -13); ctx.stroke();
    // 脚
    ctx.strokeStyle = "#f2f2f2"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(2, -11); ctx.lineTo(0, -2); ctx.stroke();
    // 頭・帽(枠色)
    ctx.fillStyle = "#e8c39e";
    ctx.beginPath(); ctx.arc(12, -24, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = silks;
    ctx.beginPath(); ctx.arc(12, -25.5, 3.6, Math.PI, Math.PI * 2); ctx.fill();

    // ゼッケン(馬番)
    ctx.fillStyle = "rgba(255,255,255,.95)";
    ctx.fillRect(-12, -8, 13, 11);
    ctx.fillStyle = "#1a1a1a"; ctx.font = "bold 9px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(String(gate), -5.5, 1);
    ctx.textAlign = "left";
    ctx.restore();
  }

  // 色を明暗シフト
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = SH.clamp((n >> 16) + amt, 0, 255), g = SH.clamp(((n >> 8) & 255) + amt, 0, 255), b = SH.clamp((n & 255) + amt, 0, 255);
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  // ---------- ビュー本体 ----------
  // root: 追加先要素 / onDone: 再生終了時
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

    // 各馬の描画属性
    const coatOf = field.runners.map(function (r, i) {
      if (r.kind === "owned") return COAT[r.ref.coat] || COAT["鹿毛"];
      return COAT[COAT_KEYS[(i * 5 + r.name.length) % COAT_KEYS.length]];
    });
    const laneY = [];   // 現在の描画y(慣性つき)
    const laneScale = [];
    for (let i = 0; i < n; i++) {
      laneY.push(TRACK_TOP + 34 + (TRACK_BOT - TRACK_TOP - 60) * (i / Math.max(1, n - 1)));
      laneScale.push(1);
    }

    // コーナー区間(視覚演出用): [開始m, 終了m]
    const corners = [];
    if (D >= 1800) corners.push([D * 0.18, D * 0.36]);
    corners.push([Math.max(0, D - 1000), Math.max(0, D - 520)]);

    function cornerBend(m) { // その地点の「曲がり」量 0〜1
      let b = 0;
      corners.forEach(function (c) {
        if (m > c[0] && m < c[1]) {
          const t = (m - c[0]) / (c[1] - c[0]);
          b = Math.max(b, Math.sin(t * Math.PI));
        }
      });
      return b;
    }

    // 実況
    let storyIdx = 0;
    function pushStory(upTo) {
      while (storyIdx < sim.story.length && sim.story[storyIdx].t <= upTo) {
        commentBox.insertBefore(SH.el("div", { class: "cline", text: "🎙 " + sim.story[storyIdx].text }), commentBox.firstChild);
        storyIdx++;
      }
    }

    // 再生状態
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

    // フレーム補間: 時刻t → 各馬位置
    function posAt(t) {
      if (t <= 0) return frames[0].pos.map(function () { return 0; });
      const fi = t / dtSim;
      const i0 = SH.clamp(Math.floor(fi), 0, frames.length - 1);
      const i1 = SH.clamp(i0 + 1, 0, frames.length - 1);
      const a = fi - i0;
      return frames[i0].pos.map(function (p, k) { return p + (frames[i1].pos[k] - p) * a; });
    }

    const goalTime = Math.max.apply(null, sim.times.filter(function (x) { return x < 900; }));
    const winTime = Math.min.apply(null, sim.times);
    const margin12 = (function () {
      const s = sim.times.slice().sort(function (a, b) { return a - b; });
      return s[1] - s[0];
    })();
    const photoFinish = margin12 < 0.10;

    let camX = -80, camSpan = 200;
    let flash = 0;

    function draw(t) {
      const pos = posAt(Math.max(0, t));
      const lead = Math.max.apply(null, pos);
      const remain = Math.max(0, D - lead);

      // ---- カメラ ----
      let targetSpan = 200;                      // 馬群が見分けられる寄り気味の画角
      if (remain < 550) targetSpan = 160;        // 直線でズーム
      if (remain < 120) targetSpan = 125;        // ゴール前さらに
      if (t < 0) targetSpan = 140;               // ゲートイン
      camSpan += (targetSpan - camSpan) * 0.04;
      const targetCam = SH.clamp(lead - camSpan * 0.68, -camSpan * 0.4, D - camSpan + 80);
      camX += (targetCam - camX) * 0.12;
      const xOf = function (m) { return (m - camX) / camSpan * W; };
      const mPerPx = camSpan / W;

      // ---- 空 ----
      const g = ctx.createLinearGradient(0, 0, 0, TRACK_TOP);
      g.addColorStop(0, sky.top); g.addColorStop(1, sky.bot);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, TRACK_TOP);
      // 雲(パララックス0.15)
      ctx.fillStyle = "rgba(255,255,255,.5)";
      for (let c = 0; c < 5; c++) {
        const cx = ((c * 700 + 300 - camX * 0.15 / mPerPx * 0.15) % (W + 400) + W + 400) % (W + 400) - 200;
        ctx.beginPath();
        ctx.ellipse(cx, 40 + c * 22, 60, 12, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + 40, 46 + c * 22, 40, 10, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // ---- 遠景(スタンド or 林) パララックス0.35 ----
      const bgShift = camX * 0.35 / mPerPx * mPerPx; // px換算
      const nearGoal = camX > D - 900;
      const nearStart = camX < 500;
      if (nearGoal || nearStart) {
        // 観客スタンド
        ctx.fillStyle = "#6f6f7c";
        ctx.fillRect(0, TRACK_TOP - 96, W, 96);
        ctx.fillStyle = "#8d8d9c";
        ctx.fillRect(0, TRACK_TOP - 96, W, 12);
        // 屋根
        ctx.fillStyle = "#d9dade";
        ctx.beginPath(); ctx.moveTo(0, TRACK_TOP - 96); ctx.lineTo(60, TRACK_TOP - 130); ctx.lineTo(W - 60, TRACK_TOP - 130); ctx.lineTo(W, TRACK_TOP - 96); ctx.closePath(); ctx.fill();
        // 観客(色ノイズ・決定的に配置)
        for (let i = 0; i < 700; i++) {
          const px = (i * 37) % W, py = TRACK_TOP - 78 + ((i * 53) % 66);
          ctx.fillStyle = ["#e5c07b", "#bf616a", "#88c0d0", "#a3be8c", "#d8dee9", "#b48ead"][i % 6];
          ctx.fillRect(px, py, 2.4, 3.2);
        }
      } else {
        // 内馬場の林・丘
        ctx.fillStyle = "#2e6b34";
        for (let c = 0; c < 30; c++) {
          const tx = ((c * 160 - bgShift) % (W + 300) + W + 300) % (W + 300) - 150;
          ctx.beginPath(); ctx.ellipse(tx, TRACK_TOP - 16, 46, 26, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = "#276029";
        ctx.fillRect(0, TRACK_TOP - 10, W, 10);
      }

      // ---- コーナー演出: 遠ラチが弧を描く ----
      const bend = cornerBend(camX + camSpan * 0.5);

      // ---- 馬場 ----
      ctx.fillStyle = turf.a;
      ctx.fillRect(0, TRACK_TOP, W, TRACK_BOT - TRACK_TOP + (H - TRACK_BOT));
      // 芝目(20m幅の刈り込み) / ダートはハロー目
      for (let m = Math.floor(camX / 20) * 20; m < camX + camSpan + 20; m += 40) {
        const x0 = xOf(m), x1 = xOf(m + 20);
        ctx.fillStyle = turf.b;
        ctx.fillRect(x0, TRACK_TOP, x1 - x0, H - TRACK_TOP);
      }
      // 遠ラチ(白柵) — コーナーでは弧
      ctx.strokeStyle = "#f5f5f5"; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let px = 0; px <= W; px += 16) {
        const m = camX + px * mPerPx;
        const dy = -cornerBend(m) * 26;
        if (px === 0) ctx.moveTo(px, TRACK_TOP + 8 + dy); else ctx.lineTo(px, TRACK_TOP + 8 + dy);
      }
      ctx.stroke();
      // 柵の支柱
      for (let m = Math.floor(camX / 25) * 25; m < camX + camSpan; m += 25) {
        const x = xOf(m);
        const dy = -cornerBend(m) * 26;
        ctx.strokeStyle = "#e8e8e8"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, TRACK_TOP + 8 + dy); ctx.lineTo(x, TRACK_TOP + 20 + dy); ctx.stroke();
      }

      // ハロン棒(残り200mごと)
      ctx.font = "bold 13px sans-serif";
      for (let m = 200; m < D; m += 200) {
        const worldM = D - m;
        const x = xOf(worldM);
        if (x < -30 || x > W + 30) continue;
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x, TRACK_TOP - 2); ctx.lineTo(x, TRACK_TOP - 30); ctx.stroke();
        ctx.fillStyle = "#d33";
        ctx.beginPath(); ctx.arc(x, TRACK_TOP - 34, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.9)";
        ctx.fillText(m + "", x - 12, TRACK_TOP - 46);
      }

      // スタートゲート
      const gx0 = xOf(0);
      if (gx0 > -80 && gx0 < W + 80) drawGate(gx0, t);

      // ゴール板
      const gx = xOf(D);
      if (gx > -60 && gx < W + 60) {
        ctx.fillStyle = "#c9312e";
        ctx.fillRect(gx - 2, TRACK_TOP - 70, 4, TRACK_BOT - TRACK_TOP + 70);
        ctx.fillStyle = "#fff";
        for (let y = TRACK_TOP - 70; y < TRACK_BOT; y += 16) ctx.fillRect(gx - 2, y, 4, 8);
        // 決勝審判塔
        ctx.fillStyle = "#f0f0f0";
        ctx.fillRect(gx + 6, TRACK_TOP - 64, 26, 34);
        ctx.fillStyle = "#333";
        ctx.fillRect(gx + 10, TRACK_TOP - 58, 18, 12);
        ctx.fillStyle = "#c9312e"; ctx.font = "bold 12px sans-serif";
        ctx.fillText("GOAL", gx + 5, TRACK_TOP - 68);
      }

      // ---- 馬(奥→手前の順に描画) ----
      // 現在順位 → 目標レーン(先頭が奥=ラチ沿い)
      const rankIdx = pos.map(function (p, i) { return i; }).sort(function (a, b) { return pos[b] - pos[a]; });
      const targetY = new Array(n);
      const spread = t < 0 ? 1.0 : SH.clamp(1.0 - (lead / D) * 0.35, 0.62, 1.0); // 進むほど縦に密集
      rankIdx.forEach(function (hi, rank) {
        targetY[hi] = TRACK_TOP + 40 + (TRACK_BOT - TRACK_TOP - 70) * (rank / Math.max(1, n - 1)) * spread;
      });
      for (let i = 0; i < n; i++) laneY[i] += (targetY[i] - laneY[i]) * 0.03;
      const drawOrder = pos.map(function (p, i) { return i; }).sort(function (a, b) { return laneY[a] - laneY[b]; });
      drawOrder.forEach(function (i) {
        const r = field.runners[i];
        const m = Math.min(pos[i], D + 40);
        const x = xOf(m);
        if (x < -80 || x > W + 90) return;
        const depth = (laneY[i] - TRACK_TOP) / (TRACK_BOT - TRACK_TOP); // 0奥〜1手前
        const scale = 0.72 + depth * 0.5;
        const y = laneY[i] - cornerBend(m) * 20 * (1 - depth);
        const running = t >= 0 && sim.times[i] > t;
        const phase = (m / 3.4) + i * 1.7;
        drawHorse(ctx, x, y, scale, phase, coatOf[i], SH.WAKU_COLORS[r.waku - 1], SH.WAKU_TEXT[r.waku - 1], r.gate, running);
        // 馬名(先頭グループ・自馬)
        const rank = rankIdx.indexOf(i);
        if ((rank < 3 || r.kind === "owned") && t >= 0) {
          ctx.font = "bold 16px sans-serif";
          const tw = ctx.measureText(r.name).width;
          ctx.fillStyle = "rgba(0,0,0,.55)";
          ctx.fillRect(x - tw / 2 - 5, y - 66 * scale - 18, tw + 10, 21);
          ctx.fillStyle = r.kind === "owned" ? "#ffd43b" : "#fff";
          ctx.fillText(r.name, x - tw / 2, y - 66 * scale - 2);
        }
      });

      // ---- 雨 ----
      if (sky.rain) {
        ctx.strokeStyle = "rgba(220,230,240," + (sky.rain === 2 ? 0.5 : 0.3) + ")";
        ctx.lineWidth = 1;
        for (let i = 0; i < sky.rain * 70; i++) {
          const rx = Math.random() * W, ry = Math.random() * H;
          ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 4, ry + 14); ctx.stroke();
        }
      }

      // ---- 中継オーバーレイ ----
      drawOverlay(t, pos, rankIdx, remain);

      // ゴールフラッシュ
      if (flash > 0) {
        ctx.fillStyle = "rgba(255,255,255," + flash + ")";
        ctx.fillRect(0, 0, W, H);
        flash -= 0.06;
      }

      // 写真判定・勝者バナー
      if (t > winTime) {
        if (photoFinish && t < winTime + 1.8) {
          banner("写真判定", "#fff", "#1a1a1a");
        } else {
          const wIdx = sim.order[0];
          const wr = field.runners[wIdx];
          banner("1着  " + wr.gate + " " + wr.name, SH.WAKU_COLORS[wr.waku - 1], SH.WAKU_TEXT[wr.waku - 1]);
        }
      } else if (t < 0) {
        banner("各馬ゲートイン", "rgba(0,0,0,.6)", "#fff");
      } else if (t < 1.2) {
        banner("スタート！", "rgba(0,0,0,.6)", "#ffd43b");
      }
    }

    function drawGate(x, t) {
      // 発馬機: 各レーンの枠
      ctx.fillStyle = "#9aa2ab";
      ctx.fillRect(x - 30, TRACK_TOP - 26, 10, TRACK_BOT - TRACK_TOP + 20);
      for (let i = 0; i < n; i++) {
        const y = TRACK_TOP + 34 + (TRACK_BOT - TRACK_TOP - 60) * (i / Math.max(1, n - 1));
        ctx.strokeStyle = "#7d858e"; ctx.lineWidth = 3;
        const open = t >= 0 ? Math.min(1, t * 3) : 0; // 開扉アニメ
        ctx.beginPath();
        ctx.moveTo(x - 20, y - 26);
        ctx.lineTo(x - 20 + open * 16, y - 26 - open * 10);
        ctx.stroke();
      }
      ctx.fillStyle = "#c0c6cc";
      ctx.fillRect(x - 34, TRACK_TOP - 40, 18, 14);
    }

    function banner(text, bg, fg) {
      ctx.font = "bold 34px sans-serif";
      const tw = ctx.measureText(text).width;
      const bx = W / 2 - tw / 2 - 24, by = 210;
      ctx.fillStyle = bg;
      ctx.fillRect(bx, by, tw + 48, 54);
      ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, tw + 48, 54);
      ctx.fillStyle = fg;
      ctx.fillText(text, W / 2 - tw / 2, by + 39);
    }

    function drawOverlay(t, pos, rankIdx, remain) {
      // 左上: レース名バナー
      const gradeCol = race.grade === "G1" || race.grade === "WBC" || race.grade === "J-G1" ? "#1c7ed6"
        : race.grade === "G2" || race.grade === "J-G2" ? "#e03131"
          : race.grade === "G3" || race.grade === "J-G3" ? "#2f9e44" : "#555f6a";
      ctx.font = "bold 22px sans-serif";
      const nameW = ctx.measureText(race.name).width;
      ctx.fillStyle = "rgba(10,14,18,.82)";
      ctx.fillRect(14, 12, Math.max(330, nameW + 130), 66);
      ctx.fillStyle = gradeCol;
      ctx.fillRect(14, 12, 7, 66);
      ctx.fillStyle = gradeCol;
      ctx.fillRect(30, 20, 58, 26);
      ctx.fillStyle = "#fff"; ctx.font = "bold 18px sans-serif";
      ctx.fillText(race.grade, 38, 40);
      ctx.font = "bold 22px sans-serif";
      ctx.fillText(race.name, 98, 41);
      ctx.font = "15px sans-serif"; ctx.fillStyle = "#c8d2dc";
      ctx.fillText(race.course + " " + race.surface + race.dist + "m  馬場:" + field.condition, 30, 68);

      if (t < 0) return;
      // 右上: 残り距離
      ctx.fillStyle = "rgba(10,14,18,.82)";
      ctx.fillRect(W - 196, 12, 182, 46);
      ctx.fillStyle = "#ffd43b"; ctx.font = "bold 27px sans-serif";
      const remShow = remain <= 0 ? "GOAL" : "残り " + (Math.ceil(remain / 10) * 10) + "m";
      ctx.fillText(remShow, W - 184, 45);

      // 右上その下: コースマップ(楕円+進捗ドット)
      const mx = W - 96, my = 122, rx = 70, ry = 34;
      ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.ellipse(mx, my, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,.3)"; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.ellipse(mx, my, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      // ゴール位置(右下)
      ctx.fillStyle = "#c9312e";
      ctx.fillRect(mx + rx * Math.cos(0.5) - 2, my + ry * Math.sin(0.5) - 5, 5, 10);
      // 各馬ドット(進捗→角度: 時計回り、ゴール=+0.5rad)
      for (let k = Math.min(n, 18) - 1; k >= 0; k--) {
        const i = rankIdx[k];
        const p = SH.clamp(pos[i] / D, 0, 1);
        const th = 0.5 + (1 - p) * 5.2; // 逆走順に配置
        const r = field.runners[i];
        ctx.fillStyle = SH.WAKU_COLORS[r.waku - 1];
        ctx.beginPath(); ctx.arc(mx + rx * Math.cos(th), my + ry * Math.sin(th), i === rankIdx[0] ? 5 : 4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 1; ctx.stroke();
      }

      // 下部: 現在の隊列(枠色の馬番チップ)
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
        const s = String(r.gate);
        ctx.fillText(s, x + cw / 2 - ctx.measureText(s).width / 2, H - 19);
      }
      ctx.fillStyle = "#b8c2cc"; ctx.font = "11px sans-serif";
      ctx.fillText("現在の隊列 →", x0 - 8, H - 50);
    }

    // ---- 再生ループ ----
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
      if (view.t < 0) sp = 1;                                             // ゲートインは等速
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
