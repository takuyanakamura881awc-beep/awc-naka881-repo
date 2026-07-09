// ============================================================
// ui-race.js — レースタブ: 週のレースカード → 出馬表/馬券 →
//              Canvas観戦 → 結果/払い戻し → 週送り
// ============================================================
"use strict";
(function (SH) {
  // 週内の一時データ(セーブしない): レースごとの出走表・結果
  let weekCache = { week: 0, fields: {}, results: {}, watched: {} };
  let currentRaceId = null;
  let pendingBets = [];    // [{typeId, sel, stake, odds, label}]
  let rideSel = [];        // 今レースのライド選択(ゲート番号)
  let raceAnim = null;     // 再生中のアニメーション状態

  function payRate() { return SH.PAY_RATES[SH.state.pay] || 0.9; }

  SH.invalidateWeekCache = function () { weekCache = { week: 0, fields: {}, results: {}, watched: {} }; };

  function ensureWeek() {
    if (weekCache.week !== SH.state.week + SH.state.year * 100) {
      weekCache = { week: SH.state.week + SH.state.year * 100, fields: {}, results: {}, watched: {} };
    }
  }

  function fieldFor(race) {
    ensureWeek();
    if (!weekCache.fields[race.id]) {
      const entries = SH.activeHorses().filter(function (h) { return h.entryRaceId === race.id; });
      const used = new Set(SH.state.usedNames);
      const f = SH.buildField(race, entries, used);
      SH.computeOdds(f, payRate());
      weekCache.fields[race.id] = f;
    }
    return weekCache.fields[race.id];
  }

  // ---------- 画面ルート ----------
  SH.renderRaceTab = function () {
    const root = SH.$("#tab-race");
    SH.clear(root);
    ensureWeek();
    if (raceAnim) { raceAnim.cancel(); raceAnim = null; }
    if (currentRaceId && weekCache.results[currentRaceId] && weekCache.watched[currentRaceId] === "result") {
      renderResult(root, SH.findRace(currentRaceId));
    } else if (currentRaceId) {
      renderBetScreen(root, SH.findRace(currentRaceId));
    } else {
      renderCard(root);
    }
  };

  // ---------- 1) 今週のレースカード ----------
  function renderCard(root) {
    const s = SH.state;
    root.appendChild(SH.el("h2", { text: s.year + "年目 第" + s.week + "週 レーシングプログラム" }));
    if (s.ride) {
      root.appendChild(SH.el("div", { class: "ride-banner", html: "🎯 <b>" + (s.ride.mode === "win" ? "メイクライド" : "複勝ライド") + "</b> 進行中 — 持ち点 <b>" + SH.fmtMedal(s.ride.pot) + "</b>枚 (" + s.ride.streak + "連勝中)" }));
    }
    const list = SH.el("div", { class: "race-list" });
    SH.racesOfWeek(s.week).forEach(function (race) {
      const done = !!weekCache.results[race.id];
      const entries = SH.activeHorses().filter(function (h) { return h.entryRaceId === race.id; });
      const row = SH.el("div", { class: "race-row" + (done ? " done" : ""), onclick: function () { openRace(race); } }, [
        SH.gradeBadge(race.grade),
        SH.el("div", { class: "race-info" }, [
          SH.el("div", { class: "race-name", text: race.name }),
          SH.el("div", { class: "race-sub", text: race.course + " " + race.surface + race.dist + "m" + (race.cond ? " [" + race.cond + "]" : "") + (race.jump ? " 障害" : "") }),
        ]),
        entries.length ? SH.el("span", { class: "entry-mark", text: "自馬出走: " + entries.map(function (h) { return h.name; }).join("・") }) : null,
        SH.el("span", { class: "chev", text: done ? "結果 ▶" : "▶" }),
      ]);
      list.appendChild(row);
    });
    root.appendChild(list);
    root.appendChild(SH.el("div", { class: "hint", text: "レースを選んで馬券を買い、観戦できます。自馬を出走させるには厩舎タブで出走登録してください。" }));
    root.appendChild(SH.el("button", { class: "btn primary big", text: "▶ 次の週へ進む", onclick: SH.nextWeekFlow }));
  }

  function openRace(race) {
    currentRaceId = race.id;
    pendingBets = [];
    rideSel = [];
    SH.renderRaceTab();
  }

  // ---------- 2) 出馬表・馬券購入 ----------
  let betType = "win";
  let betSel = [];
  let betUnit = 10;

  function renderBetScreen(root, race) {
    if (!race) { currentRaceId = null; renderCard(root); return; }
    const field = fieldFor(race);
    const result = weekCache.results[race.id];

    const head = SH.el("div", { class: "race-head" }, [
      SH.el("button", { class: "btn ghost", text: "◀ 戻る", onclick: function () { currentRaceId = null; SH.renderRaceTab(); } }),
      SH.gradeBadge(race.grade),
      SH.el("div", {}, [
        SH.el("div", { class: "race-name big", text: race.name }),
        SH.el("div", { class: "race-sub", text: race.course + " " + race.surface + race.dist + "m ／ 馬場: " + field.condition + " ／ " + field.runners.length + "頭" }),
      ]),
    ]);
    root.appendChild(head);

    // 出馬表
    const tbl = SH.el("table", { class: "field-table" });
    tbl.appendChild(SH.el("tr", {}, [
      SH.el("th", { text: "枠" }), SH.el("th", { text: "馬名" }), SH.el("th", { text: "単勝" }), SH.el("th", { text: "人気" }),
      SH.el("th", { text: "性" }), SH.el("th", { text: "脚質" }), SH.el("th", { text: "騎手" }),
    ]));
    field.runners.forEach(function (r) {
      const selected = betSel.includes(r.gate);
      const tr = SH.el("tr", {
        class: (r.kind === "owned" ? "owned " : "") + (selected ? "selected" : ""),
        onclick: function () { toggleSel(r.gate); },
      }, [
        SH.el("td", {}, SH.wakuBadge(r.waku, r.gate)),
        SH.el("td", { text: r.name + (r.kind === "owned" ? " ★" : "") }),
        SH.el("td", { class: "odds", text: SH.fmtOdds(r.winOdds) }),
        SH.el("td", { text: r.popularity + "人気" }),
        SH.el("td", { text: r.sex }),
        SH.el("td", { text: r.leg }),
        SH.el("td", { text: r.jockey.name }),
      ]);
      tbl.appendChild(tr);
    });
    root.appendChild(SH.el("div", { class: "table-wrap" }, tbl));

    if (result) {
      root.appendChild(SH.el("button", { class: "btn primary big", text: "結果を見る", onclick: function () { weekCache.watched[race.id] = "result"; SH.renderRaceTab(); } }));
      return;
    }

    // --- 馬券スリップ ---
    const slip = SH.el("div", { class: "bet-slip" });
    slip.appendChild(SH.el("h3", { text: "馬券を買う" }));
    // 券種タブ
    const typeRow = SH.el("div", { class: "bet-types" });
    SH.BET_TYPES.forEach(function (bt) {
      typeRow.appendChild(SH.el("button", {
        class: "chip" + (betType === bt.id ? " on" : ""),
        text: bt.name,
        onclick: function () { betType = bt.id; betSel = []; SH.renderRaceTab(); },
      }));
    });
    slip.appendChild(typeRow);
    const btDef = SH.BET_TYPES.find(function (b) { return b.id === betType; });
    slip.appendChild(SH.el("div", { class: "hint", text: btDef.desc + (btDef.ordered ? "(選んだ順=着順)" : "") + " — 出馬表から" + btDef.picks + "頭タップで選択" }));
    // 選択状況
    slip.appendChild(SH.el("div", { class: "sel-status", text: "選択: " + (betSel.length ? betSel.map(function (g) { return g + "番"; }).join(btDef.ordered ? "→" : "-") : "未選択") }));
    // ベット単位
    const unitRow = SH.el("div", { class: "bet-units" }, [SH.el("span", { text: "枚数: " })]);
    SH.BET_UNITS.forEach(function (u) {
      unitRow.appendChild(SH.el("button", { class: "chip" + (betUnit === u ? " on" : ""), text: String(u), onclick: function () { betUnit = u; SH.renderRaceTab(); } }));
    });
    slip.appendChild(unitRow);
    // 追加ボタン
    const canAdd = betSel.length === btDef.picks;
    let oddsPreview = "";
    if (canAdd) {
      const o = betType === "win" ? field.runners[betSel[0] - 1].winOdds
        : betType === "place" ? field.runners[betSel[0] - 1].placeOdds
          : SH.comboOdds(field, betType, betSel, payRate());
      oddsPreview = "オッズ " + SH.fmtOdds(o) + "倍";
    }
    slip.appendChild(SH.el("button", {
      class: "btn primary", text: canAdd ? "この馬券を追加 (" + betUnit + "枚 / " + oddsPreview + ")" : "出馬表から" + btDef.picks + "頭選んでください",
      disabled: canAdd ? null : "1",
      onclick: function () { addBet(field, btDef); },
    }));
    // 購入済み一覧
    if (pendingBets.length) {
      const ul = SH.el("div", { class: "bet-list" });
      let total = 0;
      pendingBets.forEach(function (b, i) {
        total += b.stake;
        ul.appendChild(SH.el("div", { class: "bet-item" }, [
          SH.el("span", { text: b.label + " " + b.stake + "枚 (" + SH.fmtOdds(b.odds) + "倍)" }),
          SH.el("button", { class: "btn tiny", text: "取消", onclick: function () { SH.earn(b.stake); pendingBets.splice(i, 1); SH.renderRaceTab(); SH.updateTopBar(); } }),
        ]));
      });
      ul.appendChild(SH.el("div", { class: "bet-total", text: "合計 " + total + "枚" }));
      slip.appendChild(ul);
    }
    root.appendChild(slip);

    // --- メイクライド ---
    root.appendChild(renderRideBox(field));

    // 発走ボタン
    root.appendChild(SH.el("button", { class: "btn go big", text: "🏇 発走！(レースを観る)", onclick: function () { runRace(race, field, false); } }));
    root.appendChild(SH.el("button", { class: "btn ghost", text: "結果だけ見る(スキップ)", onclick: function () { runRace(race, field, true); } }));
  }

  function toggleSel(gate) {
    const btDef = SH.BET_TYPES.find(function (b) { return b.id === betType; });
    const i = betSel.indexOf(gate);
    if (i >= 0) betSel.splice(i, 1);
    else {
      if (betSel.length >= btDef.picks) betSel.shift();
      betSel.push(gate);
    }
    SH.renderRaceTab();
  }

  function addBet(field, btDef) {
    if (!SH.canPay(betUnit)) { SH.toast("メダルが足りません"); return; }
    const o = betType === "win" ? field.runners[betSel[0] - 1].winOdds
      : betType === "place" ? field.runners[betSel[0] - 1].placeOdds
        : SH.comboOdds(field, betType, betSel, payRate());
    SH.pay(betUnit);
    const label = btDef.name + " " + betSel.map(function (g) { return g + "番"; }).join(btDef.ordered ? "→" : "-");
    pendingBets.push({ typeId: betType, sel: betSel.slice(), stake: betUnit, odds: o, label: label });
    SH.state.stats.betTotal += betUnit;
    betSel = [];
    SH.renderRaceTab();
    SH.updateTopBar();
  }

  // ライド操作ボックス
  function renderRideBox(field) {
    const s = SH.state;
    const box = SH.el("div", { class: "ride-box" });
    box.appendChild(SH.el("h3", { text: "メイクライド(連勝式)" }));
    if (!s.ride) {
      box.appendChild(SH.el("div", { class: "hint", text: "1着馬(または複勝圏)を当て続け、払い戻しを次のレースへ自動的に賭け続けるモード。降りるまで増え続けるが、外せば全て失う。" }));
      const row = SH.el("div", { class: "row" });
      [10, 50, 100].forEach(function (amt) {
        row.appendChild(SH.el("button", {
          class: "btn", text: "単勝ライド開始 " + amt + "枚",
          onclick: function () {
            if (!SH.startRide("win", amt)) { SH.toast("メダルが足りません"); return; }
            SH.toast("メイクライド開始！このレースの1着候補を選んでください");
            SH.renderRaceTab(); SH.updateTopBar();
          },
        }));
      });
      row.appendChild(SH.el("button", {
        class: "btn", text: "複勝ライド開始 30枚",
        onclick: function () {
          if (!SH.startRide("place", 30)) { SH.toast("メダルが足りません"); return; }
          SH.renderRaceTab(); SH.updateTopBar();
        },
      }));
      box.appendChild(row);
      return box;
    }
    box.appendChild(SH.el("div", { html: "持ち点 <b>" + SH.fmtMedal(s.ride.pot) + "</b>枚 ／ " + s.ride.streak + "連勝中 ／ 方式: " + (s.ride.mode === "win" ? "単勝(1着)" : "複勝(3着内)") }));
    box.appendChild(SH.el("div", { class: "hint", text: "このレースで乗せる馬を最大3頭選択(持ち点を均等割り)。選ばなければ今回は見送り。" }));
    const row = SH.el("div", { class: "ride-sel" });
    field.runners.forEach(function (r) {
      const on = rideSel.includes(r.gate);
      row.appendChild(SH.el("button", {
        class: "chip" + (on ? " on" : ""),
        text: r.gate + " " + r.name + " (" + SH.fmtOdds(s.ride.mode === "win" ? r.winOdds : r.placeOdds) + ")",
        onclick: function () {
          const i = rideSel.indexOf(r.gate);
          if (i >= 0) rideSel.splice(i, 1);
          else { if (rideSel.length >= 3) rideSel.shift(); rideSel.push(r.gate); }
          SH.renderRaceTab();
        },
      }));
    });
    box.appendChild(row);
    box.appendChild(SH.el("button", {
      class: "btn", text: "💰 降りる(払い戻し " + SH.fmtMedal(s.ride.pot) + "枚)",
      onclick: function () { SH.cashOutRide(); SH.toast("ライド払い戻しを受け取りました"); SH.renderRaceTab(); SH.updateTopBar(); },
    }));
    return box;
  }

  // ---------- 3) レース実行・観戦 ----------
  function runRace(race, field, skip) {
    field.closed = true;
    const sim = SH.simulateRace(field);
    weekCache.results[race.id] = sim;
    settleAll(race, field, sim);
    if (skip) {
      weekCache.watched[race.id] = "result";
      SH.renderRaceTab();
    } else {
      weekCache.watched[race.id] = "live";
      renderLive(race, field, sim);
    }
  }

  // 精算(馬券・ライド・賞金・成績)
  function settleAll(race, field, sim) {
    const s = SH.state;
    const order = sim.order;
    // 馬券
    const results = SH.settleBets(field, pendingBets, order);
    let payout = 0;
    results.forEach(function (r) { if (r.hit) payout += r.payout; });
    if (payout > 0) {
      SH.earn(payout);
      s.stats.payoutTotal += payout;
      s.stats.bestPayout = Math.max(s.stats.bestPayout, payout);
    }
    sim.betResults = results;
    sim.betPayout = payout;
    // ライド
    if (s.ride && rideSel.length) {
      const share = Math.floor(s.ride.pot / rideSel.length);
      let ridePay = 0;
      rideSel.forEach(function (g) {
        const idx = g - 1;
        const r = field.runners[idx];
        const hitWin = order[0] === idx;
        const top = field.placeN === 2 ? order.slice(0, 2) : order.slice(0, 3);
        const hitPlace = top.includes(idx);
        if (s.ride.mode === "win" && hitWin) ridePay += Math.floor(share * r.winOdds);
        if (s.ride.mode === "place" && hitPlace) ridePay += Math.floor(share * r.placeOdds);
      });
      sim.rideBefore = s.ride.pot;
      if (ridePay > 0) {
        s.ride.pot = ridePay;
        s.ride.streak++;
        sim.rideAfter = ridePay;
      } else {
        sim.rideAfter = 0;
        SH.pushLog("メイクライド失敗…" + s.ride.streak + "連勝でストップ(" + s.ride.pot + "枚喪失)");
        s.ride = null;
      }
    }
    // 自馬の成績・賞金・素質判定
    sim.ownedResults = [];
    field.runners.forEach(function (r, idx) {
      if (r.kind !== "owned") return;
      const pos = order.indexOf(idx) + 1;
      const prize = SH.prizeFor(race, pos);
      if (prize > 0) SH.earn(prize);
      const msgs = SH.recordResult(r.ref, race, pos, field.runners.length, r.winOdds, r.popularity, prize, s.year, s.week);
      r.ref.entryRaceId = null;
      r.ref._actedThisWeek = true; // 出走は週消費
      sim.ownedResults.push({ horse: r.ref, pos: pos, prize: prize, msgs: msgs, odds: r.winOdds });
      SH.pushLog(r.ref.name + "が" + race.name + "で" + pos + "着" + (prize ? "(賞金" + prize + "枚)" : ""));
      // 素質判定: 皐月賞/桜花賞出走時に単勝オッズから判定
      if (race.id === "satsuki" || race.id === "oka") {
        const yayoi = r.ref.history.find(function (x) { return x.raceName === "弥生賞" || x.raceName === "スプリングステークス"; });
        const judge = SH.judgeSoshitsu(s.pay, yayoi ? yayoi.pos : null, r.winOdds);
        if (judge) {
          r.ref.soshitsuKnown = true;
          sim.soshitsuJudge = { horse: r.ref.name, judge: judge, odds: r.winOdds, actual: r.ref.soshitsu };
        }
      }
    });
    s.stats.races++;
    SH.save();
  }

  // ---------- Canvas 観戦(テレビ中継風ビュー: raceview.js) ----------
  function renderLive(race, field, sim) {
    const root = SH.$("#tab-race");
    SH.clear(root);
    function finishLive() {
      if (raceAnim) { raceAnim.cancel(); raceAnim = null; }
      weekCache.watched[race.id] = "result";
      SH.renderRaceTab();
      SH.updateTopBar();
    }
    raceAnim = SH.createRaceView(root, race, field, sim, finishLive);
  }

  // ---------- 4) 結果画面 ----------
  function renderResult(root, race) {
    const field = weekCache.fields[race.id];
    const sim = weekCache.results[race.id];
    const s = SH.state;
    root.appendChild(SH.el("div", { class: "race-head" }, [
      SH.el("button", { class: "btn ghost", text: "◀ レース一覧", onclick: function () { currentRaceId = null; pendingBets = []; rideSel = []; SH.renderRaceTab(); } }),
      SH.gradeBadge(race.grade),
      SH.el("div", { class: "race-name big", text: race.name + " 結果" }),
    ]));
    // 着順表
    const tbl = SH.el("table", { class: "field-table" });
    tbl.appendChild(SH.el("tr", {}, [
      SH.el("th", { text: "着" }), SH.el("th", { text: "枠" }), SH.el("th", { text: "馬名" }),
      SH.el("th", { text: "単勝" }), SH.el("th", { text: "人気" }), SH.el("th", { text: "脚質" }), SH.el("th", { text: "騎手" }),
    ]));
    sim.order.forEach(function (idx, pos) {
      const r = field.runners[idx];
      tbl.appendChild(SH.el("tr", { class: (r.kind === "owned" ? "owned" : "") + (pos < 3 ? " top3" : "") }, [
        SH.el("td", { text: String(pos + 1) }),
        SH.el("td", {}, SH.wakuBadge(r.waku, r.gate)),
        SH.el("td", { text: r.name + (r.kind === "owned" ? " ★" : "") }),
        SH.el("td", { class: "odds", text: SH.fmtOdds(r.winOdds) }),
        SH.el("td", { text: r.popularity + "人気" }),
        SH.el("td", { text: r.leg }),
        SH.el("td", { text: r.jockey.name }),
      ]));
    });
    root.appendChild(SH.el("div", { class: "table-wrap" }, tbl));

    // 払い戻し
    const pay = SH.el("div", { class: "payout-box" });
    pay.appendChild(SH.el("h3", { text: "払い戻し" }));
    if (sim.betResults && sim.betResults.length) {
      sim.betResults.forEach(function (br) {
        pay.appendChild(SH.el("div", {
          class: "bet-item " + (br.hit ? "hit" : "miss"),
          text: (br.hit ? "◎ 的中 " : "× ハズレ ") + br.bet.label + " " + br.bet.stake + "枚 → " + (br.hit ? br.payout + "枚" : "0枚"),
        }));
      });
      pay.appendChild(SH.el("div", { class: "bet-total", text: "払い戻し合計: " + SH.fmtMedal(sim.betPayout || 0) + "枚" }));
    } else {
      pay.appendChild(SH.el("div", { class: "hint", text: "馬券の購入はありませんでした" }));
    }
    // ライド結果
    if (sim.rideBefore != null) {
      if (sim.rideAfter > 0) pay.appendChild(SH.el("div", { class: "bet-item hit", text: "🎯 ライド成功！持ち点 " + sim.rideBefore + " → " + sim.rideAfter + "枚 (" + s.ride.streak + "連勝)" }));
      else pay.appendChild(SH.el("div", { class: "bet-item miss", text: "🎯 ライド失敗… 持ち点" + sim.rideBefore + "枚を失った" }));
    }
    root.appendChild(pay);

    // 自馬結果
    if (sim.ownedResults && sim.ownedResults.length) {
      const box = SH.el("div", { class: "owned-result" });
      box.appendChild(SH.el("h3", { text: "自馬の結果" }));
      sim.ownedResults.forEach(function (or) {
        box.appendChild(SH.el("div", { text: "★ " + or.horse.name + ": " + or.pos + "着 (単勝" + SH.fmtOdds(or.odds) + "倍)" + (or.prize ? " 賞金" + or.prize + "枚" : "") }));
        (or.msgs || []).forEach(function (m) { box.appendChild(SH.el("div", { class: "hint", text: m })); });
      });
      if (sim.soshitsuJudge) {
        const j = sim.soshitsuJudge;
        box.appendChild(SH.el("div", {
          class: "judge-box",
          html: "🔍 <b>素質判定</b>(単勝" + SH.fmtOdds(j.odds) + "倍 / ペイ" + s.pay + "): <b>" + j.judge.rank + "</b>" +
            (j.judge.note ? " <span class='hint'>" + j.judge.note + "</span>" : "") +
            "<div class='hint'>判定はオッズからの推定。厩舎画面で素質が確認できるようになりました。</div>",
        }));
      }
      root.appendChild(box);
    }
    root.appendChild(SH.el("button", { class: "btn primary big", text: "▶ 次の週へ進む", onclick: SH.nextWeekFlow }));
    root.appendChild(SH.el("button", { class: "btn ghost", text: "同週の他のレースを見る", onclick: function () { currentRaceId = null; pendingBets = []; rideSel = []; SH.renderRaceTab(); } }));
  }

  // ---------- 週送りフロー ----------
  SH.nextWeekFlow = function () {
    ensureWeek();
    const s = SH.state;
    // 未消化の自馬出走レースを自動処理
    SH.activeHorses().forEach(function (h) {
      if (!h.entryRaceId) return;
      if (weekCache.results[h.entryRaceId]) return;
      const race = SH.findRace(h.entryRaceId);
      if (!race) { h.entryRaceId = null; return; }
      const field = fieldFor(race);
      const sim = SH.simulateRace(field);
      weekCache.results[race.id] = sim;
      // 精算(馬券なし・自馬のみ)
      field.runners.forEach(function (r, idx) {
        if (r.kind !== "owned") return;
        const pos = sim.order.indexOf(idx) + 1;
        const prize = SH.prizeFor(race, pos);
        if (prize > 0) SH.earn(prize);
        SH.recordResult(r.ref, race, pos, field.runners.length, r.winOdds, r.popularity, prize, s.year, s.week);
        r.ref.entryRaceId = null;
        r.ref._actedThisWeek = true;
        SH.pushLog(r.ref.name + "が" + race.name + "で" + pos + "着(自動処理)" + (prize ? " 賞金" + prize + "枚" : ""));
      });
    });
    // 厩舎プラン適用 → 週送り
    const planMsgs = SH.applyWeekPlans(SH.weekPlans || {});
    const msgs = SH.advanceWeek();
    SH.weekPlans = {};
    planMsgs.concat(msgs).forEach(function (m) { SH.pushLog(m); });
    SH.invalidateWeekCache();
    currentRaceId = null;
    pendingBets = [];
    rideSel = [];
    betSel = [];
    SH.toast(SH.state.year + "年目 第" + SH.state.week + "週になりました");
    SH.renderAll();
  };
})(window.SH);
