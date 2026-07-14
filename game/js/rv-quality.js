// ============================================================
// rv-quality.js — SH.RVQuality: E-15 動的品質スケーリング(設計§2.7 / 仕様§7.2)
//  ・rAF 間隔の EMA 計測(係数0.1)・30フレームごと評価・ヒステリシス降格/昇格
//  ・setLevel は全段を宣言的に適用(差分適用の状態漏れ防止)
//    stage1 影off → stage2 グロー/DPR/フォグ簡略 → stage3 ジオメトリ密度/低セグ
//    → stage4 単一ビュー化(右パス停止)。SH._rvState.qualityLevel は raceview3d が転記
//  ・縮退フックは world.set*/herd.setLowDetail/renderer.setSize のみを駆動(§1.4)
// ============================================================
"use strict";
(function (SH) {
  const Q = {};
  SH.RVQuality = Q;

  const Q_DPR = [1.0, 1.0, 0.75, 0.6, 0.5];       // stage → DPR(q)

  function isMobile() {
    try {
      const cores = navigator.hardwareConcurrency || 8;
      const coarse = (window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
      return cores <= 4 || !!coarse;
    } catch (e) { return false; }
  }

  // create(renderer, world, herd, opts)
  //   opts = { dw, dh, forceLevel(0..4|null) }
  Q.create = function (renderer, world, herd, opts) {
    opts = opts || {};
    const DW = opts.dw || 2560, DH = opts.dh || 720;
    const mobile = isMobile();
    const budget = mobile ? 33.3 : 16.7;

    let level = 0;
    let emaMs = budget, frameCount = 0, downStreak = 0, upStreak = 0;
    let forced = false;
    let viewModeSingle = false;
    let q = 1.0;

    function apply(v) {
      level = v;
      if (window.console && console.info) console.info("[E-15] quality→", v);
      // stage1: 影off(昼のshadowMapのみ。nightは world 内部で常に無効)
      world.setShadows(v < 1 && !world.night);
      // stage2: グロー/ハロ無効 + フォグ簡略
      world.setGlare(v < 2);
      world.setFogSimple(v >= 2);
      // stage3: ジオメトリ密度削減 + 低セグ/Lambert 一括差替
      if (herd && herd.setLowDetail) herd.setLowDetail(v >= 3);
      world.setDensity(v >= 3 ? 0.5 : 1);
      // DPR(q)切替
      q = Q_DPR[v];
      renderer.setSize(DW * q, DH * q, false);
      // stage4: 単一ビュー化(raceview3d が viewMode() を参照)
      viewModeSingle = (v === 4);
    }

    function setLevel(v) { v = v < 0 ? 0 : v > 4 ? 4 : v; if (v !== level || frameCount === 0) apply(v); }

    // 初期段階: モバイルは stage1 から / URL 強制があればそれ
    const forceLevel = (opts.forceLevel == null) ? null : (opts.forceLevel | 0);
    if (forceLevel != null) { forced = true; apply(Math.max(0, Math.min(4, forceLevel))); }
    else apply(mobile ? 1 : 0);

    const api = {
      get level() { return level; },
      get q() { return q; },
      get viewModeSingle() { return viewModeSingle; },
      get emaMs() { return emaMs; },
      get forced() { return forced; },
      viewMode: function () { return viewModeSingle ? "single" : "dual"; },
      sample: function (ms) {
        if (isFinite(ms) && ms > 0) emaMs += (ms - emaMs) * 0.1;
        frameCount++;
        if (forced) return;
        if (frameCount % 30 !== 0) return;
        if (emaMs > budget * 1.25) {
          upStreak = 0;
          if (++downStreak >= 2 && level < 4) { setLevel(level + 1); downStreak = 0; }
        } else if (emaMs < budget * 0.7) {
          downStreak = 0;
          if (++upStreak >= 4 && level > 0) { setLevel(level - 1); upStreak = 0; }
        } else { downStreak = upStreak = 0; }
      },
      force: function (v) { forced = true; setLevel(v | 0); },
      // auto()(強制解除)は全経路未使用のデッドコードだったため削除(Fable5総見直し)。
      // 強制解除が必要になった場合は force 側に null 引数対応を足すこと。
    };
    return api;
  };
})(window.SH);
