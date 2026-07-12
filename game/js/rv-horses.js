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

  const RIG_SCALE = 1.15;          // §6.1 実寸化スケール(createRig root のみ)
  const BLAZE_KEYS = { blazeStar: "star", blazeStripe: "stripe", blazeSnip: "snip" };
  // 部位固定色(instanceColor)
  const FIXED = {
    eye: 0x14100c, hoof: 0x2b2119, saddle: 0xf4f2ea, jhead: 0xe8c39e,
    jleg: 0xf2f2f2, jboot: 0x25201c, blazeStar: 0xffffff, blazeStripe: 0xffffff, blazeSnip: 0xffffff,
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

  // 青地・白数字ゼッケン(§6.3): 128×128、地#1c4f9e、白縁、白数字、下部に様式的飾り
  function zekkenTexture(gate) {
    const cv = document.createElement("canvas"); cv.width = 128; cv.height = 128;
    const c = cv.getContext("2d");
    c.fillStyle = "#1c4f9e"; c.fillRect(0, 0, 128, 128);
    c.strokeStyle = "#ffffff"; c.lineWidth = 7; c.strokeRect(5, 5, 118, 118);
    c.fillStyle = "#ffffff"; c.font = "bold 74px sans-serif";
    c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(String(gate), 64, 56);
    // 下部の判読不能な飾り文字列(実在表記の複製をしない・様式のみ)
    c.font = "9px sans-serif"; c.globalAlpha = 0.7;
    c.fillText("■ — □ — ■", 64, 110);
    c.globalAlpha = 1;
    const t = new THREE.CanvasTexture(cv);
    return t;
  }
  // H-9 マーカー(§2.3.5): 96×112、発光黄・下向き五角形ピン・馬番
  function markerTexture(gate) {
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
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 18, specular: 0x2a2a2a });
    // 白斑は polygonOffset で顔面との Z-fight を回避
    const blazeMat = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 10, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
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

    // ---- ゼッケン(個別 Mesh 2枚/頭・matrixAutoUpdate=false)----
    const zek = []; // [hi*2 + side]
    for (let hi = 0; hi < n; hi++) {
      const tex = zekkenTexture(indiv[hi].gate); texList.push(tex);
      const zmat = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }); matList.push(zmat);
      for (let side = 0; side < 2; side++) {
        const zm = new THREE.Mesh(geos.cloth, zmat);
        zm.matrixAutoUpdate = false; zm.frustumCulled = false;
        parent.add(zm);
        zek.push(zm);
      }
    }

    // ---- H-9 自馬マーカー(自馬出走時のみ)----
    let markerSprite = null;
    if (ownIndex >= 0) {
      const mtex = markerTexture(runners[ownIndex].gate); texList.push(mtex);
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
    const _scl = new THREE.Vector3(2.6, 0.9, 1);
    const _pos = new THREE.Vector3();
    const ownWorld = new THREE.Vector3();
    let hasOwnWorld = false;

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
        const phase = (m / 3.4) + hi * 1.7;                 // 距離連動(dphase/dt = v/3.4 と等価・ジャンプ無)

        rig.root.position.set(wp.x, 0, wp.z);
        rig.root.rotation.y = Math.atan2(-hd.z, hd.x);
        rig.pose(phase, running, { v: vArr ? vArr[hi] : 0, drive: drive, easeUp: easeUp });
        rig.root.updateWorldMatrix(false, true);

        // 全ノード → setMatrixAt(index = 馬index)
        for (let mi = 0; mi < meshes.length; mi++) {
          const e = meshes[mi];
          if (e.blaze) e.mesh.setMatrixAt(hi, indiv[hi].blaze === e.blaze ? e.node.matrixWorld : _zero);
          else e.mesh.setMatrixAt(hi, e.node.matrixWorld);
        }
        // ゼッケン(cloth ノード世界行列を matrix へ・parent=identity 前提)
        zek[hi * 2].matrix.copy(nodes.cloth[0].matrixWorld);
        zek[hi * 2 + 1].matrix.copy(nodes.cloth[1].matrixWorld);

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

      // マーカー追従(自馬 root + y2.5 + 浮遊。スケールは左カメラ距離基準)
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
      lambMat = new THREE.MeshLambertMaterial({ color: 0xffffff }); matList.push(lambMat);
      lambBlazeMat = new THREE.MeshLambertMaterial({ color: 0xffffff, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }); matList.push(lambBlazeMat);
      const L = {
        torsoSph: new THREE.SphereGeometry(1, 8, 6), skull: new THREE.SphereGeometry(1, 7, 5),
        neck: new THREE.CylinderGeometry(0.13, 0.24, 0.92, 5), tail: new THREE.ConeGeometry(0.085, 0.78, 5),
        upperF: new THREE.CylinderGeometry(0.075, 0.058, 0.52, 5), upperH: new THREE.CylinderGeometry(0.085, 0.058, 0.52, 5),
        lower: new THREE.CylinderGeometry(0.05, 0.038, 0.46, 5), jhead: new THREE.SphereGeometry(0.085, 6, 5),
        jtorso: new THREE.CylinderGeometry(0.11, 0.12, 0.36, 6), jarm: new THREE.CylinderGeometry(0.032, 0.028, 0.34, 4),
        jleg: new THREE.CylinderGeometry(0.04, 0.035, 0.26, 4),
      };
      for (const key in L) { lowGeos[key] = L[key]; ownGeoList.push(L[key]); }
    }
    function setLowDetail(b) {
      if (b) ensureLow();
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
