# -*- coding: utf-8 -*-
"""
Copilot Studio 活用ハッカソン 事前相談会 報告資料 生成スクリプト
全11チームの事前相談会トランスクリプトを整理し、PowerPoint 報告資料を生成する。
"""
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.oxml.ns import qn

# ------------------------------------------------------------------
# カラーパレット（コンサルティング標準トーン：ネイビー基調＋アクセント）
# ------------------------------------------------------------------
NAVY        = RGBColor(0x1F, 0x38, 0x5C)   # メイン
NAVY_DARK   = RGBColor(0x16, 0x28, 0x42)
TEAL        = RGBColor(0x2E, 0x8B, 0x9E)   # アクセント（技術）
ORANGE      = RGBColor(0xE8, 0x83, 0x3A)   # アクセント（注意喚起）
LIGHT_GRAY  = RGBColor(0xF2, 0xF4, 0xF7)
MID_GRAY    = RGBColor(0xD9, 0xDE, 0xE5)
DARK_TEXT   = RGBColor(0x25, 0x2A, 0x31)
WHITE       = RGBColor(0xFF, 0xFF, 0xFF)
GREEN       = RGBColor(0x3F, 0x8F, 0x5B)
AMBER       = RGBColor(0xC9, 0x8A, 0x1B)
RED         = RGBColor(0xB0, 0x3A, 0x2E)

FONT = "Meiryo"

prs = Presentation()
prs.slide_width  = Inches(13.333)
prs.slide_height = Inches(7.5)
SW = prs.slide_width
SH = prs.slide_height
BLANK = prs.slide_layouts[6]


# ------------------------------------------------------------------
# ヘルパー
# ------------------------------------------------------------------
def set_fill(shape, color):
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()


def add_rect(slide, x, y, w, h, color, line_color=None, line_w=None):
    sp = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, w, h)
    sp.fill.solid()
    sp.fill.fore_color.rgb = color
    if line_color is None:
        sp.line.fill.background()
    else:
        sp.line.color.rgb = line_color
        sp.line.width = line_w or Pt(1)
    sp.shadow.inherit = False
    return sp


def add_text(slide, x, y, w, h, text, size=14, color=DARK_TEXT, bold=False,
             align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, font=FONT,
             line_spacing=1.0, italic=False):
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = Pt(2)
    tf.margin_right = Pt(2)
    tf.margin_top = Pt(1)
    tf.margin_bottom = Pt(1)
    lines = text.split("\n")
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.line_spacing = line_spacing
        r = p.add_run()
        r.text = line
        r.font.size = Pt(size)
        r.font.bold = bold
        r.font.italic = italic
        r.font.name = font
        r.font.color.rgb = color
    return tb


def slide_header(slide, no, total, title, kicker):
    """上部ヘッダーバンド＋タイトル＋ページ番号"""
    # 背景
    add_rect(slide, 0, 0, SW, SH, WHITE)
    # 左サイドの細いアクセントバー
    add_rect(slide, 0, 0, Inches(0.14), SH, TEAL)
    # ヘッダーバンド
    band_h = Inches(1.15)
    add_rect(slide, 0, 0, SW, band_h, NAVY)
    add_rect(slide, 0, band_h, SW, Inches(0.05), ORANGE)
    # キッカー（小見出し）
    add_text(slide, Inches(0.55), Inches(0.16), Inches(9.5), Inches(0.3),
             kicker, size=11, color=RGBColor(0xBF, 0xD3, 0xE0), bold=True)
    # タイトル
    add_text(slide, Inches(0.52), Inches(0.44), Inches(11.0), Inches(0.65),
             title, size=25, color=WHITE, bold=True, anchor=MSO_ANCHOR.MIDDLE)
    # ページ番号（右上）
    add_text(slide, Inches(11.9), Inches(0.16), Inches(1.15), Inches(0.35),
             f"{no} / {total}", size=12, color=RGBColor(0xBF, 0xD3, 0xE0),
             bold=True, align=PP_ALIGN.RIGHT)


def slide_footer(slide):
    add_rect(slide, 0, SH - Inches(0.32), SW, Inches(0.32), LIGHT_GRAY)
    add_text(slide, Inches(0.55), SH - Inches(0.31), Inches(8.0), Inches(0.3),
             "Microsoft 365 Copilot Studio 活用ハッカソン｜事前相談会 報告",
             size=8.5, color=RGBColor(0x8A, 0x93, 0x9E),
             anchor=MSO_ANCHOR.MIDDLE)
    add_text(slide, SW - Inches(3.2), SH - Inches(0.31), Inches(2.65), Inches(0.3),
             "社外秘 / Confidential", size=8.5, color=RGBColor(0x8A, 0x93, 0x9E),
             align=PP_ALIGN.RIGHT, anchor=MSO_ANCHOR.MIDDLE)


def style_cell(cell, text, size=10, color=DARK_TEXT, bold=False,
               fill=None, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.MIDDLE):
    cell.margin_left = Pt(5)
    cell.margin_right = Pt(5)
    cell.margin_top = Pt(2)
    cell.margin_bottom = Pt(2)
    cell.vertical_anchor = anchor
    if fill is not None:
        cell.fill.solid()
        cell.fill.fore_color.rgb = fill
    else:
        cell.fill.solid()
        cell.fill.fore_color.rgb = WHITE
    tf = cell.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = align
    p.line_spacing = 0.98
    # サポート：複数行
    for i, line in enumerate(text.split("\n")):
        if i == 0:
            r = p.add_run()
        else:
            np = tf.add_paragraph()
            np.alignment = align
            np.line_spacing = 0.98
            r = np.add_run()
        r.text = line
        r.font.size = Pt(size)
        r.font.bold = bold
        r.font.name = FONT
        r.font.color.rgb = color


def set_row_height(table, idx, h):
    table.rows[idx].height = h


# ==================================================================
# スライド1：事前相談会の目的
# ==================================================================
s = prs.slides.add_slide(BLANK)
slide_header(s, 1, 4, "事前相談会の目的",
             "MICROSOFT 365 COPILOT STUDIO 活用ハッカソン")
slide_footer(s)

# リード文
add_text(s, Inches(0.55), Inches(1.45), Inches(12.2), Inches(0.85),
         "2026年7月よりMicrosoft 365 Copilot Studioを活用した業務効率化・自動化ハッカソンを開始。"
         "7月9日〜13日にかけて、全11チームが検討中の取り組みについて、チームごとに事前相談会を実施した。"
         "本相談会は、以下の「進行」「技術」の2つの目的で実施している。",
         size=13, color=DARK_TEXT, line_spacing=1.15)

# 2カラムの目的ボックス
box_y = Inches(2.65)
box_h = Inches(3.05)
box_w = Inches(5.9)
gap = Inches(0.4)
left_x = Inches(0.6)
right_x = left_x + box_w + gap

def purpose_box(x, tag, tagcolor, title, items):
    add_rect(s, x, box_y, box_w, box_h, LIGHT_GRAY)
    add_rect(s, x, box_y, box_w, Inches(0.9), tagcolor)
    add_text(s, x + Inches(0.35), box_y + Inches(0.12), box_w - Inches(0.7), Inches(0.3),
             tag, size=11, color=WHITE, bold=True)
    add_text(s, x + Inches(0.35), box_y + Inches(0.40), box_w - Inches(0.7), Inches(0.45),
             title, size=17, color=WHITE, bold=True)
    ty = box_y + Inches(1.15)
    for head, body in items:
        add_rect(s, x + Inches(0.35), ty + Inches(0.05), Inches(0.16), Inches(0.16), tagcolor)
        add_text(s, x + Inches(0.62), ty - Inches(0.06), box_w - Inches(1.0), Inches(0.35),
                 head, size=13.5, color=NAVY, bold=True)
        add_text(s, x + Inches(0.62), ty + Inches(0.30), box_w - Inches(0.95), Inches(0.6),
                 body, size=11.5, color=DARK_TEXT, line_spacing=1.08)
        ty += Inches(0.98)

purpose_box(left_x, "進行面 ｜ PROGRESS", NAVY, "進捗管理・伴走支援",
            [("各チームの進捗状況の確認",
              "1案への絞り込み状況、企画内容、検討の到達度を把握する。"),
             ("ネクストアクションの整理",
              "7/17の企画書提出、8〜9月の構築、10月発表に向けた次の一手を明確化する。")])

purpose_box(right_x, "技術面 ｜ TECHNOLOGY", TEAL, "適合性・実現可能性の助言",
            [("Copilot Studio の適合性評価",
              "各チームの企画がCopilot Studio／M365アプリに適した題材かを助言する。"),
             ("実現可能性へのアドバイス",
              "アーキテクチャ、連携可否、セキュリティ等の論点を早期に提示する。")])

# 下部の一言
add_text(s, Inches(0.6), Inches(5.9), Inches(12.1), Inches(0.5),
         "※ 特定案への誘導は行わず、各チームの主体的な意思決定を尊重しながら技術的助言を行う方針で実施。",
         size=11, color=RGBColor(0x6B, 0x74, 0x80), italic=True)


# ==================================================================
# スライド2：各チームの進捗状況（表）
# ==================================================================
s = prs.slides.add_slide(BLANK)
slide_header(s, 2, 4, "各チームの進捗状況",
             "PROGRESS SUMMARY ｜ 全11チーム")
slide_footer(s)

add_text(s, Inches(0.55), Inches(1.26), Inches(12.3), Inches(0.32),
         "「絞り込み」は1案への到達状況（未／2案／1案）、「進捗レベル」は下記5段階の到達点を5つの矢印で表示。質疑は各チーム1〜2件を要約。",
         size=11, color=DARK_TEXT)

# 進捗レベルの凡例
add_text(s, Inches(0.55), Inches(1.58), Inches(12.3), Inches(0.5),
         "進捗レベルの目安 ▶ Lv1：未絞り込み（各自案を持ち寄り）／ Lv2：2案まで絞り込み（1案への選定が必要）／ "
         "Lv3：1案確定・スコープ/機能理解は途上／ Lv4：To-Be・使用アプリ/アーキが具体化／ Lv5：定量効果まで概ね完成",
         size=9, color=RGBColor(0x55, 0x5D, 0x68), line_spacing=1.12)

# チーム番号, 進捗レベル(1-5), 案概要(エージェント名/30字以内・2案は両案), 質問, 回答
# Lv1=未絞込, Lv2=2案まで絞込, Lv3-5=1案絞込済（深度別）
teams = [
    ("1", 2, "（2案：内容を要確認）",
     "Copilot Studio（エージェント）を使うメリットは何か。",
     "回答範囲やフォーマットを制御でき、会話の記憶維持も可能。チャット単体より挙動を制御しやすい。"),
    ("2", 3, "加盟店問い合わせ対応支援エージェント",
     "読込はExcelよりPDFの方が精度が高いか（Excel業務が多い）。",
     "肌感ではPDFが有利だがExcelでも読める可能性あり。まず試して判断する方針。"),
    ("3", 3, "（内容を要確認）",
     "アーキテクチャ／As-Is・To-Beの描き方を知りたい。",
     "既存フローに引きずられず、やりたいことからTo-Beを新規設計。作図もCopilot活用可。"),
    ("4", 3, "（Salesforce活用案：要確認）",
     "Salesforceを読めるか。読めないと取組の意味が薄れる懸念。",
     "可否は事務局が早急に方針提示。機密情報の扱いを含め要協議として課題化。"),
    ("5", 3, "依頼メール処理・ファイル読込エージェント",
     "共有フォルダのパスからCopilotは情報取得できるか。",
     "M365内（SharePoint）が前提。共有フォルダは不可で、SharePoint格納の運用整備が必要。"),
    ("6", 3, "（内容を要確認）",
     "案内メールとツール表記（Automate／Copilot Studio）が異なる。",
     "新しい情報が正。Automateは自動化ツールで別途研修。困り事は随時相談を推奨。"),
    ("7", 5, "入力ファイル自動チェック・修正エージェント",
     "判断基準（ナレッジ）を毎月更新する認識で問題ないか。",
     "判断基準は固定。入力3ファイルを都度読込→基準照合→修正出力の構成で実現可能。"),
    ("8", 2, "（2案：内容を要確認）",
     "提出する1案以外に、作りたい案も別途作ってよいか。",
     "発表は1案に限るが、2案目を裏で並行して進めるのは全く問題なし。"),
    ("9", 1, "",
     "レビュー対象物が社外秘／Salesforceから情報取得は可能か。",
     "社外秘の扱いとSalesforce連携可否は事務局判断次第。管理系はCopilot Studioで作りやすい。"),
    ("10", 4, "対面クライテリア議事録ドラフト生成エージェント",
     "削減時間は7/17提出時点で「できる範囲」で良いか。",
     "提出時は可の範囲でOK。ただし10月の役職者報告に向け具体的な削減数字を提示したい。"),
    ("11", 2, "稟議書チェックエージェント／社内LAN問い合わせチャットボット",
     "稟議書チェックでM365外／SharePoint外は自動チェック不可では。",
     "人／Automate／AIを行ごとに振り分け、フェーズ分けする設計が必要。適否はCopilotで確認可。"),
]

rows = len(teams) + 1
tbl_x = Inches(0.55)
tbl_y = Inches(2.14)
row_h = Inches(0.40)
hdr_h = Inches(0.38)
gtbl = s.shapes.add_table(rows, 6, tbl_x, tbl_y, Inches(12.25), Inches(5.0)).table
col_w = [Inches(0.6), Inches(0.8), Inches(2.1), Inches(2.85), Inches(2.7), Inches(3.2)]
for c, w in enumerate(col_w):
    gtbl.columns[c].width = w

# ヘッダー行
headers = ["チーム", "絞り込み", "進捗レベル", "案概要（エージェント名）",
           "主な質問（要約）", "回答・助言（要約）"]
for c, htext in enumerate(headers):
    style_cell(gtbl.cell(0, c), htext, size=9.5, color=WHITE, bold=True,
               fill=NAVY, align=PP_ALIGN.CENTER)
set_row_height(gtbl, 0, hdr_h)


def level_tier(level):
    """進捗レベルに応じた点灯色（早期=琥珀 → 具体化=ティール → 完成=緑）"""
    if level >= 5:
        return GREEN
    if level >= 3:
        return TEAL
    return AMBER


def narrow_badge(level):
    """絞り込み到達状況（Lv1=未／Lv2=2案／Lv3以上=1案）"""
    if level <= 1:
        return "未", AMBER, RGBColor(0xFB, 0xF0, 0xDA)
    if level == 2:
        return "2案", TEAL, RGBColor(0xE1, 0xF0, 0xF2)
    return "1案", GREEN, RGBColor(0xE4, 0xF1, 0xE9)


CHEV_OFF = RGBColor(0xDD, 0xE1, 0xE7)  # 未点灯の矢印
AGENT_TBD = RGBColor(0x9A, 0x77, 0x2E)  # 「要確認」表示色

for i, (no, level, agent, q, a) in enumerate(teams, start=1):
    rfill = WHITE if i % 2 == 1 else LIGHT_GRAY
    style_cell(gtbl.cell(i, 0), f"チーム{no}", size=10, color=NAVY,
               bold=True, fill=rfill, align=PP_ALIGN.CENTER)
    # 絞り込みバッジ（未／2案／1案）
    btxt, bcol, bfill = narrow_badge(level)
    style_cell(gtbl.cell(i, 1), btxt, size=10, color=bcol, bold=True,
               fill=bfill, align=PP_ALIGN.CENTER)
    # 進捗レベル列は空セル（矢印を上に重ねる）
    style_cell(gtbl.cell(i, 2), "", size=9, fill=rfill)
    # 案概要（エージェント名）／未特定は薄色で「要確認」表示
    acol = AGENT_TBD if agent.startswith("（") else DARK_TEXT
    style_cell(gtbl.cell(i, 3), agent, size=8.6, color=acol,
               bold=not agent.startswith("（"), fill=rfill)
    style_cell(gtbl.cell(i, 4), q, size=8.6, color=DARK_TEXT, fill=rfill)
    style_cell(gtbl.cell(i, 5), a, size=8.6, color=DARK_TEXT, fill=rfill)
    set_row_height(gtbl, i, row_h)

# 進捗レベルの矢印（chevron 5連）を進捗レベル列に重ねて描画
chev_w = Inches(0.24)
chev_h = Inches(0.16)
chev_step = Inches(0.21)
chev_x0 = tbl_x + col_w[0] + col_w[1] + Inches(0.10)   # 進捗レベル列の左端＋余白
for i, (no, level, agent, q, a) in enumerate(teams, start=1):
    y_center = tbl_y + hdr_h + row_h * (i - 1) + row_h / 2
    on_col = level_tier(level)
    for k in range(5):
        col = on_col if k < level else CHEV_OFF
        sp = s.shapes.add_shape(MSO_SHAPE.CHEVRON,
                                chev_x0 + chev_step * k, y_center - chev_h / 2,
                                chev_w, chev_h)
        set_fill(sp, col)
        sp.shadow.inherit = False
    # レベル表記
    add_text(s, chev_x0 + chev_step * 5 + Inches(0.03),
             y_center - Inches(0.11), Inches(0.5), Inches(0.24),
             f"Lv{level}", size=8.5, color=on_col, bold=True,
             anchor=MSO_ANCHOR.MIDDLE)

# 「2案」チームの進め方に関する注記
note_y = tbl_y + hdr_h + row_h * len(teams) + Inches(0.04)
add_rect(s, tbl_x, note_y, Inches(12.25), Inches(0.21), RGBColor(0xE1, 0xF0, 0xF2))
add_rect(s, tbl_x, note_y, Inches(0.12), Inches(0.21), TEAL)
add_text(s, tbl_x + Inches(0.26), note_y - Inches(0.02), Inches(11.9), Inches(0.25),
         "「2案」のチームは、1案に絞り込んだ上で7/17に事務局へ提出し、最終発表も1案とする。"
         "他案は発表対象外だが、並行して進めることは可。",
         size=9.5, color=RGBColor(0x1D, 0x5A, 0x66), bold=True,
         anchor=MSO_ANCHOR.MIDDLE)


# ==================================================================
# スライド3：質疑で挙がった課題のカテゴライズ
# ==================================================================
s = prs.slides.add_slide(BLANK)
slide_header(s, 3, 4, "質疑で挙がった課題の整理",
             "ISSUE CATEGORIZATION ｜ 横断的な論点")
slide_footer(s)

add_text(s, Inches(0.55), Inches(1.26), Inches(12.3), Inches(0.35),
         "各チームの質疑で挙がった課題をカテゴリ別に整理。特にデータの取扱い・外部連携に関する論点が複数チームで共通している。",
         size=11.5, color=DARK_TEXT)

cats = [
    ("読込ファイルのセキュリティ・ガバナンス",
     "社外秘・開発中案件・営業情報などをCopilot Studioに読み込ませてよいかの判断。",
     "9, 4"),
    ("M365以外の製品との連携（Salesforce等）",
     "Salesforce等の外部システムからのデータ取得可否。案の成否を左右する論点。",
     "4, 9, 11"),
    ("ファイルの格納場所・アクセス制約",
     "共有フォルダのパスは参照不可。SharePoint格納への移行と運用ルール整備が必要。",
     "5, 11"),
    ("読込ファイルの形式・精度（Excel／PDF）",
     "Excel業務が多い中、PDF変換で読取精度が変わるか。まず試行して見極める。",
     "2"),
    ("Copilot Studio／Automate の機能理解・使い分け",
     "エージェント化のメリット、ナレッジ（判断基準）運用、Automateとの役割分担。",
     "1, 7, 6, 11"),
    ("ライセンス・利用環境",
     "Copilot StudioはE3等とは別に個別ライセンスの付与が必要。",
     "3"),
    ("案の絞り込み・スコープ／効果試算",
     "1案が未確定、業務への落とし込みや削減効果の定量化が未着手のチームが存在。",
     "9, 6, 1, 11, 8"),
]

rows = len(cats) + 1
tbl_x = Inches(0.55)
tbl_y = Inches(1.72)
tbl_w = Inches(12.25)
ctbl = s.shapes.add_table(rows, 3, tbl_x, tbl_y, tbl_w, Inches(3.35)).table
ctbl.columns[0].width = Inches(4.2)
ctbl.columns[1].width = Inches(6.35)
ctbl.columns[2].width = Inches(1.7)

for c, htext in enumerate(["カテゴリ", "主な論点", "該当チーム"]):
    style_cell(ctbl.cell(0, c), htext, size=10.5, color=WHITE, bold=True,
               fill=TEAL, align=PP_ALIGN.CENTER)
set_row_height(ctbl, 0, Inches(0.38))

for i, (cat, point, tms) in enumerate(cats, start=1):
    rfill = WHITE if i % 2 == 1 else LIGHT_GRAY
    style_cell(ctbl.cell(i, 0), cat, size=9.8, color=NAVY, bold=True, fill=rfill)
    style_cell(ctbl.cell(i, 1), point, size=9.3, color=DARK_TEXT, fill=rfill)
    style_cell(ctbl.cell(i, 2), tms, size=9.5, color=DARK_TEXT, bold=True, fill=rfill,
               align=PP_ALIGN.CENTER)
    set_row_height(ctbl, i, Inches(0.40))

# 注意喚起コールアウト（事務局への相談：既にお客様へ報告済みの課題）
co_y = Inches(5.35)
co_h = Inches(1.7)
add_rect(s, Inches(0.55), co_y, Inches(12.25), co_h, RGBColor(0xFC, 0xF1, 0xE6))
add_rect(s, Inches(0.55), co_y, Inches(0.14), co_h, ORANGE)
add_text(s, Inches(0.85), co_y + Inches(0.14), Inches(11.8), Inches(0.4),
         "▲ 重要：読込ファイルのOK/NG判断について（事務局への相談依頼／既にお客様へ報告済み）",
         size=13, color=ORANGE, bold=True)
add_text(s, Inches(0.85), co_y + Inches(0.60), Inches(11.7), Inches(1.0),
         "・読み込ませたいファイルのOK/NG判断が怪しい場合は、自チーム内での見解を添えて、早めに事務局へ相談いただきたい。\n"
         "・事務局の判断結果によっては、チームで決めた案がそもそも頓挫する可能性もあるため、早期の対応・確認が必要と考えている。",
         size=11.5, color=DARK_TEXT, line_spacing=1.18)


# ==================================================================
# スライド4：全体総括
# ==================================================================
s = prs.slides.add_slide(BLANK)
slide_header(s, 4, 4, "全体総括", "OVERALL ASSESSMENT")
slide_footer(s)

# 総括リード（ネイビーボックス）
add_rect(s, Inches(0.55), Inches(1.4), Inches(12.25), Inches(1.25), NAVY)
add_text(s, Inches(0.9), Inches(1.58), Inches(11.6), Inches(0.95),
         "全体として取り組み意欲が高く、各チームが期待以上に検討を進めているケースが多く見られる。\n"
         "一方で、一部のチームは1案への整理も未了であるなど、チーム間で既に差が出始めている。",
         size=14.5, color=WHITE, bold=True, line_spacing=1.2, anchor=MSO_ANCHOR.MIDDLE)

# 3カラム：ポジティブ / 差の状況 / 提言
col_y = Inches(2.95)
col_h = Inches(3.05)
col_w = Inches(3.95)
xs = [Inches(0.55), Inches(4.7), Inches(8.85)]

def summary_col(x, tagcolor, title, bullets):
    add_rect(s, x, col_y, col_w, col_h, LIGHT_GRAY)
    add_rect(s, x, col_y, col_w, Inches(0.6), tagcolor)
    add_text(s, x + Inches(0.25), col_y + Inches(0.10), col_w - Inches(0.5), Inches(0.4),
             title, size=13.5, color=WHITE, bold=True, anchor=MSO_ANCHOR.MIDDLE)
    ty = col_y + Inches(0.78)
    for b in bullets:
        add_rect(s, x + Inches(0.25), ty + Inches(0.07), Inches(0.1), Inches(0.1), tagcolor)
        add_text(s, x + Inches(0.45), ty - Inches(0.04), col_w - Inches(0.65), Inches(0.65),
                 b, size=10.8, color=DARK_TEXT, line_spacing=1.05)
        ty += Inches(0.72)

summary_col(xs[0], GREEN, "先行・順調なチーム",
            ["チーム7・10は1案に絞り込み済みで、企画書の叩き台まで到達。",
             "対象業務・ナレッジ構成が明確で、実現可能性の見通しも良好。",
             "10月の役職者報告に向け、削減効果の定量化が次の焦点。"])

summary_col(xs[1], AMBER, "フォローが必要なチーム",
            ["チーム9は各自の案を持ち寄った段階で、1案への集約が未了（Lv1）。",
             "チーム1・8・11は2案から1案への選定が必要な段階（Lv2）。",
             "外部連携・機密判断が案の前提となるチームは早期の方針確定が必須。"])

summary_col(xs[2], TEAL, "事務局からの提言",
            ["読込ファイルのOK/NG判断は、怪しい場合ほど早めに事務局へ相談を。",
             "Salesforce等の外部連携可否は、案の成否に直結するため優先確定。",
             "7/17提出→8〜9月構築→10月発表に向け、差の縮小を伴走支援する。"])

prs.save("/home/user/awc-naka881-repo/reports/CopilotStudio_ハッカソン_事前相談会報告.pptx")
print("saved OK")
