// ============================================================
// raceview.js — 擬似3Dレース観戦ビュー(Canvas 2D + 透視投影) HD版
//  ・楕円コースを3D空間として定義し、ピンホールカメラで投影
//  ・カメラ切替: ゲート正面 → 並走トラッキング → 直線正面 → ゴール定点
//  ・馬: 4脚独立の襲歩アニメ+陰影付きスプライト(横/正面/後ろ+3/4補間)
//  ・演出: 蹴り上げ土煙・投影影・大気霞・ビネット・動く観客
// ============================================================
"use strict";
(function (SH) {
  const W = 1280, H = 720;
  const PREROLL = 5.4;      // タイトルカード2.8s + ゲートイン2.6s
  const TITLE_END = -2.6;   // これよりtが小さい間はタイトルカード
  const FL = 830; // 焦点距離(px)

  // タイム表記 (89.34 → "1:29.3")
  function fmtTime(sec) {
    if (!isFinite(sec) || sec <= 0) return "-:--.-";
    const m = Math.floor(sec / 60), s = sec - m * 60;
    return m + ":" + (s < 10 ? "0" : "") + s.toFixed(1);
  }
  // 着差表記(タイム差→馬身)
  function marginLabel(d) {
    if (d < 0.02) return "ハナ";
    if (d < 0.05) return "アタマ";
    if (d < 0.09) return "クビ";
    if (d < 0.14) return "1/2馬身";
    if (d < 0.19) return "3/4馬身";
    const L = Math.round(d / 0.17 * 2) / 2;
    if (L >= 10) return "大差";
    const whole = Math.floor(L);
    return (L === whole) ? whole + "馬身" : (whole ? whole + " " : "") + "1/2馬身";
  }

  // ---------- 3Dベクトル ----------
  function v3(x, y, z) { return { x: x, y: y, z: z }; }
  function vsub(a, b) { return v3(a.x - b.x, a.y - b.y, a.z - b.z); }
  function vdot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
  function vcross(a, b) { return v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x); }
  function vnorm(a) { const l = Math.sqrt(vdot(a, a)) || 1; return v3(a.x / l, a.y / l, a.z / l); }
  function vlerp(a, b, t) { return v3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t); }

  // ---------- コース幾何(反時計回りの楕円: 直線2+半円2) ----------
  const TRACK_HALF = 11;
  function makeCourse(D) {
    const R = 120, S = 450;
    const lap = 2 * S + 2 * Math.PI * R;
    const finishWS = S * 0.82;
    const startWS = finishWS - D;
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
    function pos(m, lat, y) {
      const p = at(m);
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
    if (cond === "不良") return { top: "#39424e", bot: "#67727f", rain: 2 };
    if (cond === "重") return { top: "#57626f", bot: "#8b95a0", rain: 1 };
    if (cond === "稍重") return { top: "#7891a8", bot: "#bcc8d0", rain: 0 };
    return { top: "#3f96de", bot: "#c2e5ff", rain: 0 };
  }
  function turfColors(surface, cond) {
    const wet = cond === "重" || cond === "不良";
    if (surface === "ダート") return { a: wet ? "#6e5136" : "#b08d57", b: wet ? "#63482d" : "#a5814a", grass: wet ? "#2c6a33" : "#3a883f", kick: wet ? "#4e3b22" : "#8f7040" };
    return { a: wet ? "#2e6f35" : "#3f9142", b: wet ? "#296330" : "#379036", grass: wet ? "#2c6a33" : "#3a883f", kick: wet ? "#3e5c2c" : "#527f3a" };
  }

  // ============================================================
  //  馬スプライト(接地点0,0基準・馬体高≈40単位)
  // ============================================================
  // 3セグメントの脚(腿→管→蹄)。swing=振り幅 ph=位相
  function drawLeg(ctx, hx, hy, ph, hind, col, running, thick) {
    const swing = running ? (hind ? 0.72 : 0.82) : 0.10;
    const a1 = Math.sin(ph) * swing + (hind ? 0.42 : -0.30);
    const bend = (running ? Math.max(0, Math.sin(ph + 1.15)) : 0.12) * (hind ? 1.0 : 1.15);
    const a2 = a1 + (hind ? -bend : bend);
    const kx = hx + Math.sin(a1) * 10, ky = hy + Math.cos(a1) * 10;
    const fx = kx + Math.sin(a2) * 9, fy = ky + Math.cos(a2) * 9;
    ctx.strokeStyle = col; ctx.lineCap = "round";
    ctx.lineWidth = thick;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.stroke();
    ctx.lineWidth = thick * 0.62;
    ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
    // 蹄
    ctx.strokeStyle = "#2b2119"; ctx.lineWidth = thick * 0.66;
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + Math.sin(a2) * 2.4, fy + Math.cos(a2) * 2.4); ctx.stroke();
    return { x: fx, y: fy };
  }

  // 横向き(xsq: 3/4視の横圧縮 0.45〜1)
  function spriteSide(ctx, sc, flip, xsq, phase, coat, silks, gate, running) {
    ctx.save();
    ctx.scale(flip ? -sc : sc, sc);
    ctx.scale(xsq, 1);
    const bob = running ? Math.sin(phase + 0.3) * 2.6 : 0;
    const pitch = running ? Math.sin(phase) * 0.05 : 0;
    ctx.translate(0, -26 + bob);
    ctx.rotate(pitch);
    const dk = shade(coat, -30), lt = shade(coat, 24), far = shade(coat, -42);

    // 奥側の脚
    drawLeg(ctx, -13, 6, phase, true, far, running, 4.2);
    drawLeg(ctx, 13, 6, phase + Math.PI + 0.45, false, far, running, 3.8);

    // 尾(なびき)
    ctx.strokeStyle = dk; ctx.lineCap = "round";
    for (let k = 0; k < 3; k++) {
      ctx.lineWidth = 3.4 - k;
      const wv = Math.sin(phase * 0.8 + k) * 3;
      ctx.beginPath(); ctx.moveTo(-23, -6 + k * 2);
      ctx.quadraticCurveTo(-33, -3 + wv, -38 - k * 2, 6 + wv * 0.6);
      ctx.stroke();
    }

    // 胴体(グラデーション陰影)
    const bg = ctx.createLinearGradient(0, -14, 0, 12);
    bg.addColorStop(0, lt); bg.addColorStop(0.45, coat); bg.addColorStop(1, dk);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(-24, -6);
    ctx.bezierCurveTo(-26, -13, -14, -15, -4, -13.5); // 背〜き甲
    ctx.bezierCurveTo(4, -12.5, 12, -13.5, 18, -11);
    ctx.bezierCurveTo(24, -8, 24, 0, 19, 5);          // 胸前
    ctx.bezierCurveTo(10, 9.5, -4, 10, -13, 7.5);     // 腹
    ctx.bezierCurveTo(-22, 5, -26, 1, -24, -6);       // 臀
    ctx.closePath(); ctx.fill();
    // 臀部・肩の筋肉ハイライト
    ctx.strokeStyle = shade(coat, -16); ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(-13, -3, 8.5, -0.8, 1.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(13, -2, 7, 1.8, 3.6); ctx.stroke();
    ctx.strokeStyle = shade(coat, 30); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(-13, -6, 9.5, -2.2, -0.6); ctx.stroke();

    // 首・頭(走行時は前へ伸びる)
    const ext = running ? Math.sin(phase + 1.2) * 2.2 : 0;
    const hx = 34 + ext, hy = running ? -20 : -26;
    const ng = ctx.createLinearGradient(16, -16, hx, hy);
    ng.addColorStop(0, coat); ng.addColorStop(1, shade(coat, 8));
    ctx.fillStyle = ng;
    ctx.beginPath();
    ctx.moveTo(14, -12);
    ctx.quadraticCurveTo(24, hy + 3, hx - 3, hy - 3);
    ctx.lineTo(hx + 1, hy + 4);
    ctx.quadraticCurveTo(25, hy + 10, 16, 1);
    ctx.closePath(); ctx.fill();
    // 頭
    ctx.beginPath(); ctx.ellipse(hx + 3, hy + 1, 8, 4.4, 0.55, 0, Math.PI * 2); ctx.fill();
    // 鼻先・口
    ctx.fillStyle = shade(coat, -20);
    ctx.beginPath(); ctx.ellipse(hx + 9, hy + 4.5, 3, 2.2, 0.55, 0, Math.PI * 2); ctx.fill();
    // 耳・目
    ctx.fillStyle = coat;
    ctx.beginPath(); ctx.moveTo(hx - 2, hy - 5); ctx.lineTo(hx, hy - 11); ctx.lineTo(hx + 3, hy - 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#1a1410";
    ctx.beginPath(); ctx.arc(hx + 2.5, hy - 1.5, 1.1, 0, Math.PI * 2); ctx.fill();
    // 頭絡(ブライドル)
    ctx.strokeStyle = "#3a2c20"; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(hx, hy - 3); ctx.lineTo(hx + 7, hy + 3); ctx.stroke();
    // たてがみ
    ctx.strokeStyle = dk; ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(15, -11); ctx.quadraticCurveTo(25, hy - 1, hx - 3, hy - 4); ctx.stroke();

    // ゼッケン(白布+馬番)・腹帯
    ctx.fillStyle = "#f5f5f0";
    ctx.beginPath();
    ctx.moveTo(-8, -12); ctx.lineTo(7, -11.5); ctx.lineTo(8, 4); ctx.lineTo(-7, 5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#c9312e"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-7.6, 2.5); ctx.lineTo(7.6, 1.8); ctx.stroke();
    ctx.strokeStyle = "#4a3a2a"; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(0.6, 9.5); ctx.stroke();
    ctx.fillStyle = "#16161a"; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center";
    ctx.save();
    if (flip) { ctx.translate(-0.5, -1); ctx.scale(-1 / xsq, 1); ctx.fillText(String(gate), 0, 0); }
    else { ctx.translate(-0.5, -1); ctx.scale(1 / xsq, 1); ctx.fillText(String(gate), 0, 0); }
    ctx.restore();
    ctx.textAlign = "left";

    // 手前側の脚
    drawLeg(ctx, -11, 6, phase + 0.4, true, coat, running, 4.6);
    const hoofF = drawLeg(ctx, 15, 6, phase + Math.PI + 0.85, false, coat, running, 4.2);

    // ---- 騎手(モンキー乗り) ----
    const jy = -14;
    // 鐙側の脚
    ctx.strokeStyle = "#f5f5f5"; ctx.lineWidth = 3.4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(1, jy - 6); ctx.quadraticCurveTo(5, jy - 1, 3.4, jy + 4); ctx.stroke();
    ctx.strokeStyle = "#25201c"; ctx.lineWidth = 3.6; // ブーツ
    ctx.beginPath(); ctx.moveTo(3.4, jy + 4); ctx.lineTo(3.4, jy + 7.5); ctx.stroke();
    // 胴(前傾・勝負服グラデ)
    const sg = ctx.createLinearGradient(-4, jy - 22, 12, jy - 8);
    sg.addColorStop(0, shade2(silks, 26)); sg.addColorStop(1, silks);
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(-4, jy - 6);
    ctx.quadraticCurveTo(-2, jy - 18, 8, jy - 19);
    ctx.lineTo(13, jy - 14);
    ctx.quadraticCurveTo(8, jy - 6, -1, jy - 4);
    ctx.closePath(); ctx.fill();
    // 腕→手綱
    ctx.strokeStyle = silks; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(8, jy - 15); ctx.lineTo(19, jy - 8); ctx.stroke();
    ctx.strokeStyle = "#3a2c20"; ctx.lineWidth = 0.9; // 手綱
    ctx.beginPath(); ctx.moveTo(19, jy - 8); ctx.lineTo(hx + 5, hy + 2); ctx.stroke();
    // 頭・ヘルメット(枠色)・ゴーグル
    ctx.fillStyle = "#e8c39e";
    ctx.beginPath(); ctx.arc(11.5, jy - 20, 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = silks;
    ctx.beginPath(); ctx.arc(11.5, jy - 21.5, 4.1, Math.PI * 0.9, Math.PI * 2.06); ctx.fill();
    ctx.strokeStyle = "#20242c"; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(13.5, jy - 20.5); ctx.lineTo(15.4, jy - 19.6); ctx.stroke();
    ctx.restore();
  }

  // 正面
  function spriteFront(ctx, sc, phase, coat, silks, gate, running) {
    ctx.save(); ctx.scale(sc, sc);
    const sway = running ? Math.sin(phase) * 1.8 : 0;
    ctx.translate(sway * 0.5, -22);
    const dk = shade(coat, -30), lt = shade(coat, 22);
    // 脚(交互に開く)
    ctx.lineCap = "round";
    const l1 = running ? Math.sin(phase) * 5 : 0, l2 = running ? Math.sin(phase + Math.PI) * 5 : 0;
    ctx.strokeStyle = dk; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-5.5, 4); ctx.lineTo(-6.5 + l1 * 0.4, 13 + Math.abs(l1) * 0.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5.5, 4); ctx.lineTo(6.5 + l2 * 0.4, 13 + Math.abs(l2) * 0.4); ctx.stroke();
    ctx.strokeStyle = coat; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(-6.5 + l1 * 0.4, 13 + Math.abs(l1) * 0.4); ctx.lineTo(-7 + l1 * 0.6, 20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6.5 + l2 * 0.4, 13 + Math.abs(l2) * 0.4); ctx.lineTo(7 + l2 * 0.6, 20); ctx.stroke();
    // 胸(グラデ)
    const cg = ctx.createRadialGradient(-3, -4, 2, 0, 0, 16);
    cg.addColorStop(0, lt); cg.addColorStop(1, dk);
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.ellipse(0, 0, 13.5, 12.5, 0, 0, Math.PI * 2); ctx.fill();
    // 胸の割れ目
    ctx.strokeStyle = shade(coat, -20); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, 10); ctx.stroke();
    // 首・頭(上下に振る)
    const nod = running ? Math.sin(phase + 1) * 1.6 : 0;
    ctx.fillStyle = coat;
    ctx.beginPath(); ctx.ellipse(0, -12 + nod * 0.4, 7.2, 9.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -17 + nod, 4.6, 8, 0, 0, Math.PI * 2); ctx.fill();
    // 流星(鼻筋の白)・鼻孔
    ctx.fillStyle = "rgba(245,240,235,.85)";
    ctx.fillRect(-1.2, -22 + nod, 2.4, 10);
    ctx.fillStyle = "#3a2c22";
    ctx.beginPath(); ctx.arc(-1.8, -11.5 + nod, 1.1, 0, Math.PI * 2); ctx.arc(1.8, -11.5 + nod, 1.1, 0, Math.PI * 2); ctx.fill();
    // 耳・目
    ctx.fillStyle = coat;
    ctx.beginPath(); ctx.moveTo(-4.5, -23 + nod); ctx.lineTo(-6, -29 + nod); ctx.lineTo(-2, -24 + nod); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(4.5, -23 + nod); ctx.lineTo(6, -29 + nod); ctx.lineTo(2, -24 + nod); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#14100c";
    ctx.beginPath(); ctx.arc(-3.4, -19 + nod, 1, 0, Math.PI * 2); ctx.arc(3.4, -19 + nod, 1, 0, Math.PI * 2); ctx.fill();
    // 騎手(頭・肩)
    ctx.fillStyle = silks;
    ctx.beginPath(); ctx.ellipse(0, -27, 8.5, 5.5, 0, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e8c39e"; ctx.beginPath(); ctx.arc(0, -31, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = silks; ctx.beginPath(); ctx.arc(0, -32.2, 3.9, Math.PI, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#20242c"; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(-2.4, -31.4); ctx.lineTo(2.4, -31.4); ctx.stroke();
    // ゼッケン
    ctx.fillStyle = "rgba(250,250,245,.95)"; ctx.fillRect(-6.5, 3, 13, 9);
    ctx.fillStyle = "#16161a"; ctx.font = "bold 8.5px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(String(gate), 0, 10.2);
    ctx.textAlign = "left";
    ctx.restore();
  }

  // 後ろ姿
  function spriteRear(ctx, sc, phase, coat, silks, gate, running) {
    ctx.save(); ctx.scale(sc, sc);
    const sway = running ? Math.sin(phase) * 1.8 : 0;
    ctx.translate(sway * 0.5, -22);
    const dk = shade(coat, -30), lt = shade(coat, 20);
    ctx.lineCap = "round";
    const l1 = running ? Math.sin(phase) * 5 : 0;
    ctx.strokeStyle = dk; ctx.lineWidth = 4.4;
    ctx.beginPath(); ctx.moveTo(-6.5, 4); ctx.lineTo(-8 - l1 * 0.5, 14 + Math.abs(l1) * 0.3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6.5, 4); ctx.lineTo(8 + l1 * 0.5, 14 + Math.abs(l1) * 0.3); ctx.stroke();
    ctx.strokeStyle = coat; ctx.lineWidth = 3.6;
    ctx.beginPath(); ctx.moveTo(-8 - l1 * 0.5, 14 + Math.abs(l1) * 0.3); ctx.lineTo(-8.5 - l1 * 0.7, 20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8 + l1 * 0.5, 14 + Math.abs(l1) * 0.3); ctx.lineTo(8.5 + l1 * 0.7, 20); ctx.stroke();
    // 臀部(丸み)
    const rg = ctx.createRadialGradient(0, -6, 3, 0, -1, 17);
    rg.addColorStop(0, lt); rg.addColorStop(1, dk);
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.ellipse(0, 0, 15, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = shade(coat, -22); ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 6); ctx.stroke();
    // 尾(なびく)
    ctx.strokeStyle = dk; ctx.lineWidth = 4.6;
    ctx.beginPath(); ctx.moveTo(0, -7);
    ctx.quadraticCurveTo(sway * 1.4, 5, sway * 2.2, 15); ctx.stroke();
    // 首の後ろ
    ctx.fillStyle = coat;
    ctx.beginPath(); ctx.ellipse(0, -14, 5.6, 6.5, 0, 0, Math.PI * 2); ctx.fill();
    // 騎手の背中
    const sg = ctx.createLinearGradient(-8, -30, 8, -18);
    sg.addColorStop(0, silks); sg.addColorStop(1, shade2(silks, -24));
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.ellipse(0, -25, 8.8, 7.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e8c39e"; ctx.beginPath(); ctx.arc(0, -33, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = silks; ctx.beginPath(); ctx.arc(0, -34, 3.7, Math.PI, Math.PI * 2); ctx.fill();
    // ゼッケン(尻横)
    ctx.fillStyle = "rgba(250,250,245,.95)"; ctx.fillRect(-15, -7, 9.5, 9.5);
    ctx.fillStyle = "#16161a"; ctx.font = "bold 8.5px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(String(gate), -10.2, 0.5);
    ctx.textAlign = "left";
    ctx.restore();
  }

  // 勝負服色(rgb/hex両対応)の明暗
  function shade2(col, amt) {
    if (col[0] === "#") return shade(col, amt);
    return col;
  }

  // ---------- ビュー本体 ----------
  SH.createRaceView = function (root, race, field, sim, onDone) {
    // 3層キャンバス: 背景(2D) → 馬(WebGL) → オーバーレイ(2D)
    const canvas = SH.el("canvas", { width: String(W), height: String(H) });
    const glCanvas = SH.el("canvas", { class: "layer", width: String(W), height: String(H) });
    const fgCanvas = SH.el("canvas", { class: "layer", width: String(W), height: String(H) });
    const wrap = SH.el("div", { class: "canvas-wrap tv" }, [canvas, glCanvas, fgCanvas]);
    root.appendChild(wrap);
    const commentBox = SH.el("div", { class: "commentary" });
    root.appendChild(commentBox);
    const ctrl = SH.el("div", { class: "row" });
    root.appendChild(ctrl);

    const ctx = canvas.getContext("2d");
    const octx = fgCanvas.getContext("2d");

    // ---- WebGL(3D馬)初期化。失敗時はスプライトにフォールバック ----
    let renderer = null, scene = null, camera3 = null, horses3 = null;
    if (SH.Horse3D && SH.Horse3D.available()) {
      renderer = SH.Horse3D.createRenderer(glCanvas);
      if (renderer) {
        scene = SH.Horse3D.buildScene(field.condition);
        const fovY = 2 * Math.atan((H / 2) / FL) * 180 / Math.PI;
        camera3 = new THREE.PerspectiveCamera(fovY, W / H, 0.5, 3000);
        horses3 = [];
      }
    }
    const use3d = !!renderer;
    SH._render3d = use3d; // テスト用フラグ
    const D = race.dist;
    const n = field.runners.length;
    const frames = sim.frames;
    const dtSim = frames.length > 1 ? frames[1].t - frames[0].t : 0.4;
    const sky = skyColors(field.condition);
    const turf = turfColors(race.surface, field.condition);
    const course = makeCourse(D);

    // CPU馬の毛色は実際の出現率に寄せて鹿毛系を多めに
    const COAT_POOL = ["鹿毛", "鹿毛", "鹿毛", "黒鹿毛", "黒鹿毛", "栗毛", "栗毛", "栃栗毛", "芦毛", "青毛"];
    const coatOf = field.runners.map(function (r, i) {
      if (r.kind === "owned") return COAT[r.ref.coat] || COAT["鹿毛"];
      return COAT[COAT_POOL[(i * 7 + r.name.length) % COAT_POOL.length]];
    });
    const lat = [];
    for (let i = 0; i < n; i++) lat.push(-8 + 16 * (i / Math.max(1, n - 1)));

    // 3D馬の生成(枠色の勝負服・毛色・ゼッケン番号)
    const H3_SCALE = 1.45; // 視認性のためやや大きめ(旧スプライトと同等の存在感)
    if (use3d) {
      field.runners.forEach(function (r, i) {
        const coatHex = parseInt(coatOf[i].slice(1), 16);
        const silksHex = parseInt(SH.WAKU_COLORS[r.waku - 1].slice(1), 16);
        const h3 = SH.Horse3D.createHorse(coatHex, silksHex, r.gate);
        h3.group.scale.setScalar(H3_SCALE);
        scene.add(h3.group);
        horses3.push(h3);
      });
    }

    // 蹴り上げパーティクル {m, lt, y, vm, vy, life, max}
    const parts = [];

    // ビネット(キャッシュ)
    const vig = document.createElement("canvas");
    vig.width = W; vig.height = H;
    (function () {
      const vctx = vig.getContext("2d");
      const g = vctx.createRadialGradient(W / 2, H / 2, H * 0.5, W / 2, H / 2, H * 0.95);
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(8,10,16,.42)");
      vctx.fillStyle = g; vctx.fillRect(0, 0, W, H);
    })();

    let storyIdx = 0;
    let lastStory = null; // 画面内テロップ用 {text, at}
    function pushStory(upTo) {
      while (storyIdx < sim.story.length && sim.story[storyIdx].t <= upTo) {
        commentBox.insertBefore(SH.el("div", { class: "cline", text: "🎙 " + sim.story[storyIdx].text }), commentBox.firstChild);
        lastStory = { text: sim.story[storyIdx].text, at: upTo };
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
    let curFL = FL; // 動的焦点距離(直線正面は望遠レンズ)
    function computeCam(t, pos, leadM, camOver) {
      const remain = D - leadM;
      const packC = leadM - 8;
      let mode, p, tg;
      if (camOver === "replay") {
        // リプレイ: 外ラチ沿いの低いカメラで迫力の煽りアングル
        mode = "replay";
        p = course.pos(Math.min(leadM + 24, D + 26), -16, 1.9);
        tg = course.pos(Math.min(leadM + 2, D + 6), 2, 1.6);
      } else if (t < 0) {
        mode = "gate";
        p = course.pos(16, 2, 2.4); tg = course.pos(0, 0, 1.4);
      } else if (remain > 520) {
        const prog = leadM / D;
        if (D >= 1400 && prog > 0.40 && prog < 0.54) {
          // 中盤はクレーン(空撮)カメラで隊列全体を見せる
          mode = "crane";
          p = course.pos(packC - 34, 58, 34); tg = course.pos(packC + 12, 0, 0);
        } else {
          mode = "track";
          p = course.pos(packC + 4, 30, 8.5); tg = course.pos(packC, 0, 1.6);
        }
      } else if (remain > 130) {
        mode = "stretch";
        p = course.pos(D + 60, 7, 3.2); tg = course.pos(Math.min(leadM + 15, D + 20), 0, 1.8);
      } else {
        mode = "goal";
        p = course.pos(D - 34, 38, 9); tg = course.pos(Math.min(leadM, D + 12), 0, 1.5);
      }
      // 焦点距離: 直線正面は被写体距離に応じた望遠(中継の圧縮効果)
      let targetFL = FL;
      if (mode === "stretch") {
        const lp = course.pos(leadM, 0, 1.6);
        const dx = lp.x - p.x, dz = lp.z - p.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        targetFL = SH.clamp(dist * 42, 950, 15000);
      } else if (mode === "gate") targetFL = 1100;
      if (mode !== camMode) { camMode = mode; camPos = p; camTgt = tg; curFL = targetFL; }
      else { camPos = vlerp(camPos, p, 0.14); camTgt = vlerp(camTgt, tg, 0.2); curFL += (targetFL - curFL) * 0.1; }
      // 手持ちカメラ風の微揺れ
      const sway = mode === "track" ? 0.22 : mode === "stretch" ? 0.12 : mode === "replay" ? 0.16 : 0;
      const cp = v3(camPos.x, camPos.y + Math.sin(t * 1.9) * sway, camPos.z + Math.cos(t * 1.3) * sway * 0.5);
      const f = vnorm(vsub(camTgt, cp));
      const up = v3(0, 1, 0);
      const r = vnorm(vcross(up, f));
      const u = vcross(f, r);
      return { pos: cp, f: f, r: r, u: u, mode: mode, fl: curFL };
    }
    function project(cam, P) {
      // 標準カメラ(Three.js)と一致する右手系スクリーン基底(x = -r方向)
      const d = vsub(P, cam.pos);
      const z = vdot(d, cam.f);
      if (z < 1.2) return null;
      const fl = cam.fl || FL;
      return { x: W / 2 - vdot(d, cam.r) * fl / z, y: H * 0.5 - vdot(d, cam.u) * fl / z, z: z, s: fl / z };
    }
    // 大気霞: 距離→アルファ減衰
    function hazeOf(z) { return SH.clamp((z - 140) / 720, 0, 0.55); }

    // ---------- シーン描画 ----------
    function draw(t, dtWorld, camOver) {
      const pos = posAt(Math.max(0, t));
      const leadM = Math.max.apply(null, pos);
      const remain = Math.max(0, D - leadM);
      const cam = computeCam(t, pos, leadM, camOver);
      octx.clearRect(0, 0, W, H); // オーバーレイ層をクリア

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
        const cx = (c * 350 + 120) % W, cy = horizon * (0.16 + c * 0.15);
        if (cy > horizon - 14) continue;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 76, 14, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + 55, cy + 6, 50, 11, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // 地平の霞
      ctx.fillStyle = "rgba(255,255,255,.25)";
      ctx.fillRect(0, Math.max(horizon - 10, 0), W, 12);
      // 地面(芝生)
      ctx.fillStyle = turf.grass;
      ctx.fillRect(0, Math.max(horizon, 0), W, H - Math.max(horizon, 0));

      const packC = t < 0 ? 0 : leadM - 8;
      let mFrom, mTo;
      if (cam.mode === "stretch") { mFrom = leadM - 280; mTo = D + 95; }
      else if (cam.mode === "goal") { mFrom = leadM - 230; mTo = D + 130; }
      else if (cam.mode === "gate") { mFrom = -60; mTo = 320; }
      else { mFrom = packC - 210; mTo = packC + 350; }

      // 馬場リボン
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
        // 手前の芝ディテール(斑点)
        if (q[0].s > 11) {
          ctx.fillStyle = "rgba(0,0,0,.08)";
          for (let d = 0; d < 7; d++) {
            const fx = ((d * 43 + m * 17) % 89) / 89, fy = ((d * 71 + m * 29) % 83) / 83;
            const px = q[1].x + (q[0].x - q[1].x) * fx + (q[2].x - q[1].x) * fy;
            const py = q[1].y + (q[0].y - q[1].y) * fx + (q[2].y - q[1].y) * fy;
            ctx.fillRect(px, py, 2.4, 1.6);
          }
        }
      }
      // 決勝線
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

      // ラチ
      [TRACK_HALF + 0.6, -(TRACK_HALF + 0.6)].forEach(function (railLat) {
        let prevTop = null, prevMid = null;
        for (let m = Math.floor(mFrom / 8) * 8; m < mTo; m += 8) {
          const base = project(cam, course.pos(m, railLat, 0));
          const top = project(cam, course.pos(m, railLat, 1.25));
          const mid = project(cam, course.pos(m, railLat, 0.7));
          if (base && top && top.s < 220) { // カメラ直近の支柱は描かない(望遠時の巨大化防止)
            const hz = hazeOf(top.z);
            ctx.strokeStyle = "rgba(245,245,245," + (0.95 - hz) + ")";
            ctx.lineWidth = SH.clamp(top.s * 0.08, 1, 16);
            ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke();
            if (prevTop) {
              ctx.beginPath(); ctx.moveTo(prevTop.x, prevTop.y); ctx.lineTo(top.x, top.y); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(prevMid.x, prevMid.y); ctx.lineTo(mid.x, mid.y); ctx.stroke();
            }
          }
          prevTop = top; prevMid = mid;
        }
      });

      // パーティクル更新
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life -= dtWorld;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        p.m += p.vm * dtWorld;
        p.y += p.vy * dtWorld;
        p.vy -= 13 * dtWorld;
        if (p.y < 0) p.y = 0;
      }

      // ビルボード収集
      const bills = [];
      for (let m = Math.floor(mFrom / 40) * 40; m < mTo; m += 40) {
        const onHome = course.at(m).s < 450;
        if (onHome) bills.push({ kind: "stand", m: m });
        else if (Math.floor(m / 40) % 2 === 0) bills.push({ kind: "tree", m: m });
      }
      for (let k = 200; k < D; k += 200) {
        const m = D - k;
        if (m > mFrom && m < mTo) bills.push({ kind: "furlong", m: m, label: k });
      }
      if (D > mFrom && D < mTo) bills.push({ kind: "goalboard", m: D });
      if (0 > mFrom - 40 && 0 < mTo) bills.push({ kind: "gate", m: 0 });

      const rankIdx = pos.map(function (p, i) { return i; }).sort(function (a, b) { return pos[b] - pos[a]; });
      const targetLat = new Array(n);
      rankIdx.forEach(function (hi, rank) {
        targetLat[hi] = 7.5 - 15 * (rank / Math.max(1, n - 1)) * (t < 0 ? 1 : 0.85);
      });
      for (let i = 0; i < n; i++) lat[i] += (targetLat[i] - lat[i]) * 0.02;
      if (use3d) horses3.forEach(function (h3) { h3.group.visible = false; }); // 画面外は非表示
      for (let i = 0; i < n; i++) bills.push({ kind: "horse", i: i, m: Math.min(pos[i], D + 40) });
      parts.forEach(function (p) { bills.push({ kind: "part", p: p, m: p.m }); });

      bills.forEach(function (b) {
        const wp = b.kind === "horse" ? course.pos(b.m, lat[b.i], 0)
          : b.kind === "part" ? course.pos(b.m, b.p.lt, b.p.y)
            : course.pos(b.m, 0, 0);
        b.depth = vdot(vsub(wp, cam.pos), cam.f);
      });
      bills.sort(function (a, b) { return b.depth - a.depth; });

      bills.forEach(function (b) {
        if (b.kind === "stand") drawStand(cam, b.m, t);
        else if (b.kind === "tree") drawTree(cam, b.m);
        else if (b.kind === "furlong") drawFurlong(cam, b.m, b.label);
        else if (b.kind === "goalboard") drawGoalboard(cam);
        else if (b.kind === "gate") drawGates(cam, t);
        else if (b.kind === "part") drawPart(cam, b.p);
        else drawRunner(cam, b.i, pos, rankIdx, t, dtWorld);
      });

      // 3D馬レイヤーの描画(カメラ同期→レンダリング)
      if (use3d) {
        camera3.position.set(cam.pos.x, cam.pos.y, cam.pos.z);
        camera3.up.set(0, 1, 0);
        camera3.lookAt(cam.pos.x + cam.f.x, cam.pos.y + cam.f.y, cam.pos.z + cam.f.z);
        camera3.fov = 2 * Math.atan((H / 2) / (cam.fl || FL)) * 180 / Math.PI; // 望遠と同期
        camera3.updateProjectionMatrix();
        renderer.render(scene, camera3);
      }

      // 雨(前面レイヤー)
      if (sky.rain) {
        octx.strokeStyle = "rgba(220,230,240," + (sky.rain === 2 ? 0.5 : 0.3) + ")";
        octx.lineWidth = 1.2;
        for (let i = 0; i < sky.rain * 90; i++) {
          const rx = Math.random() * W, ry = Math.random() * H;
          octx.beginPath(); octx.moveTo(rx, ry); octx.lineTo(rx - 5, ry + 18); octx.stroke();
        }
      }

      drawOverlay(t, pos, rankIdx, remain);
      octx.drawImage(vig, 0, 0); // ビネット

      if (flash > 0) {
        octx.fillStyle = "rgba(255,255,255," + flash + ")";
        octx.fillRect(0, 0, W, H);
        flash -= 0.06;
      }
      if (camOver === "replay") {
        drawReplayMark(t);
      } else if (t > winTime) {
        if (photoFinish && t < winTime + 1.8) banner("写真判定", "#fff", "#1a1a1a");
        else {
          const wr = field.runners[sim.order[0]];
          banner("1着  " + wr.gate + " " + wr.name, SH.WAKU_COLORS[wr.waku - 1], SH.WAKU_TEXT[wr.waku - 1]);
        }
      } else if (t < TITLE_END) drawTitleCard(t);
      else if (t < 0) banner("各馬ゲートイン", "rgba(0,0,0,.6)", "#fff");
      else if (t < 1.2) banner("スタート！", "rgba(0,0,0,.6)", "#ffd43b");
    }

    // ---------- タイトルカード(発走前のレース紹介) ----------
    function drawTitleCard(t) {
      const ctx = octx; // 前面レイヤーに描く
      ctx.fillStyle = "rgba(8,12,22,.88)";
      ctx.fillRect(0, 0, W, H);
      const gradeCol = race.grade === "G1" || race.grade === "WBC" || race.grade === "J-G1" ? "#1c7ed6"
        : race.grade === "G2" || race.grade === "J-G2" ? "#e03131"
          : race.grade === "G3" || race.grade === "J-G3" ? "#2f9e44" : "#555f6a";
      // グレード帯
      ctx.fillStyle = gradeCol;
      ctx.fillRect(0, 150, W, 8);
      ctx.fillRect(0, 340, W, 8);
      ctx.font = "bold 34px sans-serif"; ctx.textAlign = "center";
      ctx.fillStyle = gradeCol === "#555f6a" ? "#c8d2dc" : gradeCol;
      ctx.fillText(race.grade, W / 2, 205);
      // レース名
      ctx.fillStyle = "#fff"; ctx.font = "bold 62px sans-serif";
      ctx.fillText(race.name, W / 2, 285);
      ctx.font = "26px sans-serif"; ctx.fillStyle = "#c8d2dc";
      ctx.fillText(race.course + "競馬場  " + race.surface + " " + race.dist + "m  馬場:" + field.condition + "  " + n + "頭立て", W / 2, 328);
      // コース図(大)
      const mx = W / 2, my = 480, rx = 240, ry = 105;
      ctx.strokeStyle = "rgba(255,255,255,.25)"; ctx.lineWidth = 30;
      ctx.beginPath(); ctx.ellipse(mx, my, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = race.surface === "ダート" ? "#a5814a" : "#3f9142"; ctx.lineWidth = 22;
      ctx.beginPath(); ctx.ellipse(mx, my, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      // 走行区間をハイライト(スタート→ゴール)
      const th0 = Math.PI / 2 + course.lapFrac(0) * Math.PI * 2;
      const thSpan = Math.min(D / course.lap, 1) * Math.PI * 2;
      ctx.strokeStyle = "#ffd43b"; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.ellipse(mx, my, rx, ry, 0, th0, th0 + thSpan); ctx.stroke();
      // スタート/ゴールマーカー
      function mark(frac, label, col) {
        const th = Math.PI / 2 + frac * Math.PI * 2;
        const x = mx + rx * Math.cos(th), y = my + ry * Math.sin(th);
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.font = "bold 20px sans-serif";
        ctx.fillText(label, x, y - 20);
      }
      mark(course.lapFrac(0), "START", "#2f9e44");
      mark(course.finishFrac, "GOAL", "#c9312e");
      // 点滅
      if (Math.sin(t * 5) > -0.3) {
        ctx.fillStyle = "#ffd43b"; ctx.font = "bold 30px sans-serif";
        ctx.fillText("まもなく発走", W / 2, 630);
      }
      ctx.textAlign = "left";
    }

    // ---------- リプレイ表示 ----------
    function drawReplayMark(t) {
      const ctx = octx; // 前面レイヤーに描く
      ctx.fillStyle = "rgba(10,14,18,.82)";
      ctx.fillRect(W - 258, 16, 240, 58);
      if (Math.sin(t * 6) > -0.2) {
        ctx.fillStyle = "#e03131";
        ctx.beginPath(); ctx.arc(W - 228, 45, 11, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = "#fff"; ctx.font = "bold 32px sans-serif";
      ctx.fillText("REPLAY", W - 204, 57);
    }

    // ---------- 3Dオブジェクト ----------
    function drawStand(cam, m, t) {
      const c = [
        project(cam, course.pos(m, -(TRACK_HALF + 6), 0)),
        project(cam, course.pos(m + 38, -(TRACK_HALF + 6), 0)),
        project(cam, course.pos(m + 38, -(TRACK_HALF + 6), 13)),
        project(cam, course.pos(m, -(TRACK_HALF + 6), 13)),
      ];
      if (c.some(function (p) { return !p; })) return;
      const hz = hazeOf(c[0].z);
      ctx.save();
      ctx.globalAlpha = 1 - hz;
      const sg = ctx.createLinearGradient(0, c[3].y, 0, c[0].y);
      sg.addColorStop(0, "#7d7d8c"); sg.addColorStop(1, "#5f5f6c");
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.moveTo(c[0].x, c[0].y);
      for (let k = 1; k < 4; k++) ctx.lineTo(c[k].x, c[k].y);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#d9dade";
      ctx.beginPath();
      ctx.moveTo(c[3].x, c[3].y); ctx.lineTo(c[2].x, c[2].y);
      ctx.lineTo(c[2].x, c[2].y - c[2].s * 2.4); ctx.lineTo(c[3].x, c[3].y - c[3].s * 2.4);
      ctx.closePath(); ctx.fill();
      // 段差ライン
      ctx.strokeStyle = "rgba(255,255,255,.14)"; ctx.lineWidth = 1;
      for (let s = 1; s < 4; s++) {
        const fy = s / 4;
        ctx.beginPath();
        ctx.moveTo(c[0].x, c[0].y + (c[3].y - c[0].y) * fy);
        ctx.lineTo(c[1].x, c[1].y + (c[2].y - c[1].y) * fy);
        ctx.stroke();
      }
      // 観客(揺れる)
      const x0 = Math.min(c[0].x, c[1].x), x1 = Math.max(c[0].x, c[1].x);
      const yTop = Math.min(c[2].y, c[3].y), yBot = Math.max(c[0].y, c[1].y);
      if (x1 - x0 > 36 && yBot - yTop > 16) {
        const cols = ["#e5c07b", "#bf616a", "#88c0d0", "#a3be8c", "#d8dee9", "#b48ead"];
        for (let i = 0; i < 110; i++) {
          const fx = ((i * 37 + m * 13) % 97) / 97, fy = ((i * 53 + m * 7) % 89) / 89;
          const wob = Math.sin(t * 2.2 + i) * 1.4;
          ctx.fillStyle = cols[i % 6];
          ctx.fillRect(x0 + fx * (x1 - x0), yTop + 5 + fy * (yBot - yTop - 10) + wob, 2.4, 3);
        }
      }
      ctx.restore();
    }
    function drawTree(cam, m) {
      const base = project(cam, course.pos(m, TRACK_HALF + 16, 0));
      if (!base) return;
      const s = base.s, hz = hazeOf(base.z);
      ctx.save(); ctx.globalAlpha = 1 - hz;
      ctx.fillStyle = "#5a3d20";
      ctx.fillRect(base.x - s * 0.18, base.y - s * 2.4, s * 0.36, s * 2.4);
      ctx.fillStyle = "#2e6b34";
      ctx.beginPath(); ctx.ellipse(base.x, base.y - s * 3.6, s * 1.7, s * 1.9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#3c8144";
      ctx.beginPath(); ctx.ellipse(base.x - s * 0.7, base.y - s * 3.1, s * 1.0, s * 1.1, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    function drawFurlong(cam, m, label) {
      const base = project(cam, course.pos(m, TRACK_HALF + 1.6, 0));
      const top = project(cam, course.pos(m, TRACK_HALF + 1.6, 2.6));
      if (!base || !top || top.s > 220) return;
      ctx.strokeStyle = "#fff"; ctx.lineWidth = SH.clamp(top.s * 0.10, 1.5, 18);
      ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke();
      ctx.fillStyle = "#d33333";
      ctx.beginPath(); ctx.arc(top.x, top.y - top.s * 0.32, Math.max(2.5, top.s * 0.34), 0, Math.PI * 2); ctx.fill();
      if (top.s > 7) {
        ctx.fillStyle = "#fff"; ctx.font = "bold " + Math.max(10, top.s * 0.5) + "px sans-serif";
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
      ctx.fillStyle = "#c9312e"; ctx.font = "bold " + Math.max(9, s * 0.72) + "px sans-serif";
      ctx.textAlign = "center"; ctx.fillText("GOAL", top.x, top.y - s * 0.28); ctx.textAlign = "left";
    }
    function drawGates(cam, t) {
      const open = t >= 0 ? Math.min(1, t * 3) : 0;
      for (let i = 0; i < n; i++) {
        const gl = -8 + 16 * (i / Math.max(1, n - 1));
        const base = project(cam, course.pos(-1.2, gl, 0));
        const top = project(cam, course.pos(-1.2, gl, 2.1));
        if (!base || !top) continue;
        const s = top.s;
        const gg = ctx.createLinearGradient(top.x - s * 0.75, 0, top.x + s * 0.75, 0);
        gg.addColorStop(0, "#aab2bc"); gg.addColorStop(0.5, "#8d949e"); gg.addColorStop(1, "#767d87");
        ctx.fillStyle = gg;
        ctx.fillRect(top.x - s * 0.75, top.y, s * 1.5, base.y - top.y);
        ctx.strokeStyle = "#6a717b"; ctx.lineWidth = Math.max(1, s * 0.06);
        ctx.strokeRect(top.x - s * 0.75, top.y, s * 1.5, base.y - top.y);
        if (open < 1) {
          ctx.fillStyle = "rgba(196,202,210," + (1 - open) + ")";
          ctx.fillRect(top.x - s * 0.75 + open * s * 0.7, top.y, s * 0.42, base.y - top.y);
        }
      }
    }
    function drawPart(cam, p) {
      const pr = project(cam, course.pos(p.m, p.lt, p.y));
      if (!pr) return;
      const a = SH.clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = turf.kick;
      ctx.globalAlpha = a * 0.75;
      const r = Math.max(1, pr.s * (0.08 + 0.1 * (1 - a)));
      ctx.beginPath(); ctx.arc(pr.x, pr.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    function drawRunner(cam, i, pos, rankIdx, t, dtWorld) {
      const r = field.runners[i];
      const m = Math.min(pos[i], D + 40);
      const wp = course.pos(m, lat[i], 0);
      const pr = project(cam, wp);
      if (!pr || pr.x < -140 || pr.x > W + 140) return;
      const running = t >= 0 && sim.times[i] > t;
      const phase = (m / 3.4) + i * 1.7;
      const h = course.heading(m);
      const frontness = vdot(h, cam.f);
      const sideness = vdot(h, cam.r);
      const sc = pr.s * 0.062;
      const hz = hazeOf(pr.z);

      // 地面の投影影
      const shSc = use3d ? sc * 1.35 : sc;
      ctx.save();
      ctx.globalAlpha = (1 - hz) * 0.30;
      ctx.fillStyle = "#0a0f08";
      ctx.beginPath();
      ctx.ellipse(pr.x + shSc * 2, pr.y + shSc * 0.5, shSc * 26, shSc * 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 蹴り上げ土煙(近距離・走行中)
      if (running && pr.s > 5 && Math.sin(phase) < -0.55 && parts.length < 260) {
        for (let k = 0; k < 2; k++) {
          parts.push({
            m: m - 1.5 - Math.random() * 1.2,
            lt: lat[i] + (Math.random() - 0.5) * 1.4,
            y: 0.15,
            vm: -(0.5 + Math.random() * 1.6),
            vy: 2.6 + Math.random() * 2.4,
            life: 0.5 + Math.random() * 0.25,
            max: 0.7,
          });
        }
      }

      if (use3d) {
        // 3Dモデルの位置・向き・ポーズを更新(描画はレンダラーが一括)
        const h3 = horses3[i];
        h3.group.visible = true;
        h3.pose(phase, running); // pose内でy(上下動)を設定
        h3.group.position.x = wp.x;
        h3.group.position.z = wp.z;
        h3.group.rotation.y = Math.atan2(-h.z, h.x);
      } else {
        ctx.save();
        ctx.globalAlpha = 1 - hz * 0.8;
        ctx.translate(pr.x, pr.y);
        if (frontness < -0.78) spriteFront(ctx, sc, phase, coatOf[i], SH.WAKU_COLORS[r.waku - 1], r.gate, running);
        else if (frontness > 0.78) spriteRear(ctx, sc, phase, coatOf[i], SH.WAKU_COLORS[r.waku - 1], r.gate, running);
        else {
          const xsq = SH.clamp(Math.abs(sideness), 0.45, 1); // 3/4視の圧縮
          spriteSide(ctx, sc, sideness > 0, xsq, phase, coatOf[i], SH.WAKU_COLORS[r.waku - 1], r.gate, running);
        }
        ctx.restore();
      }

      const rank = rankIdx.indexOf(i);
      if ((rank < 3 || r.kind === "owned") && t >= 0 && pr.s > 5) {
        octx.font = "bold 19px sans-serif";
        const tw = octx.measureText(r.name).width;
        const ny = pr.y - (use3d ? 62 : 46) * sc - 14;
        octx.fillStyle = "rgba(0,0,0,.55)";
        octx.fillRect(pr.x - tw / 2 - 7, ny - 19, tw + 14, 26);
        octx.fillStyle = r.kind === "owned" ? "#ffd43b" : "#fff";
        octx.fillText(r.name, pr.x - tw / 2, ny);
      }
    }

    // ---------- オーバーレイ ----------
    function banner(text, bg, fg) {
      const ctx = octx; // 前面レイヤーに描く
      ctx.font = "bold 44px sans-serif";
      const tw = ctx.measureText(text).width;
      const bx = W / 2 - tw / 2 - 30, by = 280;
      ctx.fillStyle = bg; ctx.fillRect(bx, by, tw + 60, 68);
      ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 2.5;
      ctx.strokeRect(bx, by, tw + 60, 68);
      ctx.fillStyle = fg; ctx.fillText(text, W / 2 - tw / 2, by + 50);
    }

    function drawOverlay(t, pos, rankIdx, remain) {
      const ctx = octx; // 前面レイヤーに描く
      const gradeCol = race.grade === "G1" || race.grade === "WBC" || race.grade === "J-G1" ? "#1c7ed6"
        : race.grade === "G2" || race.grade === "J-G2" ? "#e03131"
          : race.grade === "G3" || race.grade === "J-G3" ? "#2f9e44" : "#555f6a";
      ctx.font = "bold 28px sans-serif";
      const nameW = ctx.measureText(race.name).width;
      ctx.fillStyle = "rgba(10,14,18,.82)";
      ctx.fillRect(18, 16, Math.max(430, nameW + 170), 86);
      ctx.fillStyle = gradeCol;
      ctx.fillRect(18, 16, 9, 86);
      ctx.fillRect(40, 26, 74, 34);
      ctx.fillStyle = "#fff"; ctx.font = "bold 23px sans-serif";
      ctx.fillText(race.grade, 50, 52);
      ctx.font = "bold 28px sans-serif";
      ctx.fillText(race.name, 128, 53);
      ctx.font = "19px sans-serif"; ctx.fillStyle = "#c8d2dc";
      ctx.fillText(race.course + " " + race.surface + race.dist + "m  馬場:" + field.condition, 40, 88);

      if (t < 0) return;
      ctx.fillStyle = "rgba(10,14,18,.82)";
      ctx.fillRect(W - 258, 16, 240, 58);
      ctx.fillStyle = "#ffd43b"; ctx.font = "bold 35px sans-serif";
      const remShow = remain <= 0 ? "GOAL" : "残り " + (Math.ceil(remain / 10) * 10) + "m";
      ctx.fillText(remShow, W - 242, 59);
      // 経過タイム
      ctx.fillStyle = "rgba(10,14,18,.82)";
      ctx.fillRect(W - 258, 80, 240, 42);
      ctx.fillStyle = "#fff"; ctx.font = "bold 26px sans-serif";
      ctx.fillText("TIME " + fmtTime(Math.min(t, winTime)), W - 242, 110);
      // 実況テロップ(最新の一言を4.5秒表示)
      if (lastStory && t - lastStory.at < 4.5 && t > 0.4) {
        ctx.font = "bold 27px sans-serif";
        const tw = ctx.measureText(lastStory.text).width;
        const bx = W / 2 - tw / 2 - 18, by = H - 118;
        ctx.fillStyle = "rgba(6,10,18,.78)";
        ctx.fillRect(bx, by, tw + 36, 44);
        ctx.fillStyle = "#ffd43b";
        ctx.fillRect(bx, by, 6, 44);
        ctx.fillStyle = "#fff";
        ctx.fillText(lastStory.text, W / 2 - tw / 2, by + 32);
      }

      // コースマップ
      const mx = W - 126, my = 168, rx = 92, ry = 44;
      ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 12;
      ctx.beginPath(); ctx.ellipse(mx, my, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.78)"; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.ellipse(mx, my, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      function mapTheta(frac) { return Math.PI / 2 + frac * Math.PI * 2; }
      const fTh = mapTheta(course.finishFrac);
      ctx.fillStyle = "#c9312e";
      ctx.save();
      ctx.translate(mx + rx * Math.cos(fTh), my + ry * Math.sin(fTh));
      ctx.fillRect(-2.5, -9, 5, 18);
      ctx.restore();
      for (let k = Math.min(n, 18) - 1; k >= 0; k--) {
        const i = rankIdx[k];
        const th = mapTheta(course.lapFrac(pos[i]));
        const r = field.runners[i];
        ctx.fillStyle = SH.WAKU_COLORS[r.waku - 1];
        ctx.beginPath(); ctx.arc(mx + rx * Math.cos(th), my + ry * Math.sin(th), k === 0 ? 6.5 : 5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 1.2; ctx.stroke();
      }

      // 隊列チップ
      const show = Math.min(n, 18);
      const cw = 38, ch = 38, pad = 5;
      const total = show * (cw + pad);
      const x0 = W / 2 - total / 2;
      ctx.fillStyle = "rgba(10,14,18,.75)";
      ctx.fillRect(x0 - 12, H - 58, total + 24, 50);
      ctx.font = "bold 19px sans-serif";
      for (let k = 0; k < show; k++) {
        const i = rankIdx[k];
        const r = field.runners[i];
        const x = x0 + k * (cw + pad);
        ctx.fillStyle = SH.WAKU_COLORS[r.waku - 1];
        ctx.fillRect(x, H - 50, cw, ch);
        if (r.kind === "owned") { ctx.strokeStyle = "#ffd43b"; ctx.lineWidth = 3.5; ctx.strokeRect(x, H - 50, cw, ch); }
        ctx.fillStyle = SH.WAKU_TEXT[r.waku - 1];
        const s2 = String(r.gate);
        ctx.fillText(s2, x + cw / 2 - ctx.measureText(s2).width / 2, H - 24);
      }
      ctx.fillStyle = "#b8c2cc"; ctx.font = "14px sans-serif";
      ctx.fillText("現在の隊列 →", x0 - 10, H - 64);
    }

    // ---------- 着順確定掲示板 ----------
    function drawBoard(bt) {
      const ctx = octx; // 前面レイヤーに描く
      ctx.fillStyle = "rgba(5,9,20,.92)";
      ctx.fillRect(0, 0, W, H);
      // ヘッダ(「確定」ランプ)
      ctx.fillStyle = "#101a30";
      ctx.fillRect(140, 60, W - 280, 78);
      ctx.strokeStyle = "#3a4a66"; ctx.lineWidth = 2;
      ctx.strokeRect(140, 60, W - 280, 78);
      if (Math.sin(bt * 4) > -0.4) {
        ctx.fillStyle = "#e03131";
        ctx.fillRect(170, 80, 96, 40);
        ctx.fillStyle = "#fff"; ctx.font = "bold 28px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("確定", 218, 110);
      }
      ctx.fillStyle = "#fff"; ctx.font = "bold 36px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(race.name + "  レース結果", W / 2 + 40, 112);
      ctx.textAlign = "left";
      // 勝ちタイム
      ctx.fillStyle = "#ffd43b"; ctx.font = "bold 30px sans-serif";
      ctx.fillText("勝ちタイム " + fmtTime(winTime), 170, 190);
      ctx.fillStyle = "#c8d2dc"; ctx.font = "22px sans-serif";
      ctx.fillText(race.surface + race.dist + "m ／ 馬場:" + field.condition, 640, 190);
      // 上位5頭
      const rows = Math.min(5, sim.order.length);
      for (let k = 0; k < rows; k++) {
        const idx = sim.order[k];
        const r = field.runners[idx];
        const y = 226 + k * 84;
        ctx.fillStyle = r.kind === "owned" ? "rgba(255,212,59,.12)" : "rgba(255,255,255,.05)";
        ctx.fillRect(140, y, W - 280, 72);
        // 着順
        ctx.fillStyle = k === 0 ? "#ffd43b" : "#fff";
        ctx.font = "bold 42px sans-serif"; ctx.textAlign = "center";
        ctx.fillText(String(k + 1), 190, y + 50);
        // 枠色の馬番
        ctx.fillStyle = SH.WAKU_COLORS[r.waku - 1];
        ctx.fillRect(240, y + 14, 46, 46);
        ctx.fillStyle = SH.WAKU_TEXT[r.waku - 1]; ctx.font = "bold 28px sans-serif";
        ctx.fillText(String(r.gate), 263, y + 48);
        // 馬名・騎手
        ctx.textAlign = "left";
        ctx.fillStyle = r.kind === "owned" ? "#ffd43b" : "#fff";
        ctx.font = "bold 32px sans-serif";
        ctx.fillText(r.name + (r.kind === "owned" ? " ★" : ""), 316, y + 48);
        ctx.fillStyle = "#98a6b6"; ctx.font = "22px sans-serif";
        ctx.fillText(r.jockey.name, 700, y + 46);
        // タイム・着差
        ctx.fillStyle = "#dbe4ee"; ctx.font = "bold 26px sans-serif";
        ctx.fillText(fmtTime(sim.times[idx]), 830, y + 47);
        if (k > 0) {
          const d = sim.times[idx] - sim.times[sim.order[k - 1]];
          ctx.fillStyle = "#98a6b6"; ctx.font = "24px sans-serif";
          ctx.fillText(marginLabel(d), 990, y + 47);
        }
      }
      ctx.fillStyle = "#98a6b6"; ctx.font = "22px sans-serif"; ctx.textAlign = "center";
      if (Math.sin(bt * 3) > -0.3) ctx.fillText("画面タップで払い戻しへ ▶", W / 2, 680);
      ctx.textAlign = "left";
    }

    // ---------- 再生ループ(ライブ→リプレイ→掲示板) ----------
    let flash = 0;
    let last = performance.now();
    let goalFlashed = false;
    view.phase = "live";
    let replayT = 0, boardT = 0;
    const REPLAY_FROM = Math.max(0.5, winTime - 7);

    // タップでフェーズ送り(タイトル/リプレイ/掲示板のスキップ)
    fgCanvas.addEventListener("click", function () {
      if (view.phase === "live" && view.t < 0) view.t = -0.01;      // 紹介スキップ
      else if (view.phase === "replay") { view.phase = "board"; boardT = 0; }
      else if (view.phase === "board") { view.cancel(); onDone(); }
    });

    function loop(now) {
      if (view.done) return;
      const el = Math.min(0.1, (now - last) / 1000);
      last = now;

      if (view.phase === "live") {
        let sp = view.speed;
        const posNow = posAt(Math.max(0, view.t));
        const leadNow = Math.max.apply(null, posNow);
        if (view.t >= 0 && D - leadNow < 90 && view.t < winTime) sp *= 0.32;
        if (view.t < 0) sp = 1;
        const dtWorld = el * sp;
        view.t += dtWorld;
        draw(view.t, dtWorld);
        pushStory(view.t + 0.8);
        if (!goalFlashed && view.t >= winTime) { flash = 0.85; goalFlashed = true; }
        const endT = goalTime + (photoFinish ? 3.4 : 2.4);
        if (view.t >= endT) { view.phase = "replay"; replayT = REPLAY_FROM; camMode = ""; }
      } else if (view.phase === "replay") {
        const dtWorld = el * 1.2; // スローリプレイ
        replayT += dtWorld;
        draw(replayT, dtWorld, "replay");
        if (replayT >= winTime + 0.8) { view.phase = "board"; boardT = 0; }
      } else { // board
        boardT += el;
        drawBoard(boardT);
        if (boardT >= 7) {
          view.done = true;
          setTimeout(onDone, 200);
          return;
        }
      }
      view.raf = requestAnimationFrame(loop);
    }
    view.raf = requestAnimationFrame(loop);
    return view;
  };
})(window.SH);
