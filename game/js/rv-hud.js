// ============================================================
// rv-hud.js — SH.RVHud: 2D HUD レンダラ(設計§2.6 / 仕様§2)
//  ・論理 2560×720 前面レイヤ(fgCanvas 等倍)へ H-1〜H-8/H-10 + 実況を描画
//  ・drawLive(ctx): 毎フレーム全再描画(§2.6 の描画順)。放送HUDは p 基準フェード
//  ・drawTitle / drawReplay / drawBoard: 番組フェーズ(既存様式を座標転記・§2.9)
//  ・隊列チップ順位スライド(§3.3)・残距離スライド(§3.2)・凡例行高自動縮小(H-5)
//  ・全枠色は SH.WAKU_COLORS / SH.WAKU_TEXT のみ参照(AC-6)。オリジナル描画のみ
// ============================================================
"use strict";
(function (SH) {
  const HUD = {};
  SH.RVHud = HUD;

  const VW = 1280, VH = 720, DW = 2560, DH = 720;
  const BAND_H = 60, X_L = 380, X_R = 1580;
  const P_HUD_ON = 0.085, DP_FADE = 0.020;
  const LEGEND_COLS = 6, RH_MIN = 34, RH_MAX = 44;
  const PASS_HOLD = 10.0, PASS_FADE = 0.5, PASS_MIN_D = 1600;
  const CHIP_SLIDE = 0.35, CHIP_MAX = 8;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeOut(u) { return 1 - (1 - u) * (1 - u); }

  function fmtElapsed(sec) {                     // 'ss / m'ss(分0省略・秒切捨)
    if (!isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60), s = Math.floor(sec - m * 60);
    return (m > 0 ? m + "'" : "'") + (s < 10 ? "0" : "") + s;
  }
  function fmtPass(sec) {                          // 'ss.d(1000m通過)
    if (!isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60), s = sec - m * 60;
    return (m > 0 ? m + "'" : "'") + (s < 10 ? "0" : "") + s.toFixed(1);
  }
  function gradeLabel(g) {
    if (g === "WBC" || g === "G1" || g === "J-G1") return "GI";
    if (g === "G2" || g === "J-G2") return "GII";
    if (g === "G3" || g === "J-G3") return "GIII";
    return "";
  }

  HUD.create = function (fgCanvas, race, field, sim) {
    const octx = fgCanvas.getContext("2d");
    const runners = field.runners;
    const n = runners.length;
    const WAKU = SH.WAKU_COLORS, WTXT = SH.WAKU_TEXT;
    const D = race.dist;
    const finiteTimes = sim.times.filter(function (x) { return x < 900; });
    const winTime = Math.min.apply(null, sim.times);
    const goalTime = Math.max.apply(null, finiteTimes);

    // 凡例レイアウト(頭数で確定・行高自動縮小 + 領域上方拡張)
    const Rrow = Math.ceil(n / LEGEND_COLS);
    const rh = clamp(Math.floor(88 / Rrow), RH_MIN, RH_MAX);
    const yLegTop = VH - 8 - rh * Rrow;
    const layout = { Rrow: Rrow, rh: rh, yLegTop: yLegTop };

    // 隊列チップ順位スライド状態(runnerIdx → {x,alpha,from,to,t0})
    const chipAnim = {};

    // ビネット(2560×720・キャッシュ)
    const vig = document.createElement("canvas"); vig.width = DW; vig.height = DH;
    (function () {
      const c = vig.getContext("2d");
      const g = c.createRadialGradient(DW / 2, DH / 2, DH * 0.5, DW / 2, DH / 2, DH * 1.05);
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(8,10,16,.3)"); // Fable5: 実機は周辺減光が弱い

      c.fillStyle = g; c.fillRect(0, 0, DW, DH);
    })();

    // ---- 放送HUD フェーズ(§2.0)----
    function phaseOf(p) {
      const hudPhase = p < P_HUD_ON ? "pre" : p < P_HUD_ON + DP_FADE ? "fadein" : "on";
      const u = clamp((p - P_HUD_ON) / DP_FADE, 0, 1);
      const hudAlpha = hudPhase === "pre" ? 0 : hudPhase === "on" ? 1 : easeOut(u);
      return { hudPhase: hudPhase, hudAlpha: hudAlpha };
    }

    // ============================================================
    // 個別描画関数
    // ============================================================
    // (1) セパレータ(デュアル時のみ・§1.3)
    function drawSeparator() { octx.fillStyle = "#0a0e12"; octx.fillRect(1278, 0, 4, DH); }

    // (2) H-1 上部帯
    function drawTopBand(a) {
      // Fable5総見直し: 実機の上部帯は彩度の高い草緑(夜でも明るい)
      const g = octx.createLinearGradient(0, 0, 0, BAND_H);
      g.addColorStop(0, "#35b345"); g.addColorStop(1, "#1e7d2a");
      octx.globalAlpha = 0.9 * a; octx.fillStyle = g; octx.fillRect(0, 0, DW, BAND_H);
      octx.globalAlpha = 0.5 * a; octx.fillStyle = "rgb(190,236,178)"; octx.fillRect(0, BAND_H - 3, DW, 3);
      octx.globalAlpha = 1;
    }

    // 紅白3段縞ポールアイコン(幅7×高44)
    function drawPoleIcon(x, y) {
      octx.fillStyle = "#e03131"; octx.fillRect(x, y, 7, 44);
      octx.fillStyle = "#ffffff"; octx.fillRect(x, y + 15, 7, 14);
    }

    // (3) H-2 残距離数字スライド。返り値 {xNum,numW}(H-3 の非重複計算へ渡す)
    function drawDistSlide(a, R) {
      if (R <= 0 || a <= 0) return { xNum: null, numW: 0 };
      const Vshow = Math.ceil(R / 100) * 100;
      const f = (R % 100) / 100;                       // 1→0 で次の100m標識へ到達
      const xNum = X_R - (1 - f) * (X_R - X_L);          // f減少で右→左スライド(境界横断)
      const yNum = 4;
      // Fable5総見直し: 実機の残距離数字は太イタリック大サイズ+濃緑縁取り
      octx.font = "italic bold 52px sans-serif"; octx.textAlign = "left"; octx.textBaseline = "top";
      const numW = octx.measureText(String(Vshow)).width;
      drawPoleIcon(xNum - 17, 8);
      octx.globalAlpha = a;
      octx.shadowColor = "rgba(0,0,0,.45)"; octx.shadowOffsetX = 3; octx.shadowOffsetY = 3;
      octx.lineWidth = 7; octx.strokeStyle = "#0c3d14"; octx.strokeText(String(Vshow), xNum, yNum);
      octx.fillStyle = "#ffffff"; octx.fillText(String(Vshow), xNum, yNum);
      octx.shadowColor = "transparent"; octx.shadowOffsetX = 0; octx.shadowOffsetY = 0;
      octx.globalAlpha = 1; octx.textBaseline = "alphabetic";
      return { xNum: xNum, numW: numW };
    }

    // 盾形チップパス(§2.1 転記)
    function shieldPath(cx, cy, cw, chH) {
      const r = 6, tip = 10;
      octx.beginPath();
      octx.moveTo(cx + r, cy);
      octx.lineTo(cx + cw - r, cy); octx.arcTo(cx + cw, cy, cx + cw, cy + r, r);
      octx.lineTo(cx + cw, cy + chH - tip);
      octx.lineTo(cx + cw / 2, cy + chH);
      octx.lineTo(cx, cy + chH - tip);
      octx.lineTo(cx, cy + r); octx.arcTo(cx, cy, cx + r, cy, r);
      octx.closePath();
    }

    // (4) H-3 隊列チップ(盾形・順位スライド)+ H-4 自馬タグ
    // Fable5総見直し: 実機はチップ列が画面継ぎ目を中心に並び、先頭(1位)が左端。
    // 残距離数字とは重なり得るがチップを後描き(上)にして実機の重なり方に合わせる。
    function drawFormation(a, rankIdx, t) {
      if (a <= 0) return;
      const Nchip = Math.min(n, CHIP_MAX), gap = 6, cw = 44;
      const x0 = DW / 2 - (Nchip * (cw + gap) - gap) / 2;
      const shown = {};
      for (let slot = 0; slot < Nchip; slot++) {
        const i = rankIdx[slot]; if (i == null) continue; shown[i] = 1;
        const r = runners[i];
        const targetX = x0 + slot * (cw + gap);                 // 左端=1位、右へ
        let anm = chipAnim[i];
        if (anm == null) anm = chipAnim[i] = { x: 2540 + cw, alpha: 0, from: 2540 + cw, to: targetX, t0: t };
        else if (anm.to !== targetX) { anm.from = anm.x; anm.to = targetX; anm.t0 = t; }
        const u = clamp((t - anm.t0) / CHIP_SLIDE, 0, 1), e = easeOut(u);
        anm.x = anm.from + (anm.to - anm.from) * e; anm.alpha = Math.min(1, e);
        const own = r.kind === "owned";
        const chH = own ? 38 * 1.15 : 38, cy = 20;
        const ga = a * anm.alpha;
        // 盾チップ
        shieldPath(anm.x, cy, cw, chH);
        octx.globalAlpha = ga; octx.fillStyle = WAKU[r.waku - 1]; octx.fill();
        octx.lineWidth = 1.5; octx.strokeStyle = "rgba(0,0,0,.45)"; octx.stroke();
        octx.fillStyle = WTXT[r.waku - 1]; octx.font = "bold 28px sans-serif";
        octx.textAlign = "center"; octx.textBaseline = "top";
        octx.fillText(String(r.gate), anm.x + cw / 2, cy + chH * 0.1);
        // H-4 自馬タグ(専用ゾーン y∈[0,20])
        if (own) {
          octx.fillStyle = "#f76707";
          const tr = 4; const tx = anm.x, ty = 0, tw = cw, th = 20;
          octx.beginPath();
          octx.moveTo(tx + tr, ty); octx.arcTo(tx + tw, ty, tx + tw, ty + th, tr);
          octx.arcTo(tx + tw, ty + th, tx, ty + th, tr); octx.arcTo(tx, ty + th, tx, ty, tr);
          octx.arcTo(tx, ty, tx + tw, ty, tr); octx.closePath(); octx.fill();
          octx.fillStyle = "#fff"; octx.font = "bold 18px sans-serif"; octx.textBaseline = "middle";
          octx.fillText(String(slot + 1), tx + tw / 2, ty + 11);
        }
        octx.globalAlpha = 1; octx.textBaseline = "alphabetic"; octx.textAlign = "left";
      }
      // ウィンドウ外へ落ちたチップの状態を破棄(次回インは右端画面外から再フェード)
      for (const key in chipAnim) { if (!shown[key]) delete chipAnim[key]; }
    }

    // 名前の字詰め描画(scaleX≥0.8 + 末尾省略)
    function drawName(text, x, y, maxW) {
      octx.font = "bold 28px sans-serif"; octx.textBaseline = "middle"; octx.textAlign = "left";
      let str = text, w = octx.measureText(str).width;
      let sx = 1;
      if (w > maxW) { sx = Math.max(0.8, maxW / w); if (w * sx > maxW) { while (str.length > 1 && octx.measureText(str + "…").width * sx > maxW) str = str.slice(0, -1); str += "…"; } }
      octx.save(); octx.translate(x, y); octx.scale(sx, 1);
      // Fable5総見直し: 実機の馬名は太い白文字+強い黒縁(夜景でも判読可)
      octx.lineWidth = 4.5; octx.lineJoin = "round"; octx.strokeStyle = "rgba(0,0,0,.9)"; octx.strokeText(str, 0, 0);
      octx.fillStyle = "#fff"; octx.fillText(str, 0, 0);
      octx.restore();
    }

    // 凡例1セル
    function drawLegCell(gate, x, y, cellW, cellRh) {
      const r = runners.find(function (rr) { return rr.gate === gate; });
      if (!r) return;
      const own = r.kind === "owned";
      const chipW = 46, chipH = Math.min(cellRh - 6, 38), cy = y + (cellRh - chipH) / 2;
      // 枠色チップ(角丸r4)
      const rr = 4;
      octx.beginPath();
      octx.moveTo(x + rr, cy); octx.arcTo(x + chipW, cy, x + chipW, cy + chipH, rr);
      octx.arcTo(x + chipW, cy + chipH, x, cy + chipH, rr); octx.arcTo(x, cy + chipH, x, cy, rr);
      octx.arcTo(x, cy, x + chipW, cy, rr); octx.closePath();
      octx.fillStyle = WAKU[r.waku - 1]; octx.fill();
      if (own) { octx.lineWidth = 2.5; octx.strokeStyle = "#f76707"; octx.stroke(); }
      else { octx.lineWidth = 1.5; octx.strokeStyle = "rgba(255,255,255,.7)"; octx.stroke(); }
      octx.fillStyle = WTXT[r.waku - 1]; octx.font = "bold 28px sans-serif";
      octx.textAlign = "center"; octx.textBaseline = "middle";
      octx.fillText(String(gate), x + chipW / 2, cy + chipH / 2);
      drawName((own ? "★" : "") + r.name, x + chipW + 10, cy + chipH / 2, cellW - chipW - 16);
      octx.textAlign = "left"; octx.textBaseline = "alphabetic";
    }

    // (5) H-5 出走馬凡例(6列×Rrow行・左右分担)
    function drawLegend() {
      const leftL = 24, leftW = (1256 - 24) / 3;
      const rightL = 1304, rightW = (2536 - 1304) / 3;
      for (let row = 0; row < Rrow; row++) {
        for (let col = 0; col < LEGEND_COLS; col++) {
          const gate = row * LEGEND_COLS + col + 1;
          if (gate > n) continue;
          const y = yLegTop + row * rh;
          if (col < 3) drawLegCell(gate, leftL + col * leftW, y, leftW, rh);
          else drawLegCell(gate, rightL + (col - 3) * rightW, y, rightW, rh);
        }
      }
    }

    // (6) H-6 経過タイム
    function drawElapsed(t) {
      octx.font = "italic bold 40px sans-serif"; octx.fillStyle = "#fff"; octx.textAlign = "left"; octx.textBaseline = "top";
      octx.shadowColor = "rgba(0,0,0,.55)"; octx.shadowBlur = 4;
      octx.fillText(fmtElapsed(Math.min(t, winTime)), 40, yLegTop - 52);
      octx.shadowBlur = 0; octx.shadowColor = "transparent"; octx.textBaseline = "alphabetic";
    }

    // (7) H-7 1000m通過タイム(D≥1600のみ・保持10s+0.5sフェード)
    function drawPass1000(t, passTime) {
      if (D < PASS_MIN_D || passTime == null) return;
      const dtp = t - passTime;
      if (dtp < 0 || dtp > PASS_HOLD + PASS_FADE) return;
      const a = dtp <= PASS_HOLD ? 1 : easeOut(1 - (dtp - PASS_HOLD) / PASS_FADE);
      octx.globalAlpha = a;
      const x = 40, y = yLegTop - 130;
      octx.font = "bold 20px sans-serif"; octx.fillStyle = "#fff"; octx.textAlign = "left"; octx.textBaseline = "top";
      octx.fillText("1000m通過タイム", x, y);
      octx.fillStyle = "#e0501f"; octx.fillRect(x, y + 24, 200, 46);
      octx.fillStyle = "#fff"; octx.font = "bold 34px sans-serif"; octx.textBaseline = "middle";
      octx.fillText(fmtPass(passTime), x + 12, y + 24 + 23);
      octx.globalAlpha = 1; octx.textBaseline = "alphabetic";
    }

    // (8) H-8 レース名(serif・右詰め)
    function drawRaceName(a) {
      if (a <= 0) return;
      octx.globalAlpha = a; octx.textAlign = "right"; octx.textBaseline = "top";
      octx.shadowColor = "rgba(0,0,0,.6)"; octx.shadowBlur = 3;
      const gl = gradeLabel(race.grade);
      const y = yLegTop - 52;
      if (gl) { octx.font = "bold 30px serif"; octx.fillStyle = "#fff"; octx.fillText("【" + gl + "】", 2536, y + 8); }
      const gw = gl ? octx.measureText("【" + gl + "】").width + 8 : 0;
      octx.font = "bold 40px serif"; octx.fillStyle = "#fff"; octx.fillText(race.name, 2536 - gw, y);
      octx.shadowBlur = 0; octx.shadowColor = "transparent";
      octx.globalAlpha = 1; octx.textAlign = "left"; octx.textBaseline = "alphabetic";
    }

    // (9) 雨(昼・稍重以上)
    let _rainSeed = 0;
    function drawRain(night) {
      const cond = field.condition;
      if (night || !(cond === "稍重" || cond === "重" || cond === "不良")) return;
      const dens = cond === "不良" ? 220 : cond === "重" ? 150 : 90;
      octx.strokeStyle = "rgba(200,215,230,0.35)"; octx.lineWidth = 1.5; octx.beginPath();
      _rainSeed = (_rainSeed + 37) % 1000;
      for (let i = 0; i < dens; i++) {
        const x = (i * 137 + _rainSeed * 2.3) % DW, y = (i * 313 + _rainSeed * 5.1) % DH;
        octx.moveTo(x, y); octx.lineTo(x - 6, y + 22);
      }
      octx.stroke();
    }

    // (11) H-10 バナー(全幅中央)
    function drawBanner(text, bg, fg) {
      octx.font = "bold 46px sans-serif"; octx.textBaseline = "alphabetic";
      const tw = octx.measureText(text).width, bx = DW / 2 - tw / 2 - 30, by = 300;
      octx.fillStyle = bg; octx.fillRect(bx, by, tw + 60, 70);
      octx.strokeStyle = "rgba(255,255,255,.8)"; octx.lineWidth = 2.5; octx.strokeRect(bx, by, tw + 60, 70);
      octx.fillStyle = fg; octx.textAlign = "left"; octx.fillText(text, DW / 2 - tw / 2, by + 50);
    }

    // (12) 実況テロップ(全幅中央・4.5秒)
    function drawStoryTicker(lastStory, t) {
      if (!lastStory || t <= 0.4 || t - lastStory.at >= 4.5) return;
      octx.font = "bold 28px sans-serif"; octx.textAlign = "left"; octx.textBaseline = "alphabetic";
      // H-5凡例・経過タイム行との一時重なりを回避(凡例上端から更に上へ)
      const tw = octx.measureText(lastStory.text).width, bx = DW / 2 - tw / 2 - 18, by = yLegTop - 110;
      octx.fillStyle = "rgba(6,10,18,.78)"; octx.fillRect(bx, by, tw + 36, 44);
      octx.fillStyle = "#ffd43b"; octx.fillRect(bx, by, 6, 44);
      octx.fillStyle = "#fff"; octx.fillText(lastStory.text, DW / 2 - tw / 2, by + 32);
    }

    // ============================================================
    // drawLive(ctx) — §2.6 の描画順で全再描画。返り値 {hudPhase,hudAlpha}
    //   ctx = {t, p, R, rankIdx, dual, night, passTime1000m, flash, lastStory,
    //          bannerText, bannerBg, bannerFg}
    // ============================================================
    function drawLive(ctx) {
      const ph = phaseOf(ctx.p), a = ph.hudAlpha;
      octx.clearRect(0, 0, DW, DH);
      if (ctx.dual) drawSeparator();                         // (1)
      if (a > 0) {                                            // (2)(3)(4)(8)
        drawTopBand(a);
        drawDistSlide(a, ctx.R);
        drawFormation(a, ctx.rankIdx, ctx.t);   // 数字より後描き=実機同様チップが上
        drawRaceName(a);
      }
      drawLegend();                                          // (5) 常時
      if (ctx.t >= 0) drawElapsed(ctx.t);                    // (6) 発走時から
      drawPass1000(ctx.t, ctx.passTime1000m);                // (7)
      drawRain(ctx.night);                                   // (9)
      octx.drawImage(vig, 0, 0);                             // (10)
      if (ctx.flash > 0) { octx.fillStyle = "rgba(255,255,255," + ctx.flash + ")"; octx.fillRect(0, 0, DW, DH); }
      if (ctx.bannerText) drawBanner(ctx.bannerText, ctx.bannerBg, ctx.bannerFg); // (11)
      drawStoryTicker(ctx.lastStory, ctx.t);                 // (12)
      return ph;
    }

    // ============================================================
    // 番組フェーズ(タイトル/リプレイ/掲示板)= 既存様式を translate 中央配置
    // ============================================================
    function drawTitle(t, night) {
      octx.clearRect(0, 0, DW, DH);
      octx.save(); octx.translate((DW - 1280) / 2, 0); const W = 1280;
      octx.textBaseline = "alphabetic";
      octx.fillStyle = "rgba(8,12,22,.92)"; octx.fillRect(-(DW - 1280) / 2, 0, DW, DH);
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

    function drawReplay(t) {
      octx.clearRect(0, 0, DW, DH);
      octx.drawImage(vig, 0, 0);
      octx.fillStyle = "rgba(10,14,18,.82)"; octx.fillRect(DW - 258, 16, 240, 58);
      if (Math.sin(t * 6) > -0.2) { octx.fillStyle = "#e03131"; octx.beginPath(); octx.arc(DW - 228, 45, 11, 0, Math.PI * 2); octx.fill(); }
      octx.fillStyle = "#fff"; octx.font = "bold 32px sans-serif"; octx.textAlign = "left"; octx.textBaseline = "alphabetic"; octx.fillText("REPLAY", DW - 204, 57);
    }

    function drawBoard(bt) {
      octx.clearRect(0, 0, DW, DH);
      octx.save(); octx.translate((DW - 1280) / 2, 0); const W = 1280;
      octx.textBaseline = "alphabetic";
      octx.fillStyle = "rgba(5,9,20,.95)"; octx.fillRect(-(DW - 1280) / 2, 0, DW, DH);
      octx.fillStyle = "#101a30"; octx.fillRect(140, 60, W - 280, 78);
      octx.strokeStyle = "#3a4a66"; octx.lineWidth = 2; octx.strokeRect(140, 60, W - 280, 78);
      if (Math.sin(bt * 4) > -0.4) { octx.fillStyle = "#e03131"; octx.fillRect(170, 80, 96, 40); octx.fillStyle = "#fff"; octx.font = "bold 28px sans-serif"; octx.textAlign = "center"; octx.fillText("確定", 218, 110); }
      octx.fillStyle = "#fff"; octx.font = "bold 36px sans-serif"; octx.textAlign = "center"; octx.fillText(race.name + "  レース結果", W / 2 + 40, 112);
      octx.textAlign = "left";
      octx.fillStyle = "#ffd43b"; octx.font = "bold 30px sans-serif"; octx.fillText("勝ちタイム " + SH.RV2D.fmtTime(winTime), 170, 190);
      const rows = Math.min(5, sim.order.length);
      for (let k = 0; k < rows; k++) {
        const idx = sim.order[k], r = runners[idx], y = 226 + k * 84;
        octx.fillStyle = r.kind === "owned" ? "rgba(255,212,59,.12)" : "rgba(255,255,255,.05)"; octx.fillRect(140, y, W - 280, 72);
        octx.fillStyle = k === 0 ? "#ffd43b" : "#fff"; octx.font = "bold 42px sans-serif"; octx.textAlign = "center"; octx.fillText(String(k + 1), 190, y + 50);
        octx.fillStyle = WAKU[r.waku - 1]; octx.fillRect(240, y + 14, 46, 46);
        octx.fillStyle = WTXT[r.waku - 1]; octx.font = "bold 28px sans-serif"; octx.fillText(String(r.gate), 263, y + 48);
        octx.textAlign = "left"; octx.fillStyle = r.kind === "owned" ? "#ffd43b" : "#fff"; octx.font = "bold 32px sans-serif"; octx.fillText(r.name + (r.kind === "owned" ? " ★" : ""), 316, y + 48);
        octx.fillStyle = "#dbe4ee"; octx.font = "bold 26px sans-serif"; octx.fillText(SH.RV2D.fmtTime(sim.times[idx]), 830, y + 47);
        if (k > 0) { const dd = sim.times[idx] - sim.times[sim.order[k - 1]]; octx.fillStyle = "#98a6b6"; octx.font = "24px sans-serif"; octx.fillText(SH.RV2D.marginLabel(dd), 990, y + 47); }
      }
      octx.fillStyle = "#98a6b6"; octx.font = "22px sans-serif"; octx.textAlign = "center";
      if (Math.sin(bt * 3) > -0.3) octx.fillText("画面タップで払い戻しへ ▶", W / 2, 680);
      octx.textAlign = "left"; octx.restore();
    }

    return {
      drawLive: drawLive,
      drawTitle: drawTitle,
      drawReplay: drawReplay,
      drawBoard: drawBoard,
      drawBanner: drawBanner,
      phaseOf: phaseOf,
      layout: layout,
    };
  };
})(window.SH);
