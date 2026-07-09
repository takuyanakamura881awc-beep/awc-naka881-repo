// ============================================================
// ui-stable.js — 厩舎(育成)・生産(配合)・殿堂/記録・設定タブ
// ============================================================
"use strict";
(function (SH) {
  SH.weekPlans = {}; // {horseId: {action, training, feed}}

  // ---------- 厩舎タブ ----------
  SH.renderStableTab = function () {
    const root = SH.$("#tab-stable");
    SH.clear(root);
    const s = SH.state;
    const active = SH.activeHorses();
    root.appendChild(SH.el("h2", { text: "厩舎 (" + active.length + "/" + SH.MAX_OWNED + "頭)" }));
    if (!active.length) {
      root.appendChild(SH.el("div", { class: "hint", text: "所有馬がいません。生産タブで配合して仔馬を作りましょう(メダル" + SH.BREED_COST + "枚)。" }));
      root.appendChild(SH.el("button", { class: "btn primary", text: "生産タブへ", onclick: function () { SH.switchTab("breed"); } }));
      return;
    }
    root.appendChild(SH.el("div", { class: "hint", text: "今週のプランを馬ごとに設定 →「次の週へ」で実行。調教・飼葉・出走・放牧をした週だけ残り週が減ります(何もしなければ温存)。" }));
    active.forEach(function (h) { root.appendChild(horseCard(h)); });
  };

  function abilityBar(label, v, cap) {
    const pct = SH.clamp(v, 0, 100);
    const capPct = SH.clamp(cap, 0, 100);
    return SH.el("div", { class: "ab-row" }, [
      SH.el("span", { class: "ab-label", text: label }),
      SH.el("div", { class: "ab-bar" }, [
        SH.el("div", { class: "ab-cap", style: { width: capPct + "%" } }),
        SH.el("div", { class: "ab-fill", style: { width: pct + "%" } }),
      ]),
      SH.el("span", { class: "ab-val", text: String(Math.round(v)) }),
    ]);
  }

  function horseCard(h) {
    const s = SH.state;
    const card = SH.el("div", { class: "horse-card" });
    const starts = SH.careerStarts(h);
    // ヘッダ
    card.appendChild(SH.el("div", { class: "hc-head" }, [
      SH.el("span", { class: "hc-name", text: h.name }),
      SH.el("span", { class: "hc-meta", text: h.sex + h.age + "歳 / " + h.coat + " / " + h.generation + "代目" }),
      SH.el("span", { class: "hc-form", text: "調子 " + SH.FORM_ARROW[h.form] }),
    ]));
    // 血統・コメント
    card.appendChild(SH.el("div", { class: "hc-line hint", text: "父 " + h.sireName + " × 母 " + h.damName }));
    card.appendChild(SH.el("div", { class: "hc-comment", text: "「" + (h.extraComment || h.birthCommentText) + "」" }));
    // 能力
    const abBox = SH.el("div", { class: "ab-box" });
    abBox.appendChild(abilityBar("スピード", h.sp, h.cap));
    abBox.appendChild(abilityBar("スタミナ", h.st, h.cap));
    abBox.appendChild(abilityBar("パワー", h.pw, h.cap));
    card.appendChild(abBox);
    // 適性・情報
    const info = SH.el("div", { class: "hc-grid" });
    [["素質", SH.dispSoshitsu(h)], ["脚質", h.leg], ["成長", h.growth], ["距離", h.distance + "(" + (SH.DISTANCE_RANGE[h.distance] ? SH.DISTANCE_RANGE[h.distance].lo + "〜" + SH.DISTANCE_RANGE[h.distance].hi + "m" : "") + ")"],
    ["ダート", h.dirtApt], ["重馬場", h.mudApt], ["スタート", h.startApt], ["気性", h.temper],
    ["馬体重", h.weight + "kg(理想" + h.idealWeight + ")"], ["疲労", Math.round(h.fatigue) + "%"],
    ["残り週", h.weeksLeft + "/" + SH.MAX_WEEKS + "週"], ["漬け", h.tsukeWeeks + "週"],
    ["成績", starts + "戦" + h.first + "勝 [" + h.first + "-" + h.second + "-" + h.third + "-" + h.unplaced + "]"],
    ["獲得賞金", SH.fmtMedal(h.prizeMedals) + "枚"], ["GⅠ", h.g1Wins + "勝" + (h.wbcWins ? " WBC" + h.wbcWins + "勝" : "")], ["継承型", h.inheritType],
    ].forEach(function (pair) {
      info.appendChild(SH.el("div", { class: "hc-cell" }, [
        SH.el("span", { class: "k", text: pair[0] }), SH.el("span", { class: "v", text: String(pair[1]) }),
      ]));
    });
    card.appendChild(info);
    // 警告
    if (h.weeksLeft <= 12 && h.weeksLeft > 0) card.appendChild(SH.el("div", { class: "warn", text: "⚠ 残り" + h.weeksLeft + "週。ローテと引退時期に注意" }));
    if (h.weeksLeft <= 0) card.appendChild(SH.el("div", { class: "warn urgent", text: "⚠ 残り0週。引退させましょう" }));
    if (SH.canInherit(h)) card.appendChild(SH.el("div", { class: "ok", text: "✓ 継承引退が可能(" + (h.g1Wins + h.wbcWins + h.jg1Wins > 0 ? "GⅠ勝利" : "残" + h.weeksLeft + "週") + ")" }));
    if (h.weeksLeft >= SH.MADAKOME_WEEKS && starts < SH.MADAKOME_STARTS) {
      card.appendChild(SH.el("div", { class: "warn", text: "⚠ いま引退すると「まだコメ」(残週" + h.weeksLeft + "・出走" + starts + "/" + SH.MADAKOME_STARTS + "戦)。継承ペナルティに注意" }));
    }
    // 放牧中
    if (h.grazing > 0) {
      card.appendChild(SH.el("div", { class: "hint", text: "🌿 放牧中(あと" + h.grazing + "週)" }));
      return card;
    }
    // 週プラン
    card.appendChild(planBox(h));
    // 引退ボタン
    card.appendChild(SH.el("button", {
      class: "btn danger small", text: "引退させる",
      onclick: function () {
        SH.confirmBox(h.name + "を引退させますか？(取り消せません)", function () {
          SH.retireHorse(h).forEach(function (m) { SH.pushLog(m); SH.toast(m); });
          SH.save();
          SH.renderAll();
        });
      },
    }));
    return card;
  }

  function planBox(h) {
    const s = SH.state;
    const plan = SH.weekPlans[h.id] || (SH.weekPlans[h.id] = { action: "rest", training: null, feed: null });
    const box = SH.el("div", { class: "plan-box" });
    box.appendChild(SH.el("h4", { text: "今週のプラン" }));
    // アクション選択
    const actRow = SH.el("div", { class: "row" });
    [["rest", "休養(温存)"], ["train", "調教・飼葉"], ["graze", "放牧(4週)"]].forEach(function (pair) {
      actRow.appendChild(SH.el("button", {
        class: "chip" + (plan.action === pair[0] ? " on" : ""), text: pair[1],
        onclick: function () { plan.action = pair[0]; if (pair[0] !== "train") { plan.training = null; plan.feed = null; } SH.renderStableTab(); },
      }));
    });
    box.appendChild(actRow);
    if (plan.action === "train") {
      // 調教メニュー
      const tRow = SH.el("div", { class: "row wrap" }, [SH.el("span", { class: "k", text: "調教: " })]);
      SH.TRAININGS.forEach(function (t) {
        tRow.appendChild(SH.el("button", {
          class: "chip" + (plan.training === t.id ? " on" : ""), text: t.name + "(" + t.cost + ")", title: t.desc,
          onclick: function () { plan.training = plan.training === t.id ? null : t.id; SH.renderStableTab(); },
        }));
      });
      box.appendChild(tRow);
      if (plan.training) {
        const t = SH.TRAININGS.find(function (x) { return x.id === plan.training; });
        box.appendChild(SH.el("div", { class: "hint", text: t.desc }));
      }
      // 飼葉
      const fRow = SH.el("div", { class: "row wrap" }, [SH.el("span", { class: "k", text: "飼葉: " })]);
      SH.FEEDS.forEach(function (f) {
        fRow.appendChild(SH.el("button", {
          class: "chip" + (plan.feed === f.id ? " on" : ""), text: f.name + "(" + f.cost + ")", title: f.desc,
          onclick: function () { plan.feed = plan.feed === f.id ? null : f.id; SH.renderStableTab(); },
        }));
      });
      box.appendChild(fRow);
      if (plan.feed) {
        const f = SH.FEEDS.find(function (x) { return x.id === plan.feed; });
        box.appendChild(SH.el("div", { class: "hint", text: f.desc }));
      }
    }
    // 出走登録
    const races = SH.racesOfWeek(s.week).filter(function (r) { return SH.eligible(h, r); });
    const eRow = SH.el("div", { class: "row wrap" }, [SH.el("span", { class: "k", text: "出走: " })]);
    if (h.entryRaceId) {
      const r = SH.findRace(h.entryRaceId);
      eRow.appendChild(SH.el("span", { class: "entry-mark", text: (r ? r.name : "登録済") + " に登録済み" }));
      eRow.appendChild(SH.el("button", {
        class: "btn tiny", text: "登録取消",
        onclick: function () { h.entryRaceId = null; SH.save(); SH.renderAll(); },
      }));
    } else if (!races.length) {
      eRow.appendChild(SH.el("span", { class: "hint", text: "今週に出走可能なレースがありません" }));
    } else {
      races.forEach(function (r) {
        const fee = SH.ENTRY_FEE[r.grade] || 0;
        eRow.appendChild(SH.el("button", {
          class: "chip", text: r.name + " " + r.surface + r.dist + "m(登録料" + fee + ")",
          onclick: function () {
            if (fee > 0 && !SH.pay(fee)) { SH.toast("メダルが足りません(登録料" + fee + "枚)"); return; }
            h.entryRaceId = r.id;
            // 中2週チェック
            const last = h.history[h.history.length - 1];
            if (last && last.year === s.year && s.week - last.week < SH.ROTATION_GAP) {
              SH.toast("⚠ 前走から中" + (s.week - last.week - 1) + "週の強行ローテです(疲労に注意)");
              h.fatigue = SH.clamp(h.fatigue + 10, 0, 100);
            } else {
              SH.toast(r.name + "に出走登録しました");
            }
            SH.save();
            SH.renderAll();
            SH.updateTopBar();
          },
        }));
      });
    }
    box.appendChild(eRow);
    if (h.entryRaceId) box.appendChild(SH.el("div", { class: "hint", text: "出走週は調教できません。レースタブで観戦するか「次の週へ」で自動出走します。" }));
    return box;
  }

  // ---------- 生産タブ ----------
  let selSire = null, selDam = null, foalName = "";
  SH.renderBreedTab = function () {
    const root = SH.$("#tab-breed");
    SH.clear(root);
    const s = SH.state;
    root.appendChild(SH.el("h2", { text: "生産(配合)" }));
    root.appendChild(SH.el("div", { class: "hint", text: "種牡馬×繁殖牝馬を選んで仔馬を生産(メダル" + SH.BREED_COST + "枚)。引退した自分の馬も親に使えます。GⅠ勝ち馬や漬け育成した馬を親にすると素質が上がりやすく、代を重ねるほど強くなります。" }));

    if (SH.activeHorses().length >= SH.MAX_OWNED) {
      root.appendChild(SH.el("div", { class: "warn", text: "厩舎が満員です(" + SH.MAX_OWNED + "頭)。引退させてから生産してください。" }));
      return;
    }

    root.appendChild(parentPicker("種牡馬(父)", "sire"));
    root.appendChild(parentPicker("繁殖牝馬(母)", "dam"));

    // 配合診断
    if (selSire && selDam) {
      const st = selSire.kind === "cpu" ? selSire.data.inherit : (selSire.data.inheritType || "平均");
      const dt = selDam.kind === "cpu" ? selDam.data.inherit : (selDam.data.inheritType || "平均");
      let label, desc;
      if (st === "H/H" || dt === "H/H") { label = "ブレ大(ハイリスク)"; desc = "大当たり／大外れの振れ幅が大きい配合。素質MAXを狙うなら有力。"; }
      else if (st === "堅実" && dt === "堅実") { label = "安定"; desc = "能力が安定しやすい堅実な配合。事故が少ない反面、上振れも控えめ。"; }
      else { label = "中庸"; desc = "バランス型の配合。平均的な振れ幅が見込める。"; }
      root.appendChild(SH.el("div", { class: "judge-box" }, [
        SH.el("div", { html: "<b>配合診断:</b> " + st + " × " + dt + " → <b>" + label + "</b>" }),
        SH.el("div", { class: "hint", text: desc }),
      ]));
    }
    // 馬名
    const nameRow = SH.el("div", { class: "row" }, [
      SH.el("span", { class: "k", text: "馬名: " }),
      SH.el("input", {
        type: "text", maxlength: "9", placeholder: "空欄なら自動命名(カタカナ2〜9文字)", value: foalName,
        oninput: function (e) { foalName = e.target.value; },
      }),
    ]);
    root.appendChild(nameRow);
    // 生産ボタン
    root.appendChild(SH.el("button", {
      class: "btn primary big",
      text: "🐴 生産する(メダル" + SH.BREED_COST + "枚)",
      disabled: (selSire && selDam && SH.canPay(SH.BREED_COST)) ? null : "1",
      onclick: function () {
        const foal = SH.doBreed(selSire, selDam, foalName.trim() || null);
        if (!foal) { SH.toast("生産できませんでした(メダル/枠を確認)"); return; }
        selSire = null; selDam = null; foalName = "";
        SH.updateTopBar();
        showFoal(root, foal);
      },
    }));
    if (!SH.canPay(SH.BREED_COST)) root.appendChild(SH.el("div", { class: "warn", text: "メダルが足りません(" + SH.BREED_COST + "枚必要)" }));
  };

  function parentPicker(label, kind) {
    const box = SH.el("div", { class: "parent-box" });
    const sel = kind === "sire" ? selSire : selDam;
    box.appendChild(SH.el("h3", { text: label + (sel ? ": " + sel.data.name : "") }));
    // 自家製
    const owned = SH.ownedParents(kind);
    if (owned.length) {
      const oRow = SH.el("div", { class: "row wrap" }, [SH.el("span", { class: "k", text: "自家製: " })]);
      owned.forEach(function (h) {
        const on = sel && sel.kind === "owned" && sel.data.id === h.id;
        oRow.appendChild(SH.el("button", {
          class: "chip owned-chip" + (on ? " on" : ""),
          text: "★" + h.name + "(" + (h.soshitsuKnown ? h.soshitsu : "素質?") + "/" + h.inheritType + (h.g1Wins ? "/GⅠ" + h.g1Wins + "勝" : "") + (h.madakome ? "/まだコメ" : "") + ")",
          onclick: function () { setParent(kind, { kind: "owned", data: h }); },
        }));
      });
      box.appendChild(oRow);
    }
    // CPU
    const cpus = kind === "sire" ? SH.CPU_SIRES : SH.CPU_DAMS;
    ["堅実", "平均", "H/H"].forEach(function (it) {
      const row = SH.el("div", { class: "row wrap" }, [SH.el("span", { class: "k", text: it + "型: " })]);
      cpus.filter(function (c) { return c.inherit === it; }).forEach(function (c) {
        const on = sel && sel.kind === "cpu" && sel.data.name === c.name;
        row.appendChild(SH.el("button", {
          class: "chip" + (on ? " on" : ""), text: c.name,
          onclick: function () { setParent(kind, { kind: "cpu", data: c }); },
        }));
      });
      box.appendChild(row);
    });
    return box;
  }
  function setParent(kind, ref) {
    if (kind === "sire") selSire = ref; else selDam = ref;
    SH.renderBreedTab();
  }

  function showFoal(root, foal) {
    SH.clear(root);
    root.appendChild(SH.el("h2", { text: "🎉 仔馬誕生！" }));
    const card = SH.el("div", { class: "horse-card birth" });
    card.appendChild(SH.el("div", { class: "hc-name big", text: foal.name }));
    card.appendChild(SH.el("div", { class: "hc-meta", text: foal.sex + " / " + foal.coat + " / " + foal.generation + "代目" }));
    card.appendChild(SH.el("div", { class: "hc-line hint", text: "父 " + foal.sireName + " × 母 " + foal.damName }));
    card.appendChild(SH.el("div", { class: "hc-comment big", text: "牧場長「" + foal.birthCommentText + "」" }));
    card.appendChild(SH.el("div", { class: "hc-grid" }, [
      ["脚質", foal.leg], ["成長", foal.growth], ["距離", foal.distance], ["気性", foal.temper],
    ].map(function (p) {
      return SH.el("div", { class: "hc-cell" }, [SH.el("span", { class: "k", text: p[0] }), SH.el("span", { class: "v", text: p[1] })]);
    })));
    card.appendChild(SH.el("div", { class: "hint", text: "素質は非公開。弥生賞→皐月賞のオッズで判定できます(結果画面で自動判定)。" }));
    root.appendChild(card);
    root.appendChild(SH.el("button", { class: "btn primary", text: "厩舎へ", onclick: function () { SH.switchTab("stable"); } }));
  }

  // ---------- 殿堂/記録タブ ----------
  SH.renderHallTab = function () {
    const root = SH.$("#tab-hall");
    SH.clear(root);
    const s = SH.state;
    root.appendChild(SH.el("h2", { text: "殿堂・記録" }));
    // 収支
    const st = s.stats;
    root.appendChild(SH.el("div", { class: "hc-grid stats" }, [
      ["観戦レース数", st.races], ["総ベット", SH.fmtMedal(st.betTotal) + "枚"], ["総払戻", SH.fmtMedal(st.payoutTotal) + "枚"],
      ["最高払戻", SH.fmtMedal(st.bestPayout) + "枚"], ["ライド最高", SH.fmtMedal(st.rideBest) + "枚"],
      ["回収率", st.betTotal ? Math.round(st.payoutTotal / st.betTotal * 100) + "%" : "-"],
    ].map(function (p) {
      return SH.el("div", { class: "hc-cell" }, [SH.el("span", { class: "k", text: String(p[0]) }), SH.el("span", { class: "v", text: String(p[1]) })]);
    })));
    // 殿堂馬・引退馬
    const done = s.horses.filter(function (h) { return h.status !== "育成中"; });
    if (done.length) {
      root.appendChild(SH.el("h3", { text: "引退馬・殿堂馬" }));
      done.forEach(function (h) {
        const starts = SH.careerStarts(h);
        root.appendChild(SH.el("div", { class: "hall-row" + (h.status === "殿堂" ? " hof" : "") }, [
          SH.el("span", { class: "hc-name", text: (h.status === "殿堂" ? "🏆 " : "") + h.name }),
          SH.el("span", { class: "hint", text: h.sex + " " + h.generation + "代目 / " + starts + "戦" + h.first + "勝 / GⅠ" + (h.g1Wins + h.wbcWins + h.jg1Wins) + "勝 / 賞金" + SH.fmtMedal(h.prizeMedals) + "枚" + (h.tripleCrown.length >= 3 ? " / 三冠馬！" : "") }),
        ]));
      });
    }
    // 出走履歴(直近)
    root.appendChild(SH.el("h3", { text: "出来事ログ" }));
    const logBox = SH.el("div", { class: "log-box" });
    s.log.slice(0, 50).forEach(function (l) { logBox.appendChild(SH.el("div", { class: "log-line", text: l })); });
    root.appendChild(logBox);
  };

  // ---------- 設定タブ ----------
  SH.renderSettingsTab = function () {
    const root = SH.$("#tab-settings");
    SH.clear(root);
    const s = SH.state;
    root.appendChild(SH.el("h2", { text: "設定" }));
    // ペイ設定
    const pRow = SH.el("div", { class: "row" }, [SH.el("span", { class: "k", text: "ペイ設定(還元率): " })]);
    Object.keys(SH.PAY_RATES).forEach(function (k) {
      pRow.appendChild(SH.el("button", {
        class: "chip" + (s.pay === k ? " on" : ""), text: k + "%",
        onclick: function () { s.pay = k; SH.save(); SH.invalidateWeekCache(); SH.renderSettingsTab(); SH.toast("ペイ設定を" + k + "%にしました(次のレースから)"); },
      }));
    });
    root.appendChild(pRow);
    root.appendChild(SH.el("div", { class: "hint", text: "オッズと素質判定の基準が変わります。実機の店舗設定に相当。" }));
    // メダルバンク
    root.appendChild(SH.el("h3", { text: "メダルバンク" }));
    root.appendChild(SH.el("div", { text: "預け入れ残高: " + SH.fmtMedal(s.bank) + "枚 / 手持ち: " + SH.fmtMedal(s.medals) + "枚" }));
    const bRow = SH.el("div", { class: "row" });
    bRow.appendChild(SH.el("button", {
      class: "btn", text: "100枚預ける", onclick: function () {
        if (!SH.pay(100)) { SH.toast("メダル不足"); return; }
        s.bank += 100; SH.save(); SH.renderSettingsTab(); SH.updateTopBar();
      },
    }));
    bRow.appendChild(SH.el("button", {
      class: "btn", text: "100枚引き出す", onclick: function () {
        if (s.bank < 100) { SH.toast("残高不足"); return; }
        s.bank -= 100; SH.earn(100); SH.save(); SH.renderSettingsTab(); SH.updateTopBar();
      },
    }));
    root.appendChild(bRow);
    // セーブ
    root.appendChild(SH.el("h3", { text: "セーブデータ" }));
    root.appendChild(SH.el("div", { class: "hint", text: "自動セーブ(この端末のブラウザに保存)。機種変更やバックアップには書き出しを使ってください。" }));
    const ta = SH.el("textarea", { class: "save-ta", placeholder: "ここに書き出し/貼り付け" });
    root.appendChild(ta);
    const sRow = SH.el("div", { class: "row" });
    sRow.appendChild(SH.el("button", { class: "btn", text: "書き出し", onclick: function () { ta.value = SH.exportSave(); ta.select(); SH.toast("セーブデータを書き出しました(コピーして保管)"); } }));
    sRow.appendChild(SH.el("button", {
      class: "btn", text: "読み込み", onclick: function () {
        try { SH.importSave(ta.value); SH.toast("読み込みました"); SH.invalidateWeekCache(); SH.renderAll(); SH.updateTopBar(); }
        catch (e) { SH.toast("読み込み失敗: " + e.message); }
      },
    }));
    sRow.appendChild(SH.el("button", {
      class: "btn danger", text: "最初からやり直す", onclick: function () {
        SH.confirmBox("セーブデータを削除して最初から始めますか？", function () {
          SH.resetSave(); location.reload();
        });
      },
    }));
    root.appendChild(sRow);
    // About
    root.appendChild(SH.el("h3", { text: "このゲームについて" }));
    root.appendChild(SH.el("div", {
      class: "hint",
      text: "本作は競走馬メダルゲームというジャンルの仕組み(ベット・オッズ・育成・配合・継承)を参考にした個人利用目的のオリジナル・ファンメイド作品です。特定の商用ゲームとの接続・関係は一切なく、商用ゲームの名称・映像・音楽・プログラムは使用していません。実在の競走馬名・レース名は事実情報として使用しています。再配布・商用利用はしないでください。",
    }));
  };
})(window.SH);
