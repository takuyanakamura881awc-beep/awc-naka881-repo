// ============================================================
// horse.js — 馬モデル・生産(配合)・育成(調教/飼葉/放牧)・成長
// ============================================================
"use strict";
(function (SH) {
  // ---------- 乱数ユーティリティ ----------
  SH.rnd = function (n) { return Math.random() * n; };
  SH.rint = function (n) { return Math.floor(Math.random() * n); }; // 0..n-1
  SH.pick = function (arr) { return arr[SH.rint(arr.length)]; };
  SH.gauss = function () { // 標準正規乱数(Box-Muller)
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  };
  SH.clamp = function (x, lo, hi) { return Math.min(hi, Math.max(lo, x)); };

  let seq = 0;
  SH.uid = function (p) { return (p || "id") + "-" + Date.now().toString(36) + "-" + (seq++).toString(36) + "-" + SH.rint(1e6).toString(36); };

  // ---------- 馬名生成 ----------
  SH.genName = function (usedSet) {
    for (let i = 0; i < 40; i++) {
      const name = SH.pick(SH.NAME_HEADS) + SH.pick(SH.NAME_TAILS);
      if (name.length >= 2 && name.length <= 9 && !(usedSet && usedSet.has(name))) {
        if (usedSet) usedSet.add(name);
        return name;
      }
    }
    return SH.pick(SH.NAME_HEADS) + SH.rint(99); // フォールバック
  };

  // 素質ランク: 値(0=MAX上 … 6=4落ち)との相互変換
  SH.rankVal = function (rank) { return SH.SOSHITSU.indexOf(rank); };
  SH.valRank = function (v) { return SH.SOSHITSU[SH.clamp(Math.round(v), 0, 6)]; };

  // ---------- 距離適性・脚質など表示用の判定 ----------
  // 距離適性区分から、レース距離に対する適合度(0〜1)を返す
  SH.distFit = function (distKey, raceDist) {
    const r = SH.DISTANCE_RANGE[distKey] || SH.DISTANCE_RANGE["万能"];
    if (raceDist >= r.lo && raceDist <= r.hi) return 1.0;
    const over = raceDist < r.lo ? r.lo - raceDist : raceDist - r.hi;
    return Math.max(0.55, 1.0 - over / 1300); // 適性外は徐々に減衰
  };

  // ---------- 生産(配合) ----------
  // parent: {kind:"cpu", data:{name,inherit,tier}} または {kind:"owned", data:horse}
  function parentRankVal(p) {
    if (p.kind === "cpu") {
      // CPU馬の隠し格: tier1→MAX下相当, tier2→2落ち相当, tier3→3落ち相当
      return { 1: 2, 2: 4, 3: 5 }[p.data.tier] ?? 5;
    }
    let v = SH.rankVal(p.data.soshitsu);
    if (p.data.g1Wins > 0) v -= 1;                 // G1馬は格上げ
    if (p.data.wbcWins > 0) v -= 1;                // WBC勝ちはさらに
    if ((p.data.tsukeWeeks || 0) >= 60) v -= 2;    // 漬け育成(長期)
    else if ((p.data.tsukeWeeks || 0) >= 20) v -= 1; // 漬け育成(標準)
    if (p.data.madakome) v += 1;                   // まだコメ引退のペナルティ
    return v;
  }

  function parentLeg(p) {
    if (p.kind === "owned") return p.data.leg;
    return null;
  }
  function parentInherit(p) {
    return p.kind === "cpu" ? p.data.inherit : (p.data.inheritType || "平均");
  }

  // 継承型ごとの素質ブレ
  function inheritDelta(sireType, damType) {
    const hh = sireType === "H/H" || damType === "H/H";
    const solid = sireType === "堅実" && damType === "堅実";
    const g = SH.gauss();
    if (hh) return Math.round(g * 2.0);       // ブレ大(一発も大外れも)
    if (solid) return Math.round(g * 0.7);    // 安定
    return Math.round(g * 1.3);               // 中庸
  }

  // 誕生コメント(生産時): 素質ランクに応じたコメントを選ぶ
  SH.birthComment = function (rank) {
    const v = SH.rankVal(rank);
    const cands = SH.BIRTH_COMMENTS.filter(function (c) {
      if (c.tier >= 6) return false; // 名馬/天馬/神話は条件戦無敗クリア時のみ
      if (!c.minRank) return c.tier === 1;
      return v <= SH.rankVal(c.minRank);
    });
    // 高素質ほど上位コメが出やすい(確率で1段下がる)
    cands.sort(function (a, b) { return b.tier - a.tier; });
    const idx = Math.random() < 0.65 ? 0 : Math.min(1, cands.length - 1);
    return cands[idx] || SH.BIRTH_COMMENTS[SH.BIRTH_COMMENTS.length - 1];
  };

  // 条件戦無敗クリア時のコメント(天馬/神話/名馬)
  SH.undefeatedComment = function (rank) {
    const v = SH.rankVal(rank);
    if (v <= SH.rankVal("MAX下") && Math.random() < 0.7) return SH.BIRTH_COMMENTS[0]; // 名馬コメ(素質必要)
    return Math.random() < 0.5 ? SH.BIRTH_COMMENTS[1] : SH.BIRTH_COMMENTS[2]; // 天馬/神話(素質無関係)
  };

  // 仔馬を生産する
  // sire/dam: parent ref, generation: 何代目か, name: 馬名
  SH.breedFoal = function (sire, dam, generation, name) {
    const sv = parentRankVal(sire), dv = parentRankVal(dam);
    const sType = parentInherit(sire), dType = parentInherit(dam);
    const base = Math.min(sv, dv);
    const genBonus = Math.min(2.0, (generation - 1) * 0.5); // 代重ねで素質UP
    const v = SH.clamp(Math.round(base + 0.8 - genBonus + inheritDelta(sType, dType)), 0, 6);
    const rank = SH.valRank(v);
    const cap = SH.SOSHITSU_CAP[rank];

    // 脚質: 2世代目以降は親から継承しやすい(70%)。初代/CPU親はランダム(通常4種)
    const pl = parentLeg(sire) || parentLeg(dam);
    const leg = (pl && Math.random() < 0.7) ? pl : SH.pick(["逃げ", "先行", "差し", "追込"]);

    // 距離適性: 高素質ほど広い適性が出やすい
    const distPool = v <= 1 ? ["中距離", "中長距離", "万能", "中短距離"]
      : v <= 3 ? ["短距離", "中短距離", "中距離", "中長距離", "長距離"]
        : ["短距離", "中短距離", "中距離", "中長距離", "長距離"];
    const distance = SH.pick(distPool);

    const sex = Math.random() < 0.5 ? "牡" : "牝";
    const growth = SH.pick(SH.GROWTHS);
    const debut = cap * 0.40 + 8; // デビュー時能力

    const foal = {
      id: SH.uid("h"),
      name: name,
      sex: sex,
      generation: generation,
      sireName: sire.kind === "cpu" ? sire.data.name : sire.data.name,
      damName: dam.kind === "cpu" ? dam.data.name : dam.data.name,
      inheritType: Math.random() < 0.5 ? sType : dType, // 自身の継承型(次代用)
      soshitsu: rank,           // 隠し素質(UI上は「？」表示、判定で開示)
      soshitsuKnown: false,
      leg: leg,
      growth: growth,
      distance: distance,
      dirtApt: SH.pick(["得意", "普通", "普通", "不得意"]),
      mudApt: SH.pick(["得意", "普通", "普通", "不得意"]),
      startApt: SH.pick(["得意", "普通", "普通", "不得意"]),
      temper: SH.pick(SH.TEMPERS),
      coat: SH.pick(SH.COATS),
      // 内部能力(0-100)
      sp: debut + SH.rnd(4) - 2,
      st: debut + SH.rnd(4) - 2,
      pw: debut + SH.rnd(4) - 2,
      startSkill: 50 + SH.rnd(20) - 10,
      guts: 50 + SH.rnd(30) - 15,
      cap: cap,
      // 状態
      age: 2,
      fatigue: 0,
      form: "普通",
      weight: 460 + SH.rint(41),      // 馬体重
      idealWeight: 470 + SH.rint(21),
      weeksLeft: SH.MAX_WEEKS,
      trainedWeeks: 0,   // 調教済み週数(成長曲線用)
      tsukeWeeks: 0,     // プール漬け週数
      secretCombo: null, // {leg, count} 極秘調教×餌の進行
      grazing: 0,        // 放牧残り週
      // 成績
      first: 0, second: 0, third: 0, unplaced: 0,
      g1Wins: 0, wbcWins: 0, jg1Wins: 0, prizeMedals: 0,
      tripleCrown: [],   // 勝った三冠レースid
      undefeatedLow: true, // 条件戦以下無敗フラグ
      condClear: false,    // 条件戦クリア済み
      madakome: false,
      status: "育成中",    // 育成中/引退/殿堂
      history: [],         // {year,week,raceName,grade,pos,field,odds,pop,prize}
      birthCommentKey: null,
      birthCommentText: null,
      extraComment: null,  // 条件戦無敗クリア時コメント
      entryRaceId: null,   // 今週の出走登録先
      plan: null,          // 今週のプラン {training, feed}
    };
    const bc = SH.birthComment(rank);
    foal.birthCommentKey = bc.key;
    foal.birthCommentText = bc.text;
    return foal;
  };

  // ---------- 成長曲線 ----------
  // 調教効率: 成長タイプと経過週で変わる(0.3〜1.3)
  function growthMult(h) {
    const w = h.trainedWeeks;
    if (h.growth === "早熟") return w < 40 ? 1.3 : (w < 70 ? 0.9 : 0.5);
    if (h.growth === "晩成") return w < 30 ? 0.6 : (w < 60 ? 1.0 : 1.3);
    return 1.0; // 普通
  }

  // ---------- 週アクションの適用 ----------
  // 調教を1回適用。戻り値はメッセージ配列
  SH.applyTraining = function (h, trainingId) {
    const t = SH.TRAININGS.find(function (x) { return x.id === trainingId; });
    if (!t) return [];
    const msgs = [];
    const eff = growthMult(h) * (h.fatigue > 70 ? 0.5 : 1.0);
    ["sp", "st", "pw"].forEach(function (k) {
      const g = t.gain[k] || 0;
      if (g > 0) {
        const headroom = Math.max(0, 1 - h[k] / h.cap);
        h[k] = SH.clamp(h[k] + g * eff * (0.4 + 0.6 * headroom), 0, h.cap);
      } else if (g < 0) {
        h[k] = SH.clamp(h[k] + g, 20, h.cap);
      }
    });
    if (t.gain.start) h.startSkill = SH.clamp(h.startSkill + t.gain.start * eff, 0, 100);
    h.fatigue = SH.clamp(h.fatigue + t.fatigue, 0, 100);
    if (t.id === "woods") h.weight += Math.sign(h.idealWeight - h.weight) * Math.min(6, Math.abs(h.idealWeight - h.weight));
    else if (t.fatigue > 0) h.weight = Math.max(400, h.weight - 2);
    if (t.calm && h.temper === "荒い" && Math.random() < 0.3) { h.temper = "普通"; msgs.push(h.name + "の気性が落ち着いてきた"); }
    if (t.tsuke) h.tsukeWeeks++;
    h.trainedWeeks++;
    if (h.fatigue >= 90) msgs.push(h.name + "は疲労がかなり溜まっている(調教効率・レースに悪影響)");
    return msgs;
  };

  // 飼葉を1回適用
  SH.applyFeed = function (h, feedId) {
    const f = SH.FEEDS.find(function (x) { return x.id === feedId; });
    if (!f) return [];
    const msgs = [];
    h.fatigue = SH.clamp(h.fatigue + f.fatigue, 0, 100);
    h.weight = Math.min(560, h.weight + 2);
    if (f.formUp) {
      const i = SH.FORMS.indexOf(h.form);
      if (i > 0 && Math.random() < 0.7) { h.form = SH.FORMS[i - 1]; msgs.push(h.name + "の調子が上がってきた(" + SH.FORM_ARROW[h.form] + ")"); }
    }
    return msgs;
  };

  // 極秘調教×餌の脚質変更判定(同週に極秘調教+餌を与えた時に呼ぶ)
  SH.applySecretLeg = function (h, feedId) {
    const f = SH.FEEDS.find(function (x) { return x.id === feedId; });
    if (!f || !f.leg) return [];
    const msgs = [];
    if (!h.secretCombo || h.secretCombo.leg !== f.leg) h.secretCombo = { leg: f.leg, count: 0 };
    h.secretCombo.count++;
    const combo = h.secretCombo;
    if (f.leg === "自在") {
      h.leg = "自在"; msgs.push(h.name + "の脚質が「自在」に変わった！");
    } else if (f.specialLeg && combo.count >= 3) {
      h.leg = f.specialLeg; msgs.push(h.name + "の脚質が特殊脚質「" + f.specialLeg + "」に変わった！");
      h.secretCombo = null;
    } else {
      if (h.leg !== f.leg) { h.leg = f.leg; msgs.push(h.name + "の脚質が「" + f.leg + "」に変わった"); }
      else if (f.specialLeg) msgs.push("極秘調教×" + f.name + " " + combo.count + "回目(3回で" + f.specialLeg + ")");
    }
    return msgs;
  };

  // 放牧開始(4週)
  SH.startGrazing = function (h) {
    h.grazing = 4;
    return [h.name + "を放牧に出した(4週間)"];
  };

  // 週送り時の自然変化(全馬共通)。acted=今週なにか行動したか
  SH.tickWeek = function (h, acted) {
    const msgs = [];
    if (h.status !== "育成中") return msgs;
    if (h.grazing > 0) {
      h.grazing--;
      h.fatigue = SH.clamp(h.fatigue - 30, 0, 100);
      h.weeksLeft--; // 放牧も在籍週を消費
      if (h.grazing === 0) {
        h.form = "普通";
        h.st = Math.max(20, h.st - 0.5); // 放牧はスタミナ微減
        msgs.push(h.name + "が放牧から帰ってきた(疲労回復・調子リセット)");
      }
      return msgs;
    }
    if (acted) h.weeksLeft--; // 調教/飼葉/出走した週のみ在籍週を消費(温存可)
    // 調子の揺らぎ(気性が荒いほど激しい)
    const vol = h.temper === "荒い" ? 0.45 : h.temper === "普通" ? 0.3 : 0.2;
    if (Math.random() < vol) {
      let i = SH.FORMS.indexOf(h.form) + (Math.random() < 0.5 ? -1 : 1);
      h.form = SH.FORMS[SH.clamp(i, 0, SH.FORMS.length - 1)];
    }
    if (h.weeksLeft <= 0) msgs.push(h.name + "は残り0週。引退の時期です");
    return msgs;
  };

  // ---------- 引退・継承 ----------
  SH.canInherit = function (h) {
    return h.g1Wins > 0 || h.wbcWins > 0 || h.jg1Wins > 0 || h.weeksLeft <= SH.INHERIT_WEEKS;
  };
  SH.careerStarts = function (h) { return h.first + h.second + h.third + h.unplaced; };

  // 引退処理。まだコメ判定つき
  SH.retireHorse = function (h) {
    const msgs = [];
    const starts = SH.careerStarts(h);
    if (h.weeksLeft >= SH.MADAKOME_WEEKS && starts < SH.MADAKOME_STARTS) {
      h.madakome = true;
      msgs.push("「まだ走れたのに…」残り週を多く残した早期引退のため、次代への継承にペナルティが付く(まだコメ)");
    }
    h.status = (h.g1Wins > 0 || h.wbcWins > 0 || h.jg1Wins > 0) ? "殿堂" : "引退";
    if (h.status === "殿堂") msgs.push(h.name + "はGⅠ勝利馬として殿堂入り！種牡馬/繁殖牝馬として次代に使える");
    else msgs.push(h.name + "は引退した。繁殖として次代に使える");
    return msgs;
  };

  // ---------- レース後の成績反映 ----------
  SH.recordResult = function (h, race, pos, field, odds, pop, prize, year, week) {
    if (pos === 1) h.first++;
    else if (pos === 2) h.second++;
    else if (pos === 3) h.third++;
    else h.unplaced++;
    h.prizeMedals += prize;
    const g = race.grade;
    if (pos === 1) {
      if (g === "G1") h.g1Wins++;
      if (g === "WBC") h.wbcWins++;
      if (g === "J-G1") h.jg1Wins++;
      if (SH.TRIPLE_CROWN.includes(race.id) && !h.tripleCrown.includes(race.id)) h.tripleCrown.push(race.id);
    }
    const low = (g === "新馬" || g === "未勝利" || g === "条件");
    if (low && pos !== 1) h.undefeatedLow = false;
    h.fatigue = SH.clamp(h.fatigue + 25, 0, 100);
    h.weight = Math.max(400, h.weight - 4);
    h.history.push({ year: year, week: week, raceName: race.name, grade: g, pos: pos, field: field, odds: odds, pop: pop, prize: prize });
    // 条件戦クリア(3勝目=OP入り)時、無敗なら特別コメント
    const wins = h.first;
    if (!h.condClear && wins >= 3) {
      h.condClear = true;
      if (h.undefeatedLow) {
        const c = SH.undefeatedComment(h.soshitsu);
        h.extraComment = c.text;
        return ["厩務員「" + c.text + "」"];
      }
    }
    return [];
  };

  // ---------- 出走資格 ----------
  SH.eligible = function (h, race) {
    if (h.status !== "育成中" || h.grazing > 0 || h.weeksLeft <= 0) return false;
    const wins = h.first, starts = SH.careerStarts(h);
    switch (race.grade) {
      case "新馬": if (starts > 0) return false; break;
      case "未勝利": if (starts === 0 || wins > 0) return false; break;
      case "条件": if (wins >= 3) return false; if (starts === 0) return false; break;
      default: if (wins === 0 && starts < 1) return false; // 重賞は未出走馬不可
    }
    if (race.cond === "3歳" && h.age !== 3) return false;
    if (race.cond === "3歳牝" && (h.age !== 3 || h.sex !== "牝")) return false;
    if (race.cond === "牝" && h.sex !== "牝") return false;
    if (race.cond === "古馬" && h.age < 4) return false;
    if (race.cond === "招待") { // WBC/FEGJ: 重賞勝ち馬のみ
      if (h.g1Wins + h.wbcWins + h.jg1Wins === 0 && h.prizeMedals < 500) return false;
    }
    return true;
  };

  // ---------- 表示用 ----------
  SH.dispSoshitsu = function (h) { return h.soshitsuKnown ? h.soshitsu : "？？？"; };
  SH.abilityStars = function (v, cap) { // 内部値を☆表示(5段階)に丸める
    const n = SH.clamp(Math.round((v / 100) * 5 + 0.3), 1, 5);
    return "★".repeat(n) + "☆".repeat(5 - n);
  };
})(window.SH);
