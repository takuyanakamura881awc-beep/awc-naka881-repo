// ============================================================
// horse3d.js — Three.js による3D馬モデル(プロシージャル生成)
//  ・ローカル+Xが進行方向。単位はメートル、y上。
//  ・胴/胸/臀/首/頭/耳/たてがみ/尾/4本脚(腿-膝-管-蹄)/ゼッケン/騎手
//  ・pose(phase, running) でギャロップの関節アニメーション
// ============================================================
"use strict";
(function (SH) {
  const H3 = {};
  SH.Horse3D = H3;

  H3.available = function () { return typeof THREE !== "undefined"; };

  // WebGLレンダラー生成(失敗時null → スプライトにフォールバック)
  H3.createRenderer = function (canvas) {
    try {
      const r = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
      r.setClearColor(0x000000, 0);
      r.outputEncoding = THREE.sRGBEncoding;
      return r;
    } catch (e) { return null; }
  };

  // シーン+ライティング(馬場状態に応じて晴天/曇天)
  H3.buildScene = function (condition) {
    const scene = new THREE.Scene();
    const gloomy = condition === "重" || condition === "不良";
    const dim = condition === "稍重";
    const hemi = new THREE.HemisphereLight(
      gloomy ? 0x8c98a8 : dim ? 0xaec6d8 : 0xcfe8ff,
      gloomy ? 0x2c4a2c : 0x3a7a3a,
      gloomy ? 0.95 : 0.8
    );
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(gloomy ? 0x9aa4b0 : 0xfff2dd, gloomy ? 0.25 : dim ? 0.55 : 0.95);
    sun.position.set(120, 220, -90);
    scene.add(sun);
    return scene;
  };

  // マテリアルキャッシュ
  const matCache = {};
  function mat(hex) {
    if (!matCache[hex]) matCache[hex] = new THREE.MeshLambertMaterial({ color: hex });
    return matCache[hex];
  }
  function shadeHex(hex, f) { // f<1で暗く f>1で明るく
    const c = new THREE.Color(hex);
    c.r = Math.min(1, c.r * f); c.g = Math.min(1, c.g * f); c.b = Math.min(1, c.b * f);
    return c.getHex();
  }

  // ゼッケン番号テクスチャ(白布に黒数字)
  const numTexCache = {};
  function numTexture(gate) {
    if (numTexCache[gate]) return numTexCache[gate];
    const cv = document.createElement("canvas");
    cv.width = 64; cv.height = 64;
    const c = cv.getContext("2d");
    c.fillStyle = "#f4f2ea"; c.fillRect(0, 0, 64, 64);
    c.strokeStyle = "#c9312e"; c.lineWidth = 4; c.strokeRect(2, 2, 60, 60);
    c.fillStyle = "#16161a"; c.font = "bold 42px sans-serif";
    c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(String(gate), 32, 36);
    const tex = new THREE.CanvasTexture(cv);
    numTexCache[gate] = tex;
    return tex;
  }

  // 幾何キャッシュ(全馬で共有)
  const G = {};
  function geo(key, make) { if (!G[key]) G[key] = make(); return G[key]; }

  // 脚(腿pivot→膝pivot→管→蹄)
  function makeLeg(coatHex, hind) {
    const pivot = new THREE.Group(); // 肩/腰の付け根
    const upperGeo = geo("upper" + (hind ? "H" : "F"), function () {
      return new THREE.CylinderGeometry(hind ? 0.085 : 0.075, 0.058, 0.52, 7);
    });
    const upper = new THREE.Mesh(upperGeo, mat(coatHex));
    upper.position.y = -0.26;
    pivot.add(upper);
    const knee = new THREE.Group();
    knee.position.y = -0.5;
    pivot.add(knee);
    const lowerGeo = geo("lower", function () { return new THREE.CylinderGeometry(0.05, 0.038, 0.46, 7); });
    const lower = new THREE.Mesh(lowerGeo, mat(shadeHex(coatHex, 0.72)));
    lower.position.y = -0.22;
    knee.add(lower);
    const hoofGeo = geo("hoof", function () { return new THREE.CylinderGeometry(0.052, 0.058, 0.09, 7); });
    const hoof = new THREE.Mesh(hoofGeo, mat(0x2b2119));
    hoof.position.y = -0.47;
    knee.add(hoof);
    return { pivot: pivot, knee: knee };
  }

  // 馬+騎手モデル。coatHex=毛色 silksHex=勝負服(枠色) gate=馬番
  H3.createHorse = function (coatHex, silksHex, gate) {
    const root = new THREE.Group();
    const body = new THREE.Group(); // ピッチング用
    body.position.y = 1.08;
    root.add(body);
    const dark = shadeHex(coatHex, 0.72);

    // 胴(楕円体)+胸+臀
    const torsoGeo = geo("torso", function () { return new THREE.SphereGeometry(1, 14, 10); });
    const torso = new THREE.Mesh(torsoGeo, mat(coatHex));
    torso.scale.set(1.14, 0.45, 0.37);
    body.add(torso);
    const chest = new THREE.Mesh(torsoGeo, mat(coatHex));
    chest.scale.set(0.42, 0.42, 0.34);
    chest.position.set(0.72, -0.05, 0);
    body.add(chest);
    const rump = new THREE.Mesh(torsoGeo, mat(coatHex));
    rump.scale.set(0.46, 0.46, 0.36);
    rump.position.set(-0.68, 0.02, 0);
    body.add(rump);

    // 首(pivotで上下に振る)
    const neckPivot = new THREE.Group();
    neckPivot.position.set(0.85, 0.22, 0);
    body.add(neckPivot);
    const neckGeo = geo("neck", function () { return new THREE.CylinderGeometry(0.13, 0.24, 0.92, 8); });
    const neck = new THREE.Mesh(neckGeo, mat(coatHex));
    neck.position.set(0.30, 0.28, 0);
    neck.rotation.z = -0.85; // 前方上向き
    neckPivot.add(neck);
    // たてがみ
    const maneGeo = geo("mane", function () { return new THREE.BoxGeometry(0.62, 0.16, 0.045); });
    const mane = new THREE.Mesh(maneGeo, mat(dark));
    mane.position.set(0.22, 0.42, 0);
    mane.rotation.z = -0.85;
    neckPivot.add(mane);
    // 頭
    const head = new THREE.Group();
    head.position.set(0.62, 0.60, 0);
    neckPivot.add(head);
    const skullGeo = geo("skull", function () { return new THREE.SphereGeometry(1, 10, 8); });
    const skull = new THREE.Mesh(skullGeo, mat(coatHex));
    skull.scale.set(0.25, 0.165, 0.14);
    head.add(skull);
    const muzzle = new THREE.Mesh(skullGeo, mat(shadeHex(coatHex, 0.8)));
    muzzle.scale.set(0.19, 0.105, 0.10);
    muzzle.position.set(0.27, -0.12, 0);
    head.add(muzzle);
    const earGeo = geo("ear", function () { return new THREE.ConeGeometry(0.045, 0.16, 5); });
    [-1, 1].forEach(function (s) {
      const ear = new THREE.Mesh(earGeo, mat(coatHex));
      ear.position.set(-0.10, 0.16, 0.06 * s);
      ear.rotation.x = 0.15 * s;
      head.add(ear);
    });
    const eyeGeo = geo("eye", function () { return new THREE.SphereGeometry(0.022, 6, 5); });
    [-1, 1].forEach(function (s) {
      const eye = new THREE.Mesh(eyeGeo, mat(0x14100c));
      eye.position.set(0.06, 0.02, 0.115 * s);
      head.add(eye);
    });

    // 尾(pivotで揺れる)
    const tailPivot = new THREE.Group();
    tailPivot.position.set(-1.02, 0.18, 0);
    body.add(tailPivot);
    const tailGeo = geo("tail", function () { return new THREE.ConeGeometry(0.085, 0.78, 7); });
    const tail = new THREE.Mesh(tailGeo, mat(dark));
    tail.position.set(-0.22, -0.26, 0);
    tail.rotation.z = 2.45; // 後方下向き
    tailPivot.add(tail);

    // 脚×4(root直下・付け根は胴の高さ)
    const legs = {
      FL: makeLeg(coatHex, false), FR: makeLeg(coatHex, false),
      HL: makeLeg(coatHex, true), HR: makeLeg(coatHex, true),
    };
    legs.FL.pivot.position.set(0.62, 1.02, 0.16);
    legs.FR.pivot.position.set(0.62, 1.02, -0.16);
    legs.HL.pivot.position.set(-0.62, 1.02, 0.17);
    legs.HR.pivot.position.set(-0.62, 1.02, -0.17);
    Object.keys(legs).forEach(function (k) { root.add(legs[k].pivot); });

    // ゼッケン(両脇に番号布)+鞍
    const saddleGeo = geo("saddle", function () { return new THREE.BoxGeometry(0.46, 0.05, 0.48); });
    const saddle = new THREE.Mesh(saddleGeo, mat(0xf4f2ea));
    saddle.position.set(0.12, 0.32, 0);
    body.add(saddle);
    const clothGeo = geo("cloth", function () { return new THREE.PlaneGeometry(0.42, 0.40); });
    [-1, 1].forEach(function (s) {
      const cloth = new THREE.Mesh(clothGeo, new THREE.MeshLambertMaterial({ map: numTexture(gate), side: THREE.DoubleSide }));
      cloth.position.set(0.10, 0.02, 0.40 * s);
      cloth.rotation.y = Math.PI / 2 * s;
      cloth.rotation.x = 0.12 * s;
      body.add(cloth);
    });

    // ---- 騎手(モンキー乗り) ----
    const jockey = new THREE.Group();
    jockey.position.set(0.10, 0.36, 0);
    body.add(jockey);
    const torsoJGeo = geo("jtorso", function () { return new THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.11, 0.26, 3, 8) : new THREE.CylinderGeometry(0.11, 0.12, 0.36, 8); });
    const jt = new THREE.Mesh(torsoJGeo, mat(silksHex));
    jt.position.set(0.02, 0.22, 0);
    jt.rotation.z = 1.05; // 深い前傾
    jockey.add(jt);
    // 頭+ヘルメット(枠色)
    const jheadGeo = geo("jhead", function () { return new THREE.SphereGeometry(0.085, 8, 7); });
    const jh = new THREE.Mesh(jheadGeo, mat(0xe8c39e));
    jh.position.set(0.26, 0.30, 0);
    jockey.add(jh);
    const capGeo = geo("jcap", function () { return new THREE.SphereGeometry(0.095, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55); });
    const cap = new THREE.Mesh(capGeo, mat(silksHex));
    cap.position.set(0.26, 0.315, 0);
    cap.rotation.z = 0.35;
    jockey.add(cap);
    // 腕(手綱へ)
    const armGeo = geo("jarm", function () { return new THREE.CylinderGeometry(0.032, 0.028, 0.34, 6); });
    [-1, 1].forEach(function (s) {
      const arm = new THREE.Mesh(armGeo, mat(silksHex));
      arm.position.set(0.34, 0.12, 0.09 * s);
      arm.rotation.z = 1.25;
      jockey.add(arm);
    });
    // 脚(白いキュロット+ブーツ)
    const jlegGeo = geo("jleg", function () { return new THREE.CylinderGeometry(0.04, 0.035, 0.26, 6); });
    const bootGeo = geo("jboot", function () { return new THREE.CylinderGeometry(0.036, 0.04, 0.17, 6); });
    [-1, 1].forEach(function (s) {
      const leg = new THREE.Mesh(jlegGeo, mat(0xf2f2f2));
      leg.position.set(0.02, 0.02, 0.20 * s);
      leg.rotation.x = 0.5 * s;
      leg.rotation.z = 0.5;
      jockey.add(leg);
      const boot = new THREE.Mesh(bootGeo, mat(0x25201c));
      boot.position.set(-0.04, -0.14, 0.26 * s);
      jockey.add(boot);
    });

    // ---- ポーズ(ギャロップ) ----
    // 襲歩: 後肢→前肢の順に接地。位相オフセットで4肢をずらす
    function pose(phase, running) {
      const sw = running ? 1 : 0.12;
      function setLeg(leg, ph, hind) {
        const swing = (hind ? 0.75 : 0.85) * sw;
        leg.pivot.rotation.z = Math.sin(ph) * swing + (hind ? 0.28 : -0.18);
        const bend = Math.max(0, Math.sin(ph + 1.15)) * (hind ? 0.95 : 1.25) * sw + 0.08;
        leg.knee.rotation.z = hind ? -bend : bend;
      }
      setLeg(legs.HL, phase, true);
      setLeg(legs.HR, phase + 0.45, true);
      setLeg(legs.FL, phase + Math.PI + 0.35, false);
      setLeg(legs.FR, phase + Math.PI + 0.8, false);
      // 体の上下動・ピッチング
      root.position.y = running ? Math.abs(Math.sin(phase * 0.5 + 0.4)) * 0.10 - 0.02 : 0;
      body.rotation.z = running ? Math.sin(phase) * 0.055 : 0;
      // 首の振り(走行時は低く前方へ伸びる)
      neckPivot.rotation.z = (running ? -0.38 : 0) + (running ? Math.sin(phase + 1.1) * 0.10 : 0);
      // 尾の揺れ
      tailPivot.rotation.x = Math.sin(phase * 0.8) * 0.25 * sw;
      tailPivot.rotation.z = running ? -0.18 : 0;
    }

    return { group: root, pose: pose };
  };

  // ============================================================
  // H3.shadeGeo(geometry, lo, hi) — 頂点色による簡易AO(下面暗→上面明)。
  //  rv-horses 側の vertexColors:true マテリアルで instanceColor と乗算され、
  //  夜間照明下でも馬体に緩い陰影が乗る(ワークストリームA-5)。
  //  ジオメトリを返す(ファクトリ内でのラップ用)。
  // ============================================================
  H3.shadeGeo = function (geometry, lo, hi) {
    if (lo == null) lo = 0.74;
    if (hi == null) hi = 1.0;
    const pos = geometry.attributes.position;
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox;
    const span = Math.max(1e-6, bb.max.y - bb.min.y);
    const arr = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getY(i) - bb.min.y) / span;
      const v = lo + (hi - lo) * Math.pow(t, 0.85);
      arr[i * 3] = arr[i * 3 + 1] = arr[i * 3 + 2] = v;
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(arr, 3));
    return geometry;
  };

  // ============================================================
  // H3.createRig() — ポーズリグ(設計§2.3.0/§2.3.2)
  //  ・Mesh を持たず Object3D ノードのみ(マテリアル/テクスチャ非生成)。
  //  ・InstancedMesh(rv-horses.js)へワールド行列を供給するための階層。
  //  ・ワークストリームA: サラブレッド体型(細身の胴/深い胸/傾斜した肩・尻/
  //    長い首/小さめの頭/細長い脚+球節関節)へ全面改修。寸法は createRig 専用の
  //    "rig*" キャッシュキーを使い、createHorse(2Dフォールバック・凍結)の
  //    幾何とは完全分離(§2.3.0 の独立進化)。
  //  ・pose(phase, running, opt) は第3引数 opt={v, drive, easeUp} を受ける(§3.5)。
  //    位相は 2π=1完歩。4拍の襲歩(HL→HR→FL→FR)+懸垂期(p≈1.2±)。
  // ============================================================
  H3.createRig = function () {
    // 変換だけを持つ空ノード
    function node(px, py, pz, rx, ry, rz, sx, sy, sz) {
      const o = new THREE.Object3D();
      o.position.set(px || 0, py || 0, pz || 0);
      o.rotation.set(rx || 0, ry || 0, rz || 0);
      if (sx != null) o.scale.set(sx, sy != null ? sy : sx, sz != null ? sz : sx);
      return o;
    }

    const root = new THREE.Group();
    const body = new THREE.Group(); body.position.y = 1.14; root.add(body);

    // 胴/胸/肩/臀(torsoSph)— サラブレッド体型: 細身の胴・深い胸(腹帯部)・
    // 傾斜した肩・傾斜したトモ(rump の回転で尻の斜面を表現)
    const torso = node(0, 0, 0, 0, 0, 0, 1.12, 0.36, 0.28); body.add(torso);
    const chest = node(0.55, -0.05, 0, 0, 0, 0, 0.46, 0.42, 0.29); body.add(chest);
    const shoulder = node(0.78, 0.06, 0, 0, 0, 0.45, 0.32, 0.40, 0.25); body.add(shoulder);
    const rump = node(-0.70, 0.05, 0, 0, 0, 0.28, 0.45, 0.39, 0.29); body.add(rump);

    // 首(長く・細く・前方へ伸びる)・たてがみ×2・頭(小さめ)
    const neckPivot = new THREE.Group(); neckPivot.position.set(0.90, 0.28, 0); body.add(neckPivot);
    const neck = node(0.38, 0.24, 0, 0, 0, -1.0); neckPivot.add(neck);
    const mane = node(0.30, 0.30, 0, 0, 0, 0.50); neckPivot.add(mane);
    const mane2 = node(0.02, 0.06, 0, 0, 0, 0.85, 0.45, 0.7, 0.7); neckPivot.add(mane2);
    const head = new THREE.Group(); head.position.set(0.77, 0.50, 0); head.rotation.z = -0.45; neckPivot.add(head);
    const skull = node(0, 0, 0, 0, 0, 0, 0.24, 0.14, 0.115); head.add(skull);
    const muzzle = node(0.27, -0.08, 0, 0, 0, 0, 0.16, 0.085, 0.08); head.add(muzzle);
    const earL = node(-0.05, 0.135, 0.046, 0.22, 0, 0); head.add(earL);
    const earR = node(-0.05, 0.135, -0.046, -0.22, 0, 0); head.add(earR);
    const eyeL = node(0.07, 0.05, 0.095); head.add(eyeL);
    const eyeR = node(0.07, 0.05, -0.095); head.add(eyeR);
    // 白斑ノード(面法線を +X へ: Circle/Plane は既定 +Z 法線 → roty=π/2)
    const blazeStar = node(0.215, 0.065, 0, 0, Math.PI / 2, 0); head.add(blazeStar);
    const blazeStripe = node(0.246, -0.015, 0, 0, Math.PI / 2, 0); head.add(blazeStripe);
    const blazeSnip = node(0.405, -0.085, 0, 0, Math.PI / 2, 0); head.add(blazeSnip);

    // 尾(基部+流れる先端の2節。基部は臀に埋め込み接続)
    const tailPivot = new THREE.Group(); tailPivot.position.set(-1.06, 0.20, 0); body.add(tailPivot);
    const tail = node(-0.20, -0.12, 0, 0, 0, 2.1); tailPivot.add(tail);
    const tail2 = node(-0.62, -0.32, 0, 0, 0, 1.85, 0.75, 0.8, 0.75); tailPivot.add(tail2);

    // 鞍・ゼッケン(cloth)
    const saddle = node(0.14, 0.36, 0); body.add(saddle);
    const clothL = node(0.14, 0.05, 0.315, 0.12, Math.PI / 2, 0); body.add(clothL);
    const clothR = node(0.14, 0.05, -0.315, -0.12, -Math.PI / 2, 0); body.add(clothR);

    // 手綱(騎手の手元→馬の口元。pose で毎フレーム張り直す動的ノード。
    //  ry で先端をわずかに内側へ収束させる)
    const reinL = node(1.3, 0.35, 0.095, 0, 0.05, 0); body.add(reinL);
    const reinR = node(1.3, 0.35, -0.095, 0, -0.05, 0); body.add(reinR);

    // 騎手(モンキー乗り: ほぼ水平の前傾、腰は鞍上・膝を深く畳み鐙は脇腹)
    const jockey = new THREE.Group(); jockey.position.set(0.16, 0.42, 0); body.add(jockey);
    const jt = node(0.02, 0.08, 0, 0, 0, -1.22); jockey.add(jt);
    const jh = node(0.32, 0.24, 0); jockey.add(jh);
    const cap = node(0.32, 0.252, 0, 0, 0, -0.55); jockey.add(cap);
    const armL = node(0.355, 0.083, 0.10, 0, 0, -2.09); jockey.add(armL);
    const armR = node(0.355, 0.083, -0.10, 0, 0, -2.09); jockey.add(armR);
    const jlegL = node(-0.105, -0.06, 0.22, -0.35, 0, -2.2); jockey.add(jlegL);
    const jlegR = node(-0.105, -0.06, -0.22, 0.35, 0, -2.2); jockey.add(jlegR);
    const bootL = node(-0.02, -0.16, 0.30, 0, 0, 0.1); jockey.add(bootL);
    const bootR = node(-0.02, -0.16, -0.30, 0, 0, 0.1); jockey.add(bootR);

    // 脚×4(腿pivot→膝/飛節knee→管lower→球節fetlock→蹄hoof)
    //  球節を追加した3関節チェーン。ノード数(=DC)は従来と同じ(グループのみ追加)。
    function makeLegRig(hind) {
      const pivot = new THREE.Group();
      const upper = node(0, hind ? -0.285 : -0.265, 0); pivot.add(upper);
      const knee = new THREE.Group(); knee.position.y = hind ? -0.57 : -0.53; pivot.add(knee);
      const lower = node(0, -0.22, 0); knee.add(lower);
      const fetlock = new THREE.Group(); fetlock.position.y = -0.45; knee.add(fetlock);
      const hoof = node(0, -0.07, 0); fetlock.add(hoof);
      return { pivot: pivot, knee: knee, fetlock: fetlock, upper: upper, lower: lower, hoof: hoof, hind: hind };
    }
    const legs = { FL: makeLegRig(false), FR: makeLegRig(false), HL: makeLegRig(true), HR: makeLegRig(true) };
    legs.FL.pivot.position.set(0.70, 1.10, 0.17);
    legs.FR.pivot.position.set(0.70, 1.10, -0.17);
    legs.HL.pivot.position.set(-0.74, 1.14, 0.18);
    legs.HR.pivot.position.set(-0.74, 1.14, -0.18);
    ["FL", "FR", "HL", "HR"].forEach(function (kk) { root.add(legs[kk].pivot); });

    // 共有ジオメトリ(rig専用 "rig*" キー。createHorse の幾何とは分離 — §2.3.0。
    //  shadeGeo で頂点色AOを焼込。blaze/blobShadow/cloth は既存キー温存)
    const geos = {
      torsoSph: geo("rigTorso", function () { return H3.shadeGeo(new THREE.SphereGeometry(1, 16, 12), 0.76, 1.03); }),
      neck: geo("rigNeck", function () { return H3.shadeGeo(new THREE.CylinderGeometry(0.075, 0.14, 0.95, 9), 0.9, 1.0); }),
      mane: geo("rigMane", function () { return H3.shadeGeo(new THREE.BoxGeometry(0.50, 0.12, 0.05), 0.85, 1.0); }),
      skull: geo("rigSkull", function () { return H3.shadeGeo(new THREE.SphereGeometry(1, 12, 9), 0.84, 1.02); }),
      ear: geo("rigEar", function () { return H3.shadeGeo(new THREE.ConeGeometry(0.035, 0.13, 5), 0.9, 1.0); }),
      eye: geo("rigEye", function () { return H3.shadeGeo(new THREE.SphereGeometry(0.021, 6, 5), 1.0, 1.0); }),
      tail: geo("rigTail", function () { return H3.shadeGeo(new THREE.ConeGeometry(0.085, 0.55, 7), 0.85, 1.0); }),
      upperF: geo("rigUpperF", function () { return H3.shadeGeo(new THREE.CylinderGeometry(0.065, 0.042, 0.54, 7), 0.82, 1.0); }),
      upperH: geo("rigUpperH", function () { return H3.shadeGeo(new THREE.CylinderGeometry(0.090, 0.046, 0.58, 7), 0.82, 1.0); }),
      lower: geo("rigLower", function () { return H3.shadeGeo(new THREE.CylinderGeometry(0.037, 0.031, 0.46, 6), 0.88, 1.0); }),
      hoof: geo("rigHoof", function () { return H3.shadeGeo(new THREE.CylinderGeometry(0.048, 0.056, 0.11, 6), 0.9, 1.0); }),
      rein: geo("rigRein", function () { return H3.shadeGeo(new THREE.CylinderGeometry(0.016, 0.016, 1, 5), 1.0, 1.0); }),
      saddle: geo("rigSaddle", function () { return H3.shadeGeo(new THREE.BoxGeometry(0.40, 0.05, 0.44), 0.9, 1.0); }),
      jtorso: geo("rigJTorso", function () { return H3.shadeGeo(THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.10, 0.26, 3, 8) : new THREE.CylinderGeometry(0.10, 0.11, 0.36, 8), 0.85, 1.0); }),
      jhead: geo("rigJHead", function () { return H3.shadeGeo(new THREE.SphereGeometry(0.082, 8, 7), 0.9, 1.0); }),
      jcap: geo("rigJCap", function () { return H3.shadeGeo(new THREE.SphereGeometry(0.09, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), 0.9, 1.0); }),
      jarm: geo("rigJArm", function () { return H3.shadeGeo(new THREE.CylinderGeometry(0.028, 0.024, 0.30, 6), 0.9, 1.0); }),
      jleg: geo("rigJLeg", function () { return H3.shadeGeo(new THREE.CylinderGeometry(0.038, 0.032, 0.24, 6), 0.9, 1.0); }),
      jboot: geo("rigJBoot", function () { return H3.shadeGeo(new THREE.CylinderGeometry(0.034, 0.038, 0.16, 6), 0.9, 1.0); }),
      cloth: geo("clothRig", function () { return new THREE.PlaneGeometry(0.42, 0.40); }),
      blazeStar: geo("blazeStar", function () { return H3.shadeGeo(new THREE.CircleGeometry(0.045, 12), 1.0, 1.0); }),
      blazeStripe: geo("blazeStripe", function () { return H3.shadeGeo(new THREE.PlaneGeometry(0.05, 0.28), 1.0, 1.0); }),
      blazeSnip: geo("blazeSnip", function () { return H3.shadeGeo(new THREE.SphereGeometry(0.05, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), 1.0, 1.0); }),
      blobShadow: geo("blobShadow", function () { return new THREE.CircleGeometry(1, 20); }),
    };

    // ノード表(PART_DEFS と 1:1・生成順固定)
    const nodes = {
      torsoSph: [torso, chest, shoulder, rump],
      neck: [neck], mane: [mane, mane2],
      skull: [skull, muzzle],
      ear: [earL, earR], eye: [eyeL, eyeR], tail: [tail, tail2],
      upperF: [legs.FL.upper, legs.FR.upper],
      upperH: [legs.HL.upper, legs.HR.upper],
      lower: [legs.FL.lower, legs.FR.lower, legs.HL.lower, legs.HR.lower],
      hoof: [legs.FL.hoof, legs.FR.hoof, legs.HL.hoof, legs.HR.hoof],
      rein: [reinL, reinR],
      saddle: [saddle],
      jtorso: [jt], jhead: [jh], jcap: [cap], jarm: [armL, armR], jleg: [jlegL, jlegR], jboot: [bootL, bootR],
      cloth: [clothL, clothR],
      blazeStar: [blazeStar], blazeStripe: [blazeStripe], blazeSnip: [blazeSnip],
    };

    // ---- ポーズ(4拍襲歩+懸垂期+セカンダリ+騎手drive/easeUp、§3.5)----
    //  位相規約: 2π = 1完歩。各脚は (p+φ)=π で接地中央。
    //  接地順(トランスバース・右手前): HL(φ=0)→HR(-0.75)→FL(-1.63)→FR(-2.39)、
    //  懸垂期(全肢離地)は p≈0.65..1.74(中心1.2)。
    function pose(phase, running, opt) {
      opt = opt || {};
      const p = phase;
      const sw = running ? 1 : 0.10;          // 振幅(待機時は微動)
      const sw01 = running ? 1 : 0;            // 姿勢ブレンド(走行レスト角)
      function setLeg(leg, ph) {
        const s = Math.sin(ph), c = Math.cos(ph);
        const fold = Math.max(0, c), fold2 = fold * fold;   // 前方スイング中=畳み
        const stance = Math.max(0, -c);                     // 接地中=荷重
        if (leg.hind) {
          leg.pivot.rotation.z = 0.04 + 0.02 * sw01 + s * 0.84 * sw;
          leg.knee.rotation.z = -0.12 + fold2 * 1.30 * sw;              // 飛節: 前方畳み
          leg.fetlock.rotation.z = -0.05 - fold2 * 0.50 * sw + stance * 0.28 * sw;
        } else {
          leg.pivot.rotation.z = -0.03 - 0.02 * sw01 + s * 0.88 * sw;
          leg.knee.rotation.z = -0.06 - fold2 * 1.45 * sw;              // 膝: 後方畳み
          leg.fetlock.rotation.z = 0.04 - fold2 * 0.55 * sw + stance * 0.30 * sw;
        }
      }
      setLeg(legs.HL, p);
      setLeg(legs.HR, p - 0.75);
      setLeg(legs.FL, p - 1.63);
      setLeg(legs.FR, p - 2.39);
      // 懸垂期: 全肢を体の下へ集める(gathered flight)
      let gather = Math.max(0, Math.cos(p - 1.2));
      gather = gather * gather * gather * sw01;
      if (gather > 0) {
        legs.FL.knee.rotation.z -= 0.55 * gather; legs.FR.knee.rotation.z -= 0.55 * gather;
        legs.HL.knee.rotation.z += 0.50 * gather; legs.HR.knee.rotation.z += 0.50 * gather;
      }
      // 上下動: 懸垂期で最高、前肢荷重で最低
      root.position.y = running ? (0.07 * Math.cos(p - 1.6) + 0.01) : 0;
      // ピッチング: 後肢接地で前上がり(+)→前肢接地で前下がり(−)
      body.rotation.z = running ? Math.cos(p - 2.1) * 0.05 : 0;
      body.rotation.x = Math.sin(p) * 0.02 * sw;
      // 首: 走行時は低く前方へ。前肢接地に同期して沈む(頭の上下動)
      const nr = (running ? -0.14 : 0) + Math.cos(p - 2.4) * 0.09 * sw;
      neckPivot.rotation.z = nr;
      head.rotation.z = -0.45 - 0.10 * sw01 - Math.cos(p - 2.4) * 0.05 * sw;
      // 尾: 走行時は流れて波打つ
      tailPivot.rotation.x = Math.sin(p * 0.9) * 0.16 * sw;
      tailPivot.rotation.z = running ? (-0.30 + Math.sin(p - 1.8) * 0.10) : 0;
      tail2.rotation.z = (running ? 1.80 : 1.85) + Math.sin(p - 2.6) * 0.12 * sw;
      // たてがみのなびき
      mane2.rotation.z = 0.85 + (running ? -0.25 : 0) + Math.sin(p - 0.6) * 0.22 * sw;
      // 騎手: モンキー乗り+終盤の「追う」(A-7)。全て絶対代入(共有リグの馬間汚染防止)
      const drive = opt.drive || 0;
      jockey.rotation.z = -0.05 + Math.sin(p) * 0.16 * drive;
      jockey.position.x = 0.16 + Math.sin(p) * 0.03 * drive;
      jockey.position.y = 0.42 + (opt.easeUp ? 0.06 : 0);
      // ゴール後は立ち上がって流す
      jt.rotation.z = opt.easeUp ? -0.55 : -1.22;
      jh.position.set(opt.easeUp ? 0.20 : 0.32, opt.easeUp ? 0.38 : 0.24, 0);
      cap.position.set(jh.position.x, jh.position.y + 0.012, 0);
      const armZ = opt.easeUp ? -1.6 : -2.09;
      armL.rotation.z = armZ; armR.rotation.z = armZ;
      const armX = opt.easeUp ? 0.28 : 0.355, armY = opt.easeUp ? 0.26 : 0.083;
      armL.position.set(armX, armY, 0.10); armR.position.set(armX, armY, -0.10);
      // 手綱: 手元(body局所 ≈(0.64,0.43))→口元(ハミ)を毎フレーム張り直す
      const bx = 0.90 + 1.0 * Math.cos(nr + 0.17);
      const by = 0.28 + 1.0 * Math.sin(nr + 0.17);
      const rdx = bx - 0.64, rdy = by - 0.43;
      const rlen = Math.sqrt(rdx * rdx + rdy * rdy);
      const rrot = Math.atan2(rdy, rdx) - Math.PI / 2;
      reinL.position.set(0.64 + rdx / 2, 0.43 + rdy / 2, 0.095);
      reinR.position.set(0.64 + rdx / 2, 0.43 + rdy / 2, -0.095);
      reinL.rotation.z = rrot; reinR.rotation.z = rrot;
      reinL.scale.y = rlen; reinR.scale.y = rlen;
    }

    return { root: root, pose: pose, nodes: nodes, geos: geos };
  };
})(window.SH);
