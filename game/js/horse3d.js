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
})(window.SH);
