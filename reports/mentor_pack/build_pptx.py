# -*- coding: utf-8 -*-
"""メンター向け設計資料一式（優先度中）を PowerPoint 成果物として生成する。

正本: priority_medium_mentor_design_v1.zip（V1）
- 文言は V1 からそのまま転記し、要約・言い換え・追記を行わない
- アーキテクチャ画像は V1 の PNG をそのまま貼り付ける（再生成・簡略化しない）
- T04 は詳細設計対象外のまま（除外メモのみ）

体裁: 株式会社Low Code の資料作成ガイドライン＆汎用スライド・パーツ集に準拠
- マスター／レイアウト／テーマ色／フォントはテンプレートを継承
- アプリアイコンはテンプレート「アイコン類 2025/11/12更新」の公式アイコンを使用
"""
import copy
import io
import json
import os

from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

HERE = os.path.dirname(os.path.abspath(__file__))
SCRATCH = ("/tmp/claude-0/-home-user-awc-naka881-repo/"
           "e4943cfb-89be-5c9f-b59c-004830a57633/scratchpad")
TEMPLATE = os.path.join(SCRATCH, "tmpl", "base.pptx")
ICONDIR = os.path.join(SCRATCH, "assets", "icons")
DATA = os.path.join(HERE, "v1_data.json")
OUT = os.path.join(HERE, "out", "priority_medium_mentor_design_final.pptx")

R_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"

# ---- テーマ色 ----
DK1 = RGBColor(0x23, 0x23, 0x23)
DK2 = RGBColor(0x1B, 0x5C, 0x80)
AC1 = RGBColor(0xEC, 0x85, 0x6F)
AC2 = RGBColor(0x0F, 0xA4, 0xCC)
AC3 = RGBColor(0xA6, 0xE2, 0xF3)
AC4 = RGBColor(0xDB, 0xF1, 0xF7)
AC5 = RGBColor(0xE7, 0xE8, 0xF8)
AC6 = RGBColor(0xFA, 0xE5, 0xE3)
GRAY = RGBColor(0xD0, 0xD4, 0xD7)
MUTE = RGBColor(0x59, 0x59, 0x59)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)

# ---- 版面 ----
CX, CW = Inches(0.81), Inches(11.72)
PGX, PGY = Inches(12.67), Inches(7.00)

# ---- 文字サイズ（テンプレートの体系） ----
SZ_XL, SZ_HEAD, SZ_LEAD = 18.14, 16.33, 14.52
SZ_BODY, SZ_FINE, SZ_MICRO = 12.7, 10.89, 9.0
SZ_NANO = 7.6

prs = Presentation(TEMPLATE)
SRC = list(prs.slides)
N_SRC = len(SRC)
LY_COVER, LY_BODY, LY_BLANK = 0, 17, 15

with open(DATA, encoding="utf-8") as f:
    D = json.load(f)
TEAMS, COM = D["teams"], D["common"]


# ==================================================================
# ヘルパー
# ==================================================================
def copy_shape(shape, src_slide, dst_slide):
    el = copy.deepcopy(shape._element)
    for node in el.iter():
        for attr in list(node.attrib):
            if not attr.startswith(R_NS):
                continue
            rid = node.get(attr)
            if not rid or not str(rid).startswith("rId"):
                continue
            try:
                rel = src_slide.part.rels[rid]
            except KeyError:
                del node.attrib[attr]
                continue
            if rel.is_external:
                new = dst_slide.part.relate_to(rel.target_ref, rel.reltype,
                                               is_external=True)
            else:
                new = dst_slide.part.relate_to(rel.target_part, rel.reltype)
            node.set(attr, new)
    dst_slide.shapes._spTree.append(el)
    return dst_slide.shapes[-1]


def _walk(shapes):
    for sh in shapes:
        yield sh
        if sh.shape_type is not None and "GROUP" in str(sh.shape_type):
            for c in _walk(sh.shapes):
                yield c


def pick(slide_no, shape_id):
    for sh in _walk(SRC[slide_no - 1].shapes):
        if sh.shape_id == shape_id:
            return sh
    return None


def place(shape, src_slide, dst_slide, x, y, w, h):
    new = copy_shape(shape, src_slide, dst_slide)
    ratio = min(w / new.width, h / new.height)
    new.width, new.height = int(new.width * ratio), int(new.height * ratio)
    new.left, new.top = x, y
    return new


def delete_slides(p, indices):
    lst = p.slides._sldIdLst
    ids = list(lst)
    for i in sorted(indices, reverse=True):
        p.part.drop_rel(ids[i].get(R_NS + "id"))
        lst.remove(ids[i])


_ICON_CACHE = {}


def icon(slide, key, x, y, size):
    """テンプレートの公式アプリアイコンを配置（中心そろえ）"""
    fn = os.path.join(ICONDIR, key + ".png")
    if not os.path.exists(fn):
        return None
    if key not in _ICON_CACHE:
        with open(fn, "rb") as f:
            _ICON_CACHE[key] = f.read()
    return slide.shapes.add_picture(io.BytesIO(_ICON_CACHE[key]),
                                    x, y, height=size)


def add(layout_idx):
    return prs.slides.add_slide(prs.slide_layouts[layout_idx])


def ph(slide, idx):
    for p_ in slide.placeholders:
        if p_.placeholder_format.idx == idx:
            return p_
    return None


def drop_ph(slide, idx):
    p_ = ph(slide, idx)
    if p_ is not None:
        p_._element.getparent().remove(p_._element)


def set_ph(slide, idx, text, size=None, bold=None, color=None, ls=None):
    p_ = ph(slide, idx)
    if p_ is None:
        return None
    tf = p_.text_frame
    tf.word_wrap = True
    tf.margin_top = Pt(0)
    tf.margin_bottom = Pt(0)
    for i, line in enumerate(text.split("\n")):
        para = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        if ls is not None:
            para.line_spacing = ls
        r = para.add_run()
        r.text = line
        if size is not None:
            r.font.size = Pt(size)
        if bold is not None:
            r.font.bold = bold
        if color is not None:
            r.font.color.rgb = color
    return p_


def txt(slide, x, y, w, h, text, size=SZ_FINE, color=DK1, bold=False,
        align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, ls=1.15):
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = Pt(2)
    tf.margin_right = Pt(2)
    tf.margin_top = Pt(1)
    tf.margin_bottom = Pt(1)
    for i, line in enumerate(text.split("\n")):
        para = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        para.alignment = align
        para.line_spacing = ls
        r = para.add_run()
        r.text = line
        r.font.size = Pt(size)
        r.font.bold = bold
        r.font.color.rgb = color
    return tb


def box(slide, x, y, w, h, fill, shape=MSO_SHAPE.RECTANGLE, line=None):
    sp = slide.shapes.add_shape(shape, x, y, w, h)
    sp.fill.solid()
    sp.fill.fore_color.rgb = fill
    if line is None:
        sp.line.fill.background()
    else:
        sp.line.color.rgb = line
        sp.line.width = Pt(0.75)
    sp.shadow.inherit = False
    return sp


def chip(slide, x, y, w, h, text, fill, tcolor=None, size=SZ_MICRO, bold=True):
    sp = box(slide, x, y, w, h, fill, MSO_SHAPE.ROUNDED_RECTANGLE)
    tf = sp.text_frame
    tf.word_wrap = True
    tf.margin_left = Pt(3)
    tf.margin_right = Pt(3)
    tf.margin_top = Pt(0)
    tf.margin_bottom = Pt(0)
    para = tf.paragraphs[0]
    para.alignment = PP_ALIGN.CENTER
    r = para.add_run()
    r.text = text
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.color.rgb = tcolor if tcolor else ink(fill)
    return sp


def ink(fill):
    """白抜き文字は濃紺（DK2）地のみ。淡色地は本文色（DK1）"""
    return WHITE if fill == DK2 else DK1


def card(slide, x, y, w, h, title, tfill=DK2, bfill=AC4, hh=Inches(0.30)):
    box(slide, x, y, w, h, bfill)
    box(slide, x, y, w, hh, tfill)
    txt(slide, x + Inches(0.12), y, w - Inches(0.24), hh, title,
        size=SZ_MICRO, color=ink(tfill), bold=True, anchor=MSO_ANCHOR.MIDDLE)
    return y + hh + Inches(0.06)


def bullet_text(slide, x, y, w, h, items, size=SZ_MICRO, color=DK1,
                mark="・", ls=1.2):
    body = "\n".join(mark + it for it in items)
    return txt(slide, x, y, w, h, body, size=size, color=color, ls=ls)


def text_h(lines, width, size, ls=1.2):
    """指定幅で折り返したときに必要な高さ（EMU）を概算する"""
    import unicodedata
    avail = width / 914400 * 72
    total = 0
    for ln in lines:
        w, n = 0.0, 1
        for ch in ln:
            cw = size if unicodedata.east_asian_width(ch) in "WFA" else size * 0.55
            if w + cw > avail and w > 0:
                n += 1
                w = 0.0
            w += cw
        total += n * size * 1.2 * ls
    # txt() が上下に 1pt ずつ余白を取るぶんを加算する
    return int(total / 72 * 914400) + 25400


def page_no(slide, n):
    txt(slide, PGX, PGY, Inches(0.54), Inches(0.36), str(n), size=SZ_MICRO,
        color=MUTE, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)


PAGES = []


def content_slide(title, sub=None):
    s = add(LY_BODY)
    set_ph(s, 0, title)
    if sub:
        set_ph(s, 2, sub, size=SZ_BODY, color=MUTE)
    else:
        drop_ph(s, 2)
    PAGES.append(s)
    page_no(s, len(PAGES))
    return s


# ---- 使用アプリ → 公式アイコン ----
APP_ICON = [
    ("Copilot Studio", "CS", "Copilot Studio"),
    ("Power Automate", "PA", "Power Automate"),
    ("SharePoint", "SP", "SharePoint"),
    ("OneDrive", "OD", "OneDrive"),
    ("Teams", "Tm", "Teams"),
    ("Outlook", "OL", "Outlook"),
    ("Excel", "Xl", "Excel"),
    ("Word", "Wd", "Word"),
    ("PowerPoint", "PP", "PowerPoint"),
]


def app_icons(app_lines):
    """V1 の「使用アプリと役割」から (アイコンキー, 表示名, 補足) を作る"""
    out, seen = [], set()
    joined = " / ".join(app_lines)
    for line in app_lines:
        hits = [(n, k, la) for n, k, la in APP_ICON if n in line]
        # 1行に複数アプリが書かれている場合、補足は全アプリ名を除いた残り
        note = line
        for n, _, _ in hits:
            note = note.replace(n, "")
        note = note.strip(" 　/／・")
        for needle, key, label in hits:
            if key in seen:
                continue
            seen.add(key)
            out.append((key, label, note))
    if "アダプティブカード" in joined and "CS" in seen:
        for i, (k, la, no) in enumerate(out):
            if k == "CS":
                out[i] = (k, la, (no + " ＋アダプティブカード").strip())
    return out


# ==================================================================
# 1. 表紙
# ==================================================================
s = add(LY_COVER)
set_ph(s, 1, "Microsoft 365 Copilot Studio 活用ハッカソン", size=SZ_HEAD,
       color=DK2)
t = set_ph(s, 0, "メンター向け 設計資料一式\nMVP先行試作ガイド", size=34,
           bold=True, ls=1.2)
t.left, t.top, t.width, t.height = (Inches(1.26), Inches(2.45),
                                    Inches(10.30), Inches(1.6))
set_ph(s, 12, "全10チームのMVP設計・アーキテクチャ・構築手順・躓きポイント\n"
              "（T04は現行案の再設計中のため詳細設計対象外）",
       size=SZ_LEAD, ls=1.3)
set_ph(s, 2, "2026.07.29", size=SZ_LEAD)
drop_ph(s, 10)
txt(s, Inches(1.26), Inches(5.42), Inches(6.0), Inches(0.34), "株式会社Low Code",
    size=SZ_BODY, color=DK2, bold=True)
lg = pick(53, 4)
if lg is not None:
    place(lg, SRC[52], s, Inches(1.26), Inches(5.85), Inches(2.7), Inches(0.62))
PAGES.append(s)


# ==================================================================
# 2. 本資料の目的と使い方
# ==================================================================
s = content_slide("本資料の目的と使い方",
                  "メンターが各チームのMVPを手元で先行試作し、躓きポイントを事前に把握するための資料")
ctx = COM["context"]["sections"]
y = Inches(1.26)
cols = [("目的", "\n".join(ctx["目的"]), DK2, AC4),
        ("対象", "\n".join(ctx["対象"]), DK2, AC4),
        ("読者", "\n".join(ctx["読者"]), DK2, AC4)]
w3 = Inches(3.83)
for i, (ttl, body, tf_, bf) in enumerate(cols):
    x = CX + (w3 + Inches(0.115)) * i
    yy = card(s, x, y, w3, Inches(1.30), ttl, tf_, bf)
    txt(s, x + Inches(0.14), yy, w3 - Inches(0.28), Inches(0.86), body,
        size=SZ_MICRO, ls=1.25)

y2 = Inches(2.72)
yy = card(s, CX, y2, Inches(5.79), Inches(2.06), "本資料に含まれるもの（V1成果物）",
          DK2, AC5)
bullet_text(s, CX + Inches(0.14), yy, Inches(5.51), Inches(1.60),
            [ln.lstrip("- ").strip()
             for ln in COM["context"]["sections"]["成果物"]],
            size=SZ_MICRO, ls=1.34)

x2 = CX + Inches(5.93)
yy = card(s, x2, y2, Inches(5.79), Inches(2.06), "本資料の使い方（メンター）", DK2, AC4)
bullet_text(s, x2 + Inches(0.14), yy, Inches(5.51), Inches(1.60), [
    "共通ページ（P.4〜P.10）で制約と共通手順を確認する",
    "担当チームの「設計サマリ」で目的・MVP範囲・使用アプリを把握する",
    "「アーキテクチャ全体像」で入力→AI処理→保管→出力→人確認の流れを追う",
    "共通構築手順とダミーデータ仕様に沿って、手元でMVPを一本通す",
    "躓きポイントと助言をもとに、チームへの助言内容を準備する",
], size=SZ_MICRO, ls=1.34)

y3 = Inches(4.94)
box(s, CX, y3, CW, Inches(1.42), AC6)
box(s, CX, y3, Inches(0.07), Inches(1.42), AC1)
txt(s, CX + Inches(0.24), y3 + Inches(0.10), CW - Inches(0.48), Inches(0.28),
    "本資料の取り扱い（重要）", size=SZ_FINE, color=DK1, bold=True)
bullet_text(s, CX + Inches(0.24), y3 + Inches(0.42), CW - Inches(0.48),
            Inches(0.86), [
    "本資料はV1（priority_medium_mentor_design_v1）を正本とし、設計内容・画像・情報量を変更していない。",
    "アーキテクチャ画像はV1のPNGをそのまま掲載している（再生成・簡略化・アイコン加工は行っていない）。",
    "T04は現行案の中核が外部Web参照に依存するため、今回の詳細構築設計の対象外とする（P.31 除外メモ）。",
            ], size=SZ_FINE, ls=1.42)

box(s, CX, Inches(6.52), CW, Inches(0.38), AC5)
txt(s, CX + Inches(0.24), Inches(6.52), CW - Inches(0.48), Inches(0.38),
    "正本： priority_medium_mentor_design_v1.zip　／　"
    "使用しないもの： v2 ・ v3（アイコンガイドライン適用版）・ v4（アイコン差し替え版）"
    "　※ 画像品質と情報量がV1から劣化したため",
    size=SZ_MICRO, color=DK2, anchor=MSO_ANCHOR.MIDDLE)


# ==================================================================
# 3. 目次
# ==================================================================
s = content_slide("本資料の構成", "共通事項 → チーム別設計 → 補足の順に構成")
TOC = [
    ("01", "共通事項", "P.4〜P.10",
     "全体俯瞰マップ／共通制約／共通アーキテクチャ原則／利用アプリ方針／"
     "横断的な要注意ポイント／共通構築手順／ダミーデータ方針・テストケース"),
    ("02", "チーム別設計（10チーム × 2ページ）", "P.11〜P.30",
     "各チーム 1ページ目＝設計サマリ（企画概要・MVP範囲・使用アプリ・分担・"
     "構成・躓きポイント・助言）、2ページ目＝アーキテクチャ全体像とメンター試作手順"),
    ("03", "補足", "P.31〜P.32",
     "T04 除外メモ（詳細設計対象外の理由と今後の代替案）／"
     "メンター試作チェックリストと追加確認が望ましい点"),
]
y = Inches(1.40)
for num, ttl, pg, body in TOC:
    box(s, CX, y, CW, Inches(1.52), AC4)
    box(s, CX, y, Inches(1.20), Inches(1.52), DK2)
    txt(s, CX, y + Inches(0.30), Inches(1.20), Inches(0.60), num, size=30,
        color=WHITE, bold=True, align=PP_ALIGN.CENTER)
    txt(s, CX + Inches(1.44), y + Inches(0.20), Inches(7.4), Inches(0.42), ttl,
        size=SZ_HEAD, color=DK2, bold=True)
    chip(s, CX + Inches(9.30), y + Inches(0.22), Inches(1.30), Inches(0.32),
         pg, AC3, size=SZ_MICRO)
    txt(s, CX + Inches(1.44), y + Inches(0.72), Inches(9.16), Inches(0.66),
        body, size=SZ_FINE, ls=1.3)
    y += Inches(1.72)


# ==================================================================
# 4. メンター向け全体俯瞰マップ
# ==================================================================
s = content_slide("メンター向け 全体俯瞰マップ",
                  "対象10チームの類型と、共通する入力→AI処理→保管→出力→人確認の流れ")
s.shapes.add_picture(COM["img_map"], CX + Inches(0.02), Inches(1.26),
                     height=Inches(4.20))
KIND_X = CX + Inches(6.50)
box(s, KIND_X, Inches(1.26), Inches(5.98), Inches(4.20), AC4)
box(s, KIND_X, Inches(1.26), Inches(5.98), Inches(0.30), DK2)
txt(s, KIND_X + Inches(0.12), Inches(1.26), Inches(5.74), Inches(0.30),
    "対象チームと類型（T04は詳細設計対象外）", size=SZ_MICRO, color=WHITE,
    bold=True, anchor=MSO_ANCHOR.MIDDLE)
yy = Inches(1.64)
for i, tm in enumerate(TEAMS):
    ry = yy + Inches(0.375) * i
    chip(s, KIND_X + Inches(0.14), ry + Inches(0.02), Inches(0.62),
         Inches(0.26), tm["id"], DK2, size=SZ_NANO)
    txt(s, KIND_X + Inches(0.84), ry, Inches(2.30), Inches(0.30), tm["name"],
        size=SZ_MICRO, bold=True, color=DK1, anchor=MSO_ANCHOR.MIDDLE)
    txt(s, KIND_X + Inches(3.20), ry, Inches(2.70), Inches(0.30), tm["kind"],
        size=SZ_NANO, color=MUTE, anchor=MSO_ANCHOR.MIDDLE)

y3 = Inches(5.60)
box(s, CX, y3, CW, Inches(1.30), AC5)
txt(s, CX + Inches(0.24), y3 + Inches(0.10), CW - Inches(0.48), Inches(0.28),
    "共通の流れ（全チーム共通のMVP骨格）", size=SZ_FINE, color=DK2, bold=True)
FLOW = ["利用者 / メンター", "Copilot Studio", "SharePoint / OneDrive",
        "出力（確認可能な形式1つ）", "人の確認・修正"]
fx, fw, fh = CX + Inches(0.24), Inches(2.06), Inches(0.52)
for i, lab in enumerate(FLOW):
    x = fx + (fw + Inches(0.30)) * i
    fill = DK2 if i in (1,) else AC4
    chip(s, x, y3 + Inches(0.50), fw, fh, lab, fill, size=SZ_MICRO)
    if i < len(FLOW) - 1:
        ar = box(s, x + fw + Inches(0.05), y3 + Inches(0.65), Inches(0.20),
                 Inches(0.22), AC2, MSO_SHAPE.RIGHT_ARROW)
        ar.line.fill.background()
txt(s, CX + Inches(0.24), y3 + Inches(1.06), CW - Inches(0.48), Inches(0.22),
    "※ Power Automate（標準範囲）は必要時のみ SharePoint への保存・通知・一覧更新に使う。",
    size=SZ_NANO, color=MUTE)


# ==================================================================
# 5. 共通制約
# ==================================================================
s = content_slide("共通制約",
                  "全チーム共通。試作前にこの範囲から外れていないかを必ず確認する")
CONS = COM["constraints"]["bullets"]
y = Inches(1.26)
for i, c in enumerate(CONS):
    pa = "Power Automate" in c or "エージェントフロー" in c
    bf = AC6 if pa else (AC4 if i % 2 == 0 else AC5)
    h = Inches(0.60) if pa else Inches(0.44)
    box(s, CX, y, CW, h, bf)
    chip(s, CX + Inches(0.10), y + Inches(0.08), Inches(0.34), Inches(0.28),
         str(i + 1), DK2, size=SZ_NANO)
    txt(s, CX + Inches(0.56), y, CW - Inches(0.70), h, c,
        size=SZ_FINE, color=DK1, bold=pa, anchor=MSO_ANCHOR.MIDDLE, ls=1.2)
    if pa:
        box(s, CX, y, Inches(0.06), h, AC1)
    y += h + Inches(0.045)



# ==================================================================
# 6. 共通アーキテクチャ原則
# ==================================================================
s = content_slide("共通アーキテクチャ原則",
                  "6原則。MVPは完成版ではなく「一本通して動く」ことを優先する")
s.shapes.add_picture(COM["img_principles"], CX, Inches(1.32),
                     height=Inches(4.10))
px = CX + Inches(6.35)
PRIN = [ln.split(". ", 1)[1] if ". " in ln else ln
        for ln in COM["principles"]["raw"].splitlines()
        if ln[:1].isdigit()]
box(s, px, Inches(1.32), Inches(6.16), Inches(4.10), AC4)
box(s, px, Inches(1.32), Inches(6.16), Inches(0.34), DK2)
txt(s, px + Inches(0.14), Inches(1.32), Inches(5.90), Inches(0.34),
    "共通アーキテクチャ原則（V1原文）", size=SZ_MICRO, color=WHITE, bold=True,
    anchor=MSO_ANCHOR.MIDDLE)
for i, p_ in enumerate(PRIN):
    ry = Inches(1.78) + Inches(0.60) * i
    chip(s, px + Inches(0.18), ry + Inches(0.09), Inches(0.34), Inches(0.30),
         str(i + 1), AC2, tcolor=DK1, size=SZ_MICRO)
    txt(s, px + Inches(0.64), ry, Inches(5.36), Inches(0.48), p_,
        size=SZ_FINE, anchor=MSO_ANCHOR.MIDDLE, ls=1.2)
txt(s, CX, Inches(5.46), Inches(6.20), Inches(0.22),
    "※ 画像はV1をそのまま掲載（再生成・簡略化なし）", size=SZ_NANO, color=MUTE)

y3 = Inches(5.72)
box(s, CX, y3, CW, Inches(1.18), AC5)
txt(s, CX + Inches(0.24), y3 + Inches(0.08), CW - Inches(0.48), Inches(0.26),
    "メンターレビュー確認リスト（試作後にこの観点で確認する）",
    size=SZ_FINE, color=DK2, bold=True)
CHK = COM["checklist"]["bullets"]
half = (len(CHK) + 1) // 2
bullet_text(s, CX + Inches(0.24), y3 + Inches(0.38), Inches(5.62),
            Inches(0.74), CHK[:half], size=SZ_MICRO, mark="□ ", ls=1.18)
bullet_text(s, CX + Inches(6.06), y3 + Inches(0.38), Inches(5.62),
            Inches(0.74), CHK[half:], size=SZ_MICRO, mark="□ ", ls=1.18)


# ==================================================================
# 7. 利用アプリ方針
# ==================================================================
s = content_slide("利用アプリ方針",
                  "MVPは M365 標準の範囲で構成する。禁止側は代替手段までセットで押さえる")
OK_APPS = [("CS", "Copilot Studio", "判断・案内・生成・確認支援の中核（MVPに必ず含める）"),
           ("PA", "Power Automate", "標準範囲。保存・通知・一覧更新を必要最小限で使う"),
           ("SP", "SharePoint", "ナレッジ・ファイル・リストの標準保管先"),
           ("OD", "OneDrive", "OneDrive for Business。入力資料の集約先"),
           ("Tm", "Teams", "通知・共有・文字起こしの取得元"),
           ("OL", "Outlook", "メール文案の送信（人の確認後）"),
           ("Xl", "Excel", "整形・集計。Power Query／ピボットで代替"),
           ("Wd", "Word", "議事録・ドラフトの出力先"),
           ("PP", "PowerPoint", "資料ドラフトの要点・構成案の出力先")]
yy = card(s, CX, Inches(1.28), Inches(7.34), Inches(4.16), "利用可", DK2, AC4,
          hh=Inches(0.34))
for i, (k, name, role) in enumerate(OK_APPS):
    ry = yy + Inches(0.40) * i
    icon(s, k, CX + Inches(0.20), ry + Inches(0.04), Inches(0.26))
    txt(s, CX + Inches(0.58), ry, Inches(1.70), Inches(0.32), name,
        size=SZ_FINE, bold=True, anchor=MSO_ANCHOR.MIDDLE)
    txt(s, CX + Inches(2.34), ry, Inches(4.86), Inches(0.32), role,
        size=SZ_FINE, color=DK1, anchor=MSO_ANCHOR.MIDDLE)

NG_APPS = [("Forms", "Copilot Studioの会話入力／アダプティブカードで代替"),
           ("Power BI", "Excel Power Query・ピボット・SharePointリストビューで代替"),
           ("Dataverse", "SharePointリスト／Excelで代替"),
           ("Premium Connector", "標準コネクタの範囲で構成する"),
           ("外部API", "使用しない"),
           ("外部Web検索", "人手取得＋SharePoint格納で回避する")]
nx = CX + Inches(7.50)
yy = card(s, nx, Inches(1.28), Inches(4.22), Inches(4.16),
          "原則使わない（代替手段）", DK2, AC6, hh=Inches(0.34))
for i, (name, alt) in enumerate(NG_APPS):
    ry = yy + Inches(0.62) * i
    txt(s, nx + Inches(0.18), ry, Inches(3.86), Inches(0.26), "× " + name,
        size=SZ_FINE, bold=True, color=DK1)
    txt(s, nx + Inches(0.42), ry + Inches(0.25), Inches(3.62), Inches(0.36),
        alt, size=SZ_MICRO, color=MUTE, ls=1.15)

y3 = Inches(5.66)
box(s, CX, y3, CW, Inches(1.24), AC5)
box(s, CX, y3, Inches(0.07), Inches(1.24), AC1)
txt(s, CX + Inches(0.24), y3 + Inches(0.08), CW - Inches(0.48), Inches(0.26),
    "Power Automate の扱い（全チーム共通）", size=SZ_FINE, color=DK2, bold=True)
bullet_text(s, CX + Inches(0.24), y3 + Inches(0.38), CW - Inches(0.48),
            Inches(0.78), [
    "Power Automate 側でエージェントフローを呼び出す場合は "
    "When an agent calls the flow を使用する。",
    "通常トリガーからエージェントフローを直接呼び出したい場合は、SPOリスト作成、"
    "フォルダへのダミーファイル作成、人の確認操作などの間接起動で回避できるか検討する。"
    "ただし従量課金を回避できることが確認できる場合に限る。",
            ], size=SZ_FINE, ls=1.28)


# ==================================================================
# 8. 横断的な要注意ポイント
# ==================================================================
s = content_slide("横断的な要注意ポイント",
                  "チームをまたいで発生しやすい論点。担当チームに当てはまるものを事前に確認する")
ATT = []
for k, v in COM["attention"]["sections"].items():
    num, ttl = k.split(". ", 1) if ". " in k else ("", k)
    ATT.append((num, ttl, " ".join(v)))
TARGET = {"1": "全チーム", "2": "T08 / T09", "3": "全チーム",
          "4": "全チーム（特にT03）", "5": "T09", "6": "T03 / T06 / T08 / T09"}
cw3, gap = Inches(3.83), Inches(0.115)
for i, (num, ttl, body) in enumerate(ATT):
    col, row = i % 3, i // 3
    x = CX + (cw3 + gap) * col
    y = Inches(1.32) + Inches(2.72) * row
    hot = num in ("2", "3", "5")
    box(s, x, y, cw3, Inches(2.50), AC6 if hot else AC4)
    box(s, x, y, cw3, Inches(0.42), DK2)
    chip(s, x + Inches(0.12), y + Inches(0.07), Inches(0.30), Inches(0.28),
         num, AC3, tcolor=DK1, size=SZ_NANO)
    txt(s, x + Inches(0.50), y, cw3 - Inches(0.62), Inches(0.42), ttl,
        size=SZ_FINE, color=WHITE, bold=True, anchor=MSO_ANCHOR.MIDDLE)
    txt(s, x + Inches(0.16), y + Inches(0.56), cw3 - Inches(0.32), Inches(1.32),
        body, size=SZ_FINE, ls=1.32)
    box(s, x + Inches(0.16), y + Inches(2.00), cw3 - Inches(0.32), Inches(0.34),
        WHITE)
    txt(s, x + Inches(0.28), y + Inches(2.00), cw3 - Inches(0.56), Inches(0.34),
        "主な対象： " + TARGET.get(num, "全チーム"),
        size=SZ_NANO, color=DK2, bold=True, anchor=MSO_ANCHOR.MIDDLE)


# ==================================================================
# 9. メンター試作 共通構築手順
# ==================================================================
s = content_slide("メンター試作 共通構築手順",
                  "全チーム共通の5ステップ。チーム別の入出力・ダミーデータは各チームのページを参照")
STEPS = TEAMS[0]["steps"]
sy, sh_ = Inches(1.30), Inches(0.86)
for i, st in enumerate(STEPS):
    y = sy + (sh_ + Inches(0.09)) * i
    ttl = st["title"].split(": ", 1)[1] if ": " in st["title"] else st["title"]
    box(s, CX, y, CW, sh_, AC4 if i % 2 == 0 else AC5)
    box(s, CX, y, Inches(2.60), sh_, DK2)
    txt(s, CX + Inches(0.16), y + Inches(0.08), Inches(2.28), Inches(0.24),
        "STEP %d" % (i + 1), size=SZ_NANO, color=WHITE, bold=True)
    txt(s, CX + Inches(0.16), y + Inches(0.32), Inches(2.28), Inches(0.44),
        ttl, size=SZ_FINE, color=WHITE, bold=True, ls=1.1)
    bullet_text(s, CX + Inches(2.78), y, CW - Inches(2.94), sh_,
                [i.replace("`", "") for i in st["items"]],
                size=SZ_FINE, ls=1.34)

y3 = Inches(6.06)
box(s, CX, y3, CW, Inches(0.86), AC6)
box(s, CX, y3, Inches(0.07), Inches(0.86), AC1)
txt(s, CX + Inches(0.24), y3 + Inches(0.06), CW - Inches(0.48), Inches(0.26),
    "先回り検証ポイント（全チーム共通・試作中に必ず確認する）",
    size=SZ_FINE, color=DK2, bold=True)
PRE = TEAMS[0]["precheck"]
pw = (CW - Inches(0.48)) // len(PRE)
for i, p_ in enumerate(PRE):
    txt(s, CX + Inches(0.24) + pw * i, y3 + Inches(0.34), pw - Inches(0.12),
        Inches(0.44), "□ " + p_, size=SZ_MICRO, ls=1.2)


# ==================================================================
# 10. ダミーデータ方針・MVP範囲・最低限テストケース
# ==================================================================
s = content_slide("ダミーデータ方針・MVP範囲・最低限テストケース",
                  "いずれも全チーム共通。チーム固有の入出力とサンプルは各チームのページを参照")
yy = card(s, CX, Inches(1.28), Inches(5.79), Inches(2.30), "ダミーデータ方針",
          DK2, AC5, hh=Inches(0.32))
bullet_text(s, CX + Inches(0.18), yy, Inches(5.43), Inches(1.00),
            COM["sample_policy"]["bullets"], size=SZ_MICRO, ls=1.30)
txt(s, CX + Inches(0.18), Inches(2.68), Inches(5.43), Inches(0.86),
    "推奨列（全チーム共通）： " + "／".join(TEAMS[0]["dummy_cols"]) + "\n"
    "件数の目安： " + "／".join(TEAMS[0]["dummy_policy"][1:]),
    size=SZ_MICRO, color=DK2, ls=1.30)

dx = CX + Inches(5.93)
box(s, dx, Inches(1.28), Inches(5.79), Inches(2.30), AC4)
box(s, dx, Inches(1.28), Inches(5.79), Inches(0.32), DK2)
txt(s, dx + Inches(0.14), Inches(1.28), Inches(5.51), Inches(0.32),
    "MVP範囲（全チーム共通）", size=SZ_MICRO, color=WHITE, bold=True,
    anchor=MSO_ANCHOR.MIDDLE)
txt(s, dx + Inches(0.18), Inches(1.68), Inches(2.60), Inches(0.22),
    "MVPスコープ", size=SZ_MICRO, color=DK2, bold=True)
bullet_text(s, dx + Inches(0.18), Inches(1.92), Inches(2.60), Inches(1.44),
            TEAMS[0]["mvp_scope"], size=SZ_MICRO, ls=1.34)
txt(s, dx + Inches(2.94), Inches(1.68), Inches(2.66), Inches(0.22),
    "非MVP範囲", size=SZ_MICRO, color=DK2, bold=True)
bullet_text(s, dx + Inches(2.94), Inches(1.92), Inches(2.66), Inches(1.44),
            TEAMS[0]["mvp_out"], size=SZ_MICRO, mark="× ", ls=1.34)

y3 = Inches(3.72)
yy = card(s, CX, y3, CW, Inches(2.94), "最低限テストケース（V1原文）", DK2, AC4,
          hh=Inches(0.34))
TC = TEAMS[0]["testcases"]
tw = [Inches(0.60), Inches(1.30), Inches(2.80), Inches(3.70), Inches(2.98)]
tbl = s.shapes.add_table(len(TC), 5, CX + Inches(0.17), yy,
                         sum(tw, Inches(0)), Inches(2.52)).table
tbl.first_row = False
tbl.horz_banding = False
for i, w in enumerate(tw):
    tbl.columns[i].width = w
for r, row in enumerate(TC):
    tbl.rows[r].height = Inches(0.42)
    for c, v in enumerate(row):
        cl = tbl.cell(r, c)
        cl.margin_left = Pt(5)
        cl.margin_right = Pt(5)
        cl.margin_top = Pt(2)
        cl.margin_bottom = Pt(2)
        cl.vertical_anchor = MSO_ANCHOR.MIDDLE
        cl.fill.solid()
        cl.fill.fore_color.rgb = DK2 if r == 0 else (WHITE if r % 2 else AC4)
        p_ = cl.text_frame.paragraphs[0]
        p_.line_spacing = 1.0
        p_.alignment = PP_ALIGN.CENTER if c < 2 else PP_ALIGN.LEFT
        run = p_.add_run()
        run.text = v
        run.font.size = Pt(SZ_FINE)
        run.font.bold = (r == 0)
        run.font.color.rgb = WHITE if r == 0 else DK1


# ==================================================================
# 11〜30. チーム別設計（1チーム2ページ）
# ==================================================================
ROLE_LABEL = [("人", "人"), ("Copilot Studio", "Copilot Studio"),
              ("Power Automate", "Power Automate"),
              ("SharePoint/OneDrive/Excel", "SharePoint / OneDrive / Excel")]


def team_summary(tm):
    """1ページ目：設計サマリ"""
    s = content_slide("%s %s ｜ 設計サマリ" % (tm["id"], tm["name"]),
                      "企画概要・MVP範囲・使用アプリ・人/AI/自動化の分担・構成・躓きポイント")

    # 類型と目的
    y = Inches(1.26)
    box(s, CX, y, CW, Inches(0.44), AC5)
    chip(s, CX + Inches(0.10), y + Inches(0.07), Inches(2.62), Inches(0.30),
         "類型： " + tm["kind"], DK2, size=SZ_MICRO)
    txt(s, CX + Inches(2.86), y, CW - Inches(3.02), Inches(0.44),
        "目的： " + tm["purpose"], size=SZ_FINE, anchor=MSO_ANCHOR.MIDDLE)

    # MVPゴール / 入力 / 出力
    y = Inches(1.78)
    for x, w, ttl, body in [
            (CX, Inches(4.30), "MVPゴール（MVPの考え方）", tm["mvp_goal"]),
            (CX + Inches(4.41), Inches(3.60), "入力", tm["inputs"]),
            (CX + Inches(8.12), Inches(3.60), "出力", tm["outputs"])]:
        yy = card(s, x, y, w, Inches(1.20), ttl, DK2, AC4)
        txt(s, x + Inches(0.14), yy, w - Inches(0.28), Inches(0.82), body,
            size=SZ_MICRO, ls=1.32)

    # 使用アプリ
    y = Inches(3.06)
    yy = card(s, CX, y, CW, Inches(1.06), "使用アプリと役割（V1原文）", DK2, AC5)
    apps = app_icons(tm["apps"])
    aw = CW // max(len(apps), 1)
    for i, (k, label, note) in enumerate(apps):
        ax = CX + aw * i
        pic = icon(s, k, ax, yy + Inches(0.02), Inches(0.26))
        if pic is not None:
            pic.left = int(ax + aw / 2 - pic.width / 2)
        txt(s, ax, yy + Inches(0.30), aw, Inches(0.20), label, size=SZ_MICRO,
            bold=True, align=PP_ALIGN.CENTER)
        if note:
            txt(s, ax, yy + Inches(0.50), aw, Inches(0.20), note,
                size=SZ_NANO, color=MUTE, align=PP_ALIGN.CENTER)

    # 構成（V1 Mermaid の要約）
    y = Inches(4.20)
    yy = card(s, CX, y, CW, Inches(1.00), "構成（V1 Mermaidアーキテクチャの要約）",
              DK2, AC4)
    flow = [("利用者 / メンター", Inches(1.75), AC5),
            ("Copilot Studio", Inches(1.90), DK2),
            ("SharePoint / OneDrive", Inches(2.10), AC3),
            ("出力： " + tm["mermaid_out"], Inches(3.00), AC5),
            ("人の確認・修正", Inches(1.60), AC6)]
    fx = CX + Inches(0.14)
    for i, (lab, fw, fill) in enumerate(flow):
        chip(s, fx, yy + Inches(0.04), fw, Inches(0.40), lab, fill,
             size=SZ_NANO)
        fx += fw
        if i < len(flow) - 1:
            ar = box(s, fx + Inches(0.04), yy + Inches(0.14), Inches(0.18),
                     Inches(0.20), AC2, MSO_SHAPE.RIGHT_ARROW)
            ar.line.fill.background()
            fx += Inches(0.26)
    txt(s, CX + Inches(0.14), yy + Inches(0.48), CW - Inches(0.28),
        Inches(0.20),
        "Power Automate（標準範囲）… 必要時のみ SharePoint への保存・通知・一覧更新に使う"
        "（点線＝必要時）。", size=SZ_NANO, color=MUTE)

    # 人 / AI / 自動化の分担
    y = Inches(5.28)
    yy = card(s, CX, y, CW, Inches(0.80), "人 / AI / 自動化の分担（V1原文）",
              DK2, AC5, hh=Inches(0.26))
    rw = CW // 4
    for i, raw in enumerate(tm["roles"][:4]):
        label, _, body = raw.partition(":")
        rx = CX + rw * i
        txt(s, rx + Inches(0.10), yy - Inches(0.02), rw - Inches(0.20),
            Inches(0.20), label.strip(), size=SZ_MICRO, color=DK2, bold=True)
        txt(s, rx + Inches(0.10), yy + Inches(0.18), rw - Inches(0.20),
            Inches(0.30), body.strip(), size=SZ_NANO, ls=1.2)

    # 躓きポイント / メンターからの助言
    y = Inches(6.16)
    for x, ttl, items, bf in [
            (CX, "想定される躓きポイント", tm["risks"], AC6),
            (CX + Inches(5.93), "メンターからの助言", tm["advice"], AC4)]:
        yy = card(s, x, y, Inches(5.79), Inches(0.80), ttl, DK2, bf,
                  hh=Inches(0.26))
        bullet_text(s, x + Inches(0.14), yy - Inches(0.02), Inches(5.51),
                    Inches(0.54), items, size=SZ_NANO, ls=1.26)
    return s


def team_detail(tm):
    """2ページ目：アーキテクチャ全体像とメンター試作手順

    構築手順の本文は全チームで同一のため、詳細はP.9（共通）に置き、
    ここでは手順の並びとチーム固有の情報（ダミーデータ・テスト）を示す。
    """
    s = content_slide("%s %s ｜ アーキテクチャ全体像とメンター試作手順" %
                      (tm["id"], tm["name"]),
                      "画像はV1のアーキテクチャバナーをそのまま掲載（再生成・簡略化なし）")
    s.shapes.add_picture(tm["banner"], CX, Inches(1.28), height=Inches(5.44))
    txt(s, CX, Inches(6.76), Inches(8.16), Inches(0.22),
        "※ 入力／AI処理／保管／通知／出力／人の確認 の流れを、Mermaid図と矛盾しない形で1枚に整理したもの。",
        size=SZ_NANO, color=MUTE)

    rx, rw = CX + Inches(8.31), Inches(3.41)
    inner = rw - Inches(0.28)
    SZ, LS = SZ_NANO, 1.24
    TOP, BOTTOM = Inches(1.28), Inches(6.94)

    def clean(t):
        return t.replace("`", "")

    step_lines = ["%s" % clean(st["title"]) for st in tm["steps"]]
    step_lines.append("各ステップの詳細な作業内容は P.9（全チーム共通）を参照")
    dummy = ["サンプル： " + " ／ ".join(clean(f) for f in tm["dummy_files"])]
    dummy += [clean(x) for x in tm["dummy_io"]]
    kinds = [r[1] for r in tm["testcases"][1:]]
    tests = ["種別： " + " ／ ".join(kinds) + " の5件",
             "入力と期待結果は P.10（全チーム共通）を参照",
             "AI出力は人が確認し、誤りや不足を記録する"]
    pre = [clean(x) for x in tm["precheck"]]

    BLOCKS = [("メンター試作 構築手順（V1原文）", step_lines, AC4),
              ("ダミーデータ仕様（このチーム固有）", dummy, AC5),
              ("最低限テストケース", tests, AC4),
              ("先回り検証ポイント", pre, AC6)]
    HB, PAD, GAP = Inches(0.30), Inches(0.06), Inches(0.09)
    heights = [HB + PAD + text_h(["・" + t for t in items], inner, SZ, LS)
               for _, items, _ in BLOCKS]
    slack = (BOTTOM - TOP) - sum(heights) - GAP * (len(BLOCKS) - 1)
    if slack > 0:                       # 余白は各ブロックへ均等に配分する
        add_ = slack // len(BLOCKS)
        heights = [h + add_ for h in heights]

    y = TOP
    for (title, items, fill), h in zip(BLOCKS, heights):
        box(s, rx, y, rw, h, fill)
        box(s, rx, y, rw, HB, DK2)
        txt(s, rx + Inches(0.10), y, rw - Inches(0.20), HB, title,
            size=SZ_MICRO, color=WHITE, bold=True, anchor=MSO_ANCHOR.MIDDLE)
        txt(s, rx + Inches(0.12), y + HB + PAD, inner, h - HB - PAD * 2,
            "\n".join("・" + t for t in items), size=SZ, ls=LS)
        y += h + GAP
    return s


def fitline(text, width_emu, size_pt):
    """テキストが width に収まらず折り返す行数（1行目を除く）を概算する"""
    import unicodedata
    w = sum(size_pt if unicodedata.east_asian_width(ch) in "WFA"
            else size_pt * 0.55 for ch in text)
    avail = width_emu / 914400 * 72
    return max(0, int((w - 1) // avail))


for tm in TEAMS:
    team_summary(tm)
    team_detail(tm)


# ==================================================================
# 31. T04 除外メモ
# ==================================================================
s = content_slide("T04 除外メモ（今回の詳細設計対象外）",
                  "現行案の中核が外部Web参照に依存するため、案自体の再設計が必要")
t04 = [ln.strip() for ln in COM["t04"].splitlines()
       if ln.strip() and not ln.startswith("#")]
y = Inches(1.40)
box(s, CX, y, CW, Inches(1.60), AC6)
box(s, CX, y, Inches(0.07), Inches(1.60), AC1)
chip(s, CX + Inches(0.24), y + Inches(0.18), Inches(2.60), Inches(0.34),
     "詳細設計対象外（V1どおり）", DK2, size=SZ_MICRO)
txt(s, CX + Inches(0.24), y + Inches(0.64), CW - Inches(0.48), Inches(0.80),
    t04[0], size=SZ_LEAD, ls=1.36)

y = Inches(3.22)
yy = card(s, CX, y, CW, Inches(1.70), "今後、詳細設計を作成する場合の代替案（V1原文）",
          DK2, AC4, hh=Inches(0.34))
txt(s, CX + Inches(0.24), yy + Inches(0.06), CW - Inches(0.48), Inches(0.90),
    t04[1] if len(t04) > 1 else "", size=SZ_LEAD, ls=1.36)

y = Inches(5.14)
yy = card(s, CX, y, CW, Inches(1.76), "本資料での取り扱い", DK2, AC5,
          hh=Inches(0.34))
bullet_text(s, CX + Inches(0.24), yy + Inches(0.06), CW - Inches(0.48),
            Inches(1.20), [
    "T04は、アーキテクチャ設計・MVP設計・構築手順・ダミーデータ仕様・"
    "テストケースのいずれも作成していない（V1の方針をそのまま維持）。",
    "全体俯瞰マップ・チーム別ページの対象は T01・T02・T03・T05〜T11 の10チーム。",
    "案の再設計後に、共通制約（P.5）と共通アーキテクチャ原則（P.6）に沿って"
    "あらためて設計する。",
            ], size=SZ_FINE, ls=1.40)


# ==================================================================
# 32. メンター試作チェックリスト
# ==================================================================
s = content_slide("メンター試作チェックリスト",
                  "試作前・試作中・試作後の確認観点と、事務局に確認が必要な残論点")
y = Inches(1.30)
yy = card(s, CX, y, Inches(5.79), Inches(2.60), "試作前に確認する（制約の適合）",
          DK2, AC4, hh=Inches(0.32))
bullet_text(s, CX + Inches(0.18), yy, Inches(5.43), Inches(2.10), [
    "Copilot StudioをMVPに含めているか",
    "Forms／Power BI／Dataverse／Premium Connector／外部Web・APIを使っていないか",
    "SharePoint／OneDrive格納になっているか（共有ファイルサーバ直接参照でないか）",
    "Power Automateからエージェントフローを呼ぶ場合、"
    "When an agent calls the flow になっているか",
    "ダミーデータに実名・実データ・個人情報が含まれていないか",
], size=SZ_FINE, mark="□ ", ls=1.36)

cx2 = CX + Inches(5.93)
yy = card(s, cx2, y, Inches(5.79), Inches(2.60), "試作後に確認する（MVPの成立）",
          DK2, AC5, hh=Inches(0.32))
bullet_text(s, cx2 + Inches(0.18), yy, Inches(5.43), Inches(2.10),
            COM["checklist"]["bullets"], size=SZ_FINE, mark="□ ", ls=1.40)

y2 = Inches(4.14)
yy = card(s, CX, y2, CW, Inches(2.76), "追加確認が望ましい点（V1 品質レビュー結果より）",
          DK2, AC6, hh=Inches(0.34))
ADD = COM["quality"]["追加確認が望ましい点"]
ADD = [a.lstrip("- ").strip() for a in ADD]
OWNER = {0: "各チーム", 1: "運営", 2: "事務局", 3: "事務局", 4: "運営 / 事務局"}
for i, a in enumerate(ADD):
    ry = yy + Inches(0.42) * i
    box(s, CX + Inches(0.18), ry, CW - Inches(0.36), Inches(0.36), WHITE)
    chip(s, CX + Inches(0.26), ry + Inches(0.04), Inches(1.50), Inches(0.28),
         OWNER.get(i, "運営"), AC3, tcolor=DK1, size=SZ_NANO)
    txt(s, CX + Inches(1.90), ry, CW - Inches(2.16), Inches(0.36), a,
        size=SZ_FINE, anchor=MSO_ANCHOR.MIDDLE)


# ==================================================================
# 保存
# ==================================================================
def prune_unused_masters(p):
    """本資料のスライドが参照していないスライドマスターを取り除く。
    テンプレートには使用しないマスター（別ブランド用）が含まれており、
    その背景画像だけで約20MBあるため、納品ファイルから外す。
    使用中のマスター・レイアウト・テーマ色・フォントはそのまま残す。"""
    used = {s.slide_layout.slide_master.part for s in p.slides}
    lst = p.part._element.find(
        "{http://schemas.openxmlformats.org/presentationml/2006/main}"
        "sldMasterIdLst")
    if lst is None:
        return 0
    removed = 0
    for el in list(lst):
        rid = el.get(R_NS + "id")
        if p.part.rels[rid].target_part in used:
            continue
        p.part.drop_rel(rid)
        lst.remove(el)
        removed += 1
    return removed


delete_slides(prs, range(N_SRC))
print("pruned masters:", prune_unused_masters(prs))
os.makedirs(os.path.dirname(OUT), exist_ok=True)
prs.save(OUT)
print("saved:", OUT)
print("slides:", len(prs.slides._sldIdLst))
