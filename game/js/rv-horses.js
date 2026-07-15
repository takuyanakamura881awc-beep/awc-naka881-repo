// ============================================================
// rv-horses.js — SH.RVHorses: 馬 InstancedMesh システム(設計§2.3 / 仕様§6)
//  ・パーツ種別のノードごとに独立した THREE.InstancedMesh(index = 馬index)
//  ・instanceColor(setColorAt)で 毛色 / 勝負服(地・袖・帽) / 白斑 の個体差
//  ・リグ1体(SH.Horse3D.createRig)を毎フレーム n 回評価 → setMatrixAt で全馬行列書込
//  ・ゼッケン = 個別 Mesh 2枚/頭(青地白数字テクスチャ・§2.3.4 方式(i))
//  ・H-9 自馬マーカー(下向きピン)/ ブロブ影 / 隊列力学(lat)/ setLowDetail
//  ・全パーツ frustumCulled=false(§2.3.1・R2)。行列/色は再利用しGCゼロ
//  ・全アセットはコード生成のオリジナル(複製・模写・トレースなし)
// ============================================================
"use strict";
(function (SH) {
  const RH = {};
  SH.RVHorses = RH;

  const RIG_SCALE = 1.2;           // §6.1 実寸化スケール(createRig root のみ)。Fable5: 実機比の存在感へ微増
  const BLAZE_KEYS = { blazeStar: "star", blazeStripe: "stripe", blazeSnip: "snip" };
  // 部位固定色(instanceColor)
  const FIXED = {
    eye: 0x14100c, hoof: 0x2b2119, saddle: 0xf4f2ea, jhead: 0xe8c39e,
    jleg: 0xf2f2f2, jboot: 0x25201c, rein: 0x352a20,
    blazeStar: 0xffffff, blazeStripe: 0xffffff, blazeSnip: 0xffffff,
  };
  // 勝負服パレット(12色・オリジナル配色)
  const SILKS_PALETTE = [
    "#d63a3a", "#2b6cb0", "#2f9e44", "#f2b705", "#8e44ad", "#e8590c",
    "#12b5b0", "#d6336c", "#495057", "#f1f3f5", "#3b5bdb", "#74b816",
  ];

  // FNV-1a(勝負服/白斑シードのハッシュ)
  function fnv(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function shadeHexStr(hex, f) {
    const c = new THREE.Color(hex);
    c.r = Math.min(1, c.r * f); c.g = Math.min(1, c.g * f); c.b = Math.min(1, c.b * f);
    return "#" + c.getHexString();
  }

  // ---- 青地・白数字ゼッケン番号アトラス(§2.3.4(ii)採用・WS2-A MAJOR解消)----
  //  ・512×512 に 6列×3行=18タイル(馬番 1〜18)を1枚生成しモジュールキャッシュ。
  //    馬番は全レース共通(1〜18)なので週次連続再生成は起きない(WS2-B 解消)。
  //  ・ゼッケンは頭数ぶんの個別 Mesh(2n DC)を廃し、共有アトラス+焼込UVの
  //    単一動的マージメッシュ(1 DC)へ。draw call を頭数非依存化(発走ピーク解消)。
  //  ・onBeforeCompile(R4リスク)に依存せず UV を頂点へ焼き込む方式=シェーダ非依存で堅牢。
  const ATLAS_COLS = 6, ATLAS_ROWS = 3, ATLAS_PX = 512;
  let _zekAtlas = null;
  function zekkenAtlas() {
    if (_zekAtlas) return _zekAtlas;
    const cv = document.createElement("canvas"); cv.width = ATLAS_PX; cv.height = ATLAS_PX;
    const c = cv.getContext("2d");
    const tw = ATLAS_PX / ATLAS_COLS, th = ATLAS_PX / ATLAS_ROWS;
    for (let g = 1; g <= ATLAS_COLS * ATLAS_ROWS; g++) {
      const ti = g - 1, col = ti % ATLAS_COLS, row = Math.floor(ti / ATLAS_COLS);
      const x = col * tw, y = row * th;
      c.fillStyle = "#1c4f9e"; c.fillRect(x, y, tw, th);
      c.strokeStyle = "#ffffff"; c.lineWidth = 5; c.strokeRect(x + 4, y + 4, tw - 8, th - 8);
      c.fillStyle = "#ffffff"; c.font = "bold 92px sans-serif";
      c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(String(g), x + tw / 2, y + th * 0.42);
      // 下部の判読不能な飾り(実在表記の複製をしない・様式のみ)
      c.font = "12px sans-serif"; c.globalAlpha = 0.7;
      c.fillText("■ — □ — ■", x + tw / 2, y + th * 0.82); c.globalAlpha = 1;
    }
    _zekAtlas = new THREE.CanvasTexture(cv);
    return _zekAtlas;
  }
  // gate → タイルUV矩形(周囲を微小 inset してタイル間ブリードを回避)
  function zekkenUV(gate) {
    const ti = ((gate - 1) % (ATLAS_COLS * ATLAS_ROWS)), col = ti % ATLAS_COLS, row = Math.floor(ti / ATLAS_COLS);
    const e = 0.003;
    return {
      uMin: col / ATLAS_COLS + e, uMax: (col + 1) / ATLAS_COLS - e,
      vTop: 1 - row / ATLAS_ROWS - e, vBot: 1 - (row + 1) / ATLAS_ROWS + e,
    };
  }

  // H-9 マーカー(§2.3.5): 96×112、発光黄・下向き五角形ピン・馬番。gate毎にモジュールキャッシュ(WS2-B解消・最大18枚)
  const _markerCache = {};
  function markerTexture(gate) {
    if (_markerCache[gate]) return _markerCache[gate];
    _markerCache[gate] = _buildMarker(gate);
    return _markerCache[gate];
  }
  function _buildMarker(gate) {
    const cv = document.createElement("canvas"); cv.width = 96; cv.height = 112;
    const c = cv.getContext("2d");
    c.clearRect(0, 0, 96, 112);
    c.beginPath();
    c.moveTo(48, 108);           // ピン先(下)
    c.lineTo(10, 60); c.lineTo(10, 12); c.lineTo(86, 12); c.lineTo(86, 60);
    c.closePath();
    c.fillStyle = "#ffd21a"; c.fill();
    c.lineWidth = 5; c.strokeStyle = "#8a6a00"; c.stroke();
    c.fillStyle = "#3a2a00"; c.font = "bold 48px sans-serif";
    c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(String(gate), 48, 40);
    const t = new THREE.CanvasTexture(cv);
    return t;
  }

  // ============================================================
  // create(parent, field, sim, course, coatOf, D)
  //   parent = world.horsesRoot(Group・scene 直下 identity)
  //   coatOf = 毛色hex配列(raceview3d 側で SH.RV2D.COAT 規則で算出)
  //   D      = 走破距離(drive=R算出用・設計 create シグネチャに追記)
  // ============================================================
  RH.create = function (parent, field, sim, course, coatOf, D) {
    if (typeof THREE === "undefined" || !SH.Horse3D || !SH.Horse3D.createRig) return null;
    const runners = field.runners;
    const n = runners.length;
    if (!n) return null;

    const rig = SH.Horse3D.createRig();
    rig.root.scale.setScalar(RIG_SCALE);       // §2.3.0 RIG_SCALE は createRig 側のみ
    const nodes = rig.nodes, geos = rig.geos;

    // 自馬(先頭の owned)
    let ownIndex = -1;
    for (let i = 0; i < n; i++) { if (runners[i].kind === "owned") { ownIndex = i; break; } }

    // 個体差の決定(§2.3.3・§6.4/6.5)
    const indiv = runners.map(function (r, i) {
      const seed = ((r.gate * 2654435761) ^ fnv(r.name)) >>> 0;
      const base = SILKS_PALETTE[seed % 12];
      const pattern = (seed >> 4) % 5;                        // {無地,縦縞,袖違い,一本襷,星散}
      const cap = SH.WAKU_COLORS[r.waku - 1] || "#ffffff";
      const sleeve = (pattern === 2) ? SILKS_PALETTE[(seed >> 8) % 12] : shadeHexStr(base, ((seed >> 7) & 1) ? 1.2 : 0.78);
      let blaze = "none";
      if (((seed >> 12) % 10) < 5) blaze = ["star", "stripe", "snip"][(seed >> 16) % 3]; // 付与率50%
      return { base: base, sleeve: sleeve, cap: cap, coat: coatOf[i] || "#8a5a2b", blaze: blaze, gate: r.gate };
    });

    // ---- 共有マテリアル(パーツ共用・instanceColor が乗る白基調)----
    const matList = [], texList = [], ownGeoList = [];
    // vertexColors: リグ幾何に焼き込んだ頂点色AO(H3.shadeGeo)と instanceColor の乗算で
    // 夜間照明下でも馬体に緩い陰影を確保(A-5)
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 18, specular: 0x2a2a2a, vertexColors: true });
    // 白斑は polygonOffset で顔面との Z-fight を回避
    const blazeMat = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 10, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    matList.push(bodyMat, blazeMat);
    let lambMat = null, lambBlazeMat = null; // stage3 用(遅延生成)
    const lowGeos = {};                       // stage3 低セグ版(遅延生成)

    function isBlaze(key) { return key === "blazeStar" || key === "blazeStripe" || key === "blazeSnip"; }

    // 部位色を _c に設定
    function setNodeColor(c, key, k, iv) {
      if (FIXED[key] != null) { c.setHex(FIXED[key]); return; }
      switch (key) {
        case "mane": case "tail": case "lower": c.set(iv.coat).multiplyScalar(0.72); return;
        case "skull": if (k === 1) { c.set(iv.coat).multiplyScalar(0.8); return; } c.set(iv.coat); return;
        case "jtorso": c.set(iv.base); return;
        case "jcap": c.set(iv.cap); return;
        case "jarm": c.set(iv.sleeve); return;
        default: c.set(iv.coat); return; // torsoSph, neck, ear, upperF, upperH
      }
    }

    // ---- InstancedMesh 群(cloth を除く全ノード)----
    const meshes = []; // {mesh, key, node}
    const partKeys = Object.keys(nodes).filter(function (key) { return key !== "cloth"; });
    const _c = new THREE.Color();
    partKeys.forEach(function (key) {
      const arr = nodes[key];
      const mat = isBlaze(key) ? blazeMat : bodyMat;
      for (let k = 0; k < arr.length; k++) {
        const im = new THREE.InstancedMesh(geos[key], mat, n);
        im.frustumCulled = false;                                 // §2.3.1・R2
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        for (let hi = 0; hi < n; hi++) { setNodeColor(_c, key, k, indiv[hi]); im.setColorAt(hi, _c); }
        im.instanceColor.needsUpdate = true;                      // 色は初期化時1回のみ(§2.3.2)
        parent.add(im);
        meshes.push({ mesh: im, key: key, node: arr[k], blaze: isBlaze(key) ? BLAZE_KEYS[key] : null });
      }
    });

    // ---- ブロブ影(接地・上下動非追従・楕円2.6×0.9)----
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
    matList.push(shadowMat);
    const shadowMesh = new THREE.InstancedMesh(geos.blobShadow, shadowMat, n);
    shadowMesh.frustumCulled = false;
    shadowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    shadowMesh.renderOrder = -1;
    parent.add(shadowMesh);

    // ---- ゼッケン = 共有アトラス+焼込UVの単一動的マージメッシュ(1 DC・頭数非依存)----
    //  2n枚の四辺形(各馬2枚=左右)を1本の BufferGeometry に統合。UVは gate タイルへ焼込、
    //  頂点座標は毎フレーム cloth ノードのワールド行列で更新(§2.3.4(ii)採用)。
    const QUADS = n * 2;
    const zekPos = new Float32Array(QUADS * 4 * 3);
    const zekUV = new Float32Array(QUADS * 4 * 2);
    const zekIdx = new Uint16Array(QUADS * 6);
    // 四辺形ローカル4隅(cloth = PlaneGeometry(0.42,0.40) と同寸)
    const ZC = [[-0.21, 0.20], [0.21, 0.20], [0.21, -0.20], [-0.21, -0.20]];
    for (let hi = 0; hi < n; hi++) {
      const uv = zekkenUV(indiv[hi].gate);
      const uvC = [[uv.uMin, uv.vTop], [uv.uMax, uv.vTop], [uv.uMax, uv.vBot], [uv.uMin, uv.vBot]];
      for (let side = 0; side < 2; side++) {
        const q = hi * 2 + side;
        for (let cc = 0; cc < 4; cc++) { zekUV[(q * 4 + cc) * 2] = uvC[cc][0]; zekUV[(q * 4 + cc) * 2 + 1] = uvC[cc][1]; }
        const b = q * 4;
        zekIdx[q * 6] = b; zekIdx[q * 6 + 1] = b + 1; zekIdx[q * 6 + 2] = b + 2;
        zekIdx[q * 6 + 3] = b; zekIdx[q * 6 + 4] = b + 2; zekIdx[q * 6 + 5] = b + 3;
      }
    }
    const zekGeo = new THREE.BufferGeometry();
    const zekPosAttr = new THREE.BufferAttribute(zekPos, 3); zekPosAttr.setUsage(THREE.DynamicDrawUsage);
    zekGeo.setAttribute("position", zekPosAttr);
    zekGeo.setAttribute("uv", new THREE.BufferAttribute(zekUV, 2));
    zekGeo.setIndex(new THREE.BufferAttribute(zekIdx, 1));
    // 番号は常時判読を優先し unlit(MeshBasic)+両面。アトラスは共有=disposeしない(texListに入れない)
    const zekMat = new THREE.MeshBasicMaterial({ map: zekkenAtlas(), side: THREE.DoubleSide }); matList.push(zekMat);
    const zekMesh = new THREE.Mesh(zekGeo, zekMat);
    zekMesh.frustumCulled = false; ownGeoList.push(zekGeo);
    parent.add(zekMesh);
    const _zv = new THREE.Vector3();

    // ---- H-9 自馬マーカー(自馬出走時のみ)。テクスチャは gate 毎キャッシュ(disposeしない)----
    let markerSprite = null;
    if (ownIndex >= 0) {
      const mtex = markerTexture(runners[ownIndex].gate);
      const smat = new THREE.SpriteMaterial({ map: mtex, transparent: true, depthTest: false, depthWrite: false, fog: false });
      matList.push(smat);
      markerSprite = new THREE.Sprite(smat);
      markerSprite.renderOrder = 999;
      markerSprite.frustumCulled = false;
      parent.add(markerSprite);
    }

    // ---- lat(隊列力学)----
    const lat = new Float32Array(n);
    for (let i = 0; i < n; i++) lat[i] = -8 + 16 * (i / Math.max(1, n - 1));

    // 再利用オブジェクト(GCゼロ)
    const _dummy = new THREE.Object3D();
    const _zero = new THREE.Matrix4().makeScale(0, 0, 0);
    const _qFlat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    const _qHead = new THREE.Quaternion();
    const _yAxis = new THREE.Vector3(0, 1, 0);
    const _scl = new THREE.Vector3(2.9, 1.0, 1);
    const _pos = new THREE.Vector3();
    const ownWorld = new THREE.Vector3();
    let hasOwnWorld = false;
    let blazeHidden = false;   // stage3 で白斑を落とす(§2.7・WS2-A MAJOR: per-pass 恒常≤140)

    function update(t, dt, pos, vArr, camL, camR) {
      // 順位(降順)
      const rankIdx = pos.map(function (v, i) { return i; }).sort(function (a, b) { return pos[b] - pos[a]; });
      const rankOf = new Array(n);
      rankIdx.forEach(function (hi, rank) { rankOf[hi] = rank; });

      // 目標 lat(順位で内外配分)→ lerp
      const spread = (t < 0) ? 1 : 0.85;
      for (let i = 0; i < n; i++) {
        const target = 7.5 - 15 * (rankOf[i] / Math.max(1, n - 1)) * spread;
        lat[i] += (target - lat[i]) * 0.02;
      }
      // 近接反発(同m帯・lat差<1.2m を微小に押し分け)
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          if (Math.abs(pos[i] - pos[j]) < 3) {
            const dl = lat[i] - lat[j];
            if (Math.abs(dl) < 1.2) {
              const push = (1.2 - Math.abs(dl)) * 0.05;
              const s = dl >= 0 ? 1 : -1;
              lat[i] += s * push; lat[j] -= s * push;
            }
          }
        }
      }

      hasOwnWorld = false;
      for (let hi = 0; hi < n; hi++) {
        const m = Math.min(pos[hi], D + 40);
        const R = D - pos[hi];
        const wp = course.pos(m + hi * 0.02, lat[hi], 0);   // i*0.02 で Z-fight回避
        const hd = course.heading(m);
        const easeUp = (t >= 0) && (sim.times[hi] < t);
        const running = (t >= 0) && !easeUp;
        const drive = running ? SH.clamp((400 - R) / 400, 0, 1) : 0;
        const phase = (m / 1.15) + hi * 1.7;                // 距離連動(2π=1完歩≈7.2m・実馬のストライド相当。dphase/dt = v/1.15 と等価・ジャンプ無)

        rig.root.position.set(wp.x, 0, wp.z);
        rig.root.rotation.y = Math.atan2(-hd.z, hd.x);
        // opt.v は死パラメータのため渡さない(位相は m 連動 phase で完結・§3.5 の dphase/dt=v/3.4 と等価)
        rig.pose(phase, running, { drive: drive, easeUp: easeUp });
        rig.root.updateWorldMatrix(false, true);

        // 全ノード → setMatrixAt(index = 馬index)
        for (let mi = 0; mi < meshes.length; mi++) {
          const e = meshes[mi];
          if (e.blaze) e.mesh.setMatrixAt(hi, (indiv[hi].blaze === e.blaze && !blazeHidden) ? e.node.matrixWorld : _zero);
          else e.mesh.setMatrixAt(hi, e.node.matrixWorld);
        }
        // ゼッケン(cloth ノード世界行列で4隅を変換しマージ頂点へ焼込・parent=identity前提)
        for (let side = 0; side < 2; side++) {
          const mw = nodes.cloth[side].matrixWorld, q = hi * 2 + side;
          for (let cc = 0; cc < 4; cc++) {
            _zv.set(ZC[cc][0], ZC[cc][1], 0).applyMatrix4(mw);
            const bi = (q * 4 + cc) * 3; zekPos[bi] = _zv.x; zekPos[bi + 1] = _zv.y; zekPos[bi + 2] = _zv.z;
          }
        }

        // ブロブ影(上下動非追従・heading 沿いに長軸)
        _qHead.setFromAxisAngle(_yAxis, rig.root.rotation.y);
        _qHead.multiply(_qFlat);
        _pos.set(wp.x, 0.02, wp.z);
        _dummy.matrix.compose(_pos, _qHead, _scl);
        shadowMesh.setMatrixAt(hi, _dummy.matrix);

        if (hi === ownIndex) { ownWorld.set(wp.x, 0, wp.z); hasOwnWorld = true; }
      }

      // 更新フラグ(フレーム1回・2パス共有)
      for (let mi = 0; mi < meshes.length; mi++) meshes[mi].mesh.instanceMatrix.needsUpdate = true;
      shadowMesh.instanceMatrix.needsUpdate = true;
      zekPosAttr.needsUpdate = true;

      // マーカー追従(自馬 root + y2.5 + 浮遊)
      // H-9スケール実式(WS2-A MINOR 整合): Sprite は距離で画面上縮む→画面px一定化には距離zに
      //  比例させる。よって sc=clamp(z*K, minWorld0.9, maxWorld3.4)(仕様の "k/z" は反比例だが
      //  Sprite投影特性では画面一定=z比例が正。基準は左カメラ距離=シーン共有のため)。右ビュー最小は minWorld0.9 で担保。
      if (markerSprite) {
        if (hasOwnWorld) {
          markerSprite.visible = true;
          markerSprite.position.set(ownWorld.x, 2.5 + Math.sin(t * 1.4) * 0.12, ownWorld.z);
          const z = camL ? camL.position.distanceTo(markerSprite.position) : 60;
          const sc = SH.clamp(z * 0.02, 0.9, 3.4);
          markerSprite.scale.set(sc * 0.86, sc, 1);
        } else markerSprite.visible = false;
      }
    }

    // ---- E-15 stage3: 低セグ差替 + Phong→Lambert(§2.7)----
    function ensureLow() {
      if (lambMat) return;
      lambMat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }); matList.push(lambMat);
      lambBlazeMat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }); matList.push(lambBlazeMat);
      // 寸法は createRig の "rig*" 幾何(horse3d.js)と一致させた低セグ版。shadeGeo で頂点色を付与
      const SG = SH.Horse3D.shadeGeo;
      const L = {
        torsoSph: SG(new THREE.SphereGeometry(1, 9, 7), 0.76, 1.03), skull: SG(new THREE.SphereGeometry(1, 8, 6), 0.84, 1.02),
        neck: SG(new THREE.CylinderGeometry(0.075, 0.14, 0.95, 6), 0.9, 1.0), tail: SG(new THREE.ConeGeometry(0.085, 0.55, 5), 0.85, 1.0),
        upperF: SG(new THREE.CylinderGeometry(0.065, 0.042, 0.54, 5), 0.82, 1.0), upperH: SG(new THREE.CylinderGeometry(0.090, 0.046, 0.58, 5), 0.82, 1.0),
        lower: SG(new THREE.CylinderGeometry(0.037, 0.031, 0.46, 4), 0.88, 1.0), jhead: SG(new THREE.SphereGeometry(0.082, 6, 5), 0.9, 1.0),
        jtorso: SG(new THREE.CylinderGeometry(0.10, 0.11, 0.36, 6), 0.85, 1.0), jarm: SG(new THREE.CylinderGeometry(0.028, 0.024, 0.30, 4), 0.9, 1.0),
        jleg: SG(new THREE.CylinderGeometry(0.038, 0.032, 0.24, 4), 0.9, 1.0),
      };
      for (const key in L) { lowGeos[key] = L[key]; ownGeoList.push(L[key]); }
    }
    function setLowDetail(b) {
      if (b) ensureLow();
      blazeHidden = !!b;   // stage3: 白斑を落とす(次フレームの setMatrixAt で _zero 化・§2.7)
      for (let mi = 0; mi < meshes.length; mi++) {
        const e = meshes[mi];
        e.mesh.material = b ? (e.blaze ? lambBlazeMat : lambMat) : (e.blaze ? blazeMat : bodyMat);
        if (lowGeos[e.key]) e.mesh.geometry = b ? lowGeos[e.key] : geos[e.key];
      }
    }

    function dispose() {
      for (let i = 0; i < matList.length; i++) { try { matList[i].dispose(); } catch (e) {} }
      for (let i = 0; i < texList.length; i++) { try { texList[i].dispose(); } catch (e) {} }
      for (let i = 0; i < ownGeoList.length; i++) { try { ownGeoList[i].dispose(); } catch (e) {} }
      // 共有リグ geos(H3 の geo キャッシュ)はレース跨ぎ再利用のため dispose しない
      matList.length = texList.length = ownGeoList.length = 0;
    }

    return {
      update: update,
      latOf: function (i) { return lat[i]; },
      ownRootPos: function (out) { if (out && hasOwnWorld) { out.copy(ownWorld); return out; } return null; },
      setLowDetail: setLowDetail,
      markerSprite: markerSprite,
      ownIndex: ownIndex,
      dispose: dispose,
    };
  };
})(window.SH);
