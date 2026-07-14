// ============================================================
// rv-cams.js — SH.RVCams: カメラ演出(設計§2.5・§3.1)
//  ・DirectorL: 左・可変追走(L0〜L8 状態機械 + l4Done ラッチ)
//  ・DirectorR: 右・定点カメラ列(先回り・再同期・名物経由・自馬保証)
//  ・各 director は THREE.PerspectiveCamera を1個ずつ所有(左右で共有しない・§6-R1)
// ============================================================
"use strict";
(function (SH) {
  const CAMS = {};
  SH.RVCams = CAMS;

  const VW = 1280, VH = 720;
  const CAM_SPACING = 200, CAM_OFFSET = 40, ARRIVE_M = 140, LEAD_PASS = 25, EMPTY_MAX = 3.5;
  const OWN_EVERY = 25, OWN_HOLD = 2.5;

  function fovFromFL(fl) { return 2 * Math.atan((VH / 2) / fl) * 180 / Math.PI; }
  function Mcam(k) { return k * CAM_SPACING + CAM_OFFSET; }

  // {x,y,z} を返す course.pos ラッパ
  function makeP(course) { return function (m, lat, y) { return course.pos(m, lat, y); }; }

  // 簡易フラスタム判定(NDC)。camera は updateMatrixWorld / projection 済み前提
  // three.min.js 読込失敗時に ReferenceError を投げないよう遅延初期化(WS1 MAJOR修正)
  let _pv = null;
  function inView(camera, p) {
    if (!p || typeof THREE === "undefined") return false;
    if (!_pv) _pv = new THREE.Vector3();
    _pv.set(p.x, p.y, p.z).project(camera);
    return _pv.z < 1 && _pv.z > -1 && Math.abs(_pv.x) <= 1.05;
  }

  // ============================================================
  // DirectorL(左・可変追走)
  // ============================================================
  CAMS.createL = function (course, D, world) {
    const P = makeP(course);
    const camera = new THREE.PerspectiveCamera(fovFromFL(830), VW / VH, 0.5, 5000);
    const camPos = new THREE.Vector3(16, 2.4, 0);
    const camTgt = new THREE.Vector3(0, 1.4, 0);
    let curFL = 830;
    let shot = "";
    let shotTimer = 0, l2Timer = 0, l2Near = false;
    let l4Time = 0, l4Done = false;

    // Fable5総見直し: 実機映像は馬群が画面高の3〜5割を占める(側面=望遠パン)。
    // 各ショットを「ラチ際・低アングル・長焦点」へ寄せ、馬群の画面占有率を実機比に近づけた。
    function LT(id, ctx) {
      const packC = ctx.packC, leadM = ctx.leadM;
      switch (id) {
        case "L0": return { pos: P(14, -12.8, 2.2), tgt: P(0, 0, 1.5), fl: 1000, sway: 0 };
        case "L1": return { pos: P(packC + 6, 13.4, 1.7), tgt: P(packC, 0, 1.5), fl: 1500, sway: 0.12 };
        case "L2": return l2Near
          ? { pos: P(packC + 5, 13.0, 1.6), tgt: P(packC, 0, 1.6), fl: 1450, sway: 0.12 }
          : { pos: P(packC + 2, 19, 3.0), tgt: P(packC, 0, 1.6), fl: 1150, sway: 0.14 };
        case "L3": return { pos: P(packC - 20, 24, 12), tgt: P(packC + 8, 0, 0.8), fl: 950, sway: 0.06 };
        case "L4": return { pos: P(leadM + 70, 3, 3.0), tgt: P(leadM + 120, 0, 2.0), fl: 900, sway: 0 };
        case "L5": return { pos: P(packC - 34, 58, 40), tgt: P(packC + 12, 0, 0), fl: 700, sway: 0.05 };
        case "L6": return { pos: P(packC + 4, 13.2, 1.5), tgt: P(packC, 0, 1.5), fl: 1600, sway: 0.16 };
        case "L7": return { pos: P(packC + 3, 15, 3.2), tgt: P(packC, 0, 1.6), fl: 1250, sway: 0.12 };
        case "L8": {
          if (ctx.R <= 130) return { pos: P(D - 30, 30, 7), tgt: P(Math.min(leadM + 15, D + 20), 0, 1.8), fl: 1000, sway: 0.12 };
          const pos = P(D + 60, 7, 3.2), tp = P(leadM, 0, 1.6);
          const dx = tp.x - pos.x, dz = tp.z - pos.z, dist = Math.sqrt(dx * dx + dz * dz);
          return { pos: pos, tgt: P(Math.min(leadM + 15, D + 20), 0, 1.8), fl: SH.clamp(dist * 60, 1100, 15000), sway: 0.12 };
        }
        case "replay": return { pos: P(Math.min(leadM + 16, D + 18), -14.5, 1.8), tgt: P(Math.min(leadM + 2, D + 6), 2, 1.6), fl: 1700, sway: 0.12 };
        default: return { pos: P(packC, 14, 2), tgt: P(packC, 0, 1.6), fl: 1100, sway: 0.1 };
      }
    }

    function desired(ctx) {
      if (ctx.replay) return "replay";
      const p = ctx.p, R = ctx.R;
      if (ctx.t < 0) return "L0";
      if (R <= 400) return "L8";
      if (p >= 0.47 && p < 0.53) return "L5";
      if (p < 0.08) return "L1";
      if (p < 0.25) return "L2";
      if (p < 0.45) return "L3";
      if (p < 0.55) return l4Done ? "L6" : "L4";
      if (p < 0.75) return "L6";
      return "L7";
    }

    return {
      camera: camera,
      update: function (ctx) {
        const want = desired(ctx);
        const spec = LT(want, ctx);
        if (want !== shot) {
          shot = want; shotTimer = 0; l2Timer = 0;
          camPos.set(spec.pos.x, spec.pos.y, spec.pos.z);
          camTgt.set(spec.tgt.x, spec.tgt.y, spec.tgt.z);
          curFL = spec.fl;
        }
        shotTimer += ctx.dt;
        if (shot === "L2") { l2Timer += ctx.dt; if (l2Timer >= 3) { l2Timer = 0; l2Near = !l2Near; } }
        if (shot === "L4") { l4Time += ctx.dt; if (l4Time >= 2.5) l4Done = true; }
        if (shot === "L5") l4Done = true;

        // lerp 追従(位置0.14 / 注視0.2 / FL0.1)
        camPos.x += (spec.pos.x - camPos.x) * 0.14; camPos.y += (spec.pos.y - camPos.y) * 0.14; camPos.z += (spec.pos.z - camPos.z) * 0.14;
        let tx = spec.tgt.x, ty = spec.tgt.y, tz = spec.tgt.z;
        // L5 橋補正: 先頭の lap-s が橋±250 なら注視を橋中心へ0.5合成
        if (shot === "L5" && world.sOfM && world.bridgePos) {
          const s = world.sOfM(ctx.leadM);
          const ds = Math.min(Math.abs(s - 1040), world.lap - Math.abs(s - 1040));
          if (ds < 250) { tx = tx * 0.5 + world.bridgePos.x * 0.5; ty = ty * 0.5 + world.bridgePos.y * 0.5; tz = tz * 0.5 + world.bridgePos.z * 0.5; }
        }
        camTgt.x += (tx - camTgt.x) * 0.2; camTgt.y += (ty - camTgt.y) * 0.2; camTgt.z += (tz - camTgt.z) * 0.2;
        curFL += (spec.fl - curFL) * 0.1;

        const sw = spec.sway;
        camera.position.set(camPos.x, camPos.y + Math.sin(ctx.t * 1.9) * sw, camPos.z + Math.cos(ctx.t * 1.3) * sw * 0.5);
        camera.up.set(0, 1, 0);
        camera.lookAt(camTgt.x, camTgt.y, camTgt.z);
        camera.fov = fovFromFL(curFL);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);

        const own = ctx.ownM != null ? P(ctx.ownM, 0, 1.6) : null;
        const ownInView = inView(camera, own);
        return { camera: camera, mode: shot, fl: curFL, empty: false, ownInView: ownInView,
          pos: { x: camera.position.x, y: camera.position.y, z: camera.position.z }, tgt: { x: camTgt.x, y: camTgt.y, z: camTgt.z } };
      },
    };
  };

  // ============================================================
  // DirectorR(右・定点カメラ列)
  // ============================================================
  const R_FRONT = "R-front", R_SIDE = "R-side", R_DIAG = "R-diag", R_NAME = "R-name", R_GOAL = "R-goal", R_OWNPAN = "R-ownpan";
  const RR = [R_FRONT, R_SIDE, R_DIAG];
  const FRONT_FIXED = { "R-front": 1, "R-diag": 1, "R-goal": 1, "R-name": 1 };

  CAMS.createR = function (course, D, world, ownIndex) {
    const P = makeP(course);
    const camera = new THREE.PerspectiveCamera(fovFromFL(1100), VW / VH, 0.5, 5000);
    const ownExists = ownIndex != null && ownIndex >= 0;

    // 名物定点 k → {kind, focus}
    const nameKs = {};
    (world.nameMs || []).forEach(function (nm) {
      const k = Math.round((nm.m - CAM_OFFSET) / CAM_SPACING);
      if (k >= 0) nameKs[k] = { kind: nm.kind, focus: nm.focus };
    });
    const nameKList = Object.keys(nameKs).map(Number).sort(function (a, b) { return a - b; });

    let k = 0, type = R_FRONT, rrCursor = 0, emptySince = 0, ownHold = 0, lastCutT = -99, curFL = 1100;
    let forceNextFlag = false;
    const curTgt = { x: 0, y: 1.6, z: 0 }; // 現在の注視点(publishState で camR.tgt として公開・WS1 MINOR修正)

    function setCam(pos, tgt, fl) {
      camera.position.set(pos.x, pos.y, pos.z);
      camera.up.set(0, 1, 0);
      camera.lookAt(tgt.x, tgt.y, tgt.z);
      camera.fov = fovFromFL(fl); curFL = fl;
      curTgt.x = tgt.x; curTgt.y = tgt.y; curTgt.z = tgt.z;
      camera.updateProjectionMatrix();
    }
    // Fable5総見直し: 定点も望遠寄り(正面=長玉で馬群が迫る/側面=ラチ際パン)
    function tableCam(tp, ctx) {
      const m = Mcam(k), packC = ctx.packC, leadM = ctx.leadM;
      if (tp === R_FRONT) return { pos: P(m + 42, 1.2, 2.1), tgt: P(leadM, 0, 1.6), fl: 2300 };
      if (tp === R_SIDE) return { pos: P(m, 17.5, 2.6), tgt: P(packC, 0, 1.6), fl: 2000 };
      if (tp === R_DIAG) return { pos: P(m + 20, 14, 4.5), tgt: P(packC, 0, 1.6), fl: 1400 };
      if (tp === R_GOAL) return { pos: P(D - 6, 14, 3.0), tgt: P(D, 0, 1.6), fl: 1250 };
      if (tp === R_OWNPAN) return { pos: P(m, 17.5, 2.6), tgt: P(ctx.ownM != null ? ctx.ownM : packC, 0, 1.6), fl: 2000 };
      if (tp === R_NAME) {
        const info = nameKs[k] || {};
        const foc = info.focus ? info.focus : P(leadM, 0, 1.6);
        return { pos: P(m + 10, 20, 6), tgt: { x: foc.x, y: foc.y, z: foc.z }, fl: 1000 };
      }
      return { pos: P(m + 42, 1.2, 2.1), tgt: P(leadM, 0, 1.6), fl: 2300 };
    }
    function applyCam(tp, ctx) { const c = tableCam(tp, ctx); setCam(c.pos, c.tgt, c.fl); }
    function cutTo(k2, ctx) {
      k = k2; lastCutT = ctx.t;
      type = nameKs[k] ? R_NAME : RR[(rrCursor++) % 3];
      applyCam(type, ctx);
    }
    function resyncK(ctx) { return Math.ceil((ctx.leadM + 30 - CAM_OFFSET) / CAM_SPACING); }
    function emptyNow(ctx) { return FRONT_FIXED[type] ? (ctx.leadM < Mcam(k) - ARRIVE_M) : false; }

    // 初期化
    (function () { const c = tableCam(R_FRONT, { packC: -8, leadM: 0, ownM: null }); setCam(c.pos, c.tgt, c.fl); })();

    return {
      camera: camera,
      forceNext: function () { forceNextFlag = true; },
      update: function (ctx) {
        const last = (ctx.lastOwnInView == null) ? 0 : ctx.lastOwnInView;
        if (ctx.R <= 200 && type !== R_GOAL) {
          type = R_GOAL; k = -1; ownHold = 0; applyCam(R_GOAL, ctx);
        } else if (type !== R_GOAL) {
          if (ownExists && (ctx.t - last) >= OWN_EVERY && ownHold <= 0) {
            k = resyncK(ctx); type = R_OWNPAN; ownHold = OWN_HOLD; lastCutT = ctx.t; applyCam(R_OWNPAN, ctx);
          } else if (ownHold > 0) {
            ownHold -= ctx.dt; // 注視は末尾で更新
          } else {
            // (a) 先回りカット
            if (ctx.leadM >= Mcam(k) + LEAD_PASS || forceNextFlag) {
              const suppress = ctx.lShotIsAway && (ctx.t - lastCutT) < 1.0;
              if (!suppress) {
                let k2 = k + 1;
                for (let i = 0; i < nameKList.length; i++) { const kn = nameKList[i]; if (kn > k && kn <= k2) { k2 = kn; break; } }
                cutTo(k2, ctx);
              }
            }
            // (b) 空フレーム超過 → 再同期 + R-side 強制
            if (emptyNow(ctx)) { emptySince += ctx.dt; if (emptySince > EMPTY_MAX) { k = resyncK(ctx); type = R_SIDE; applyCam(R_SIDE, ctx); emptySince = 0; } }
            else emptySince = 0;
          }
        }
        forceNextFlag = false;

        // パン追従型は注視のみ毎フレーム更新
        if (type === R_SIDE || type === R_OWNPAN || type === R_NAME) {
          const c = tableCam(type, ctx);
          camera.lookAt(c.tgt.x, c.tgt.y, c.tgt.z);
          curTgt.x = c.tgt.x; curTgt.y = c.tgt.y; curTgt.z = c.tgt.z;
        }
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);

        const empty = FRONT_FIXED[type] ? (ctx.leadM < Mcam(k) - ARRIVE_M) : false;
        const own = ctx.ownM != null ? P(ctx.ownM, 0, 1.6) : null;
        const ownInView = (type === R_OWNPAN) ? true : inView(camera, own);
        return { camera: camera, type: type, camIndex: k, empty: empty, fl: curFL, ownInView: ownInView,
          pos: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
          tgt: { x: curTgt.x, y: curTgt.y, z: curTgt.z } };
      },
    };
  };
})(window.SH);
