# -*- coding: utf-8 -*-
"""
スライド8「難易度とガイドライン適合性の分離評価」を事務局向けに再構成する。

構成（修正依頼 slide8_20260729 準拠）
  上段：評価軸（難易度／ガイドライン適合性を同じ粒度で短く）
  中段：全チーム評価一覧（難易度・適合性・状態・事務局視点）
  下段：重点フォロー対象の論点・回避策・事務局判断
  ＋ ポイント（難易度と制約抵触は別、という事務局向けメッセージ）

お客様の編集を保持するため、資料は再生成せず添付ファイルを直接更新する。
"""
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

SRC = ("/tmp/claude-0/-home-user-awc-naka881-repo/"
       "e4943cfb-89be-5c9f-b59c-004830a57633/scratchpad/u29b.pptx")
OUT = ("/home/user/awc-naka881-repo/reports/"
       "CopilotStudio_ハッカソン_事前相談会②_状況報告_20260729.pptx")

DK1 = RGBColor(0x23, 0x23, 0x23)
DK2 = RGBColor(0x1B, 0x5C, 0x80)
LT1 = RGBColor(0xF8, 0xFD, 0xFA)
AC1 = RGBColor(0xEC, 0x85, 0x6F)
AC2 = RGBColor(0x0F, 0xA4, 0xCC)
AC3 = RGBColor(0xA6, 0xE2, 0xF3)
AC4 = RGBColor(0xDB, 0xF1, 0xF7)
AC5 = RGBColor(0xE7, 0xE8, 0xF8)
AC6 = RGBColor(0xFA, 0xE5, 0xE3)
GRAY = RGBColor(0xD0, 0xD4, 0xD7)
MUTE = RGBColor(0x6E, 0x76, 0x7C)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)

SZ_BODY, SZ_FINE = 12.7, 10.89
CX, CW = Inches(0.81), Inches(11.72)

prs = Presentation(SRC)
s = prs.slides[7]                      # スライド8


def txt(sl, x, y, w, h, text, size=SZ_FINE, color=DK1, bold=False,
        align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, ls=1.0):
    tb = sl.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = Pt(2); tf.margin_right = Pt(2)
    tf.margin_top = Pt(1); tf.margin_bottom = Pt(1)
    for i, line in enumerate(text.split("\n")):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.line_spacing = ls
        r = p.add_run(); r.text = line
        r.font.size = Pt(size); r.font.bold = bold; r.font.color.rgb = color
    return tb


def box(sl, x, y, w, h, fill, shape=MSO_SHAPE.RECTANGLE):
    sp = sl.shapes.add_shape(shape, x, y, w, h)
    sp.fill.solid(); sp.fill.fore_color.rgb = fill
    sp.line.fill.background(); sp.shadow.inherit = False
    return sp


def cell(c, text, size=9.2, color=DK1, bold=False, fill=None,
         align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.MIDDLE):
    c.margin_left = Pt(4); c.margin_right = Pt(4)
    c.margin_top = Pt(1); c.margin_bottom = Pt(1)
    c.vertical_anchor = anchor
    c.fill.solid(); c.fill.fore_color.rgb = fill if fill else WHITE
    tf = c.text_frame; tf.word_wrap = True
    for i, line in enumerate(text.split("\n")):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align; p.line_spacing = 0.96
        r = p.add_run(); r.text = line
        r.font.size = Pt(size); r.font.bold = bold; r.font.color.rgb = color


def table(sl, x, y, w, rows, cols, widths, hdr_h, row_h):
    shp = sl.shapes.add_table(rows, cols, x, y, w, hdr_h + row_h * (rows - 1))
    t = shp.table
    t.first_row = False
    t.horz_banding = False
    for i, cw in enumerate(widths):
        t.columns[i].width = cw
    t.rows[0].height = hdr_h
    for i in range(1, rows):
        t.rows[i].height = row_h
    return t


def fit_fill(v):
    return AC4 if v.startswith("○") else (AC6 if v.startswith("×")
                                          else (AC6 if v == "△確認要" else AC5))


def diff_fill(v):
    return {"1": AC4, "2": AC4, "3": AC5, "4": AC6}.get(v, GRAY)


# ==================================================================
# 既存の中身を消す（タイトル・見出し・ページ番号は残す）
# ==================================================================
keep_page = None
for sh in list(s.shapes):
    if sh.is_placeholder and sh.placeholder_format.idx in (0, 2):
        continue
    if (sh.has_text_frame and sh.left is not None and sh.top is not None
            and sh.left > Inches(12.4) and sh.top > Inches(6.8)):
        keep_page = sh
        continue
    sh._element.getparent().remove(sh._element)

# 見出し（サブタイトル）を差し替え
for ph in s.placeholders:
    if ph.placeholder_format.idx == 2:
        tf = ph.text_frame
        p0 = tf.paragraphs[0]
        for para in list(tf.paragraphs[1:]):
            para._p.getparent().remove(para._p)
        for r in list(p0.runs[1:]):
            r._r.getparent().remove(r._r)
        if not p0.runs:
            p0.add_run()
        r = p0.runs[0]
        r.text = "難しさ・制約論点・回避可否を分けて、事務局の確認事項を明確化"
        r.font.size = Pt(SZ_BODY); r.font.color.rgb = MUTE

# ==================================================================
# 上段：評価軸
# ==================================================================
box(s, CX, Inches(1.26), CW, Inches(0.3), AC4)
txt(s, CX + Inches(0.14), Inches(1.26), Inches(1.2), Inches(0.3), "難易度",
    size=9.5, color=DK2, bold=True, anchor=MSO_ANCHOR.MIDDLE)
txt(s, CX + Inches(1.3), Inches(1.26), CW - Inches(1.45), Inches(0.3),
    "1〜2：標準機能中心　／　3：設計力が必要　／　4：技術検証・運用整理が必要　／　"
    "－：現行案では評価不可（再設計）",
    size=9.5, color=DK1, anchor=MSO_ANCHOR.MIDDLE)

box(s, CX, Inches(1.6), CW, Inches(0.3), AC5)
txt(s, CX + Inches(0.14), Inches(1.6), Inches(1.3), Inches(0.3),
    "ガイドライン\n適合性", size=7.6, color=DK2, bold=True,
    anchor=MSO_ANCHOR.MIDDLE, ls=1.0)
txt(s, CX + Inches(1.5), Inches(1.6), CW - Inches(1.65), Inches(0.3),
    "○：制約内で進行可　／　△回避可：手動運用やSharePoint格納等で回避可能　／　"
    "△確認要：事務局判断が必要　／　×：現行案の中核が制約に抵触",
    size=9.5, color=DK1, anchor=MSO_ANCHOR.MIDDLE)

# ==================================================================
# 中段：難易度 × ガイドライン適合性のマトリクス（分布）
# ==================================================================
txt(s, CX, Inches(1.98), CW, Inches(0.24),
    "難易度 × ガイドライン適合性の分布　－　難しさと制約論点は別の軸。事務局が見るべき位置を示す",
    size=SZ_BODY, color=DK2, bold=True)

MROWS = [("○", "伴走のみ", AC4),
         ("△回避可", "チーム側で進行", AC5),
         ("△確認要", "事務局判断が必要", AC6),
         ("×", "再設計", AC6)]
MCOLS = ["1〜2", "3", "4", "－"]
MATRIX = {("○", "3"): "チーム1・2・7・10・11",
          ("△回避可", "3"): "チーム5",
          ("△回避可", "4"): "チーム3・6・9",
          ("△確認要", "4"): "チーム8",
          ("×", "－"): "チーム4"}

MX, MY = CX + Inches(1.45), Inches(2.26)
MCW, MRH = Inches(2.56), Inches(0.38)
HDR_H = Inches(0.28)
txt(s, CX, MY - Inches(0.02), Inches(1.4), HDR_H, "適合性＼難易度",
    size=8.6, color=DK2, bold=True, align=PP_ALIGN.CENTER,
    anchor=MSO_ANCHOR.MIDDLE)
for j, c in enumerate(MCOLS):
    box(s, MX + MCW * j, MY, MCW - Inches(0.04), HDR_H, DK2)
    txt(s, MX + MCW * j, MY, MCW - Inches(0.04), HDR_H, c, size=9.5,
        color=WHITE, bold=True, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
for i, (fit, act, col) in enumerate(MROWS):
    y = MY + HDR_H + Inches(0.02) + (MRH + Inches(0.02)) * i
    box(s, CX, y, Inches(1.4), MRH, col)
    txt(s, CX, y, Inches(1.4), MRH, f"{fit}\n{act}", size=8.6, color=DK1,
        bold=True, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE, ls=1.05)
    for j, c in enumerate(MCOLS):
        teams = MATRIX.get((fit, c))
        box(s, MX + MCW * j, y, MCW - Inches(0.04), MRH,
            col if teams else LT1)
        if teams:
            txt(s, MX + MCW * j, y, MCW - Inches(0.04), MRH, teams,
                size=SZ_FINE, color=DK2, bold=True, align=PP_ALIGN.CENTER,
                anchor=MSO_ANCHOR.MIDDLE)
txt(s, CX, Inches(4.2), CW, Inches(0.22),
    "※ 5チームは制約論点なしで進行可。4チームは回避策があり、チーム側で進めながら整理できる。"
    "事務局判断が必要なのはチーム8、再設計はチーム4のみ（各チームの詳細はスライド5を参照）。",
    size=9.0, color=DK1)

# ==================================================================
# 下段：重点フォロー対象＋ポイント
# ==================================================================
txt(s, CX, Inches(4.5), Inches(4.6), Inches(0.44),
    "重点フォロー対象：論点と回避可否", size=SZ_BODY, color=DK2, bold=True,
    anchor=MSO_ANCHOR.MIDDLE)
box(s, CX + Inches(4.7), Inches(4.48), Inches(7.83), Inches(0.46), AC4)
txt(s, CX + Inches(4.86), Inches(4.48), Inches(7.55), Inches(0.46),
    "ポイント：「難易度が高い」ことと「制約に抵触する」ことは別。多くの△は手動運用や"
    "SharePoint格納で回避可能。事務局判断が必要なのは、主に個人情報・権限、"
    "メール送信条件、再設計案の確認。",
    size=9.0, color=DK1, bold=True, anchor=MSO_ANCHOR.MIDDLE, ls=1.14)

FOLLOW = [
    ("チーム3", "△回避可", "外部Web／営業データ",
     "外部Webは手動取得＋SharePoint格納。営業データは手動マスキングで回避",
     "データ利用範囲・マスキング要否"),
    ("チーム4", "×", "外部Web参照が企画の中核",
     "現行案では不可。社内資料・手動取得済み資料ベースへ再設計",
     "新案のレビュー"),
    ("チーム5", "△回避可", "リマインドの自動起動",
     "人起点またはエージェント経由に寄せる", "なし（軽微な確認）"),
    ("チーム6", "△回避可", "月次自動実行・資料保管",
     "人起点のMVP、SharePoint／OneDrive格納へ寄せる", "保管方針の確認"),
    ("チーム8", "△確認要", "個人情報・予定表・会議室・メール参照",
     "タスク整理中心にすれば一部は回避可能", "必須：個人情報・権限の判断"),
    ("チーム9", "△回避可", "共有ファイルサーバ・社外秘・メール送信",
     "SharePoint格納と人の確認で大部分を回避", "メール送信条件を確認"),
]
FW = [Inches(0.8), Inches(0.9), Inches(2.5), Inches(4.6), Inches(2.92)]
FY, FHH, FRH = Inches(5.0), Inches(0.28), Inches(0.28)
t = table(s, CX, FY, CW, 7, 5, FW, FHH, FRH)
for c, h in enumerate(["チーム", "適合性", "主な論点", "回避策", "事務局判断"]):
    cell(t.cell(0, c), h, size=8.8, color=WHITE, bold=True, fill=DK2,
         align=PP_ALIGN.CENTER)
for i, (team, fit, point, how, judge) in enumerate(FOLLOW, start=1):
    emph = (fit == "△確認要")
    rf = AC6 if emph else (WHITE if i % 2 else LT1)
    cell(t.cell(i, 0), team, size=9.0, color=DK2, bold=True, fill=rf,
         align=PP_ALIGN.CENTER)
    cell(t.cell(i, 1), fit, size=8.8, color=DK1, bold=True, fill=fit_fill(fit),
         align=PP_ALIGN.CENTER)
    cell(t.cell(i, 2), point, size=8.8, color=DK1, fill=rf)
    cell(t.cell(i, 3), how, size=8.8, color=DK1, fill=rf)
    cell(t.cell(i, 4), judge, size=8.8, color=DK1, bold=emph, fill=rf)

# ==================================================================
# 目次の該当行を新しい内容に合わせる
# ==================================================================
s2 = prs.slides[1]
for sh in s2.shapes:
    if sh.has_text_frame and sh.text_frame.text.strip().startswith("△の内訳"):
        p0 = sh.text_frame.paragraphs[0]
        for r in list(p0.runs[1:]):
            r._r.getparent().remove(r._r)
        p0.runs[0].text = "全チームの評価一覧と重点フォロー対象の論点・回避策"

prs.save(OUT)
print("saved:", OUT)
print("slides:", len(prs.slides._sldIdLst))
