// ============================================================
// main.js — 起動・タブ切替・トップバー
// ============================================================
"use strict";
(function (SH) {
  const TABS = [
    { id: "race", label: "🏇 レース", render: function () { SH.renderRaceTab(); } },
    { id: "stable", label: "🏠 厩舎", render: function () { SH.renderStableTab(); } },
    { id: "breed", label: "🐴 生産", render: function () { SH.renderBreedTab(); } },
    { id: "hall", label: "🏆 記録", render: function () { SH.renderHallTab(); } },
    { id: "settings", label: "⚙ 設定", render: function () { SH.renderSettingsTab(); } },
  ];
  let currentTab = "race";

  SH.switchTab = function (id) {
    currentTab = id;
    TABS.forEach(function (t) {
      SH.$("#tab-" + t.id).style.display = t.id === id ? "" : "none";
      SH.$("#nav-" + t.id).classList.toggle("on", t.id === id);
    });
    const tab = TABS.find(function (t) { return t.id === id; });
    if (tab) tab.render();
    window.scrollTo(0, 0);
  };

  SH.renderAll = function () {
    SH.updateTopBar();
    const tab = TABS.find(function (t) { return t.id === currentTab; });
    if (tab) tab.render();
  };

  SH.updateTopBar = function () {
    const s = SH.state;
    if (!s) return;
    SH.$("#tb-medals").textContent = SH.fmtMedal(s.medals);
    SH.$("#tb-week").textContent = s.year + "年目 第" + s.week + "週";
    SH.$("#tb-ride").style.display = s.ride ? "" : "none";
    if (s.ride) SH.$("#tb-ride").textContent = "🎯" + SH.fmtMedal(s.ride.pot);
  };

  // タイトル/ニューゲーム画面
  function renderTitle() {
    const root = SH.$("#title-screen");
    root.style.display = "";
    SH.$("#app").style.display = "none";
    SH.clear(root);
    root.appendChild(SH.el("div", { class: "title-logo", html: "🐎<br>UMA STABLE<br><span class='title-sub'>プログレス</span>" }));
    root.appendChild(SH.el("div", { class: "hint center", text: "競走馬メダルゲーム — 馬券で増やし、名馬を育て、血を繋ぐ" }));
    const hasSave = !!SH.load();
    if (hasSave) {
      root.appendChild(SH.el("button", { class: "btn primary big", text: "つづきから", onclick: startGame }));
      root.appendChild(SH.el("button", {
        class: "btn ghost", text: "はじめから(セーブ削除)",
        onclick: function () {
          SH.confirmBox("セーブデータを削除して最初から始めますか？", function () { SH.resetSave(); renderTitle(); });
        },
      }));
    } else {
      const input = SH.el("input", { type: "text", maxlength: "10", placeholder: "オーナー名(省略可)" });
      root.appendChild(SH.el("div", { class: "row center" }, input));
      root.appendChild(SH.el("button", {
        class: "btn primary big", text: "ゲームスタート",
        onclick: function () { SH.newGame(input.value.trim() || "オーナー"); startGame(); },
      }));
    }
    root.appendChild(SH.el("div", {
      class: "hint center legal",
      text: "個人利用目的のオリジナル・ファンメイド作品です。特定の商用ゲームとの接続・関係はありません。",
    }));
  }

  function startGame() {
    if (!SH.state) SH.load();
    SH.$("#title-screen").style.display = "none";
    SH.$("#app").style.display = "";
    // 初回ガイド: 馬がいなければ生産タブへ誘導
    SH.updateTopBar();
    SH.switchTab("race");
    if (!SH.state.horses.length && SH.state.stats.races === 0) {
      SH.toast("ようこそ！まずはレースで馬券を買うか、生産タブで自分の馬を作りましょう");
    }
  }

  // ナビ生成
  function buildNav() {
    const nav = SH.$("#nav");
    TABS.forEach(function (t) {
      nav.appendChild(SH.el("button", {
        id: "nav-" + t.id, class: "nav-btn", text: t.label,
        onclick: function () { SH.switchTab(t.id); },
      }));
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    buildNav();
    renderTitle();
  });
})(window.SH);
