// ============================================================
// rv-world.js — 3Dワールド生成(WebGL観戦経路 / WS1)
//  ・コースリボン/地形/ラチ/生垣/テーマT0〜T6美術/可搬物(ゲート・ポール)
//  ・照明(ナイター/昼)/空/フォグ/グレア/CanvasTextureファクトリ
//  ・公開: SH.RVWorld.createRenderer(canvas) / SH.RVWorld.build(renderer, race, field, opt)
//  ・world はフラットAPI(設計書§1.4): updateVisibility/applyTone/scrollFx/
//    setDensity/setFogSimple/setGlare/setShadows/setGateOpen/dispose
//  ・posS(lap空間の直接配置ヘルパー)は本ファイル内部限定(公開しない)
//  ・美術は全てコード生成のオリジナル(複製・模写・トレースなし)
// ============================================================
"use strict";
(function (SH) {
  const W3 = {};
  SH.RVWorld = W3;

  // E-12 ナイター判定(設計書§1.1ではdata.js所管。WS1のファイルスコープ内に
  // 収めるためガード付きでここに定義 — 04-implementation-notes.md 参照)
  if (!SH.isNightRace) {
    SH.isNightRace = function (race) {
      return race.grade === "WBC" || (race.week >= 48 && race.grade === "G1");
    };
  }

  // ---------- コース幾何定数(makeCourse と同一) ----------
  const S_LEN = 450, R_ARC = 120;
  const LAP = 2 * S_LEN + 2 * Math.PI * R_ARC;    // ≈1653.98
  const EDGE = 11.6;                               // ラチ位置(±)
  const FINISH_S = 369, BRIDGE_S = 1040, STAND_S = 355;
  const CULL_RADIUS = 380;                         // §4.1 ±350m+余裕

  // テーマ配置テーブル(設計書§4.4 転記)
  const THEMES = [
    { id: 0, name: "stand",    s0: 260,  s1: 450,        tone: 1.0,  hedge: false },
    { id: 1, name: "bamboo",   s0: 450,  s1: 700,        tone: 0.8,  hedge: true  },
    { id: 2, name: "forest",   s0: 700,  s1: 950,        tone: 0.8,  hedge: true  },
    { id: 3, name: "gorge",    s0: 950,  s1: 1130,       tone: 1.15, hedge: false },
    { id: 4, name: "wall",     s0: 1130, s1: 1280,       tone: 1.0,  hedge: false },
    { id: 5, name: "hills",    s0: 1280, s1: 1470,       tone: 1.15, hedge: true  },
    { id: 6, name: "darkwood", s0: 1470, s1: 1654 + 260, tone: 0.8,  hedge: false }, // 周回境界またぎ
  ];

  // ---------- 決定的乱数(設計書§2.1: 全リロードで同一ワールド) ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- lap空間の直接配置(内部限定・at()と同一の区分計算) ----------
  function atS(s0) {
    let s = ((s0 % LAP) + LAP) % LAP;
    if (s < S_LEN) return { x: -S_LEN / 2 + s, z: 0, hx: 1, hz: 0 };
    s -= S_LEN;
    if (s < Math.PI * R_ARC) {
      const a = s / R_ARC;
      return { x: S_LEN / 2 + R_ARC * Math.sin(a), z: R_ARC - R_ARC * Math.cos(a), hx: Math.cos(a), hz: Math.sin(a) };
    }
    s -= Math.PI * R_ARC;
    if (s < S_LEN) return { x: S_LEN / 2 - s, z: 2 * R_ARC, hx: -1, hz: 0 };
    s -= S_LEN;
    const a = s / R_ARC;
    return { x: -S_LEN / 2 - R_ARC * Math.sin(a), z: R_ARC + R_ARC * Math.cos(a), hx: -Math.cos(a), hz: -Math.sin(a) };
  }
  function posS(s, lat, y) {
    const p = atS(s);
    return new THREE.Vector3(p.x - p.hz * lat, y || 0, p.z + p.hx * lat);
  }
  function headingAngleS(s) {
    const p = atS(s);
    return Math.atan2(-p.hz, p.hx);
  }

  // ---------- レンダラー(§1.4: 失敗時null) ----------
  W3.createRenderer = function (canvas) {
    if (typeof THREE === "undefined") return null;
    try {
      const r = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: "high-performance" });
      const gl = r.getContext();
      if (!gl || (gl.isContextLost && gl.isContextLost())) {
        try { r.forceContextLoss(); } catch (e) {} // 設計§1.2/R12: dispose と併せコンテキスト明示解放
        r.dispose();
        return null;
      }
      r.outputEncoding = THREE.sRGBEncoding;
      r.autoClear = true; // シザー有効時は領域限定クリア(§2.2)
      return r;
    } catch (e) { return null; }
  };

  // ============================================================
  // ワールド構築
  // ============================================================
  W3.build = function (renderer, race, field, opt) {
    const D = race.dist;
    const night = (opt && opt.forceNight) ? true : SH.isNightRace(race);
    const cond = field.condition;
    const course = SH.RV2D.makeCourse(D);
    const sky = SH.RV2D.skyColors(cond);
    const turf = SH.RV2D.turfColors(race.surface, cond);

    // 破棄対象の一括管理(§6-R12: dispose の単一窓口)
    const texList = [], geoList = [], matList = [];
    const scrollTexs = []; // UVスクロール対象(滝など)。TDZ回避のため構築より前に宣言
    function trackTex(t) { texList.push(t); return t; }
    function trackGeo(g) { geoList.push(g); return g; }
    function trackMat(m) { matList.push(m); return m; }

    // ---------- CanvasTexture 工場(§4.3。texCacheで1回生成・2の冪) ----------
    const texCache = {};
    function ctex(key, w, h, draw) {
      if (texCache[key]) return texCache[key];
      const cv = document.createElement("canvas");
      cv.width = w; cv.height = h;
      draw(cv.getContext("2d"), w, h);
      const t = new THREE.CanvasTexture(cv);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      texCache[key] = trackTex(t);
      return t;
    }

    // 芝/ダート走路: 刈り目ストライプ+微ノイズ(1タイル=40m相当・10m帯)
    function turfTexture() {
      return ctex("turf", 512, 512, function (c, w, h) {
        const rng = mulberry32(7);
        for (let b = 0; b < 4; b++) {
          c.fillStyle = (b % 2 === 0) ? turf.a : turf.b;
          c.fillRect(b * 128, 0, 128, h);
        }
        c.fillStyle = "rgba(0,0,0,.10)";
        for (let i = 0; i < 700; i++) c.fillRect(rng() * w, rng() * h, 2, 3);
        c.fillStyle = "rgba(255,255,255,.05)";
        for (let i = 0; i < 300; i++) c.fillRect(rng() * w, rng() * h, 2, 2);
      });
    }
    // 生垣: 深緑+葉ノイズ
    function hedgeTexture() {
      return ctex("hedge", 256, 128, function (c, w, h) {
        const rng = mulberry32(11);
        c.fillStyle = "#1f5a2a"; c.fillRect(0, 0, w, h);
        for (let i = 0; i < 900; i++) {
          const v = rng();
          c.fillStyle = v < 0.5 ? "rgba(10,40,16,.5)" : "rgba(90,160,80,.35)";
          c.fillRect(rng() * w, rng() * h, 3, 3);
        }
      });
    }
    // 紅白縞(ポール/ゴール柱共用): 横縞32px
    function poleTexture() {
      return ctex("pole", 64, 256, function (c, w, h) {
        for (let y = 0; y < h; y += 32) {
          c.fillStyle = (y / 32) % 2 === 0 ? "#e03131" : "#ffffff";
          c.fillRect(0, y, w, 32);
        }
      });
    }
    // 石積み(橋・岩壁・城壁共用): 矩形石割れ+目地
    function stoneTexture() {
      return ctex("stone", 256, 256, function (c, w, h) {
        const rng = mulberry32(31);
        c.fillStyle = "#8a8577"; c.fillRect(0, 0, w, h);
        const rows = 8;
        for (let r = 0; r < rows; r++) {
          const y = r * (h / rows);
          let x = (r % 2) * 18;
          while (x < w) {
            const bw = 24 + rng() * 26;
            const v = -14 + rng() * 24;
            c.fillStyle = "rgb(" + (138 + v) + "," + (133 + v) + "," + (119 + v) + ")";
            c.fillRect(x + 2, y + 2, bw - 4, h / rows - 4);
            x += bw;
          }
        }
        c.strokeStyle = "#6a655a"; c.lineWidth = 2;
        for (let r = 0; r <= rows; r++) { c.beginPath(); c.moveTo(0, r * h / rows); c.lineTo(w, r * h / rows); c.stroke(); }
      });
    }
    // 滝: 白青縦縞(UVスクロール)
    function waterfallTexture() {
      return ctex("fall", 128, 256, function (c, w, h) {
        const rng = mulberry32(41);
        c.clearRect(0, 0, w, h);
        for (let i = 0; i < 26; i++) {
          const x = rng() * w, ww = 2 + rng() * 6, a = 0.25 + rng() * 0.45;
          const g = c.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, "rgba(225,240,250," + a + ")");
          g.addColorStop(1, "rgba(190,215,240," + a * 0.7 + ")");
          c.fillStyle = g;
          c.fillRect(x, 0, ww, h);
        }
      });
    }
    // 竹葉/樹木ビルボード(透過)
    function leafTexture() {
      return ctex("leaf", 128, 128, function (c, w, h) {
        const rng = mulberry32(53);
        c.clearRect(0, 0, w, h);
        for (let i = 0; i < 120; i++) {
          const x = w / 2 + (rng() - 0.5) * w * 0.9, y = h / 2 + (rng() - 0.5) * h * 0.9;
          c.fillStyle = "rgba(" + (60 + rng() * 60 | 0) + "," + (120 + rng() * 70 | 0) + "," + (50 + rng() * 40 | 0) + ",.8)";
          c.beginPath(); c.ellipse(x, y, 3 + rng() * 6, 2 + rng() * 3, rng() * 3, 0, Math.PI * 2); c.fill();
        }
      });
    }
    function treeBillboardTexture() {
      return ctex("treebb", 256, 256, function (c, w, h) {
        const rng = mulberry32(67);
        c.clearRect(0, 0, w, h);
        c.fillStyle = "#4a3220";
        c.fillRect(w / 2 - 8, h * 0.55, 16, h * 0.45);
        for (let i = 0; i < 240; i++) {
          const a = rng() * Math.PI * 2, rr = rng() * w * 0.36;
          const x = w / 2 + Math.cos(a) * rr, y = h * 0.34 + Math.sin(a) * rr * 0.8;
          c.fillStyle = "rgba(" + (30 + rng() * 40 | 0) + "," + (90 + rng() * 60 | 0) + "," + (40 + rng() * 30 | 0) + ",.85)";
          c.beginPath(); c.arc(x, y, 6 + rng() * 12, 0, Math.PI * 2); c.fill();
        }
      });
    }
    // 観客(昼=カラーノイズ点 / ナイター=暗部+照明窓ドット)。既存drawStand配色流用
    function crowdTexture() {
      return ctex("crowd", 256, 256, function (c, w, h) {
        const rng = mulberry32(here_seed(0));
        function here_seed() { return 97; }
        c.fillStyle = night ? "#191c26" : "#55596a"; c.fillRect(0, 0, w, h);
        c.strokeStyle = "rgba(255,255,255,.12)"; c.lineWidth = 2;
        for (let r = 1; r < 4; r++) { c.beginPath(); c.moveTo(0, r * h / 4); c.lineTo(w, r * h / 4); c.stroke(); }
        const cols = ["#e5c07b", "#bf616a", "#88c0d0", "#a3be8c", "#d8dee9", "#b48ead"];
        for (let i = 0; i < 1200; i++) {
          if (night && rng() < 0.55) c.fillStyle = "rgba(255,226,170," + (0.35 + rng() * 0.6) + ")";
          else c.fillStyle = cols[(i * 7) % 6];
          c.fillRect(rng() * w, rng() * h, 3, 4);
        }
      });
    }
    // 放射ハロ/光条(グレア・月)
    function haloTexture() {
      return ctex("halo", 128, 128, function (c, w, h) {
        const g = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
        g.addColorStop(0, "rgba(255,246,220,.9)");
        g.addColorStop(0.35, "rgba(255,240,200,.28)");
        g.addColorStop(1, "rgba(255,240,200,0)");
        c.fillStyle = g; c.fillRect(0, 0, w, h);
      });
    }
    function streakTexture() {
      return ctex("streak", 128, 128, function (c, w, h) {
        c.clearRect(0, 0, w, h);
        const g1 = c.createLinearGradient(0, h / 2, w, h / 2);
        g1.addColorStop(0, "rgba(255,244,210,0)"); g1.addColorStop(0.5, "rgba(255,244,210,.75)"); g1.addColorStop(1, "rgba(255,244,210,0)");
        c.fillStyle = g1; c.fillRect(0, h / 2 - 3, w, 6);
        const g2 = c.createLinearGradient(w / 2, 0, w / 2, h);
        g2.addColorStop(0, "rgba(255,244,210,0)"); g2.addColorStop(0.5, "rgba(255,244,210,.75)"); g2.addColorStop(1, "rgba(255,244,210,0)");
        c.fillStyle = g2; c.fillRect(w / 2 - 3, 0, 6, h);
      });
    }
    function cloudTexture() {
      return ctex("cloud", 128, 64, function (c, w, h) {
        const g = c.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
        g.addColorStop(0, "rgba(255,255,255,.85)");
        g.addColorStop(0.6, "rgba(255,255,255,.4)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        c.fillStyle = g;
        c.save(); c.scale(1, 0.5); c.fillRect(0, 0, w, h * 2); c.restore();
      });
    }

    // ---------- シーン・照明(§5) ----------
    const scene = new THREE.Scene();
    let fogFull, fogSimple;
    if (night) {
      scene.background = new THREE.Color(0x0d1424); // 濃紺(上#0a0e1e〜地平#1a2436の中間)
      fogFull = new THREE.FogExp2(0x121a2a, 0.0016);
      fogSimple = new THREE.Fog(0x121a2a, 130, 640);
    } else {
      const bgc = new THREE.Color(sky.top).lerp(new THREE.Color(sky.bot), 0.55);
      scene.background = bgc;
      fogFull = new THREE.Fog(bgc.getHex(), 200, 950);
      fogSimple = new THREE.Fog(bgc.getHex(), 140, 620);
    }
    scene.fog = fogFull;

    const gloomy = cond === "重" || cond === "不良";
    const dim = cond === "稍重";
    let hemi, sun = null, moonDir = null;
    const HEMI_BASE = night ? 0.35 : (gloomy ? 0.95 : 0.8);
    if (night) {
      hemi = new THREE.HemisphereLight(0x2a3550, 0x0e1a12, HEMI_BASE);
      // 月明かり(造形の可読性確保のための弱い指向光 — 実装判断・notes参照)
      moonDir = new THREE.DirectionalLight(0x8899bb, 0.18);
      moonDir.position.set(-180, 260, -140);
      scene.add(moonDir);
    } else {
      hemi = new THREE.HemisphereLight(
        gloomy ? 0x8c98a8 : dim ? 0xaec6d8 : 0xcfe8ff,
        gloomy ? 0x2c4a2c : 0x3a7a3a, HEMI_BASE);
      sun = new THREE.DirectionalLight(gloomy ? 0x9aa4b0 : 0xfff2dd, gloomy ? 0.25 : dim ? 0.55 : 0.95);
      sun.position.set(120, 220, -90);
      scene.add(sun);
    }
    scene.add(hemi);

    // ---------- 可視制御リスト(±380m球判定。§2.4.2 相当) ----------
    // WS1は静的物件数が少ないため、50mチャンクGroupの代わりに
    // オブジェクト粒度の visList で同一契約(updateVisibility)を実装(notes参照)
    const visList = [];
    function addVis(obj, x, z, r) { visList.push({ obj: obj, x: x, z: z, r: r || 0 }); }

    // 密度制御対象(InstancedMesh)一覧: {mesh, full}
    const densityList = [];
    function addDensity(mesh) { densityList.push({ mesh: mesh, full: mesh.count }); }

    // 共通マテリアル
    function lamb(hexOrOpt) {
      const m = new THREE.MeshLambertMaterial(typeof hexOrOpt === "object" ? hexOrOpt : { color: hexOrOpt });
      return trackMat(m);
    }

    // InstancedMesh 散布ヘルパ(行列は静的・1回書込)
    const _dummy = new THREE.Object3D();
    function makeInstanced(geo, mat, items, cullCenter, cullR) {
      const im = new THREE.InstancedMesh(trackGeo(geo), mat, items.length);
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        _dummy.position.copy(it.p);
        _dummy.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
        const sc = it.sc || 1;
        _dummy.scale.set(it.sx || sc, it.sy || sc, it.sz || sc);
        _dummy.updateMatrix();
        im.setMatrixAt(i, _dummy.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
      im.frustumCulled = false; // 可視制御は visList の距離判定で行う(notes参照)
      scene.add(im);
      if (cullCenter) addVis(im, cullCenter.x, cullCenter.z, cullR || 0);
      return im;
    }
    // テーマ区間の中心と半径(可視判定用)
    function rangeCull(s0, s1) {
      const c = posS((s0 + s1) / 2, 0, 0);
      const a = posS(s0, 0, 0), b = posS(s1, 0, 0);
      const r = Math.max(c.distanceTo(a), c.distanceTo(b)) + 60;
      return { c: c, r: r };
    }

    // ---------- 走路リボン・地面(§2.1 trackGroup) ----------
    function buildRibbon(latIn, latOut, y, sFrom, sTo, step, uvPerM) {
      const nSeg = Math.max(2, Math.ceil((sTo - sFrom) / step));
      const pa = new Float32Array((nSeg + 1) * 2 * 3);
      const na = new Float32Array((nSeg + 1) * 2 * 3);
      const ua = new Float32Array((nSeg + 1) * 2 * 2);
      const idx = [];
      for (let i = 0; i <= nSeg; i++) {
        const s = sFrom + (sTo - sFrom) * i / nSeg;
        const a = posS(s, latIn, y), b = posS(s, latOut, y);
        pa.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
        na.set([0, 1, 0, 0, 1, 0], i * 6);
        const u = s * uvPerM;
        ua.set([u, 0, u, 1], i * 4);
        if (i < nSeg) { const o = i * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pa, 3));
      g.setAttribute("normal", new THREE.BufferAttribute(na, 3));
      g.setAttribute("uv", new THREE.BufferAttribute(ua, 2));
      g.setIndex(idx);
      return trackGeo(g);
    }

    const trackGroup = new THREE.Group();
    scene.add(trackGroup);

    const turfTex = turfTexture();
    const trackMatM = lamb({ map: turfTex, side: THREE.DoubleSide });
    const trackMesh = new THREE.Mesh(buildRibbon(EDGE, -EDGE, 0, 0, LAP, 4, 1 / 40), trackMatM);
    trackMesh.frustumCulled = false;
    trackGroup.add(trackMesh);

    // 走路外地面(大円盤)+インフィールド
    const groundMat = lamb(night ? 0x14231a : (gloomy ? 0x24512a : 0x2c6a33));
    const ground = new THREE.Mesh(trackGeo(new THREE.CircleGeometry(1500, 48)), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.08, R_ARC);
    ground.frustumCulled = false;
    trackGroup.add(ground);
    const infield = new THREE.Mesh(trackGeo(new THREE.CircleGeometry(100, 32)), lamb(night ? 0x17281d : 0x35753a));
    infield.rotation.x = -Math.PI / 2;
    infield.scale.set(2.6, 1, 1);
    infield.position.set(0, -0.03, R_ARC);
    infield.frustumCulled = false;
    trackGroup.add(infield);

    // 決勝線(s=369)
    const finMesh = new THREE.Mesh(buildRibbon(EDGE, -EDGE, 0.02, FINISH_S, FINISH_S + 0.9, 0.45, 0.01),
      lamb({ color: 0xf5f5f5, side: THREE.DoubleSide }));
    trackGroup.add(finMesh);
    { const cc = posS(FINISH_S, 0, 0); addVis(finMesh, cc.x, cc.z, 15); }

    // 砂色路肩帯(E-1: T3取付路・T5路肩)
    [[950, 1130], [1280, 1470]].forEach(function (rg) {
      const m = new THREE.Mesh(buildRibbon(-EDGE - 0.2, -EDGE - 3.0, 0.005, rg[0], rg[1], 6, 0.02),
        lamb({ color: gloomy ? 0x6e5136 : 0xb08d57, side: THREE.DoubleSide }));
      trackGroup.add(m);
      const cu = rangeCull(rg[0], rg[1]);
      addVis(m, cu.c.x, cu.c.z, cu.r);
    });

    // ---------- ラチ(§4.4) ----------
    (function buildRails() {
      const hedgeRanges = [], innerWhiteRanges = [];
      // 生垣区間 = hedge:true のテーマ、その補集合は内白ラチ
      let cursor = 0;
      const hs = [[450, 700], [700, 950], [1280, 1470]];
      hs.forEach(function (r) {
        if (r[0] > cursor) innerWhiteRanges.push([cursor, r[0]]);
        hedgeRanges.push(r);
        cursor = r[1];
      });
      innerWhiteRanges.push([cursor, LAP]);

      // 内ラチ生垣(高0.9m)
      const hedgeGeo = new THREE.BoxGeometry(2.15, 0.9, 0.55);
      const hedgeMat = lamb({ map: hedgeTexture() });
      hedgeRanges.forEach(function (rg) {
        const items = [];
        for (let s = rg[0]; s < rg[1]; s += 2) {
          items.push({ p: posS(s + 1, EDGE, 0.45), ry: headingAngleS(s + 1) });
        }
        const cu = rangeCull(rg[0], rg[1]);
        const im = makeInstanced(hedgeGeo.clone(), hedgeMat, items, cu.c, cu.r);
        addDensity(im);
      });

      // 白ラチ/柵の共通部材
      const postGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 5);
      const railGeo = new THREE.BoxGeometry(4.15, 0.055, 0.05);
      const whiteMat = lamb(0xf0f0f0);

      // 内白ラチ(高0.7m・横桟1段)
      innerWhiteRanges.forEach(function (rg) {
        if (rg[1] - rg[0] < 6) return;
        const posts = [], rails = [];
        for (let s = rg[0]; s < rg[1]; s += 4) {
          posts.push({ p: posS(s, EDGE, 0.35), sy: 0.7 });
          rails.push({ p: posS(Math.min(s + 2, rg[1] - 2), EDGE, 0.68), ry: headingAngleS(s + 2) });
        }
        const cu = rangeCull(rg[0], rg[1]);
        makeInstanced(postGeo.clone(), whiteMat, posts, cu.c, cu.r);
        makeInstanced(railGeo.clone(), whiteMat, rails, cu.c, cu.r);
      });

      // 外ラチ白柵(全周・支柱1.2m+横桟2段)
      const SEGN = 4; // 4分割してカリング粒度を確保
      for (let seg = 0; seg < SEGN; seg++) {
        const s0 = LAP * seg / SEGN, s1 = LAP * (seg + 1) / SEGN;
        const posts = [], rails = [];
        for (let s = s0; s < s1; s += 4) {
          posts.push({ p: posS(s, -EDGE, 0.6), sy: 1.2 });
          rails.push({ p: posS(s + 2, -EDGE, 0.72), ry: headingAngleS(s + 2) });
          rails.push({ p: posS(s + 2, -EDGE, 1.16), ry: headingAngleS(s + 2) });
        }
        const cu = rangeCull(s0, s1);
        makeInstanced(postGeo.clone(), whiteMat, posts, cu.c, cu.r);
        makeInstanced(railGeo.clone(), whiteMat, rails, cu.c, cu.r);
      }
    })();

    // ---------- 空の演出(skyFx) ----------
    const skyFx = new THREE.Group();
    scene.add(skyFx);
    const glareFx = new THREE.Group(); // 内部Group。可視切替は setGlare 経由のみ(§2.1)
    scene.add(glareFx);

    if (night) {
      // 月+ハロ
      const moonMat = trackMat(new THREE.SpriteMaterial({ map: haloTexture(), color: 0xf6f2e4, fog: false, depthWrite: false }));
      const moon = new THREE.Sprite(moonMat);
      moon.position.set(320, 230, -420); moon.scale.set(46, 46, 1);
      skyFx.add(moon);
      const haloMat = trackMat(new THREE.SpriteMaterial({
        map: haloTexture(), color: 0xdfe4f2, fog: false, depthWrite: false,
        blending: THREE.AdditiveBlending, opacity: 0.55,
      }));
      const halo = new THREE.Sprite(haloMat);
      halo.position.copy(moon.position); halo.scale.set(130, 130, 1);
      glareFx.add(halo);
      // 星(40点)
      const starN = 40, sp = new Float32Array(starN * 3);
      const srng = mulberry32(1234);
      for (let i = 0; i < starN; i++) {
        const a = srng() * Math.PI * 2, e = 0.25 + srng() * 0.6, r = 900;
        sp[i * 3] = Math.cos(a) * Math.cos(e) * r;
        sp[i * 3 + 1] = Math.sin(e) * r * 0.6 + 80;
        sp[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r + R_ARC;
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
      const stars = new THREE.Points(trackGeo(sg),
        trackMat(new THREE.PointsMaterial({ color: 0xcfd8ff, size: 2.5, sizeAttenuation: false, fog: false, depthWrite: false })));
      stars.frustumCulled = false;
      skyFx.add(stars);
    } else {
      // 昼: 雲ビルボード
      const cldMat = trackMat(new THREE.SpriteMaterial({ map: cloudTexture(), fog: false, depthWrite: false, opacity: gloomy ? 0.5 : 0.85 }));
      const crng = mulberry32(555);
      for (let i = 0; i < 6; i++) {
        const cl = new THREE.Sprite(cldMat);
        const a = crng() * Math.PI * 2;
        cl.position.set(Math.cos(a) * 700, 170 + crng() * 130, Math.sin(a) * 700 + R_ARC);
        cl.scale.set(160 + crng() * 120, 46 + crng() * 26, 1);
        skyFx.add(cl);
      }
    }

    // ---------- 照明塔(E-9/E-10) + グレア(E-14) ----------
    const nightLights = [];
    (function buildTowers() {
      const towerGeo = trackGeo(new THREE.CylinderGeometry(0.22, 0.4, 15, 6));
      const headGeo = trackGeo(new THREE.BoxGeometry(2.6, 0.9, 0.7));
      const towerMat = lamb(0x596069);
      const headMat = lamb({ color: 0xd8dce4, emissive: night ? 0xfff4e0 : 0x000000, emissiveIntensity: night ? 0.9 : 0 });
      const lit = [255, 320, 385, 450, 1000, 1350]; // T0周辺4基+向正面/丘陵(§5.1 4〜6灯)
      const unlit = [980, 1180, 1520, 1620];        // E-9: T3〜T6の小物(非点灯)
      lit.concat(unlit).forEach(function (s, i) {
        const isLit = i < lit.length;
        const base = posS(s, -14.5, 0);
        const g = new THREE.Group();
        const t = new THREE.Mesh(towerGeo, towerMat); t.position.y = 7.5; g.add(t);
        const hd = new THREE.Mesh(headGeo, headMat); hd.position.y = 15.2; hd.rotation.y = headingAngleS(s); g.add(hd);
        g.position.copy(base);
        scene.add(g);
        addVis(g, base.x, base.z, 20);
        if (isLit && night) {
          const pl = new THREE.PointLight(0xfff4e0, 1.05, 300, 1.6);
          pl.position.set(base.x, 14.5, base.z);
          scene.add(pl);
          nightLights.push(pl);
          const hm = trackMat(new THREE.SpriteMaterial({
            map: haloTexture(), color: 0xfff4e0, fog: false, depthWrite: false,
            blending: THREE.AdditiveBlending, opacity: 0.85,
          }));
          const sm = trackMat(new THREE.SpriteMaterial({
            map: streakTexture(), color: 0xfff4e0, fog: false, depthWrite: false,
            blending: THREE.AdditiveBlending, opacity: 0.6,
          }));
          const halo = new THREE.Sprite(hm); halo.position.set(base.x, 15.3, base.z); halo.scale.set(9, 9, 1);
          const stk = new THREE.Sprite(sm); stk.position.set(base.x, 15.3, base.z); stk.scale.set(16, 16, 1);
          glareFx.add(halo); glareFx.add(stk);
          addVis(halo, base.x, base.z, 20); addVis(stk, base.x, base.z, 20);
        }
      });
    })();

    // ---------- テーマ美術 T0〜T6(§2.4.1) ----------
    const stoneMat = lamb({ map: stoneTexture() });

    // T0 スタンド
    (function buildStand() {
      const g = new THREE.Group();
      const sMid = (260 + 450) / 2;                    // 直線上(z=0)
      const x0 = posS(270, 0, 0).x, x1 = posS(445, 0, 0).x;
      const len = x1 - x0, cx = (x0 + x1) / 2;
      const bodyMat = lamb(night ? 0x3a3f4e : 0x6b6b7a);
      for (let t = 0; t < 4; t++) {
        const tier = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(len, 2.0, 3.4)), bodyMat);
        tier.position.set(cx, 1.0 + t * 1.85, -(17.5 + t * 3.1));
        g.add(tier);
      }
      // 前面観客プレーン(段に沿って傾斜)
      const crowd = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(len, 11.5)),
        lamb({ map: crowdTexture(), side: THREE.DoubleSide }));
      crowd.position.set(cx, 4.6, -21.2);
      crowd.rotation.x = -0.55;
      crowd.rotation.y = Math.PI; // コース側を向く
      g.add(crowd);
      // 屋根
      const roof = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(len + 4, 0.5, 6.5)), lamb(night ? 0x2c3038 : 0xd9dade));
      roof.position.set(cx, 9.4, -24.5);
      g.add(roof);
      // ゴール塔(s=372脇)+頂部発光
      const tw = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.4, 11, 2.4)), lamb(0xe8e6de));
      const twp = posS(372, -14.2, 0);
      tw.position.set(twp.x, 5.5, twp.z);
      g.add(tw);
      const twTop = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.0, 1.2, 3.0)),
        lamb({ color: 0xfff2c8, emissive: night ? 0xffe9a8 : 0x000000, emissiveIntensity: night ? 1.0 : 0 }));
      twTop.position.set(twp.x, 11.4, twp.z);
      g.add(twTop);
      scene.add(g);
      const cc = posS(sMid, -22, 0);
      addVis(g, cc.x, cc.z, len / 2 + 30);
    })();

    // ゴール柱(固定・s=369, lat=+13.2, 高4.2 — §4.4)
    (function () {
      const gp = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.09, 0.09, 4.2, 8)),
        lamb({ map: poleTexture() }));
      const p = posS(FINISH_S, 13.2, 2.1);
      gp.position.copy(p);
      scene.add(gp);
      addVis(gp, p.x, p.z, 6);
    })();

    // T1 竹林
    (function buildBamboo() {
      const rng = mulberry32(1 * 7919);
      const trunks = [], leaves = [];
      for (let s = 452; s < 700; s += 2.2) {
        const side = rng() < 0.62 ? -1 : 1;
        const lat = side * (13 + rng() * (side < 0 ? 25 : 18));
        const sj = s + (rng() - 0.5) * 1.4;
        const p = posS(sj, lat, 3);
        trunks.push({ p: p, ry: rng() * 6.28, sy: 0.8 + rng() * 0.5 });
        if (rng() < 0.7) leaves.push({ p: posS(sj, lat, 4.6 + rng() * 1.6), ry: rng() * 6.28, sc: 1.1 + rng() * 1.2 });
      }
      const cu = rangeCull(450, 700);
      const trunkGeo = new THREE.CylinderGeometry(0.06, 0.075, 6, 5);
      addDensity(makeInstanced(trunkGeo, lamb(0x7a9a3a), trunks, cu.c, cu.r));
      const leafGeo = new THREE.PlaneGeometry(1.7, 1.3);
      const leafMat = lamb({ map: leafTexture(), side: THREE.DoubleSide, transparent: true, alphaTest: 0.25 });
      addDensity(makeInstanced(leafGeo, leafMat, leaves, cu.c, cu.r));
    })();

    // T2 巨木の森(+T6でアセット再利用)
    const trunkBigGeo = new THREE.CylinderGeometry(0.2, 0.34, 3.6, 6);
    const folGeo = new THREE.SphereGeometry(1.7, 6, 5);
    const bbGeo = new THREE.PlaneGeometry(6, 8);
    function buildForest(id, s0, s1, dark) {
      const rng = mulberry32(id * 7919);
      const trunks = [], fols = [], bbs = [];
      for (let s = s0 + 3; s < s1; s += 6.2) {
        const side = rng() < 0.6 ? -1 : 1;
        const lat = side * (13.5 + rng() * (side < 0 ? 24 : 16));
        const sj = s + (rng() - 0.5) * 3.6;
        if (rng() < 0.42) { // 近景メッシュ木
          const p = posS(sj, lat, 1.8);
          const sc = 0.8 + rng() * 0.7;
          trunks.push({ p: p, sy: sc, ry: rng() * 6.28 });
          fols.push({ p: posS(sj, lat, 3.4 + sc * 1.3), sc: sc * (1.0 + rng() * 0.4), sy: sc * 1.3 });
        } else {         // 遠景ビルボード
          bbs.push({ p: posS(sj, lat * 1.35, 3.9), ry: headingAngleS(sj) + Math.PI / 2, sc: 0.9 + rng() * 0.8 });
        }
      }
      const cu = rangeCull(s0, s1);
      addDensity(makeInstanced(trunkBigGeo.clone(), lamb(dark ? 0x2e2418 : 0x4a3220), trunks, cu.c, cu.r));
      addDensity(makeInstanced(folGeo.clone(), lamb(dark ? 0x16351f : 0x2e6b34), fols, cu.c, cu.r));
      const bbMat = lamb({ map: treeBillboardTexture(), side: THREE.DoubleSide, transparent: true, alphaTest: 0.3, color: dark ? 0x60705f : 0xffffff });
      addDensity(makeInstanced(bbGeo.clone(), bbMat, bbs, cu.c, cu.r));
    }
    buildForest(2, 700, 950, false);

    // T3 渓谷・石橋・滝
    (function buildGorge() {
      const cu = rangeCull(950, 1130);
      // 谷の「見え」: 暗い谷底帯(走路外)+奥の岩壁(視覚のみ・走行座標不変)
      const chasm = new THREE.Mesh(buildRibbon(-13, -44, 0.012, 950, 1130, 8, 0.01),
        lamb({ color: 0x0b0f14, side: THREE.DoubleSide }));
      scene.add(chasm);
      addVis(chasm, cu.c.x, cu.c.z, cu.r);
      for (let i = 0; i < 5; i++) {
        const s = 965 + i * 36;
        const w = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(38, 15)), stoneMat);
        const p = posS(s, -45, 6.5);
        w.position.copy(p);
        w.rotation.y = headingAngleS(s) + Math.PI / 2;
        w.rotation.x = -0.12;
        scene.add(w);
        addVis(w, p.x, p.z, 30);
      }
      // 石橋(中心 s=1040・コース外側に並走する高架の「見え」)
      const shp = new THREE.Shape();
      shp.moveTo(-30, -1); shp.lineTo(30, -1); shp.lineTo(30, 6); shp.lineTo(-30, 6); shp.closePath();
      [-12, 12].forEach(function (hx) {
        const hole = new THREE.Path();
        hole.absarc(hx, 1.6, 3.4, 0, Math.PI * 2, true);
        shp.holes.push(hole);
      });
      const archGeo = trackGeo(new THREE.ExtrudeGeometry(shp, { depth: 2.6, bevelEnabled: false }));
      const arch = new THREE.Mesh(archGeo, stoneMat);
      const bp = posS(BRIDGE_S, -19, 0);
      arch.position.copy(bp);
      arch.rotation.y = headingAngleS(BRIDGE_S);
      scene.add(arch);
      const deck = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(62, 0.55, 4.2)), stoneMat);
      deck.position.set(bp.x, 6.3, bp.z);
      deck.rotation.y = headingAngleS(BRIDGE_S);
      scene.add(deck);
      addVis(arch, bp.x, bp.z, 40); addVis(deck, bp.x, bp.z, 40);
      // 白欄干(Instanced円柱列)
      const rails = [];
      for (let k = -29; k <= 29; k += 2) {
        [1.6, -1.6].forEach(function (off) {
          rails.push({ p: posS(BRIDGE_S + k, -19 + off, 7.0), sy: 0.9 });
        });
      }
      makeInstanced(new THREE.CylinderGeometry(0.06, 0.06, 1, 5), lamb(0xe9e7de), rails, posS(BRIDGE_S, -19, 6), 40);
      // 滝(UVスクロール)
      const fallTex = waterfallTexture();
      const fallMat = trackMat(new THREE.MeshBasicMaterial({ map: fallTex, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
      [1000, 1088].forEach(function (s) {
        const f = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(5, 13)), fallMat);
        const p = posS(s, -43.5, 6.8);
        f.position.copy(p);
        f.rotation.y = headingAngleS(s) + Math.PI / 2;
        scene.add(f);
        addVis(f, p.x, p.z, 12);
      });
      scrollTexs.push(fallTex);
    })();

    // T4 岩壁・城壁
    (function buildWall() {
      const rng = mulberry32(4 * 7919);
      const cu = rangeCull(1130, 1280);
      const teeth = [];
      for (let s = 1134; s < 1276; s += 10.4) {
        const h = 4 + rng() * 3;
        const w = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(10.6, h, 1.3)), stoneMat);
        const p = posS(s + 5, -15.5, h / 2);
        w.position.copy(p);
        w.rotation.y = headingAngleS(s + 5);
        scene.add(w);
        addVis(w, p.x, p.z, 12);
        for (let k = 0; k < 5; k++) {
          teeth.push({ p: posS(s + 1 + k * 2, -15.5, h + 0.35), ry: headingAngleS(s + 1 + k * 2) });
        }
      }
      addDensity(makeInstanced(new THREE.BoxGeometry(1.0, 0.7, 1.25), stoneMat, teeth, cu.c, cu.r));
      // 門柱×2
      [1198, 1206].forEach(function (s) {
        const g = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.0, 8, 2.0)), stoneMat);
        const p = posS(s, -15.5, 4);
        g.position.copy(p);
        g.rotation.y = headingAngleS(s);
        scene.add(g);
        addVis(g, p.x, p.z, 10);
      });
    })();

    // T5 丘陵(草丘)
    (function buildHills() {
      const rng = mulberry32(5 * 7919);
      const hillMat = lamb(night ? 0x27492b : 0x4f9a48);
      for (let i = 0; i < 6; i++) {
        const s = 1290 + i * 32;
        const side = i % 2 === 0 ? -1 : 1;
        const lat = side * (28 + rng() * 34);
        const h = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(1, 9, 7)), hillMat);
        const p = posS(s, lat, 0);
        h.position.copy(p);
        h.scale.set(16 + rng() * 18, 4.5 + rng() * 3.5, 15 + rng() * 16);
        scene.add(h);
        addVis(h, p.x, p.z, 45);
      }
    })();

    // T6 暗森+岩(T1/T2アセット再利用・暗トーン)
    buildForest(6, 1470, LAP + 260, true);
    (function buildRocks() {
      const rng = mulberry32(6 * 7919 + 1);
      const rocks = [];
      for (let i = 0; i < 42; i++) {
        const s = 1470 + rng() * (LAP + 260 - 1470);
        const side = rng() < 0.55 ? -1 : 1;
        rocks.push({
          p: posS(s, side * (13 + rng() * 16), 0.5),
          ry: rng() * 6.28, sc: 0.6 + rng() * 1.5,
        });
      }
      const cu = rangeCull(1470, LAP + 260);
      addDensity(makeInstanced(new THREE.DodecahedronGeometry(1.1, 0), lamb(0x3a3f46), rocks, cu.c, cu.r));
    })();

    // E-9 小物: 木箱(T3〜T6に疎ら)
    (function buildCrates() {
      const rng = mulberry32(999);
      const crates = [];
      for (let i = 0; i < 12; i++) {
        const s = 950 + rng() * 650;
        crates.push({ p: posS(s, -(12.6 + rng() * 3), 0.35), ry: rng() * 6.28, sc: 0.6 + rng() * 0.6 });
      }
      const cu = rangeCull(950, 1600);
      makeInstanced(new THREE.BoxGeometry(1, 1, 1), lamb(0x6a4e30), crates, cu.c, cu.r);
    })();

    // ---------- 可搬物(§2.4.2): 発走ゲート・距離ポール ----------
    const portable = new THREE.Group();
    scene.add(portable);
    const n = field.runners.length;
    // 発走ゲートは InstancedMesh 化(支柱2n/横桟n/前面パネルn を 3 InstancedMesh へ)。
    // 発走時に全馬がゲート前へ密集する瞬間の draw call ピークを抑える(WS2 予算 ≤140/pass 達成)。
    const gatePanelBase = [];                 // パネル各房の基準行列(開扉オフセット除く)
    let gatePanelMesh = null;
    const _gq = new THREE.Quaternion();
    const _gidq = new THREE.Quaternion();     // 単位クォータニオン(パネル開扉の compose 用)
    const _gloc = new THREE.Matrix4();
    const _gout = new THREE.Matrix4();
    const _gpv = new THREE.Vector3();
    const _gscl = new THREE.Vector3(1, 1, 1);
    (function buildGate() {
      const frameMat = lamb(0x8d949e);
      const panelMat = lamb(0xc4cad2);
      const postGeo = trackGeo(new THREE.BoxGeometry(0.12, 2.1, 0.12));
      const beamGeo = trackGeo(new THREE.BoxGeometry(0.14, 0.35, 1.7));
      const panelGeo = trackGeo(new THREE.BoxGeometry(0.06, 1.7, 1.5));
      const postIM = new THREE.InstancedMesh(postGeo, frameMat, n * 2);
      const beamIM = new THREE.InstancedMesh(beamGeo, frameMat, n);
      const panelIM = new THREE.InstancedMesh(panelGeo, panelMat, n);
      postIM.frustumCulled = beamIM.frustumCulled = panelIM.frustumCulled = false;
      panelIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const hd = course.heading(-1.2);
      _gq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-hd.z, hd.x));
      const _stall = new THREE.Matrix4();
      for (let i = 0; i < n; i++) {
        const gl = -8 + 16 * (i / Math.max(1, n - 1));
        const wp = course.pos(-1.2, gl, 0);
        _stall.compose(_gpv.set(wp.x, 0, wp.z), _gq, _gscl);
        [-0.8, 0.8].forEach(function (off, j) {
          _gloc.makeTranslation(0, 1.05, off);
          _gout.multiplyMatrices(_stall, _gloc);
          postIM.setMatrixAt(i * 2 + j, _gout);
        });
        _gloc.makeTranslation(0, 2.2, 0);
        _gout.multiplyMatrices(_stall, _gloc);
        beamIM.setMatrixAt(i, _gout);
        gatePanelBase.push(_stall.clone());
        _gloc.makeTranslation(0.55, 1.0, 0);
        _gout.multiplyMatrices(_stall, _gloc);
        panelIM.setMatrixAt(i, _gout);
      }
      postIM.instanceMatrix.needsUpdate = true;
      beamIM.instanceMatrix.needsUpdate = true;
      panelIM.instanceMatrix.needsUpdate = true;
      portable.add(postIM); portable.add(beamIM); portable.add(panelIM);
      gatePanelMesh = panelIM;
      const gp = course.pos(-1.2, 0, 0);
      addVis(portable, gp.x, gp.z, 30);
    })();
    function setGateOpen(o) {
      if (!gatePanelMesh) return;
      const v = SH.clamp(o, 0, 1);
      const sc = v < 0.98 ? 1 : 0;            // 全開後はスケール0で退避(旧 visible=false 相当)
      _gscl.set(sc, sc, sc);
      for (let i = 0; i < gatePanelBase.length; i++) {
        _gloc.compose(_gpv.set(0.55, 1.0, v * 1.45), _gidq, _gscl);
        _gout.multiplyMatrices(gatePanelBase[i], _gloc);
        gatePanelMesh.setMatrixAt(i, _gout);
      }
      _gscl.set(1, 1, 1);
      gatePanelMesh.instanceMatrix.needsUpdate = true;
    }

    // 紅白距離ポール(D-200k、lat=+12.6、高3.5 — §4.4)
    const poleMs = [];
    (function buildPoles() {
      const poleGeo = trackGeo(new THREE.CylinderGeometry(0.07, 0.07, 3.5, 8));
      const poleMat = lamb({ map: poleTexture() });
      for (let k = 200; k < D; k += 200) {
        const m = D - k;
        poleMs.push(m);
        const p = course.pos(m, 12.6, 1.75);
        const mesh = new THREE.Mesh(poleGeo, poleMat);
        mesh.position.set(p.x, p.y, p.z);
        portable.add(mesh);
        addVis(mesh, p.x, p.z, 5);
      }
    })();

    // ---------- 名物定点の m 逆写像(§3.4) ----------
    function sOfM(m) { return (((FINISH_S - D + m) % LAP) + LAP) % LAP; }
    function msOfS(sStar, margin) {
      const m0 = (((sStar - (FINISH_S - D)) % LAP) + LAP) % LAP;
      const out = [];
      for (let m = m0; m <= D + (margin || 200); m += LAP) out.push(m);
      return out;
    }
    const bridgePosV = posS(BRIDGE_S, -19, 5);
    const standPosV = posS(STAND_S, -20, 5);
    const nameMs = [];
    msOfS(BRIDGE_S).forEach(function (m) { nameMs.push({ m: m, kind: "bridge", focus: { x: bridgePosV.x, y: bridgePosV.y, z: bridgePosV.z } }); });
    msOfS(STAND_S).forEach(function (m) { nameMs.push({ m: m, kind: "stand", focus: { x: standPosV.x, y: standPosV.y, z: standPosV.z } }); });
    if (D > 600) nameMs.push({ m: D - 600, kind: "pole", focus: null });

    // ---------- 馬の装着先(rv-horses / WS1暫定馬) ----------
    const horsesRoot = new THREE.Group();
    scene.add(horsesRoot);

    // ---------- フラットAPI(§1.4) ----------
    let toneCur = 1.0;
    function themeToneOf(s) {
      const ss = ((s % LAP) + LAP) % LAP;
      for (let i = 0; i < THEMES.length; i++) {
        const t = THEMES[i];
        if (t.id === 6) { if (ss >= 1470 || ss < 260) return t.tone; }
        else if (ss >= t.s0 && ss < t.s1) return t.tone;
      }
      return 1.0;
    }

    let shadowsOn = false;
    const world = {
      scene: scene,
      course: course,
      night: night,
      themes: THEMES,
      lap: LAP,
      finishS: FINISH_S,
      horsesRoot: horsesRoot,
      poleMs: poleMs,
      nameMs: nameMs,
      bridgePos: { x: bridgePosV.x, y: bridgePosV.y, z: bridgePosV.z },
      sOfM: sOfM,

      updateVisibility: function (camLpos, camRpos) {
        for (let i = 0; i < visList.length; i++) {
          const e = visList[i];
          let dx = e.x - camLpos.x, dz = e.z - camLpos.z;
          let vis = (dx * dx + dz * dz) <= (CULL_RADIUS + e.r) * (CULL_RADIUS + e.r);
          if (!vis && camRpos) {
            dx = e.x - camRpos.x; dz = e.z - camRpos.z;
            vis = (dx * dx + dz * dz) <= (CULL_RADIUS + e.r) * (CULL_RADIUS + e.r);
          }
          e.obj.visible = vis;
        }
      },

      // 区間トーン(§5.3): 左カメラ基準の単一値・係数0.02でlerp
      applyTone: function (sOfCamL) {
        const target = themeToneOf(sOfCamL);
        toneCur += (target - toneCur) * 0.02;
        hemi.intensity = HEMI_BASE * toneCur;
      },

      scrollFx: function (dt) {
        for (let i = 0; i < scrollTexs.length; i++) scrollTexs[i].offset.y -= dt * 0.55;
      },

      setDensity: function (v) {
        for (let i = 0; i < densityList.length; i++) {
          const e = densityList[i];
          e.mesh.count = Math.max(1, Math.round(e.full * v));
        }
      },

      setFogSimple: function (b) { scene.fog = b ? fogSimple : fogFull; },

      setGlare: function (b) { glareFx.visible = !!b; },

      setShadows: function (b) {
        shadowsOn = !!b && !night;
        if (renderer.shadowMap) renderer.shadowMap.enabled = shadowsOn;
      },

      setGateOpen: setGateOpen,

      dispose: function () {
        for (let i = 0; i < geoList.length; i++) geoList[i].dispose();
        for (let i = 0; i < matList.length; i++) matList[i].dispose();
        for (let i = 0; i < texList.length; i++) texList[i].dispose();
        geoList.length = matList.length = texList.length = 0;
        visList.length = densityList.length = 0;
        while (scene.children.length) scene.remove(scene.children[0]);
      },
    };
    return world;
  };
})(window.SH);
