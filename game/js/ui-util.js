// ============================================================
// ui-util.js — DOMユーティリティ
// ============================================================
"use strict";
(function (SH) {
  SH.$ = function (sel, root) { return (root || document).querySelector(sel); };
  SH.$$ = function (sel, root) { return Array.from((root || document).querySelectorAll(sel)); };

  // el("div", {class:"x", onclick:fn}, [children...]) 形式のDOM生成
  SH.el = function (tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        const v = attrs[k];
        if (v == null) return;
        if (k === "class") e.className = v;
        else if (k === "text") e.textContent = v;
        else if (k === "html") e.innerHTML = v;
        else if (k.indexOf("on") === 0 && typeof v === "function") e.addEventListener(k.slice(2), v);
        else if (k === "style" && typeof v === "object") Object.assign(e.style, v);
        else e.setAttribute(k, v);
      });
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c == null) return;
        e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
      });
    }
    return e;
  };

  SH.clear = function (node) { while (node.firstChild) node.removeChild(node.firstChild); };

  SH.fmtOdds = function (o) { return (Math.round(o * 10) / 10).toFixed(1); };
  SH.fmtMedal = function (n) { return n.toLocaleString("ja-JP"); };

  // 枠番バッジ
  SH.wakuBadge = function (waku, gate) {
    return SH.el("span", {
      class: "waku-badge",
      text: String(gate),
      style: { background: SH.WAKU_COLORS[waku - 1], color: SH.WAKU_TEXT[waku - 1] },
    });
  };

  // グレードバッジ
  SH.gradeBadge = function (grade) {
    const cls = grade === "G1" || grade === "WBC" || grade === "J-G1" ? "g1"
      : grade === "G2" || grade === "J-G2" ? "g2"
        : grade === "G3" || grade === "J-G3" ? "g3" : "flat";
    return SH.el("span", { class: "grade-badge " + cls, text: grade });
  };

  // トースト表示
  let toastTimer = null;
  SH.toast = function (msg) {
    let t = SH.$("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2600);
  };

  // 確認モーダル
  SH.confirmBox = function (msg, onOk) {
    if (window.confirm(msg)) onOk();
  };
})(window.SH);
