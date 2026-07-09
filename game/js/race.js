// ============================================================
// race.js — 出走馬生成・オッズ算出・馬券・レースシミュレーション
// ============================================================
"use strict";
(function (SH) {
  // グレード別のCPU出走馬の強さ(平均スコア)と頭数
  const GRADE_BAND = {
    "新馬": { mean: 44, sd: 5, field: [8, 12] },
    "未勝利": { mean: 47, sd: 5, field: [10, 14] },
    "条件": { mean: 55, sd: 5, field: [10, 14] },
    "OP": { mean: 64, sd: 5, field: [10, 14] },
    "G3": { mean: 71, sd: 5, field: [12, 16] },
    "G2": { mean: 77, sd: 5, field: [12, 16] },
    "G1": { mean: 85, sd: 5, field: [14, 18] },
    "J-G3": { mean: 66, sd: 6, field: [10, 12] },
    "J-G2": { mean: 72, sd: 6, field: [10, 12] },
    "J-G1": { mean: 78, sd: 6, field: [10, 14] },
    "WBC": { mean: 92, sd: 4, field: [5, 5] }, // WBCは最大5頭マッチング
  };

  // ---------- CPU出走馬の生成 ----------
  function cpuRunner(race, usedNames, band) {
    const power = band.mean + SH.gauss() * band.sd;
    const leg = SH.pick(["逃げ", "先行", "先行", "差し", "差し", "追込"]);
    return {
      kind: "cpu",
      name: SH.genName(usedNames),
      sex: Math.random() < 0.6 ? "牡" : "牝",
      leg: leg,
      power: SH.clamp(power, 25, 105),
      distance: SH.pick(SH.DISTANCES),
      dirtApt: race.surface === "ダート" ? SH.pick(["得意", "得意", "普通"]) : SH.pick(["得意", "普通", "普通", "不得意"]),
      mudApt: SH.pick(["得意", "普通", "普通", "不得意"]),
      startSkill: 40 + SH.rnd(40),
      guts: 30 + SH.rnd(50),
      form: SH.pick(SH.FORMS),
      fatigue: SH.rnd(30),
      weightPenalty: 0,
    };
  }

  // 所有馬 → 出走馬形式へ
  function ownedRunner(h) {
    // 距離適性の重み: 長距離ほどスタミナ重視
    return {
      kind: "owned",
      ref: h,
      name: h.name,
      sex: h.sex,
      leg: h.leg,
      power: null, // score() で sp/st/pw から算出
      distance: h.distance,
      dirtApt: h.dirtApt,
      mudApt: h.mudApt,
      startSkill: h.startSkill,
      guts: h.guts,
      form: h.form,
      fatigue: h.fatigue,
      weightPenalty: Math.abs(h.weight - h.idealWeight) / 20,
    };
  }

  // 出走馬の「基礎スコア」(オッズ・シミュ共通の強さ指標)
  function baseScore(r, race) {
    let s;
    if (r.kind === "cpu") s = r.power;
    else {
      const h = r.ref;
      const wSt = SH.clamp(0.22 + (race.dist - 1400) / 2000 * 0.20, 0.15, 0.42);
      const wSp = 0.72 - wSt - 0.05;
      s = h.sp * wSp + h.st * wSt + h.pw * 0.28 + (h.guts - 50) * 0.05;
    }
    // 距離適性
    s *= SH.distFit(r.distance, race.dist);
    // 馬場(芝/ダート)
    if (race.surface === "ダート") s += r.dirtApt === "得意" ? 2 : r.dirtApt === "不得意" ? -8 : -3;
    // 調子・疲労・馬体重
    s *= SH.FORM_MULT[r.form] || 1;
    s -= r.fatigue * 0.06;
    s -= r.weightPenalty || 0;
    return s;
  }

  // 馬場状態による補正(パワー/道悪適性)
  function condAdjust(r, condition) {
    const lv = SH.CONDITIONS.indexOf(condition); // 0良 1稍重 2重 3不良
    if (lv === 0) return 0;
    const apt = r.mudApt;
    if (apt === "得意") return lv * 1.0;
    if (apt === "不得意") return -lv * 2.5;
    return -lv * 1.2;
  }

  // ---------- 出走表の作成 ----------
  // playerEntries: この レースに登録済みの所有馬配列
  SH.buildField = function (race, playerEntries, usedNames) {
    const band = GRADE_BAND[race.grade] || GRADE_BAND["条件"];
    const size = SH.clamp(band.field[0] + SH.rint(band.field[1] - band.field[0] + 1), 5, 18);
    const runners = [];
    (playerEntries || []).forEach(function (h) { runners.push(ownedRunner(h)); });
    const used = usedNames || new Set();
    while (runners.length < size) runners.push(cpuRunner(race, used, band));
    // ゲート抽選
    for (let i = runners.length - 1; i > 0; i--) {
      const j = SH.rint(i + 1);
      const t = runners[i]; runners[i] = runners[j]; runners[j] = t;
    }
    const n = runners.length;
    runners.forEach(function (r, i) {
      r.gate = i + 1;
      // 枠番(JRA式: 8枠に振り分け)
      r.waku = n <= 8 ? i + 1 : Math.min(8, Math.floor(i * 8 / n) + 1);
      const j = SH.pick(SH.JOCKEYS);
      r.jockey = j;
    });
    // 馬場状態
    const condition = Math.random() < 0.72 ? "良" : Math.random() < 0.5 ? "稍重" : Math.random() < 0.6 ? "重" : "不良";
    runners.forEach(function (r) {
      r.score = baseScore(r, race) + condAdjust(r, condition)
        + r.jockey.skill * 4 + (r.jockey.favLeg === r.leg ? 1.5 : 0);
    });
    return { race: race, runners: runners, condition: condition, closed: false };
  };

  // ---------- 勝率推定とオッズ (Plackett-Luce サンプリング) ----------
  const N_SAMPLES = 600;
  function sampleOrders(field) {
    const n = field.runners.length;
    const scores = field.runners.map(function (r) { return r.score; });
    const orders = [];
    for (let s = 0; s < N_SAMPLES; s++) {
      // Gumbelノイズ付きスコアで着順サンプル(上位3着まで確定すれば十分)
      const noisy = scores.map(function (sc, i) {
        const u = Math.random();
        const gumbel = -Math.log(-Math.log(u + 1e-12) + 1e-12);
        return { i: i, v: sc / 5.8 + gumbel };
      });
      noisy.sort(function (a, b) { return b.v - a.v; });
      orders.push([noisy[0].i, noisy[1].i, noisy[2].i]);
    }
    return orders;
  }

  // オッズ計算: field に odds(単勝/複勝) と確率テーブルを付与
  SH.computeOdds = function (field, payRate) {
    const n = field.runners.length;
    const orders = sampleOrders(field);
    const winC = new Array(n).fill(0);
    const placeC = new Array(n).fill(0);
    const placeN = n <= 7 ? 2 : 3; // 複勝: 7頭以下は2着まで
    orders.forEach(function (o) {
      winC[o[0]]++;
      for (let k = 0; k < placeN; k++) placeC[o[k]]++;
    });
    const pay = payRate;
    field.samples = orders;
    field.placeN = placeN;
    field.pWin = winC.map(function (c) { return Math.max(c, 0.35) / N_SAMPLES; });
    field.pPlace = placeC.map(function (c) { return Math.max(c, 0.6) / N_SAMPLES; });
    field.runners.forEach(function (r, i) {
      r.winOdds = SH.clamp(Math.round(pay / field.pWin[i] * 10) / 10, 1.1, 999.9);
      r.placeOdds = SH.clamp(Math.round(pay / field.pPlace[i] * 10) / 10, 1.1, 999.9);
    });
    // 人気順
    const idx = field.runners.map(function (r, i) { return i; });
    idx.sort(function (a, b) { return field.runners[a].winOdds - field.runners[b].winOdds; });
    idx.forEach(function (ri, rank) { field.runners[ri].popularity = rank + 1; });
    return field;
  };

  // 組合せ馬券のオッズをサンプルから算出(選択時に呼ぶ)
  // sel: ゲート番号の配列(1-origin)。ordered=trueなら着順どおり
  SH.comboOdds = function (field, betTypeId, sel, payRate) {
    const idxs = sel.map(function (g) { return g - 1; });
    let hit = 0;
    const N = field.samples.length;
    field.samples.forEach(function (o) {
      if (comboHit(field, betTypeId, idxs, o)) hit++;
    });
    const p = Math.max(hit, 0.3) / N;
    return SH.clamp(Math.round(payRate / p * 10) / 10, 1.1, 9999.9);
  };

  // 的中判定(サンプル/本番共用)。order: [1着idx,2着idx,3着idx]
  function comboHit(field, type, idxs, order) {
    const [a, b, c] = order;
    switch (type) {
      case "win": return a === idxs[0];
      case "place": {
        const top = field.placeN === 2 ? [a, b] : [a, b, c];
        return top.includes(idxs[0]);
      }
      case "wakuren": {
        const w1 = field.runners[a].waku, w2 = field.runners[b].waku;
        const s1 = field.runners[idxs[0]].waku, s2 = field.runners[idxs[1]].waku;
        return (w1 === s1 && w2 === s2) || (w1 === s2 && w2 === s1);
      }
      case "umaren": return (a === idxs[0] && b === idxs[1]) || (a === idxs[1] && b === idxs[0]);
      case "umatan": return a === idxs[0] && b === idxs[1];
      case "wide": {
        const top3 = [a, b, c];
        return top3.includes(idxs[0]) && top3.includes(idxs[1]);
      }
      case "sanrenpuku": {
        const t = [a, b, c];
        return idxs.every(function (x) { return t.includes(x); });
      }
      case "sanrentan": return a === idxs[0] && b === idxs[1] && c === idxs[2];
    }
    return false;
  }
  SH.comboHit = comboHit;

  // ---------- レースシミュレーション ----------
  // 返り値: { frames, order, times, story }
  //   frames: 描画用スナップショット列 [{t, pos:[m], v:[m/s]}]
  //   order:  着順のrunner index列
  //   story:  実況 [{t, text}]
  SH.simulateRace = function (field) {
    const race = field.race;
    const D = race.dist;
    const n = field.runners.length;
    const dt = 0.4;

    // 脚質パラメータ: [道中ペース係数, スパート係数, スパート開始残距離]
    const LEG_P = {
      "大逃げ": [1.075, 0.94, 700],
      "逃げ":   [1.045, 0.99, 650],
      "先行":   [1.02, 1.03, 600],
      "差し":   [0.995, 1.09, 520],
      "追込":   [0.975, 1.14, 430],
      "まくり": [0.99, 1.06, 1100], // 3角(残り約1000m)から動く
      "自在":   [1.01, 1.06, 560],
    };

    // 各馬の走行モデル
    const H = field.runners.map(function (r, i) {
      const sc = r.score + SH.gauss() * 5.2; // 当日の出来(オッズ算出のブレ幅と整合させる)
      // 基準速度: スコア50→16.4m/s, 100→18.4m/s 付近。距離が長いほど全体に遅く
      const distSlow = (D - 1600) / 1600 * 0.9;
      const vBase = 16.4 + (sc - 50) * 0.04 - Math.max(0, distSlow);
      const lp = LEG_P[r.leg] || LEG_P["先行"];
      // スタミナ: スパート持続力。スタミナ切れで失速
      const stamina = (r.kind === "owned" ? r.ref.st : r.power) + SH.gauss() * 3;
      return {
        i: i, r: r, x: 0, v: 0,
        vBase: vBase, pace: lp[0], spurt: lp[1], spurtAt: lp[2],
        stamina: 1.0 + (stamina - 55) * 0.004, // 1.0中心の持続係数
        startDelay: startDelay(r),
        spurting: false, tired: false,
        finish: null,
        lane: i, // 描画用レーン
      };
    });

    function startDelay(r) {
      const apt = r.kind === "owned" ? r.ref.startApt : "普通";
      const sk = r.startSkill;
      let p = apt === "得意" ? 0.02 : apt === "不得意" ? 0.16 : 0.07;
      p += (60 - sk) * 0.002;
      return Math.random() < SH.clamp(p, 0.01, 0.3) ? 0.5 + SH.rnd(0.8) : SH.rnd(0.15);
    }

    const frames = [];
    const story = [];
    const say = function (t, tpl, h1, h2) {
      let txt = SH.pick(tpl);
      if (h1) txt = txt.replace("{h}", h1);
      if (h2) txt = txt.replace("{h2}", h2);
      story.push({ t: t, text: txt });
    };

    // 実況: スタート
    const late = H.filter(function (h) { return h.startDelay > 0.45; });
    if (late.length) say(0.6, SH.COMMENTARY.start_bad, late[0].r.name);
    else say(0.6, SH.COMMENTARY.start_good);

    let t = 0, finished = 0, rank = 1;
    const order = [];
    let saidLead = false, saidMid = false, said34 = false, saidStr = false, saidMakuri = false, saidFade = false;

    while (finished < n && t < 400) {
      t += dt;
      // 現在の先頭
      let leader = H[0];
      H.forEach(function (h) { if (h.x > leader.x) leader = h; });

      H.forEach(function (h) {
        if (h.finish !== null) return;
        if (t < h.startDelay) return;
        const remain = D - h.x;
        // フェーズ判定
        let target = h.vBase * h.pace;
        if (remain <= h.spurtAt) {
          if (!h.spurting) h.spurting = true;
          // スパート: スタミナ残に応じて伸び/失速
          const spurtDist = h.spurtAt - remain;
          const endurance = h.stamina * (900 + (h.r.guts - 40) * 4); // 持続距離
          if (spurtDist < endurance) target = h.vBase * h.spurt;
          else { h.tired = true; target = h.vBase * 0.86; }
        } else {
          // 道中: 大逃げ/逃げはハイペースのぶんスタミナを前借り
          if ((h.r.leg === "大逃げ" || h.r.leg === "逃げ") && h.x > D * 0.5) {
            h.stamina -= dt * 0.0016 * (h.r.leg === "大逃げ" ? 1.6 : 1.0);
          }
          // 差し/追込は道中脚を溜める(スタミナ微回復)
          if (h.r.leg === "差し" || h.r.leg === "追込") h.stamina += dt * 0.0004;
        }
        // 揉まれ/不利(中団後方の馬にまれに発生)
        if (h.spurting && !h.blocked && Math.random() < 0.004 && (h.r.leg === "差し" || h.r.leg === "追込")) {
          h.blocked = true; target *= 0.9;
        }
        // 加速(慣性)
        const acc = h.spurting ? 2.6 : 1.9;
        if (h.v < target) h.v = Math.min(target, h.v + acc * dt);
        else h.v = Math.max(target, h.v - 2.2 * dt);
        h.v += SH.gauss() * 0.05; // 揺らぎ
        h.x += h.v * dt;
        if (h.x >= D && h.finish === null) {
          h.finish = t + (h.x - D) / Math.max(h.v, 1);
          order.push(h.i);
          finished++;
          rank++;
        }
      });

      // 実況イベント
      const prog = leader.x / D;
      if (!saidLead && prog > 0.08) {
        saidLead = true;
        if (leader.r.leg === "大逃げ") say(t, SH.COMMENTARY.ooniige, leader.r.name);
        else say(t, SH.COMMENTARY.lead, leader.r.name);
      }
      if (!saidMid && prog > 0.45) { saidMid = true; say(t, SH.COMMENTARY.mid, leader.r.name); }
      if (!saidMakuri && prog > 0.55) {
        const mk = H.find(function (h) { return h.r.leg === "まくり" && h.spurting && h.finish === null; });
        if (mk) { saidMakuri = true; say(t, SH.COMMENTARY.makuri, mk.r.name); }
      }
      if (!said34 && prog > 0.72) { said34 = true; say(t, SH.COMMENTARY.corner34, leader.r.name); }
      if (!saidStr && prog > 0.85) {
        saidStr = true; say(t, SH.COMMENTARY.straight, leader.r.name);
        // 伸びてくる馬
        const chg = H.filter(function (h) { return (h.r.leg === "差し" || h.r.leg === "追込") && h.spurting && !h.tired && h.finish === null; })
          .sort(function (a, b) { return b.v - a.v; })[0];
        if (chg && chg !== leader) say(t + 0.5, SH.COMMENTARY.charge, chg.r.name);
        const fd = H.find(function (h) { return h.tired && h.finish === null && h.x > D * 0.6; });
        if (fd && !saidFade) { saidFade = true; say(t + 1, SH.COMMENTARY.fade, fd.r.name); }
      }

      frames.push({ t: t, pos: H.map(function (h) { return h.x; }), v: H.map(function (h) { return h.v; }) });
    }
    // 完走できなかった馬(念のため)を追加
    H.forEach(function (h) { if (h.finish === null) { h.finish = 999; order.push(h.i); } });

    // ゴール実況
    const w = field.runners[order[0]], second = field.runners[order[1]];
    const margin = H[order[1]] ? (H[order[1]].finish - H[order[0]].finish) : 9;
    if (margin < 0.12) say(t + 0.5, SH.COMMENTARY.goal_close, w.name, second ? second.name : "");
    else say(t + 0.5, SH.COMMENTARY.goal_solo, w.name);

    return { frames: frames, order: order, times: H.map(function (h) { return h.finish; }), story: story, condition: field.condition };
  };

  // ---------- 払い戻し ----------
  // bets: [{typeId, sel(gate配列), stake, odds}], result order(index列)
  SH.settleBets = function (field, bets, order) {
    const results = [];
    bets.forEach(function (b) {
      const idxs = b.sel.map(function (g) { return g - 1; });
      const top = [order[0], order[1], order[2]];
      const hit = comboHit(field, b.typeId, idxs, top);
      const payout = hit ? Math.floor(b.stake * b.odds) : 0;
      results.push({ bet: b, hit: hit, payout: payout });
    });
    return results;
  };

  // ---------- 賞金 ----------
  SH.prizeFor = function (race, pos) {
    if (pos > 5) return 0;
    const p1 = SH.PRIZE_1ST[race.grade] || 30;
    return Math.floor(p1 * SH.PRIZE_SHARE[pos - 1]);
  };

  // ---------- 素質判定(皐月賞オッズ) ----------
  // yayoiFinish: 弥生賞(orスプリングS)の着順(未出走ならnull)
  SH.judgeSoshitsu = function (payKey, yayoiFinish, satsukiOdds) {
    const table = SH.SOSHITSU_TABLE[payKey];
    if (!table) return null;
    const rowKey = yayoiFinish == null ? "4" : yayoiFinish <= 1 ? "1" : yayoiFinish === 2 ? "2" : yayoiFinish === 3 ? "3" : yayoiFinish <= 5 ? "4" : "6";
    const row = table[rowKey]; // [準MAX, MAX下, MAX中, MAX上]
    const o = Math.round(satsukiOdds * 10);
    let rank;
    if (o <= row[3]) rank = "MAX上";
    else if (o <= row[2]) rank = "MAX中";
    else if (o <= row[1]) rank = "MAX下";
    else if (o <= row[0]) rank = "準MAX";
    else rank = "準MAX未満";
    return { rank: rank, note: yayoiFinish == null ? "弥生賞未出走のため参考値" : "" };
  };
})(window.SH);
