# -*- coding: utf-8 -*-
"""
Copilot Studio 活用ハッカソン 第2回 事前相談会 チームごとの状況報告
株式会社Low Code の納品物として、社内テンプレート（資料作成ガイドライン＆汎用スライド・
パーツ集）のスライドマスター・レイアウト・テーマ色・フォントに従って生成する。

テンプレート準拠のポイント
- ベースは添付テンプレート（マスター／レイアウト／テーマをそのまま継承）
- フォントはテーマ既定の「游ゴシック」を継承（明示指定せず）／タイトルは太字
- 色はテーマの色のみ使用。ピンク（lt2）は使わず、注意・注目にはオレンジ（accent1）
    dk2 #1B5C80 … 主要・見出し     accent2 #0FA4CC … 強調
    accent1 #EC856F … 注意・注目   accent3 #A6E2F3 … ちょっと強調
    accent4/5/6 … 背景             dk1 #232323 … 本文
- レイアウト：1_表紙 / 1_目次 / 1_タイトル（章区切り）/ 2_タイトル＋見出し小（本文）
- 本文領域は x0.81〜12.53、ページ番号は x12.67 y7.00
"""
import copy

from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.opc.constants import RELATIONSHIP_TYPE as RT
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

A_NS = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
R_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
SVG_NS = "{http://schemas.microsoft.com/office/drawing/2016/SVG/main}"

TEMPLATE = ("/tmp/claude-0/-home-user-awc-naka881-repo/"
            "e4943cfb-89be-5c9f-b59c-004830a57633/scratchpad/tmpl/base.pptx")
OUT = ("/home/user/awc-naka881-repo/reports/"
       "CopilotStudio_ハッカソン_事前相談会②_状況報告_20260724_LowCode.pptx")

# ---- テーマ色 ----
DK1     = RGBColor(0x23, 0x23, 0x23)   # 本文
DK2     = RGBColor(0x1B, 0x5C, 0x80)   # 主要・見出し
LT1     = RGBColor(0xF8, 0xFD, 0xFA)
AC1     = RGBColor(0xEC, 0x85, 0x6F)   # 注意・注目（オレンジ）
AC2     = RGBColor(0x0F, 0xA4, 0xCC)   # 強調
AC3     = RGBColor(0xA6, 0xE2, 0xF3)   # ちょっと強調
AC4     = RGBColor(0xDB, 0xF1, 0xF7)   # 背景
AC5     = RGBColor(0xE7, 0xE8, 0xF8)   # 背景
AC6     = RGBColor(0xFA, 0xE5, 0xE3)   # 背景
GRAY    = RGBColor(0xD0, 0xD4, 0xD7)   # 未達・補助
MUTE    = RGBColor(0x6E, 0x76, 0x7C)
WHITE   = RGBColor(0xFF, 0xFF, 0xFF)

# ---- 版面（テンプレート準拠）----
CX = Inches(0.81)          # 本文左端
CW = Inches(11.72)         # 本文幅
CY = Inches(1.45)          # 本文上端
PGX, PGY = Inches(12.67), Inches(7.00)

# ---- 文字サイズ：テンプレートの体系に準拠 ----
# テンプレートで実際に使われている段階：25.4(タイトル) / 18.14 / 16.33 / 14.52 / 12.7 / 10.89
SZ_XL    = 18.14  # スライド内の大見出し
SZ_HEAD  = 16.33  # カード・セクション見出し
SZ_LEAD  = 14.52  # 本文（標準）
SZ_BODY  = 12.7   # 本文小
SZ_FINE  = 10.89  # 注記・チップ・表の小（テンプレートの最小値）
SZ_SUB   = 12.7   # 見出し（サブタイトル）
SZ_TBL   = 12.7   # 表の主要セル
SZ_TBLS  = 10.89  # 表の説明セル
SZ_NOTE  = 10.89  # 凡例

prs = Presentation(TEMPLATE)
SW, SH = prs.slide_width, prs.slide_height
LY_COVER, LY_TOC, LY_SECTION, LY_BODY = 0, 1, 2, 17
TOTAL = 18


# ==================================================================
# 基本ヘルパー
# ==================================================================
def copy_shape(shape, src_slide, dst_slide):
    """テンプレート内の図形（画像・SVGを含む）を複製して dst_slide に追加する。
    画像リレーションは複製先スライドに張り替える。"""
    el = copy.deepcopy(shape._element)
    for tag in (A_NS + "blip", SVG_NS + "svgBlip"):
        for blip in el.iter(tag):
            rid = blip.get(R_NS + "embed") or blip.get(R_NS + "link")
            if not rid:
                continue
            try:
                part = src_slide.part.related_part(rid)
            except KeyError:
                continue
            new_rid = dst_slide.part.relate_to(part, RT.IMAGE)
            if blip.get(R_NS + "embed"):
                blip.set(R_NS + "embed", new_rid)
            else:
                blip.set(R_NS + "link", new_rid)
    dst_slide.shapes._spTree.append(el)
    return dst_slide.shapes[-1]


def place(shape, src_slide, dst_slide, x, y, w=None, h=None):
    """図形を複製し、位置（と必要ならサイズ）を指定して配置する"""
    new = copy_shape(shape, src_slide, dst_slide)
    if w is not None and h is not None:
        # 縦横比を保ったまま指定枠に収める
        ratio = min(w / new.width, h / new.height)
        new.width = int(new.width * ratio)
        new.height = int(new.height * ratio)
    new.left, new.top = x, y
    return new


def delete_slides(p, indices):
    """指定インデックス（0始まり）のスライドを削除する"""
    lst = p.slides._sldIdLst
    ids = list(lst)
    for i in sorted(indices, reverse=True):
        rId = ids[i].get('{http://schemas.openxmlformats.org/officeDocument/'
                         '2006/relationships}id')
        p.part.drop_rel(rId)
        lst.remove(ids[i])


# テンプレートの既存スライドは、アイコン・挿絵の供給元として構築中は保持する
SRC = list(prs.slides)
N_SRC = len(SRC)


def parts(slide_no):
    """テンプレートのスライド番号（1始まり）を返す"""
    return SRC[slide_no - 1]


def pick(slide_no, shape_id=None, name=None):
    """テンプレートのスライドから shape_id または name で図形を取得"""
    for sh in parts(slide_no).shapes:
        if shape_id is not None and sh.shape_id == shape_id:
            return sh
        if name is not None and sh.name == name:
            return sh
    return None


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


def set_ph(slide, idx, text, size=None, bold=None, color=None,
           align=None, ls=None):
    """プレースホルダに文字を入れる（フォントはテーマ継承）"""
    p_ = ph(slide, idx)
    if p_ is None:
        return None
    tf = p_.text_frame
    tf.word_wrap = True
    for i, line in enumerate(text.split("\n")):
        para = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        if align is not None:
            para.alignment = align
        if ls is not None:
            para.line_spacing = ls
        r = para.add_run(); r.text = line
        if size is not None:
            r.font.size = Pt(size)
        if bold is not None:
            r.font.bold = bold
        if color is not None:
            r.font.color.rgb = color
    return p_


def txt(slide, x, y, w, h, text, size=SZ_BODY, color=DK1, bold=False,
        align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, ls=1.0):
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = Pt(2); tf.margin_right = Pt(2)
    tf.margin_top = Pt(1); tf.margin_bottom = Pt(1)
    for i, line in enumerate(text.split("\n")):
        para = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        para.alignment = align
        para.line_spacing = ls
        r = para.add_run(); r.text = line
        r.font.size = Pt(size); r.font.bold = bold
        r.font.color.rgb = color
    return tb


def box(slide, x, y, w, h, fill, shape=MSO_SHAPE.RECTANGLE, line=None):
    sp = slide.shapes.add_shape(shape, x, y, w, h)
    sp.fill.solid(); sp.fill.fore_color.rgb = fill
    if line is None:
        sp.line.fill.background()
    else:
        sp.line.color.rgb = line; sp.line.width = Pt(0.75)
    sp.shadow.inherit = False
    return sp


def chip(slide, x, y, w, h, text, fill, tcolor=WHITE, size=SZ_FINE, bold=True):
    sp = box(slide, x, y, w, h, fill, MSO_SHAPE.ROUNDED_RECTANGLE)
    tf = sp.text_frame; tf.word_wrap = True
    tf.margin_left = Pt(3); tf.margin_right = Pt(3)
    tf.margin_top = Pt(1); tf.margin_bottom = Pt(1)
    para = tf.paragraphs[0]; para.alignment = PP_ALIGN.CENTER
    r = para.add_run(); r.text = text
    r.font.size = Pt(size); r.font.bold = bold; r.font.color.rgb = tcolor
    return sp


def ink(fill):
    """塗り色に対してコントラストが確保できる文字色を返す
    （白文字は濃紺 DK2 のみ。薄い色地は本文色 DK1）"""
    return WHITE if fill == DK2 else DK1


def diff_fill(d):
    return AC4 if d == "中" else AC5 if d == "中〜高" else AC6


def fc_fill(m):
    return AC3 if m == "◎" else AC4 if m == "○" else AC6


def vol_fill(v):
    return AC4 if v == "中" else AC5 if v == "中〜大" else AC6


def page_no(slide, n):
    txt(slide, PGX, PGY, Inches(0.54), Inches(0.36), str(n),
        size=SZ_FINE, color=MUTE, align=PP_ALIGN.CENTER,
        anchor=MSO_ANCHOR.MIDDLE)


def content_slide(n, title, sub=None):
    """2_タイトル＋見出し小 をベースにした本文スライド"""
    s = add(LY_BODY)
    set_ph(s, 0, title)                       # タイトル（25.4pt太字を継承）
    if sub:
        set_ph(s, 2, sub, size=SZ_SUB, color=MUTE)
    else:
        drop_ph(s, 2)
    page_no(s, n)
    return s


def cell(c, text, size=SZ_FINE, color=DK1, bold=False, fill=None,
         align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.MIDDLE):
    c.margin_left = Pt(4); c.margin_right = Pt(4)
    c.margin_top = Pt(1); c.margin_bottom = Pt(1)
    c.vertical_anchor = anchor
    c.fill.solid(); c.fill.fore_color.rgb = fill if fill else WHITE
    tf = c.text_frame; tf.word_wrap = True
    for i, line in enumerate(text.split("\n")):
        para = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        para.alignment = align; para.line_spacing = 0.96
        r = para.add_run(); r.text = line
        r.font.size = Pt(size); r.font.bold = bold; r.font.color.rgb = color


def table(slide, x, y, w, rows, cols, widths, hdr_h, row_h):
    shp = slide.shapes.add_table(rows, cols, x, y, w, hdr_h + row_h * (rows - 1))
    t = shp.table
    t.first_row = False
    t.horz_banding = False
    for i, cw_ in enumerate(widths):
        t.columns[i].width = cw_
    t.rows[0].height = hdr_h
    for i in range(1, rows):
        t.rows[i].height = row_h
    return t


def stages(slide, x0, yc, level, w=Inches(0.26), h=Inches(0.155),
           step=Inches(0.235), on=AC2):
    for k in range(5):
        col = on if k < level else GRAY
        sp = slide.shapes.add_shape(MSO_SHAPE.CHEVRON, x0 + step * k,
                                    yc - h / 2, w, h)
        sp.fill.solid(); sp.fill.fore_color.rgb = col
        sp.line.fill.background(); sp.shadow.inherit = False


def stage_color(lv):
    return DK2 if lv >= 5 else AC2 if lv >= 3 else AC1


def diff_color(d):
    return AC2 if d == "中" else DK2 if d == "中〜高" else AC1


def fc_color(m):
    return DK2 if m == "◎" else AC2 if m == "○" else AC1


def vol_color(v):
    return AC2 if v == "中" else DK2 if v == "中〜大" else AC1


# ==================================================================
# データ
# ==================================================================
STAGE = {1: "案の絞り込み中", 2: "2案から選定中", 3: "1案確定",
         4: "設計まで具体化", 5: "効果試算まで完了"}
STAGE_SHORT = {1: "絞り込み中", 2: "2案選定中", 3: "1案確定",
               4: "設計具体化", 5: "効果試算済"}
NO = {1: "①", 2: "②", 3: "③", 4: "④", 5: "⑤"}

# (No, 進捗段階, 取り組み内容, 難易度, 第2回の主な論点, 第2回実施済)
overview = [
    (1, 3, "加盟店提出様式の自動チェック", "中",
     "構築の優先順位・開発手順の型／スケジュールの提示要望", True),
    (2, 3, "受付Cエラーの原因案内", "中",
     "設計相談に使うプロンプト（指示文）の見本が欲しい", True),
    (3, 3, "加盟店防衛マネジメント支援", "高",
     "外部情報の参照が禁止となるリスクと代替策", True),
    (4, 2, "市場・企業分析", "高",
     "外部Web参照の禁止により、現在の案がガイドラインに抵触", True),
    (5, 5, "依頼事項の自動リマインド", "中",
     "管理表の項目立ての進め方／サービス更新に伴う保守", True),
    (6, 3, "会議資料作成と会議招集の自動化", "中〜高",
     "（第2回未実施）Power AutomateとCopilot Studioの役割分担", False),
    (7, 5, "加盟店課金精算のチェック", "中",
     "（第2回未実施）判断基準と毎月の入力ファイルを分ける構成", False),
    (8, 4, "会議調整・タスク整理の支援", "中",
     "（第2回未実施）発表する1案以外を並行して進めてよいか", False),
    (9, 3, "レビュー進捗の管理", "中〜高",
     "（第2回未実施）社外秘資料・外部システム連携・メール送付の可否", False),
    (10, 4, "対面会議の議事録ドラフト生成", "中",
     "Copilotの回答をそのまま信じてよいか／今後の定例の進め方", True),
    (11, 4, "社内LAN問い合わせチャットボット", "中〜高",
     "本番環境への移行、手順書・利用ルールの完成時期", True),
]

APP_COLS = [("CS", "Copilot\nStudio"), ("PA", "Power\nAutomate"),
            ("SP", "Share\nPoint"), ("Tm", "Teams"), ("OL", "Outlook"),
            ("Fm", "Forms"), ("BI", "Power\nBI"), ("Xl", "Excel"),
            ("WP", "Word/\nPPT"), ("Ext", "外部/\nその他")]
app_use = {
    1: {"CS", "SP", "Xl"}, 2: {"CS", "PA", "SP", "Tm"},
    3: {"CS", "PA", "SP", "BI", "Ext"},
    4: {"CS", "PA", "SP", "Tm", "WP", "Ext"},
    5: {"CS", "PA", "Fm", "Tm"},
    6: {"CS", "PA", "SP", "Tm", "OL", "WP"},
    7: {"CS", "SP", "Xl", "Ext"}, 8: {"CS", "PA", "SP", "Tm", "OL"},
    9: {"CS", "PA", "SP", "Tm", "OL", "Xl", "Ext"},
    10: {"CS", "SP", "Tm", "WP"}, 11: {"CS", "SP", "Tm"},
}
constraint = {
    1: "M365内で完結／判定基準の作り込み", 2: "FAQ・ガイドの整備が前提",
    3: "外部Web・営業システムの取得制約が大", 4: "外部Web禁止のため案の再設計が必要",
    5: "M365標準のみ／制約は小さい", 6: "共有サーバ参照・資料生成の検証が要",
    7: "外部連携なし（データは人手取得）", 8: "予定表・会議室・メールの権限整備が要",
    9: "社外秘資料・共有サーバ・送信可否", 10: "文字起こしの権限・転記精度の検証",
    11: "本番移行・FAQ品質・運用保守が焦点",
}
volume = {1: "中", 2: "中", 3: "大", 4: "中〜大", 5: "中", 6: "大",
          7: "中", 8: "中", 9: "大", 10: "中", 11: "大"}
forecast = {1: "○", 2: "○", 3: "○", 4: "△", 5: "◎",
            6: "○", 7: "◎", 8: "○", 9: "○", 10: "○", 11: "○"}
fc_reason = {
    1: "作るものは明確。開発手順の型とスケジュール提示があれば自走できる。",
    2: "対象エラーと回答テンプレートを絞れば動くデモを作れる。指示文の見本で加速。",
    3: "構想は明確。使うデータの可否を整理し範囲を絞れば発表できる（作業量は大）。",
    4: "外部Web参照の禁止で企画の中心が抵触。代替案が未確定で、作るものが定まっていない。",
    5: "業務の流れ・効果・構成まで具体化済み。8月のデモまで道筋が明確。",
    6: "構成は明確。資料収集・資料生成・会議通知を分けて検証すれば発表できる。",
    7: "固定の判断基準＋毎月の入力照合という構成が明確で、実現性が高い。",
    8: "会議調整とタスク整理のどちらを軸にするか決めれば、デモを1本作れる。",
    9: "構想は明確。社外秘・外部連携は別課題として切り出し、範囲を絞れば発表できる。",
    10: "構成は明確。文字起こしの権限とドラフト品質の検証を進めれば発表できる。",
    11: "構成・前提は明確。FAQ整備・本番移行・運用項目の洗い出しを進めれば発表できる。",
}
detail = {
    1: dict(agent="カクニンジャ",
            work="加盟店から提出される様式の記載漏れ・形式不備をAIがチェックする。",
            apps="Copilot Studio ／ Copilot チャット ／ Excel ／ SharePoint（想定）",
            risk="AIの判定結果にばらつきが出る可能性。判定基準と「AIに任せる範囲／人が確認する範囲」の切り分けが必要。",
            q="第2回：構築フェーズで何を優先すべきか。開発手順の型（基本フォーマット）と8〜9月のスケジュール提示が欲しい。",
            a="8〜9月の進め方は事務局から共有する方針。Copilot Studioは通常のチャットより回答範囲・出力形式を制御しやすい点が利点。",
            nxt="チェック項目を分解し、AI判断・自動化・人の確認の境界を設計。サンプル様式で結果の再現性を確認する。"),
    2: dict(agent="受付Cエラー原因ナビゲーター",
            work="カード会社が受付エラーの原因を自分で解決できるよう、AIが原因と対処を案内する。",
            apps="Copilot Studio ／ SharePoint ／ Teams・Web画面 ／ Power Automate（想定）",
            risk="エラーファイルの取り込み形式と、回答の根拠となるFAQ・ガイドの整備状況が成否を左右する。",
            q="第2回：Copilotに設計や成果物を相談するときの指示文（プロンプト）の見本が欲しい。",
            a="企画内容をそのまま貼り付け、「必要な設定・使うべきアプリ・構成案」を尋ねる進め方を助言。ファイル形式は試して見極める。",
            nxt="代表的なエラーパターンと回答テンプレートを絞り、最初に作る範囲の入力・出力例を用意する。"),
    3: dict(agent="加盟店防衛マネジメントエージェント",
            work="営業データを統合し、リスク分析や訪問前のサマリをAIが作成する。",
            apps="Power Automate ／ Power Query ／ SharePoint ／ Power BI ／ Copilot Studio ／ 営業システム等（取得可否が論点）",
            risk="外部情報・営業システムからの取得制約が大きい。使うデータを洗い出し、可否の判断を得る必要がある。",
            q="第2回：外部のIR情報等を参照したいが、外部情報の参照禁止によるリスクと代替策を知りたい。",
            a="外部サイトの自動参照は相手先サーバへの負荷などの観点から原則不可。必要な資料は事前に取得し参照資料として登録する方法が現実的。",
            nxt="使うデータを「M365内／M365外／外部Web」に分類し、最初に作る範囲を再定義する。"),
    4: dict(agent="市場・企業分析エージェント",
            work="企業名やキーワードを起点に、調査結果の整理と提案書のドラフトをAIが作成する。",
            apps="Copilot Studio ／ Power Automate ／ SharePoint ／ Teams ／ Word・PowerPoint（外部Web・RSS・APIは原則不可）",
            risk="企画の中心が外部情報の取得であるため、今回の条件下では実装できる効果が大きく下がる。",
            q="第2回：外部サイトからの情報取得が原則禁止となり、現在の案がガイドラインに抵触する可能性を確認したい。",
            a="Web検索が主機能となる場合は案の練り直しが必要。手元の資料を整えてドラフト化するだけで効果が出るかを検討するよう助言。",
            nxt="外部参照なしで成立する使い方に再設計する（過去の調査結果や社内資料をもとにした整理など）。"),
    5: dict(agent="おはようリマインドくん",
            work="依頼事項の登録・通知・回答集約・未回答者へのリマインドを自動化する。",
            apps="Copilot Studio ／ Microsoft Forms ／ Power Automate ／ Teams ／ 管理ダッシュボード",
            risk="運用の定着と、依頼元の入力ルールが鍵。リマインドの設計と回答形式の標準化が必要。",
            q="第2回：管理表の項目立てをどう始めるか。Copilot Studioの更新に伴う保守リスクも知りたい。",
            a="まず項目を仮決めし、3件程度のサンプルで Power Automate から一連の流れを通す。更新による不具合は運用保守の観点で考慮が必要。",
            nxt="「依頼1件の登録→対象者へ通知→回答集約→未回答リマインド」を8月中に動くデモにする。"),
    6: dict(agent="Forecast ONE",
            work="フォーキャスト会議の資料作成と、会議の招集をあわせて自動化する。",
            apps="Copilot Studio ／ Power Automate ／ SharePoint・OneDrive ／ Outlook ／ Teams ／ PowerPoint",
            risk="資料の保管場所、資料の自動生成、会議招集の自動化は、それぞれ分けて実現性を検証する必要がある。",
            q="第2回は未実施。第1回では Power Automate と Copilot Studio の違い、研修の予定、困ったときの相談先を確認。",
            a="Power AutomateはAIではなく自動化の道具だが、時間削減には重要。資料収集・資料生成・会議通知の役割分担を明確にする必要がある。",
            nxt="3つの入力資料・前月資料・出力資料・会議通知について、データの流れをM365内で整理する。"),
    7: dict(agent="加盟店課金精算チェックエージェント",
            work="請求データと関連システムのデータを突き合わせ、差異をAIがチェックする。",
            apps="Copilot Studio ／ SharePoint ／ Excel または CSV ／ 人手で取得したデータ",
            risk="外部システムと直接つながず人手取得データを前提とするため、ファイル名やフォルダ構成の維持が前提条件になる。",
            q="第2回は未実施。第1回では、判断基準と毎月の入力ファイルを分ける構成について確認。",
            a="固定のチェックリストを判断基準として登録し、毎月の入力ファイルは都度読み込んで照合・修正出力する構成は実現しやすい。",
            nxt="まず3種類程度のデータと固定のチェック項目で、突合結果のレポートを作成する。"),
    8: dict(agent="段取（Dandori）AI",
            work="会議の調整、タスクの洗い出し、レビュー観点の蓄積をAIが支援する。",
            apps="Copilot Studio ／ Power Automate ／ Outlook ／ Teams ／ SharePoint",
            risk="予定表・会議室・メールへのアクセス権限、対象者リストの整備が必要。",
            q="第2回は未実施。第1回では、発表する1案以外の案も並行して進めてよいかを確認。",
            a="発表は1案だが、2案目を並行して進めることは問題ない。会議調整・タスク洗い出しを主軸に、レビュー観点の蓄積は付加価値と整理。",
            nxt="会議調整とタスク洗い出しのどちらを中心にするか決め、デモの筋書きを1本作る。"),
    9: dict(agent="レビュー進捗管理アシスタント",
            work="レビュー対象の一覧化、依頼、完了確認、リマインドまでを自動化する。",
            apps="Copilot Studio ／ Power Automate ／ Outlook ／ Excel ／ Teams ／ 共有ファイルサーバ（制約あり）",
            risk="開発中案件・社外秘情報の扱い、共有サーバの参照、メール自動送信の可否を整理する必要がある。",
            q="第2回は未実施。第1回では、社外秘ファイルや外部システムからの取得、メールの下書き・送付可否が論点。",
            a="管理ツールとしての性格が強くCopilot Studioで作りやすい一方、社外秘・共有サーバ・外部システムの扱いは事務局の判断が必要。",
            nxt="まずメール検知→管理表への反映→下書き作成までに絞り、共有サーバの処理は別課題として切り出す。"),
    10: dict(agent="議事録ドラフト生成エージェント",
             work="会議資料・文字起こし・出席者情報から、議事録のドラフトをAIが作成する。",
             apps="Copilot Studio ／ Teams の文字起こし ／ SharePoint ／ 議事録フォーマット ／ Word（想定）",
             risk="文字起こしの取得権限、会議形式やライセンス、決まった書式への転記精度の検証が必要。",
             q="第2回：Copilotチャットの回答をそのまま信じて進めてよいか。今後の定例の進め方も知りたい。",
             a="Copilotの回答は必ず正解とは限らないため、根拠の提示を求め、実際の画面操作で確認する。8〜9月は定例で伴走予定。",
             nxt="サンプルの会議資料・文字起こし・議事録テンプレートを用意し、ドラフトの品質を確認する。"),
    11: dict(agent="社内LAN問い合わせチャットボット",
             work="社内LANに関するFAQや申請種別の案内を、チャットボットが一次受付する。",
             apps="Copilot Studio ／ SharePoint（参照資料） ／ Teams またはチャット画面 ／ FAQ",
             risk="FAQの整備状況と参照資料の品質、本番環境への移行、利用ルールと運用保守が焦点。",
             q="第2回：開発環境から本番環境への移行、年度末の展開、手順書・利用ルールを社長報告までに完成させるべきか。",
             a="手順書は完成していれば望ましいが、10月時点では準備中でも可。項目の洗い出しと全体量の把握が重要。本番移行は社内の申請フローを要確認。",
             nxt="FAQをCopilot Studioが扱いやすい形に整備し、段階展開（第1〜第3フェーズ）の運用項目を洗い出す。"),
}

# ==================================================================
# 1. 表紙（1_表紙）
# ==================================================================
s = add(LY_COVER)
set_ph(s, 1, "Microsoft 365 Copilot Studio 活用ハッカソン", size=SZ_HEAD, color=DK2)
t = set_ph(s, 0, "第2回 事前相談会\nチームごとの状況報告", size=34, bold=True, ls=1.2)
# 位置・サイズは4値すべて明示（一部だけ指定すると 0 が書き込まれ表示が崩れる）
t.left, t.top, t.width, t.height = Inches(1.26), Inches(2.45), Inches(10.30), Inches(1.6)
set_ph(s, 12, "全11チームの進捗状況・使用アプリ・難易度\n10月発表に向けた見込みと課題",
       size=SZ_LEAD, ls=1.3)
set_ph(s, 2, "2026.07.24", size=SZ_LEAD)
drop_ph(s, 10)
txt(s, Inches(1.26), Inches(5.42), Inches(6.0), Inches(0.38),
    "株式会社Low Code", size=SZ_LEAD, color=DK2, bold=True)

# ==================================================================
# 2. 目次（1_目次）
# ==================================================================
s = add(LY_TOC)
set_ph(s, 0, "本日の内容")
set_ph(s, 2, "第2回 事前相談会（2026年7月22日〜24日 実施）の状況報告",
       size=SZ_SUB, color=MUTE)
page_no(s, 2)
toc = [("01", "本日の目的", "第2回の位置づけと、確認・整理する範囲"),
       ("02", "エグゼクティブサマリ", "全体の状況と、事務局への依頼事項（重点3点）"),
       ("03", "各チームの状況一覧", "進捗の段階・難易度・10月発表の見込み"),
       ("04", "使用アプリ・難易度・ボリューム", "メンター検討の材料としての比較"),
       ("05", "第2回で挙がった課題", "大きく3点に整理"),
       ("06", "各チームの状況", "チーム1〜11の個別状況（1チーム1枚）")]
ty = Inches(1.68)
for num, ttl, note in toc:
    box(s, CX, ty, Inches(0.72), Inches(0.72), AC4)
    txt(s, CX, ty, Inches(0.72), Inches(0.72), num, size=SZ_HEAD, color=DK2,
        bold=True, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    txt(s, CX + Inches(0.92), ty + Inches(0.02), Inches(5.2), Inches(0.36),
        ttl, size=SZ_HEAD, color=DK1, bold=True)
    txt(s, CX + Inches(0.92), ty + Inches(0.42), Inches(9.5), Inches(0.28),
        note, size=SZ_BODY, color=MUTE)
    ty += Inches(0.86)

# ==================================================================
# 3. 本日の目的
# ==================================================================
s = content_slide(3, "本日の目的",
                  "第1回後に提出された企画書を前提に、構築フェーズへ進むための確認を実施")
txt(s, CX, Inches(1.42), CW, Inches(0.62),
    "本資料は、株式会社Low Codeが第2回 事前相談会の結果を取りまとめ、事務局向けに各チームの進捗と"
    "10月発表に向けた課題・依頼事項を報告するものである。",
    size=SZ_LEAD, ls=1.25)

bw, bh, by = Inches(5.72), Inches(2.62), Inches(2.24)
for i, (tag, ttl, col, bgc, items) in enumerate([
    ("進行面", "進捗の確認と次アクションの整理", DK2, AC4,
     [("各チームの進捗状況の確認",
       "企画の具体化の度合いと、構築に着手できる準備が整っているかを確認。"),
      ("次アクションの整理",
       "8月：動くデモ／9月：発表準備／10月：発表 に向けた優先順位を明確化。")]),
    ("技術面", "適合性と実現可能性の助言", AC2, AC5,
     [("使うアプリの適合性",
       "Copilot Studio・Power Automate・SharePoint・Teams等の使い分けを助言。"),
      ("実現可能性と制約の早期確認",
       "外部Web参照、M365外システム連携、資料の保管場所、本番移行などを論点化。")])]):
    x = CX + (bw + Inches(0.28)) * i
    box(s, x, by, bw, bh, bgc)
    box(s, x, by, bw, Inches(0.52), col)
    txt(s, x + Inches(0.22), by, Inches(1.3), Inches(0.52), tag, size=SZ_FINE,
        color=ink(col), bold=True, anchor=MSO_ANCHOR.MIDDLE)
    txt(s, x + Inches(1.5), by, bw - Inches(1.65), Inches(0.52), ttl,
        size=SZ_HEAD, color=ink(col), bold=True, anchor=MSO_ANCHOR.MIDDLE)
    iy = by + Inches(0.68)
    for head, body in items:
        box(s, x + Inches(0.26), iy + Inches(0.08), Inches(0.11), Inches(0.11), col)
        txt(s, x + Inches(0.48), iy - Inches(0.04), bw - Inches(0.72), Inches(0.3),
            head, size=SZ_LEAD, color=DK2, bold=True)
        txt(s, x + Inches(0.48), iy + Inches(0.3), bw - Inches(0.74), Inches(0.62),
            body, size=SZ_BODY, ls=1.18)
        iy += Inches(0.94)

box(s, CX, Inches(5.02), CW, Inches(0.56), AC6)
txt(s, CX + Inches(0.24), Inches(5.02), CW - Inches(0.48), Inches(0.56),
    "特定の案へ誘導することはせず、各チームの主体的な判断を尊重しながら、"
    "技術・運用・ガバナンス面の助言を行う方針で実施。",
    size=SZ_BODY, color=DK1, anchor=MSO_ANCHOR.MIDDLE)

txt(s, CX, Inches(5.74), CW, Inches(0.3), "全体スケジュール", size=SZ_LEAD,
    color=DK2, bold=True)
steps = [("7/9〜13", "事前相談会①", AC4), ("〜7/17", "企画書 提出", AC4),
         ("7/22〜24", "事前相談会②（今回）", AC1), ("8月", "構築・デモ作成", AC3),
         ("9月", "発表準備・運用整理", AC3), ("10月初旬", "最終発表", DK2)]
sx, stw, sdx = CX, Inches(2.15), Inches(1.95)
for i, (d, lb, col) in enumerate(steps):
    sp = s.shapes.add_shape(MSO_SHAPE.CHEVRON, sx + sdx * i, Inches(6.1),
                            stw, Inches(0.6))
    sp.fill.solid(); sp.fill.fore_color.rgb = col
    sp.line.fill.background(); sp.shadow.inherit = False
    tf = sp.text_frame; tf.word_wrap = True
    tf.margin_left = Pt(10); tf.margin_right = Pt(5)
    p1 = tf.paragraphs[0]; p1.alignment = PP_ALIGN.CENTER
    r = p1.add_run(); r.text = d; r.font.size = Pt(SZ_FINE); r.font.bold = True
    r.font.color.rgb = ink(col)
    p2 = tf.add_paragraph(); p2.alignment = PP_ALIGN.CENTER
    r2 = p2.add_run(); r2.text = lb; r2.font.size = Pt(SZ_NOTE)
    r2.font.color.rgb = ink(col)

# ==================================================================
# 4. エグゼクティブサマリ
# ==================================================================
s = content_slide(4, "エグゼクティブサマリ", "全体の状況と、事務局への依頼事項")
box(s, CX, Inches(1.42), CW, Inches(0.78), DK2)
txt(s, CX + Inches(0.3), Inches(1.42), CW - Inches(0.6), Inches(0.78),
    "全11チームが企画を1案に固め、構築フェーズへ移行。"
    "10チームは10月発表に間に合う見込みで、要フォローは1チーム。",
    size=SZ_HEAD, color=WHITE, bold=True, anchor=MSO_ANCHOR.MIDDLE)

tiles = [("◎ 先行", "2チーム", "チーム5・7", "業務の流れ・効果・構成まで具体化済み",
          AC3, CX, Inches(3.06)),
         ("○ 概ね順調", "8チーム", "チーム1・2・3・6・8・9・10・11",
          "不明点はCopilotとの相談で解消でき、\n作業量が多い場合も範囲を絞れば発表可能",
          AC4, CX + Inches(3.22), Inches(5.28)),
         ("△ 要フォロー", "1チーム", "チーム4",
          "外部Web参照の禁止で再設計中。\n作るものの再定義が最優先",
          AC6, CX + Inches(8.66), Inches(3.06))]
ty, th = Inches(2.36), Inches(2.0)
for label, cnt, teams, note, bg, x, w in tiles:
    box(s, x, ty, w, th, bg)
    box(s, x, ty, w, Inches(0.5), DK2)
    txt(s, x, ty, w, Inches(0.5), label, size=SZ_LEAD, color=WHITE, bold=True,
        align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    txt(s, x, ty + Inches(0.56), w, Inches(0.52), cnt, size=26, color=DK2,
        bold=True, align=PP_ALIGN.CENTER)
    txt(s, x + Inches(0.12), ty + Inches(1.14), w - Inches(0.24), Inches(0.3),
        teams, size=SZ_BODY, color=DK1, bold=True, align=PP_ALIGN.CENTER)
    txt(s, x + Inches(0.14), ty + Inches(1.46), w - Inches(0.28), Inches(0.5),
        note, size=SZ_FINE, color=DK1, align=PP_ALIGN.CENTER, ls=1.14)

txt(s, CX, Inches(4.55), CW, Inches(0.3), "事務局への依頼事項（重点3点）",
    size=SZ_LEAD, color=DK2, bold=True)
asks = [("01", "使えるデータ・環境の可否判断を早期に",
         "外部Web参照・M365外連携・機密情報の可否。抵触時は案が頓挫するため最優先。"),
        ("02", "進め方の型とスケジュールの提示",
         "開発手順の基本フォーマット、8〜9月の予定、指示文の見本を配布いただきたい。"),
        ("03", "8月は「一本通す」デモに集中",
         "入力→処理→出力を一本通すことを優先し、細部の作り込みは9月以降とする。")]
ay, aw, ah = Inches(4.92), Inches(3.83), Inches(1.5)
for i, (num, ttl, note) in enumerate(asks):
    x = CX + (aw + Inches(0.12)) * i
    box(s, x, ay, aw, ah, AC5)
    box(s, x, ay, Inches(0.56), ah, DK2)
    txt(s, x, ay, Inches(0.56), ah, num, size=SZ_HEAD, color=WHITE,
        bold=True, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    txt(s, x + Inches(0.68), ay + Inches(0.1), aw - Inches(0.84), Inches(0.5),
        ttl, size=SZ_BODY, color=DK2, bold=True, ls=1.12)
    txt(s, x + Inches(0.68), ay + Inches(0.66), aw - Inches(0.84), Inches(0.74),
        note, size=SZ_FINE, color=DK1, ls=1.16)

# ==================================================================
# 5. 各チームの状況一覧
# ==================================================================
s = content_slide(5, "各チームの状況一覧",
                  "全11チームが1案に確定／第2回 実施済み＝チーム1・2・3・4・5・10・11")
txt(s, CX, Inches(1.38), CW, Inches(0.5),
    "進捗の段階 ▶ ①案の絞り込み中　②2案から選定中　③1案確定（内容の詰めは途上）　"
    "④設計まで具体化　⑤効果試算まで完了\n"
    "10月発表の見込み（基準＝発表に向けた道筋の明確さ）▶ "
    "◎ 道筋が明確で自走できる　○ Copilotとの相談や範囲の絞り込みで間に合う　"
    "△ 要フォロー（作るものが未確定・再設計中）",
    size=SZ_NOTE, color=DK1, ls=1.25)

ty0, rowh, hh = Inches(1.94), Inches(0.418), Inches(0.38)
t = table(s, CX, ty0, CW, 12, 6,
          [Inches(0.95), Inches(2.45), Inches(2.95), Inches(3.27),
           Inches(0.85), Inches(1.25)], hh, rowh)
for c, h in enumerate(["チーム", "進捗の段階", "取り組み内容",
                       "第2回の主な論点・相談", "難易度", "10月見込み"]):
    cell(t.cell(0, c), h, size=SZ_TBL, color=WHITE, bold=True, fill=DK2,
         align=PP_ALIGN.CENTER)
fcw = {"◎": "◎ 順調", "○": "○ 概ね順調", "△": "△ 要フォロー"}
for i, (no, lv, name, diff, topic, done) in enumerate(overview, start=1):
    rf = WHITE if i % 2 else LT1
    cell(t.cell(i, 0), f"チーム{no}", size=SZ_TBL, color=DK2, bold=True, fill=rf,
         align=PP_ALIGN.CENTER)
    cell(t.cell(i, 1), "", fill=rf)
    cell(t.cell(i, 2), name, size=SZ_TBLS, color=DK1, bold=True, fill=rf)
    cell(t.cell(i, 3), topic, size=SZ_TBLS, color=DK1, fill=rf)
    cell(t.cell(i, 4), diff, size=SZ_TBL, color=DK1, bold=True,
         fill=diff_fill(diff), align=PP_ALIGN.CENTER)
    cell(t.cell(i, 5), fcw[forecast[no]], size=SZ_TBLS, color=DK1, bold=True,
         fill=fc_fill(forecast[no]), align=PP_ALIGN.CENTER)
cx0 = CX + Inches(0.95) + Inches(0.1)
for i, (no, lv, *_r) in enumerate(overview, start=1):
    yc = ty0 + hh + rowh * (i - 1) + rowh / 2
    stages(s, cx0, yc, lv, on=stage_color(lv), step=Inches(0.215),
           w=Inches(0.24))
    txt(s, cx0 + Inches(0.215) * 5 + Inches(0.05), yc - Inches(0.13),
        Inches(1.22), Inches(0.26), f"{NO[lv]} {STAGE_SHORT[lv]}", size=SZ_TBLS,
        color=DK2, bold=True, anchor=MSO_ANCHOR.MIDDLE)

# ==================================================================
# 6. 使用アプリ（想定）・難易度・ボリューム
# ==================================================================
s = content_slide(6, "使用アプリ（想定）・難易度・ボリュームの比較",
                  "メンター検討の材料／企画書と相談会の内容にもとづく想定")
ty0, rowh, hh = Inches(1.46), Inches(0.39), Inches(0.52)
APP_SHOW = [c for c in APP_COLS if c[0] != "CS"]   # CSは全チーム共通のため注記に記載
ncol = 3 + len(APP_SHOW) + 1
widths = ([Inches(0.9), Inches(0.86), Inches(0.86)]
          + [Inches(0.82)] * len(APP_SHOW) + [Inches(1.72)])
t = table(s, CX, ty0, CW, 12, ncol, widths, hh, rowh)
cell(t.cell(0, 0), "チーム", size=SZ_TBLS, color=WHITE, bold=True, fill=DK2,
     align=PP_ALIGN.CENTER)
cell(t.cell(0, 1), "難易度", size=SZ_TBLS, color=WHITE, bold=True, fill=DK2,
     align=PP_ALIGN.CENTER)
cell(t.cell(0, 2), "ボリュ\nーム", size=SZ_NOTE, color=WHITE, bold=True, fill=DK2,
     align=PP_ALIGN.CENTER)
for j, (key, label) in enumerate(APP_SHOW):
    cell(t.cell(0, 3 + j), label, size=SZ_FINE, color=WHITE, bold=True, fill=DK2,
         align=PP_ALIGN.CENTER)
cell(t.cell(0, ncol - 1), "主な制約・留意点", size=SZ_TBLS, color=WHITE, bold=True,
     fill=DK2, align=PP_ALIGN.CENTER)
for i, (no, lv, name, diff, topic, done) in enumerate(overview, start=1):
    rf = WHITE if i % 2 else LT1
    cell(t.cell(i, 0), f"チーム{no}", size=SZ_TBL, color=DK2, bold=True, fill=rf,
         align=PP_ALIGN.CENTER)
    cell(t.cell(i, 1), diff, size=SZ_TBL, color=DK1, bold=True,
         fill=diff_fill(diff), align=PP_ALIGN.CENTER)
    cell(t.cell(i, 2), volume[no], size=SZ_TBL, color=DK1, bold=True,
         fill=vol_fill(volume[no]), align=PP_ALIGN.CENTER)
    for j, (key, label) in enumerate(APP_SHOW):
        if key in app_use[no]:
            cell(t.cell(i, 3 + j), "●", size=SZ_TBL, color=DK2, bold=True,
                 fill=AC3, align=PP_ALIGN.CENTER)
        else:
            cell(t.cell(i, 3 + j), "", size=10, fill=rf)
    cell(t.cell(i, ncol - 1), constraint[no], size=SZ_NOTE, color=DK1, fill=rf)
sy = ty0 + hh + rowh * 11 + Inches(0.08)
box(s, CX, sy, CW, Inches(0.62), AC5)
txt(s, CX + Inches(0.22), sy + Inches(0.02), CW - Inches(0.44), Inches(0.58),
    "● ＝ 想定される使用アプリ（Copilot Studio は全11チームが使用のため列を省略）　／　"
    "難易度：中＝M365標準で実現しやすい・"
    "中〜高＝連携や運用の検証項目が多い・高＝外部連携や制約が大きく再設計や判断を伴う\n"
    "ボリューム ＝ 企画着手から実業務で使い始める（リリース）までに必要な総作業量。"
    "開発するもの＋読み込む資料の整備＋連携・権限・本番移行・運用展開を含む　※暫定評価",
    size=SZ_NOTE, color=DK1, ls=1.2)

# ==================================================================
# 7. 課題は大きく3点
# ==================================================================
s = content_slide(7, "第2回で挙がった課題は、大きく3点",
                  "チーム1・2・3・4・5・10・11で実際に挙がった論点を集約")
issues = [
    ("01", "使えるデータ・環境", "ガバナンス・制約", AC1, AC6,
     ["外部Web参照・M365外連携・機密情報は原則不可。依存する案は再設計が必要　… チーム3・4",
      "開発環境から本番環境への移行は、社内の申請・決裁フローを要確認　… チーム11"],
     "可否の判断を早期に。抵触時は案が頓挫するため最優先で確認したい。"),
    ("02", "進め方の型", "構築フェーズの支援", AC2, AC4,
     ["開発手順の型（基本フォーマット）と8〜9月のスケジュール提示　… チーム1・5",
      "設計相談の進め方と、指示文（プロンプト）の見本　… チーム1・2",
      "Copilotの回答は鵜呑みにせず、根拠の提示と実機確認で精度を担保　… チーム10"],
     "進め方の型・スケジュール・指示文の見本を配布いただきたい。"),
    ("03", "10月以降の展開", "運用・定着", AC3, AC5,
     ["8月のデモは範囲を絞り「入力→処理→出力」を一本通す　… チーム4・5",
      "手順書・利用ルールの整備（項目の洗い出しと全体量の把握）と運用保守　… チーム5・11",
      "8月以降の定例（週次／隔週）の進め方の案内　… チーム2・10"],
     "展開・運用の枠組みと定例の進め方を案内いただきたい。"),
]
cy0, ch, cgap = Inches(1.45), Inches(1.71), Inches(0.16)
for k, (num, ttl, sub, col, bg, bullets, action) in enumerate(issues):
    y = cy0 + (ch + cgap) * k
    box(s, CX, y, CW, ch, bg)
    box(s, CX, y, Inches(3.5), ch, col)
    txt(s, CX + Inches(0.18), y + Inches(0.2), Inches(0.8), Inches(0.55), num,
        size=28, color=ink(col), bold=True, align=PP_ALIGN.CENTER)
    txt(s, CX + Inches(1.0), y + Inches(0.3), Inches(2.4), Inches(0.5), ttl,
        size=SZ_HEAD, color=ink(col), bold=True, ls=1.05)
    txt(s, CX + Inches(1.0), y + Inches(0.88), Inches(2.4), Inches(0.3), sub,
        size=SZ_FINE, color=ink(col))
    bx, by2 = CX + Inches(3.72), y + Inches(0.16)
    for b in bullets:
        box(s, bx, by2 + Inches(0.08), Inches(0.1), Inches(0.1), col)
        txt(s, bx + Inches(0.22), by2 - Inches(0.04), Inches(7.6), Inches(0.32),
            b, size=SZ_FINE, color=DK1)
        by2 += Inches(0.34)
    txt(s, bx, y + ch - Inches(0.42), Inches(7.95), Inches(0.34),
        "▶ 事務局へ：" + action, size=SZ_FINE, color=DK2, bold=True)

# ==================================================================
# 8〜18. 各チーム個票
# ==================================================================
def team_slide(no, page):
    d = detail[no]
    ov = overview[no - 1]
    lv, name, diff, done = ov[1], ov[2], ov[3], ov[5]
    fc = forecast[no]
    s = content_slide(page, f"チーム{no}：{name}", f"エージェント名：{d['agent']}")

    # ステータス帯
    sy = Inches(1.4)
    box(s, CX, sy, CW, Inches(0.54), AC4)
    txt(s, CX + Inches(0.2), sy, Inches(0.6), Inches(0.54), "進捗", size=SZ_FINE,
        color=DK1, bold=True, anchor=MSO_ANCHOR.MIDDLE)
    stages(s, CX + Inches(0.88), sy + Inches(0.27), lv, on=stage_color(lv))
    txt(s, CX + Inches(2.15), sy, Inches(1.75), Inches(0.54),
        f"{NO[lv]} {STAGE[lv]}", size=SZ_FINE, color=DK2, bold=True,
        anchor=MSO_ANCHOR.MIDDLE)
    chip(s, CX + Inches(4.0), sy + Inches(0.08), Inches(1.5), Inches(0.38),
         f"難易度 {diff}", diff_fill(diff), tcolor=DK1, size=SZ_FINE)
    chip(s, CX + Inches(5.62), sy + Inches(0.08), Inches(1.75), Inches(0.38),
         f"10月見込み {fc}", fc_fill(fc), tcolor=DK1, size=SZ_FINE)
    chip(s, CX + Inches(7.49), sy + Inches(0.08), Inches(1.6), Inches(0.38),
         ("第2回 実施済" if done else "第2回 未実施"), (DK2 if done else GRAY),
         tcolor=(WHITE if done else DK1), size=SZ_FINE)
    txt(s, CX + Inches(9.25), sy, Inches(2.4), Inches(0.54),
        f"ボリューム {volume[no]}", size=SZ_FINE, color=DK1, bold=True,
        align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)

    txt(s, CX, Inches(2.02), CW, Inches(0.28),
        f"10月発表の見込み（{fc}）の根拠：{fc_reason[no]}", size=SZ_TBLS, color=DK1)

    # 上段3カード
    r1y, r1h = Inches(2.36), Inches(1.62)
    cwd, gap = Inches(3.79), Inches(0.18)
    for i, (ttl, body, col, bg) in enumerate([
            ("取り組み内容", d["work"], DK2, AC4),
            ("使用アプリ・データ（想定）", d["apps"], AC2, AC4),
            ("リスク・論点", d["risk"], AC1, AC6)]):
        x = CX + (cwd + gap) * i
        box(s, x, r1y, cwd, r1h, bg)
        box(s, x, r1y, cwd, Inches(0.4), col)
        txt(s, x + Inches(0.14), r1y, cwd - Inches(0.28), Inches(0.4), ttl,
            size=SZ_FINE, color=ink(col), bold=True, anchor=MSO_ANCHOR.MIDDLE)
        txt(s, x + Inches(0.14), r1y + Inches(0.48), cwd - Inches(0.28),
            r1h - Inches(0.58), body, size=SZ_TBLS, color=DK1, ls=1.2)

    # 中段2カード（相談・助言の記録）
    r2y, r2h = Inches(4.12), Inches(1.5)
    cwd2 = Inches(5.79)
    for i, (ttl, body, col) in enumerate([
            ("相談された内容", d["q"], DK2), ("助言した内容", d["a"], AC2)]):
        x = CX + (cwd2 + Inches(0.14)) * i
        box(s, x, r2y, cwd2, r2h, AC4)
        box(s, x, r2y, cwd2, Inches(0.4), col)
        txt(s, x + Inches(0.14), r2y, cwd2 - Inches(0.28), Inches(0.4), ttl,
            size=SZ_FINE, color=ink(col), bold=True, anchor=MSO_ANCHOR.MIDDLE)
        txt(s, x + Inches(0.14), r2y + Inches(0.46), cwd2 - Inches(0.28),
            r2h - Inches(0.56), body, size=SZ_TBLS, color=DK1, ls=1.2)

    # 次アクション
    ny, nh = Inches(5.76), Inches(0.86)
    box(s, CX, ny, CW, nh, AC5)
    txt(s, CX + Inches(0.24), ny + Inches(0.06), CW - Inches(0.48), Inches(0.28),
        "次アクション", size=SZ_FINE, color=DK2, bold=True)
    txt(s, CX + Inches(0.24), ny + Inches(0.36), CW - Inches(0.48), Inches(0.44),
        d["nxt"], size=SZ_TBLS, color=DK1, ls=1.14)


for k, no in enumerate(range(1, 12)):
    team_slide(no, 8 + k)

# テンプレート由来のスライドを削除し、本資料のスライドのみを残す
delete_slides(prs, range(N_SRC))

prs.save(OUT)
print("saved:", OUT)
print("slides:", len(prs.slides._sldIdLst))
