// ============================================================
// state.js — ゲーム状態・週進行・レーシングカレンダー・セーブ
// ============================================================
"use strict";
(function (SH) {
  const SAVE_KEY = "umastable-save-v1";

  SH.state = null;

  // ---------- 初期状態 ----------
  SH.newGame = function (playerName) {
    SH.state = {
      version: 1,
      playerName: playerName || "オーナー",
      medals: SH.START_MEDALS,
      bank: 0,              // メダルバンク(預け入れ)
      year: 1,
      week: 1,
      pay: SH.DEFAULT_PAY,  // ペイ設定(オッズ算出用)
      horses: [],           // 所有馬(育成中/引退/殿堂すべて)
      usedNames: [],        // 使用済み馬名
      ride: null,           // メイクライド進行 {mode:"win"|"place", pot, streak}
      log: [],              // 週ごとの出来事ログ(最新100)
      stats: { betTotal: 0, payoutTotal: 0, races: 0, bestPayout: 0, rideBest: 0 },
      week1Done: false,     // 今週の厩舎アクション実行済みフラグ
    };
    SH.pushLog("ゲーム開始！メダル" + SH.START_MEDALS + "枚からスタート");
    SH.save();
    return SH.state;
  };

  SH.pushLog = function (msg) {
    const s = SH.state;
    s.log.unshift("Y" + s.year + " W" + s.week + "  " + msg);
    if (s.log.length > 100) s.log.length = 100;
  };

  // ---------- セーブ/ロード ----------
  SH.save = function () {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(SH.state)); } catch (e) { /* プライベートモード等 */ }
  };
  SH.load = function () {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      SH.state = JSON.parse(raw);
      return SH.state;
    } catch (e) { return null; }
  };
  SH.resetSave = function () {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { }
    SH.state = null;
  };
  SH.exportSave = function () { return JSON.stringify(SH.state); };
  SH.importSave = function (text) {
    const obj = JSON.parse(text);
    if (!obj || typeof obj.medals !== "number" || !Array.isArray(obj.horses)) throw new Error("セーブデータの形式が不正です");
    SH.state = obj;
    SH.save();
    return SH.state;
  };

  // ---------- レーシングカレンダー ----------
  // その週に開催されるレース一覧(重賞+自動生成の平場)
  SH.racesOfWeek = function (week) {
    const list = [];
    SH.STAKES.forEach(function (r) { if (r.week === week) list.push(r); });
    // 平場(毎週): 新馬・未勝利・条件・OP特別
    const d = SH.FLAT_DISTS, c = SH.COURSES;
    const surf = week % 3 === 0 ? "ダート" : "芝";
    list.push({ week: week, id: "w" + week + "-maiden", name: "メイクデビュー(新馬)", grade: "新馬", dist: d[week % 5], surface: surf, course: c[week % c.length], cond: null, flat: true });
    list.push({ week: week, id: "w" + week + "-mdn2", name: "未勝利戦", grade: "未勝利", dist: d[(week + 2) % 7], surface: week % 2 === 0 ? "芝" : "ダート", course: c[(week + 3) % c.length], cond: null, flat: true });
    list.push({ week: week, id: "w" + week + "-allow", name: "500万下(条件)", grade: "条件", dist: d[(week + 4) % 7], surface: "芝", course: c[(week + 5) % c.length], cond: null, flat: true });
    if (week % 2 === 0) list.push({ week: week, id: "w" + week + "-op", name: "オープン特別", grade: "OP", dist: d[(week + 1) % 7], surface: "芝", course: c[(week + 1) % c.length], cond: null, flat: true });
    // メインレース(グレード最上位)を先頭に
    const rankOf = { "WBC": 0, "G1": 1, "J-G1": 2, "G2": 3, "J-G2": 4, "G3": 5, "J-G3": 6, "OP": 7, "条件": 8, "未勝利": 9, "新馬": 10 };
    list.sort(function (a, b) { return rankOf[a.grade] - rankOf[b.grade]; });
    return list;
  };

  SH.findRace = function (raceId) {
    return SH.racesOfWeek(SH.state.week).find(function (r) { return r.id === raceId; }) || null;
  };

  // ---------- メダル操作 ----------
  SH.canPay = function (n) { return SH.state.medals >= n; };
  SH.pay = function (n) {
    if (!SH.canPay(n)) return false;
    SH.state.medals -= n;
    return true;
  };
  SH.earn = function (n) { SH.state.medals += n; };

  // ---------- 厩舎: 週プランの適用 ----------
  // plans: {horseId: {action:"train"|"graze"|"rest", training, feed, entryRaceId}}
  SH.applyWeekPlans = function (plans) {
    const s = SH.state;
    const msgs = [];
    s.horses.forEach(function (h) {
      if (h.status !== "育成中") return;
      const p = plans[h.id];
      let acted = false;
      if (h.grazing > 0) {
        // 放牧中は自動経過(tickWeekで処理)
      } else if (p) {
        if (p.action === "graze") {
          msgs.push.apply(msgs, SH.startGrazing(h));
          SH.pushLog(h.name + "を放牧に出した");
        } else if (p.action === "train") {
          let cost = 0;
          const t = p.training ? SH.TRAININGS.find(function (x) { return x.id === p.training; }) : null;
          const f = p.feed ? SH.FEEDS.find(function (x) { return x.id === p.feed; }) : null;
          if (t) cost += t.cost;
          if (f) cost += f.cost;
          if (cost > 0 && !SH.pay(cost)) {
            msgs.push(h.name + ": メダル不足で調教/飼葉ができなかった");
          } else {
            if (t) { msgs.push.apply(msgs, SH.applyTraining(h, t.id)); acted = true; }
            if (f) {
              msgs.push.apply(msgs, SH.applyFeed(h, f.id));
              acted = true;
              if (t && t.secret) msgs.push.apply(msgs, SH.applySecretLeg(h, f.id));
            }
          }
        }
        // 出走登録(レース処理はメインフローで)
        if (p.entryRaceId) { h.entryRaceId = p.entryRaceId; acted = true; }
        else h.entryRaceId = null;
      }
      h._actedThisWeek = acted;
    });
    return msgs;
  };

  // 週送り(レース終了後に呼ぶ)
  SH.advanceWeek = function () {
    const s = SH.state;
    const msgs = [];
    s.horses.forEach(function (h) {
      if (h.status !== "育成中") return;
      msgs.push.apply(msgs, SH.tickWeek(h, !!h._actedThisWeek || !!h.entryRaceId));
      h._actedThisWeek = false;
      h.entryRaceId = null;
    });
    s.week++;
    if (s.week > 52) {
      s.week = 1;
      s.year++;
      s.horses.forEach(function (h) {
        if (h.status === "育成中") { h.age++; }
      });
      msgs.push("年が明けて " + s.year + "年目。所有馬は加齢した");
    }
    SH.save();
    return msgs;
  };

  // ---------- 生産 ----------
  SH.ownedParents = function (sex) {
    return SH.state.horses.filter(function (h) {
      return (h.status === "引退" || h.status === "殿堂") && h.sex === (sex === "sire" ? "牡" : "牝");
    });
  };
  SH.activeHorses = function () {
    return SH.state.horses.filter(function (h) { return h.status === "育成中"; });
  };
  SH.canBreed = function () {
    return SH.activeHorses().length < SH.MAX_OWNED && SH.canPay(SH.BREED_COST);
  };
  SH.doBreed = function (sireRef, damRef, name) {
    if (!SH.canBreed()) return null;
    if (!SH.pay(SH.BREED_COST)) return null;
    // 世代: 自家製親がいれば その世代+1
    let gen = 1;
    [sireRef, damRef].forEach(function (p) {
      if (p.kind === "owned") gen = Math.max(gen, (p.data.generation || 1) + 1);
    });
    const used = new Set(SH.state.usedNames);
    const foal = SH.breedFoal(sireRef, damRef, gen, name || SH.genName(used));
    SH.state.usedNames = Array.from(used);
    if (SH.state.usedNames.indexOf(foal.name) < 0) SH.state.usedNames.push(foal.name);
    SH.state.horses.push(foal);
    SH.pushLog(foal.name + "が誕生(" + foal.sireName + "×" + foal.damName + " / " + gen + "代目)");
    SH.save();
    return foal;
  };

  // ---------- メイクライド ----------
  SH.startRide = function (mode, stake) {
    if (!SH.pay(stake)) return false;
    SH.state.ride = { mode: mode, pot: stake, streak: 0 };
    return true;
  };
  SH.cashOutRide = function () {
    const r = SH.state.ride;
    if (!r) return 0;
    SH.earn(r.pot);
    const amt = r.pot;
    SH.state.stats.rideBest = Math.max(SH.state.stats.rideBest, amt);
    SH.pushLog("メイクライド" + r.streak + "連勝で降りた。獲得" + amt + "枚");
    SH.state.ride = null;
    SH.save();
    return amt;
  };
})(window.SH);
