# -*- coding: utf-8 -*-
"""
事前相談会② 状況報告資料：スライド5〜10の改訂版（20260729 修正依頼を反映）

主な修正点
  1. Power Automate は「通常トリガー全面禁止」ではなく、
     「エージェントフローを呼び出すときは When an agent calls the flow のみ」
     という位置づけに統一し、対象外となるケースも明記する。
     扱いは「最重要」ではなく「全チーム共有事項」とする。
  2. 進捗表現を弱める（詳細設計済みに見せない）。
  3. ガイドライン適合性を ○／△回避可／△確認要／× に分け、△の内訳を示す。
  4. 重点フォロー4チームの論点を、止まっている点と回避できる点に分解する。
  5. 使用アプリ想定から Forms・Power BI を外し、代替手段と「その他内容」を明記する。
     列見出しにアプリアイコンを復活させる。
  6. 事務局判断待ちと横断課題を区分で分ける。
  7. 8月は「構築フェーズ：MVPを絞って一本通す」として表現する。
"""
import io
import json

from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.oxml.ns import qn

BASE = ("/tmp/claude-0/-home-user-awc-naka881-repo/"
        "e4943cfb-89be-5c9f-b59c-004830a57633/scratchpad/base_in.pptx")
TMPL = ("/tmp/claude-0/-home-user-awc-naka881-repo/"
        "e4943cfb-89be-5c9f-b59c-004830a57633/scratchpad/tmpl/base.pptx")
DATA = "/home/user/awc-naka881-repo/reports/data/slide5_8_data_v2.json"
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

SZ_XL, SZ_HEAD, SZ_LEAD = 18.14, 16.33, 14.52
SZ_BODY, SZ_FINE = 12.7, 10.89
CX, CW = Inches(0.81), Inches(11.72)
PGX, PGY = Inches(12.67), Inches(7.00)
LY_BODY = 17

prs = Presentation(BASE)
tmpl = Presentation(TMPL)
D = json.load(open(DATA, encoding="utf-8"))
TEAMS = {t["team_id"]: t for t in D["teams"]}
ORDER = [f"T{i:02d}" for i in range(1, 12)]


# ==================================================================
# 汎用ヘルパー
# ==================================================================
def txt(s, x, y, w, h, text, size=SZ_BODY, color=DK1, bold=False,
        align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, ls=1.0):
    tb = s.shapes.add_textbox(x, y, w, h)
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


def box(s, x, y, w, h, fill, shape=MSO_SHAPE.RECTANGLE):
    sp = s.shapes.add_shape(shape, x, y, w, h)
    sp.fill.solid(); sp.fill.fore_color.rgb = fill
    sp.line.fill.background(); sp.shadow.inherit = False
    return sp


def cell(c, text, size=SZ_FINE, color=DK1, bold=False, fill=None,
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


def table(s, x, y, w, rows, cols, widths, hdr_h, row_h):
    shp = s.shapes.add_table(rows, cols, x, y, w, hdr_h + row_h * (rows - 1))
    t = shp.table
    t.first_row = False
    t.horz_banding = False
    for i, cw in enumerate(widths):
        t.columns[i].width = cw
    t.rows[0].height = hdr_h
    for i in range(1, rows):
        t.rows[i].height = row_h
    return t


def new_slide(title, sub=None):
    s = prs.slides.add_slide(prs.slide_layouts[LY_BODY])
    for ph in list(s.placeholders):
        if ph.placeholder_format.idx == 0:
            ph.text_frame.paragraphs[0].add_run().text = title
        elif ph.placeholder_format.idx == 2:
            if sub:
                r = ph.text_frame.paragraphs[0].add_run(); r.text = sub
                r.font.size = Pt(SZ_BODY); r.font.color.rgb = MUTE
            else:
                ph._element.getparent().remove(ph._element)
    txt(s, PGX, PGY, Inches(0.54), Inches(0.36), "0", size=SZ_FINE, color=MUTE,
        align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    return s


# ---- テンプレートのアプリアイコンを取り込む ----
ICON_SRC = {"CS": (44, 30), "PA": (23, 13), "SP": (44, 36), "OD": (44, 34),
            "Tm": (44, 33), "OL": (44, 31), "Xl": (44, 178), "WP": (44, 179)}
_icon_cache = {}


def _walk(shapes):
    for sh in shapes:
        yield sh
        if sh.shape_type is not None and "GROUP" in str(sh.shape_type):
            for c in _walk(sh.shapes):
                yield c


def icon_blob(key):
    if key in _icon_cache:
        return _icon_cache[key]
    sn, sid = ICON_SRC[key]
    for sh in _walk(tmpl.slides[sn - 1].shapes):
        if sh.shape_id == sid:
            _icon_cache[key] = sh.image.blob
            return _icon_cache[key]
    return None


def put_icon(s, key, cx_center, y, size=Inches(0.22)):
    blob = icon_blob(key)
    if blob is None:
        return None
    pic = s.shapes.add_picture(io.BytesIO(blob), cx_center, y, height=size)
    pic.left = int(cx_center - pic.width / 2)
    return pic


def fc_fill(g):
    return {"S": AC3, "A": AC4, "B": AC5, "C": AC6}.get(g, GRAY)


def fit_fill(v):
    return AC4 if v.startswith("○") else (AC6 if v.startswith("×") else AC5)


def diff_fill(v):
    return {"1": AC4, "2": AC4, "3": AC5, "4": AC6}.get(v, GRAY)


# ==================================================================
# 表示テキスト（修正依頼を反映）
# ==================================================================
# 進捗：ステップインジケーター（点灯数）と記号
STEP = {"T01": 3, "T02": 3, "T03": 3, "T04": 0, "T05": 5, "T06": 3,
        "T07": 5, "T08": 4, "T09": 4, "T10": 4, "T11": 4}
STEP_MARK = {"T01": "③", "T02": "③", "T03": "③", "T04": "－", "T05": "⑤",
             "T06": "③ *", "T07": "⑤ *", "T08": "④", "T09": "④",
             "T10": "④", "T11": "④"}
STAGE = {
    "T01": "③ MVP候補と入出力", "T02": "③ MVP候補と入出力",
    "T03": "③ MVP候補と入出力", "T04": "－ 再設計中",
    "T05": "⑤ 効果・デモ筋書き", "T06": "③ MVP候補と入出力 *",
    "T07": "⑤ 効果・デモ筋書き *", "T08": "④ 概念設計レベル",
    "T09": "④ 概念設計レベル", "T10": "④ 概念設計レベル",
    "T11": "④ 概念設計レベル",
}
# 適合性：○／△回避可／△確認要／×
FIT = {"T01": "○", "T02": "○", "T03": "△回避可", "T04": "×",
       "T05": "△回避可", "T06": "△回避可", "T07": "○", "T08": "△確認要",
       "T09": "△回避可", "T10": "○", "T11": "○"}

SHORT = {
    "T01": dict(work="提出様式の記載漏れ・形式不備をAIが確認",
                issues="AI判定の揺れ／判定基準の粒度／人の確認範囲",
                action="開発手順の型・8〜9月スケジュール・プロンプト例を共有"),
    "T02": dict(work="受付Cエラーの原因・修正・再申請手順を案内",
                issues="FAQ・ガイドの整備／代表エラーの選定",
                action="設計相談用プロンプトの見本を配布"),
    "T03": dict(work="営業データ統合とリスク分析・訪問前サマリ",
                issues="外部Webは手動取得＋SharePoint格納で回避可／"
                       "営業データのマスキング有無は要確認（手動マスキングで回避可）",
                action=""),
    "T04": dict(work="市場調査・企業分析・アイデア出しの自動化",
                issues="現行案の中核が外部Web参照／代替ユースケースが未確定",
                action="再設計対象として最優先フォロー。新案確定後に難易度・ボリュームを再評価"),
    "T05": dict(work="依頼事項の登録・通知・回答集約・リマインド",
                issues="リマインドの自動起動が論点／人起点またはエージェント経由で回避可",
                action="Formsは使わずCopilot Studioの会話入力で代替する方針を共有"),
    "T06": dict(work="月次フォーキャスト会議の資料作成と会議招集",
                issues="月次自動実行・ファイル保管が論点／人起点のMVPで回避可",
                action="SharePoint/OneDrive格納を原則化できるか（回避方針で進行可）"),
    "T07": dict(work="請求と関連データの照合・不整合チェック",
                issues="ファイル命名規則の維持／判定基準の固定化",
                action="初回メンター定例でMVPの入力・出力例を確認"),
    "T08": dict(work="会議調整・タスク抽出・レビュー観点の蓄積",
                issues="予定表・会議室・メール参照に含まれる個人情報の可否（事務局確認）",
                action="社員・協力会社・ゲスト情報と予定表参照の可否を判断"),
    "T09": dict(work="レビュー対象の一覧化・依頼・完了確認",
                issues="共有サーバはSharePoint格納で回避可／固定文面送信時の人確認は要確認",
                action="固定文面を自動送信してよい条件を個別に判断"),
    "T10": dict(work="文字起こしと会議資料から議事録ドラフト生成",
                issues="文字起こしの取得権限／議事録テンプレート",
                action="サンプル素材と評価観点を準備し、実機確認で精度を担保"),
    "T11": dict(work="社内LAN問い合わせの一次受付（FAQ案内）",
                issues="FAQ整備／本番移行／利用ルール・運用保守",
                action="本番移行の申請フローと運用項目テンプレートを提示"),
}

# 使用アプリ：Forms・Power BI を外し、代替へ振り替えた相対値
APP_COLS = [("CS", "Copilot\nStudio"), ("PA", "Power\nAutomate"),
            ("SP", "SharePoint\n/ OneDrive"), ("Tm", "Teams"),
            ("OL", "Outlook"), ("Xl", "Excel"), ("WP", "Word\n/ PPT")]
VOL = {
    "T01": dict(CS=25, PA=5, SP=10, Tm=0, OL=0, Xl=15, WP=0, other=0,
                other_txt="－", total=55),
    "T02": dict(CS=30, PA=5, SP=15, Tm=5, OL=0, Xl=5, WP=0, other=0,
                other_txt="－", total=60),
    "T03": dict(CS=30, PA=10, SP=20, Tm=0, OL=0, Xl=30, WP=5, other=15,
                other_txt="Power Query・ピボット、人手取得データ", total=110),
    "T04": None,
    "T05": dict(CS=20, PA=30, SP=10, Tm=15, OL=0, Xl=0, WP=0, other=15,
                other_txt="アダプティブカード・会話入力、SharePointリストビュー",
                total=90),
    "T06": dict(CS=25, PA=30, SP=25, Tm=10, OL=10, Xl=15, WP=30, other=0,
                other_txt="－（OneDriveはSharePoint列に合算）", total=145),
    "T07": dict(CS=25, PA=5, SP=15, Tm=0, OL=0, Xl=25, WP=5, other=0,
                other_txt="人手取得データ", total=75),
    "T08": dict(CS=30, PA=25, SP=10, Tm=15, OL=25, Xl=0, WP=0, other=5,
                other_txt="会議室リソース・対象者リストの整備", total=110),
    "T09": dict(CS=30, PA=35, SP=25, Tm=10, OL=15, Xl=20, WP=5, other=10,
                other_txt="レビュー管理表、人手アップロード運用", total=150),
    "T10": dict(CS=25, PA=5, SP=15, Tm=20, OL=0, Xl=0, WP=20, other=0,
                other_txt="議事録テンプレート", total=85),
    "T11": dict(CS=30, PA=5, SP=20, Tm=10, OL=0, Xl=0, WP=5, other=5,
                other_txt="利用ルール・手順書の整備", total=75),
}

PA_RULE_MAIN = ("Power Automate側でエージェントフローを呼び出すときは、必ず"
                "「When an agent calls the flow（エージェントがフローを呼び出したとき）」"
                "のみ利用する。ほかのトリガーでは従量課金が発生する可能性があるため使用しない。")
PA_RULE_SCOPE = ("対象外：クラウドフローとCopilot Studioエージェントが直接連携しない設計、"
                 "および間に人の手作業が入りエージェントフローとして直接呼び出さない場合。"
                 "Power Automate側からエージェントフローを呼び出す構成にする場合のみ、"
                 "上記のトリガーを使用する。")

FIT_DETAIL = [
    ("T03", "外部Webの取得／営業データのマスキング",
     "外部Webは人が取得してSharePointに置く方針で回避可能。営業システムから取得したデータの"
     "マスキング有無は要確認だが、手動マスキングで回避可能。"),
    ("T05", "リマインドの自動起動",
     "エージェントフローを直接呼び出さない構成であれば対象外。必要に応じて人の確認を挟む"
     "オンデマンド型で回避可能。"),
    ("T06", "月次自動実行・ファイル保管・会議招集",
     "8月のMVPは人が起点となって資料作成を開始する構成に寄せれば回避可能。"
     "共有ファイルサーバの直接参照は不可のため、保管先はSharePoint／OneDriveへ。"),
    ("T08", "個人情報・予定表・会議室・メール参照",
     "事務局確認が必要。MVPの範囲をタスク整理側に寄せれば一部は回避可能。"),
    ("T09", "共有ファイルサーバ・社外秘・メール送信",
     "共有ファイルサーバの直接参照は不可。SharePoint格納と人の確認を前提にすれば大部分は"
     "回避可能。固定文面の自動送信条件のみ事務局確認。"),
]


# ==================================================================
# Slide 5：各チームの状況一覧
# ==================================================================
s5 = new_slide("各チームの状況一覧",
               "進捗・10月発表の見込み・難易度・ガイドライン適合性を1枚で把握する")
txt(s5, CX, Inches(1.3), CW, Inches(0.5),
    "進捗 ▶ ①テーマ・案の整理中／②1案化済み、構成は未整理／③MVP候補と入出力イメージあり／"
    "④概念設計レベルまで整理／⑤効果・デモ筋書きまで整理／－再設計中（いずれも詳細設計は未着手）\n"
    "10月見込み ▶ S：可能性が非常に高い／A：見込み高い／B：重点フォロー／C：現行案では難しい　｜　"
    "難易度 ▶ 1〜4（大きいほど設計・検証の負荷が高い）、－は評価不可　｜　"
    "適合性 ▶ ○ 概ね実現可能／△回避可 回避策あり／△確認要 事務局確認待ち／× 中核が抵触",
    size=9.2, color=DK1, ls=1.22)

W5 = [Inches(0.8), Inches(2.5), Inches(1.85), Inches(0.8), Inches(0.7),
      Inches(1.0), Inches(4.07)]
TY5, HH5, RH5 = Inches(1.9), Inches(0.44), Inches(0.42)
t = table(s5, CX, TY5, CW, 12, 7, W5, HH5, RH5)
for c, h in enumerate(["チーム", "取り組み", "進捗", "10月\n見込み", "難易\n度",
                       "適合性", "主な論点（回避可否を含む）"]):
    cell(t.cell(0, c), h, size=SZ_FINE, color=WHITE, bold=True, fill=DK2,
         align=PP_ALIGN.CENTER)
for i, tid in enumerate(ORDER, start=1):
    d = TEAMS[tid]; sh = SHORT[tid]
    rf = WHITE if i % 2 else LT1
    cell(t.cell(i, 0), d["team_label"], size=SZ_FINE, color=DK2, bold=True,
         fill=rf, align=PP_ALIGN.CENTER)
    cell(t.cell(i, 1), sh["work"], size=9.2, color=DK1, bold=True, fill=rf)
    cell(t.cell(i, 2), "", fill=rf)
    cell(t.cell(i, 3), d["forecast"], size=SZ_BODY, color=DK1, bold=True,
         fill=fc_fill(d["forecast"]), align=PP_ALIGN.CENTER)
    cell(t.cell(i, 4), d["difficulty"], size=SZ_BODY, color=DK1, bold=True,
         fill=diff_fill(d["difficulty"]), align=PP_ALIGN.CENTER)
    cell(t.cell(i, 5), FIT[tid], size=9.2, color=DK1, bold=True,
         fill=fit_fill(FIT[tid]), align=PP_ALIGN.CENTER)
    cell(t.cell(i, 6), sh["issues"], size=9.2, color=DK1, fill=rf)

# 進捗列：ステップインジケーター（到達段階まで点灯する矢印）
step_x0 = CX + W5[0] + W5[1] + Inches(0.1)
STEP_W, STEP_H, STEP_GAP = Inches(0.24), Inches(0.155), Inches(0.22)
for i, tid in enumerate(ORDER, start=1):
    yc = TY5 + HH5 + RH5 * (i - 1) + RH5 / 2
    lit = STEP[tid]
    on = DK2 if lit >= 5 else AC2
    for k in range(5):
        sp = s5.shapes.add_shape(MSO_SHAPE.CHEVRON, step_x0 + STEP_GAP * k,
                                 yc - STEP_H / 2, STEP_W, STEP_H)
        sp.fill.solid()
        sp.fill.fore_color.rgb = on if k < lit else GRAY
        sp.line.fill.background(); sp.shadow.inherit = False
    txt(s5, step_x0 + STEP_GAP * 5 + Inches(0.04), yc - Inches(0.12),
        Inches(0.52), Inches(0.24), STEP_MARK[tid], size=10, color=DK2,
        bold=True, anchor=MSO_ANCHOR.MIDDLE)
ny = TY5 + HH5 + RH5 * 11 + Inches(0.06)
box(s5, CX, ny, CW, Inches(0.44), AC5)
txt(s5, CX + Inches(0.2), ny, CW - Inches(0.4), Inches(0.44),
    "＊ チーム6・7は第2回 事前相談会が未実施のため、第1回と企画書をもとにした暫定評価。"
    "△は「進められない」ではなく論点があることを示す。回避策と確認事項の内訳はスライド8を参照。",
    size=9.2, color=DK1, anchor=MSO_ANCHOR.MIDDLE)


# ==================================================================
# Slide 6：エグゼクティブサマリ
# ==================================================================
s6 = new_slide("エグゼクティブサマリ：全体状況とフォロー優先順位",
               "10月発表に向けた見込みの分布と、論点の切り分け")
box(s6, CX, Inches(1.3), CW, Inches(0.6), DK2)
txt(s6, CX + Inches(0.3), Inches(1.3), CW - Inches(0.6), Inches(0.6),
    "多くのチームはMVP化により10月発表が可能。論点は「事務局判断が必要なもの」と"
    "「チーム側で回避しながら進められるもの」に切り分ける。",
    size=SZ_LEAD, color=WHITE, bold=True, anchor=MSO_ANCHOR.MIDDLE)

grades = [("S", "1チーム", "チーム7", "MVP範囲・入出力・デモ筋書きが明確"),
          ("A", "5チーム", "チーム1・2・5・10・11", "軽微な整理でデモ化できる"),
          ("B", "4チーム", "チーム3・6・8・9", "論点の切り分けと範囲の絞り込みが必要"),
          ("C", "1チーム", "チーム4", "現行案では難しく、再設計が必要")]
gy, gh, gw, gap = Inches(2.02), Inches(1.16), Inches(2.85), Inches(0.09)
for i, (g, cnt, teams, note) in enumerate(grades):
    x = CX + (gw + gap) * i
    box(s6, x, gy, gw, gh, fc_fill(g))
    box(s6, x, gy, gw, Inches(0.38), DK2)
    txt(s6, x, gy, gw, Inches(0.38), f"{g}　{cnt}", size=SZ_BODY, color=WHITE,
        bold=True, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    txt(s6, x + Inches(0.1), gy + Inches(0.44), gw - Inches(0.2), Inches(0.28),
        teams, size=SZ_BODY, color=DK1, bold=True, align=PP_ALIGN.CENTER)
    txt(s6, x + Inches(0.12), gy + Inches(0.76), gw - Inches(0.24), Inches(0.34),
        note, size=9.2, color=DK1, align=PP_ALIGN.CENTER, ls=1.12)

txt(s6, CX, Inches(3.32), CW, Inches(0.44),
    "重点フォローのチーム3・6・8・9は、企画自体が実現できないという意味ではない。"
    "外部データ／個人情報・権限／ファイル保管／メール送信／エージェントフロー連携のどこに論点があるかを切り分け、"
    "手動運用やSharePoint格納で回避できる範囲を明確にする。回避可能な論点はチーム側で進行し、"
    "事務局判断が必要な論点のみ確認事項として残す。",
    size=9.5, color=DK1, ls=1.2)

pts = [("外部データ", AC4,
        "外部Web・APIは使用しない。必要な資料は人が取得しSharePointへ格納する方針で回避予定（チーム3・4）。"),
       ("個人情報・権限", AC6,
        "予定表・会議室・メール・Teams情報の扱いは事務局確認が必要。設計に影響する（チーム8・9）。"),
       ("ファイル保管", AC4,
        "共有ファイルサーバの直接参照は不可。SharePoint／OneDrive格納を原則とする。"
        "個人情報や極秘情報を含む場合はマスキング等の追加対応が必要（チーム5・6・9）。"),
       ("エージェントフロー", AC5,
        "Power Automate側でエージェントフローを呼び出す構成の場合のみ"
        "「When an agent calls the flow」の使用が必要。直接連携しない場合は対象外。")]
py = Inches(4.02)
for label, col, note in pts:
    box(s6, CX, py, CW, Inches(0.58), col)
    txt(s6, CX + Inches(0.16), py, Inches(2.0), Inches(0.58), label,
        size=SZ_BODY, color=DK2, bold=True, anchor=MSO_ANCHOR.MIDDLE)
    txt(s6, CX + Inches(2.2), py, Inches(9.3), Inches(0.58), note,
        size=9.5, color=DK1, anchor=MSO_ANCHOR.MIDDLE, ls=1.14)
    py += Inches(0.64)

box(s6, CX, Inches(6.6), CW, Inches(0.36), AC4)
txt(s6, CX + Inches(0.16), Inches(6.6), CW - Inches(0.32), Inches(0.36),
    "全チーム共有事項：Power Automate側でエージェントフローを呼び出す場合は"
    "「When an agent calls the flow」のみを使用する（詳細はスライド9）。",
    size=9.5, color=DK1, bold=True, anchor=MSO_ANCHOR.MIDDLE)


# ==================================================================
# Slide 7：使用アプリ想定と構築ボリューム
# ==================================================================
s7 = new_slide("使用アプリ想定と構築ボリューム（相対値）",
               "アプリの数ではなく、アプリごとの構築量の相対値と合計で比較する")
txt(s7, CX, Inches(1.26), CW, Inches(0.26),
    "数値は工数ではなく比較用の相対値。太字は各チームで最も作り込みが大きいアプリ。"
    "Forms・Power BIは使用しない前提のため列から除外している。",
    size=9.2, color=DK1)

widths = [Inches(0.8), Inches(0.78), Inches(0.82), Inches(1.02), Inches(0.72),
          Inches(0.78), Inches(0.72), Inches(0.8), Inches(0.6), Inches(2.86),
          Inches(0.62), Inches(1.2)]
t = table(s7, CX, Inches(1.6), CW, 12, 12, widths, Inches(0.62), Inches(0.375))
cell(t.cell(0, 0), "チーム", size=SZ_FINE, color=WHITE, bold=True, fill=DK2,
     align=PP_ALIGN.CENTER)
for j, (k, label) in enumerate(APP_COLS):
    cell(t.cell(0, 1 + j), "\n" + label.replace("\n", " "), size=8.6, color=WHITE,
         bold=True, fill=DK2, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.BOTTOM)
cell(t.cell(0, 8), "その他", size=SZ_FINE, color=WHITE, bold=True, fill=DK2,
     align=PP_ALIGN.CENTER)
cell(t.cell(0, 9), "その他の内容", size=SZ_FINE, color=WHITE, bold=True, fill=DK2,
     align=PP_ALIGN.CENTER)
cell(t.cell(0, 10), "合計", size=SZ_FINE, color=WHITE, bold=True, fill=DK2,
     align=PP_ALIGN.CENTER)
cell(t.cell(0, 11), "構築ボリューム", size=SZ_FINE, color=WHITE, bold=True, fill=DK2,
     align=PP_ALIGN.CENTER)

keys = [k for k, _ in APP_COLS]
maxtot = max(v["total"] for v in VOL.values() if v) or 1
for i, tid in enumerate(ORDER, start=1):
    rf = WHITE if i % 2 else LT1
    cell(t.cell(i, 0), TEAMS[tid]["team_label"], size=SZ_FINE, color=DK2,
         bold=True, fill=rf, align=PP_ALIGN.CENTER)
    v = VOL[tid]
    if v is None:
        t.cell(i, 1).merge(t.cell(i, 10))
        cell(t.cell(i, 1), "現行案が制約に抵触し再設計中のため、構築ボリュームは未評価",
             size=9.2, color=DK1, fill=AC6, align=PP_ALIGN.CENTER)
        cell(t.cell(i, 11), "－", size=SZ_FINE, color=DK1, fill=rf,
             align=PP_ALIGN.CENTER)
        continue
    top = max(v[k] for k in keys)
    for j, k in enumerate(keys):
        val = v[k]
        cell(t.cell(i, 1 + j), (str(val) if val else ""), size=SZ_FINE,
             color=DK1, bold=(val == top and val > 0),
             fill=(AC3 if val == top and val > 0 else (AC4 if val >= 20 else rf))
             if val else rf, align=PP_ALIGN.CENTER)
    cell(t.cell(i, 8), (str(v["other"]) if v["other"] else ""), size=SZ_FINE,
         color=DK1, fill=rf, align=PP_ALIGN.CENTER)
    cell(t.cell(i, 9), v["other_txt"], size=9.2, color=DK1, fill=rf)
    cell(t.cell(i, 10), str(v["total"]), size=SZ_BODY, color=DK2, bold=True,
         fill=rf, align=PP_ALIGN.CENTER)
    cell(t.cell(i, 11), "", size=SZ_FINE, fill=rf)

# 列見出しのアプリアイコン
icon_x = CX + widths[0]
for j, (k, _label) in enumerate(APP_COLS):
    cxc = icon_x + widths[1 + j] / 2
    if k == "SP":
        put_icon(s7, "SP", cxc - Inches(0.15), Inches(1.66), Inches(0.2))
        put_icon(s7, "OD", cxc + Inches(0.15), Inches(1.66), Inches(0.2))
    else:
        put_icon(s7, k, cxc, Inches(1.66), Inches(0.22))
    icon_x += widths[1 + j]

bar_x = CX + sum(widths[:11]) + Inches(0.1)
bar_max = Inches(1.0)
for i, tid in enumerate(ORDER, start=1):
    v = VOL[tid]
    if v is None:
        continue
    y = Inches(1.6) + Inches(0.62) + Inches(0.375) * (i - 1) + Inches(0.12)
    box(s7, bar_x, y, int(bar_max * (v["total"] / maxtot)), Inches(0.14), AC2)

ny = Inches(1.6) + Inches(0.62) + Inches(0.375) * 11 + Inches(0.06)
box(s7, CX, ny, CW, Inches(0.46), AC5)
txt(s7, CX + Inches(0.2), ny, CW - Inches(0.4), Inches(0.46),
    "＊ 空欄は使用想定なし。Formsの入力はCopilot Studioの会話入力・アダプティブカードで、"
    "Power BIの可視化はSharePointリストビューやExcelのPower Query・ピボットで代替する。"
    "OneDriveはSharePointの列に合算している。",
    size=9.2, color=DK1, anchor=MSO_ANCHOR.MIDDLE, ls=1.14)


# ==================================================================
# Slide 8：難易度とガイドライン適合性
# ==================================================================
s8 = new_slide("難易度とガイドライン適合性の分離評価",
               "「作る量」「作り方の難しさ」「制約適合性」を分けて評価し、△の内訳を示す")
dl = D["constraints"]["difficulty_definition"]
txt(s8, CX, Inches(1.26), Inches(5.3), Inches(0.26), "難易度の定義",
    size=SZ_BODY, color=DK2, bold=True)
dy = Inches(1.54)
for k in ["1", "2", "3", "4", "-"]:
    box(s8, CX, dy, Inches(0.44), Inches(0.42), diff_fill(k))
    txt(s8, CX, dy, Inches(0.44), Inches(0.42), ("－" if k == "-" else k),
        size=SZ_FINE, color=DK1, bold=True, align=PP_ALIGN.CENTER,
        anchor=MSO_ANCHOR.MIDDLE)
    txt(s8, CX + Inches(0.52), dy, Inches(4.8), Inches(0.42), dl[k],
        size=9.2, color=DK1, anchor=MSO_ANCHOR.MIDDLE, ls=1.1)
    dy += Inches(0.46)

gx = CX + Inches(5.62)
txt(s8, gx, Inches(1.26), Inches(6.1), Inches(0.26), "ガイドライン適合性の定義",
    size=SZ_BODY, color=DK2, bold=True)
fits = [("○", "制約内で概ね実現可能。そのまま進められる。"),
        ("△回避可", "制約論点はあるが、手動運用やSharePoint格納などで回避可能。チーム側で進行できる。"),
        ("△確認要", "制約論点があり、事務局の判断を待つ必要がある。"),
        ("×", "現行案の中核が制約に抵触。再設計が必要。")]
gy2 = Inches(1.54)
for k, desc in fits:
    box(s8, gx, gy2, Inches(1.0), Inches(0.42), fit_fill(k))
    txt(s8, gx, gy2, Inches(1.0), Inches(0.42), k, size=9.2, color=DK1,
        bold=True, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    txt(s8, gx + Inches(1.08), gy2, Inches(5.0), Inches(0.42), desc,
        size=9.2, color=DK1, anchor=MSO_ANCHOR.MIDDLE, ls=1.1)
    gy2 += Inches(0.46)

txt(s8, CX, Inches(3.5), CW, Inches(0.26),
    "△の内訳：何が論点で、どこまで回避できるか", size=SZ_BODY, color=DK2, bold=True)
t = table(s8, CX, Inches(3.78), CW, 6, 4,
          [Inches(0.9), Inches(0.95), Inches(2.75), Inches(7.12)],
          Inches(0.36), Inches(0.46))
for c, h in enumerate(["チーム", "適合性", "論点", "回避策・確認事項"]):
    cell(t.cell(0, c), h, size=SZ_FINE, color=WHITE, bold=True, fill=DK2,
         align=PP_ALIGN.CENTER)
for i, (tid, point, how) in enumerate(FIT_DETAIL, start=1):
    rf = WHITE if i % 2 else LT1
    cell(t.cell(i, 0), TEAMS[tid]["team_label"], size=SZ_FINE, color=DK2,
         bold=True, fill=rf, align=PP_ALIGN.CENTER)
    cell(t.cell(i, 1), FIT[tid], size=9.2, color=DK1, bold=True,
         fill=fit_fill(FIT[tid]), align=PP_ALIGN.CENTER)
    cell(t.cell(i, 2), point, size=9.2, color=DK1, fill=rf)
    cell(t.cell(i, 3), how, size=9.2, color=DK1, fill=rf)
ny = Inches(3.78) + Inches(0.36) + Inches(0.46) * 5 + Inches(0.08)
box(s8, CX, ny, CW, Inches(0.44), AC5)
txt(s8, CX + Inches(0.2), ny, CW - Inches(0.4), Inches(0.44),
    "※ 難易度「－」は、現行案が制約に抵触し案自体の再設計が必要なため評価しないことを示す（チーム4）。"
    "構築ボリューム（作る量）はスライド7を参照。ボリュームが大きくても難易度が高いとは限らない。",
    size=9.2, color=DK1, anchor=MSO_ANCHOR.MIDDLE)


# ==================================================================
# Slide 9：事務局判断待ち・横断課題一覧
# ==================================================================
s9 = new_slide("事務局判断待ち・横断課題一覧",
               "「事務局判断待ち」「回避方針あり」「全チーム共有事項」を区分して整理")
rows9 = [
    ("コスト/ライセンス", "全チーム共有事項", AC4,
     "Power Automate側でエージェントフローを呼び出すときは"
     "「When an agent calls the flow」のみを使用する。",
     "全チーム（特にチーム5・6・8・9）"),
    ("外部Web/API", "横断課題：回避方針あり", AC4,
     "外部Web・APIは使用しない。手動取得＋SharePoint格納で回避する方針を相談会で回答済み。",
     "チーム3・4"),
    ("個人情報/権限", "事務局判断待ち", AC6,
     "予定表・会議室・メール・Teams、社員／協力会社／ゲスト情報の扱い。設計に影響する。",
     "チーム8・9"),
    ("ファイル保管", "横断課題：回避方針あり", AC4,
     "共有ファイルサーバの直接参照は不可。SharePoint／OneDrive格納を原則とする。"
     "個人情報・極秘情報を含む場合はマスキング等が必要。",
     "チーム5・6・9"),
    ("本番移行", "事務局判断待ち", AC6,
     "リリース要件を整理中。10月のデモ時点では必須ではなく、クリティカルパスではない。",
     "チーム11・全チーム共通"),
    ("メール送信", "個別判断", AC5,
     "固定文面を自動送信してよいか、人の確認が必要かはチームごとに異なる。",
     "チーム9（ほかチーム6・8）"),
]
t = table(s9, CX, Inches(1.36), CW, 7, 4,
          [Inches(1.7), Inches(2.15), Inches(5.75), Inches(2.12)],
          Inches(0.38), Inches(0.5))
for c, h in enumerate(["カテゴリ", "区分", "内容", "該当チーム"]):
    cell(t.cell(0, c), h, size=SZ_FINE, color=WHITE, bold=True, fill=DK2,
         align=PP_ALIGN.CENTER)
for i, (cat, kind, kcol, body, teams) in enumerate(rows9, start=1):
    rf = WHITE if i % 2 else LT1
    cell(t.cell(i, 0), cat, size=SZ_FINE, color=DK2, bold=True, fill=rf,
         align=PP_ALIGN.CENTER)
    cell(t.cell(i, 1), kind, size=9.2, color=DK1, bold=True, fill=kcol,
         align=PP_ALIGN.CENTER)
    cell(t.cell(i, 2), body, size=9.2, color=DK1, fill=rf)
    cell(t.cell(i, 3), teams, size=9.2, color=DK1, fill=rf,
         align=PP_ALIGN.CENTER)

cy = Inches(1.36) + Inches(0.38) + Inches(0.5) * 6 + Inches(0.12)
box(s9, CX, cy, CW, Inches(1.7), AC4)
box(s9, CX, cy, Inches(0.14), Inches(1.7), AC2)
txt(s9, CX + Inches(0.3), cy + Inches(0.08), CW - Inches(0.5), Inches(0.28),
    "全チーム共有事項：エージェントフロー呼び出し時のPower Automate起動ルール",
    size=SZ_BODY, color=DK2, bold=True)
txt(s9, CX + Inches(0.3), cy + Inches(0.4), Inches(7.1), Inches(0.5),
    PA_RULE_MAIN, size=9.5, color=DK1, ls=1.16)
txt(s9, CX + Inches(0.3), cy + Inches(0.94), Inches(7.1), Inches(0.5),
    PA_RULE_SCOPE, size=9.2, color=DK1, ls=1.16)
txt(s9, CX + Inches(0.3), cy + Inches(1.44), Inches(7.1), Inches(0.22),
    "共有方法：事務局から全チームへ周知し、週次・隔週のメンター相談会で該当チームを確認する。",
    size=9.2, color=DK2, bold=True)
txt(s9, CX + Inches(7.7), cy + Inches(0.36), Inches(4.0), Inches(0.22),
    "エージェントフローを使う場合の構成", size=9.2, color=DK1, bold=True)
flow = ["Copilot Studio", "When an agent\ncalls the flow", "Power Automate",
        "SharePoint /\nTeams / Outlook"]
fx = CX + Inches(7.7)
for k, lab in enumerate(flow):
    col = AC1 if k == 1 else DK2
    sp = s9.shapes.add_shape(MSO_SHAPE.CHEVRON, fx, cy + Inches(0.64),
                             Inches(1.16), Inches(0.54))
    sp.fill.solid(); sp.fill.fore_color.rgb = col
    sp.line.fill.background(); sp.shadow.inherit = False
    tf = sp.text_frame; tf.word_wrap = True
    tf.margin_left = Pt(6); tf.margin_right = Pt(3)
    for m, line in enumerate(lab.split("\n")):
        p = tf.paragraphs[0] if m == 0 else tf.add_paragraph()
        p.alignment = PP_ALIGN.CENTER
        r = p.add_run(); r.text = line
        r.font.size = Pt(8); r.font.bold = True
        r.font.color.rgb = WHITE if col == DK2 else DK1
    fx += Inches(1.0)
txt(s9, CX + Inches(7.7), cy + Inches(1.28), Inches(4.1), Inches(0.36),
    "直接連携しない設計や、間に人の作業が入る場合はこのルールの対象外。",
    size=9.2, color=DK1, ls=1.14)


# ==================================================================
# Slide 10：8月構築フェーズの進め方
# ==================================================================
s10 = new_slide("8月構築フェーズの進め方：MVPを絞って一本通す",
                "各チームへの共通メッセージ")
box(s10, CX, Inches(1.32), CW, Inches(0.62), DK2)
txt(s10, CX + Inches(0.3), Inches(1.32), CW - Inches(0.6), Inches(0.62),
    "8月は完成版を作り込む期間ではなく、MVPの入力→処理→出力を一本通す期間とする。"
    "9月に発表内容・効果・運用面を整理する。",
    size=SZ_LEAD, color=WHITE, bold=True, anchor=MSO_ANCHOR.MIDDLE)
steps = [("1", "MVPを1本に絞る", "最も効果が見えるユースケースを1つ選ぶ。"),
         ("2", "入力・処理・出力を1例で定義", "サンプル入力と期待する出力を先に決める。"),
         ("3", "Copilot StudioをMVPに必ず含める",
          "開始点はメール・ファイル・人手でもよい。"
          "エージェントが判断・案内・生成・確認支援を行う場面を必ず入れる。"),
         ("4", "制約に抵触する部分は手動運用で回避",
          "外部Web取得、共有ファイルサーバ参照、個人情報利用などは、"
          "SharePoint格納・マスキング・人の確認で代替する。"),
         ("5", "8月は一本通す、9月は発表・運用整理",
          "9月に削減効果、運用項目、手順書、発表資料を整理する。")]
sy2, sh2 = Inches(2.1), Inches(0.8)
for num, ttl, note in steps:
    box(s10, CX, sy2, CW, sh2 - Inches(0.1), AC4)
    box(s10, CX, sy2, Inches(0.62), sh2 - Inches(0.1), AC2)
    txt(s10, CX, sy2, Inches(0.62), sh2 - Inches(0.1), num, size=SZ_XL,
        color=DK1, bold=True, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    txt(s10, CX + Inches(0.82), sy2 + Inches(0.06), Inches(4.6), Inches(0.3),
        ttl, size=SZ_BODY, color=DK2, bold=True)
    txt(s10, CX + Inches(0.82), sy2 + Inches(0.36), Inches(10.6), Inches(0.3),
        note, size=9.5, color=DK1)
    sy2 += sh2
box(s10, CX, Inches(6.22), CW, Inches(0.5), AC5)
txt(s10, CX + Inches(0.2), Inches(6.22), CW - Inches(0.4), Inches(0.5),
    "注意：Power Automate側でエージェントフローを呼び出す設計の場合は"
    "「When an agent calls the flow」を使用する（該当しない構成はこのルールの対象外）。",
    size=9.5, color=DK1, anchor=MSO_ANCHOR.MIDDLE)


# ==================================================================
# 既存スライド5〜8を差し替え、並べ替え
# ==================================================================
RID = qn("r:id")
lst = prs.slides._sldIdLst
ids = list(lst)
for i in sorted([4, 5, 6, 7], reverse=True):
    prs.part.drop_rel(ids[i].get(RID))
    lst.remove(ids[i])
ids = list(lst)
new_ids = ids[-6:]
for el in new_ids:
    lst.remove(el)
for k, el in enumerate(new_ids):
    lst.insert(4 + k, el)


# ==================================================================
# 各チーム個票の波及修正
# ==================================================================
def find_by(slide, kw):
    for sh in slide.shapes:
        if sh.has_text_frame and kw in sh.text_frame.text:
            return sh
    return None


def set_text(sh, text, size=None, color=None, bold=None):
    if sh is None:
        return
    tf = sh.text_frame
    p0 = tf.paragraphs[0]
    for para in list(tf.paragraphs[1:]):
        para._p.getparent().remove(para._p)
    if not p0.runs:
        r = p0.add_run()
    else:
        for r_ in list(p0.runs[1:]):
            r_._r.getparent().remove(r_._r)
        r = p0.runs[0]
    r.text = text
    if size is not None:
        r.font.size = Pt(size)
    if color is not None:
        r.font.color.rgb = color
    if bold is not None:
        r.font.bold = bold


STAGE_FULL = {"③ 1案確定": "③ MVP候補と入出力イメージあり",
              "④ 設計まで具体化": "④ 概念設計レベルまで整理",
              "⑤ 効果試算まで完了": "⑤ 効果・デモ筋書きまで整理",
              "② 2案から選定中": "－ 再設計中"}
label_to_id = {TEAMS[t]["team_label"]: t for t in TEAMS}
for s in prs.slides:
    title = ""
    for ph in s.placeholders:
        if ph.placeholder_format.idx == 0:
            title = ph.text_frame.text
            break
    if not title.startswith("チーム") or "：" not in title:
        continue
    tid = label_to_id.get(title.split("：")[0])
    if tid is None:
        continue
    grade = TEAMS[tid]["forecast"]
    for sh in s.shapes:
        if not sh.has_text_frame:
            continue
        tx = sh.text_frame.text
        if tx.startswith("10月見込み"):
            sh.fill.solid(); sh.fill.fore_color.rgb = fc_fill(grade)
            set_text(sh, f"10月見込み {grade}", color=DK1)
        elif tx.startswith("10月発表の見込み（"):
            _h, _s, rest = tx.partition("）")
            set_text(sh, f"10月発表の見込み（{grade}）" + rest)
        elif tx.strip() in STAGE_FULL:
            set_text(sh, STAGE_FULL[tx.strip()])

# T04 個票：進捗の矢印を消灯（再設計中のため）
s = prs.slides[14]
for sh in s.shapes:
    if (sh.shape_type is not None and "AUTO_SHAPE" in str(sh.shape_type)
            and sh.width < Inches(0.35) and Inches(1.5) < sh.top < Inches(1.75)):
        sh.fill.solid(); sh.fill.fore_color.rgb = GRAY

# T03：Power BI を外し、代替と外部Webの回避方針を明記
s = prs.slides[13]
set_text(find_by(s, "Power Query"),
         "Power Automate ／ Power Query ／ SharePoint ／ Excel ／ Copilot Studio "
         "（Power BIは使用しない。可視化はSharePointリストビューやExcelのピボットで代替）",
         size=11, color=DK1)
set_text(find_by(s, "外部情報・営業システムからの取得制約"),
         "外部Webは人が取得してSharePointに置く方針で回避可能。"
         "営業システムからの取得可否は事務局判断が必要で、MVPの対象範囲を絞る。",
         size=11, color=DK1)
# T03 の使用アプリカードから Power BI（円グラフ）アイコンを削除
icons_t3 = [sh for sh in s.shapes
            if sh.shape_type is not None and "PICTURE" in str(sh.shape_type)
            and Inches(2.7) < sh.top < Inches(3.2)]
if icons_t3:
    rightmost = max(icons_t3, key=lambda x: x.left)
    rightmost._element.getparent().remove(rightmost._element)

# T05：Forms を使わず、リマインドは人起点／エージェント経由
s = prs.slides[15]
set_text(find_by(s, "Microsoft Forms"),
         "Copilot Studio ／ Power Automate ／ Teams ／ SharePoint"
         "（入力はCopilot Studioの会話入力・アダプティブカードで代替。Formsは使用しない）",
         size=11, color=DK1)
set_text(find_by(s, "運用の定着と、依頼元の入力ルール"),
         "リマインドは定時の自動実行ではなく、人起点またはエージェント経由で実行する構成とする。"
         "運用の定着と依頼元の入力ルールの標準化が鍵。",
         size=11, color=DK1)

# T06：スケジュール実行前提に見える表現を避ける
s = prs.slides[16]
set_text(find_by(s, "資料の保管場所"),
         "8月のMVPは人がエージェントに依頼して資料作成を開始する構成とする。"
         "資料の保管場所はSharePoint／OneDriveへ寄せ、資料の自動生成と会議招集は"
         "分けて実現性を検証する。",
         size=11, color=DK1)

# T08：「通常トリガー不可」と断定せず、個人情報・権限の確認を主論点にする
s = prs.slides[18]
set_text(find_by(s, "予定表・会議室・メールへのアクセス権限"),
         "主な論点は、予定表・会議室・メール・Teams参照に含まれる個人情報の取り扱い可否"
         "（事務局確認）。MVPの範囲をタスク整理側に寄せれば一部は回避できる。",
         size=11, color=DK1)

# T09：SharePoint格納と人確認を前提に、メール受信トリガーは主論点にしない
s = prs.slides[19]
set_text(find_by(s, "定型メールの自動送信で人の確認"),
         "共有ファイルサーバはSharePoint格納へ寄せ、メール送信は人の確認を挟む前提とすれば"
         "大部分は回避できる。固定文面を自動送信してよい条件のみ事務局確認が必要。",
         size=11, color=DK1)


# ==================================================================
# 目次とページ番号
# ==================================================================
toc_items = [("01", "本日の目的", "第2回の位置づけと、確認・整理する範囲"),
             ("02", "各チームの状況一覧", "進捗・10月見込み・難易度・ガイドライン適合性"),
             ("03", "エグゼクティブサマリ", "S/A/B/Cの分布と論点の切り分け"),
             ("04", "使用アプリ想定と構築ボリューム", "アプリ別の構築量を相対値で比較"),
             ("05", "難易度とガイドライン適合性", "△の内訳（論点と回避策）を含む"),
             ("06", "事務局判断待ち・横断課題", "判断待ち／回避方針あり／全チーム共有事項"),
             ("07", "8月構築フェーズの進め方", "MVPを絞って一本通す"),
             ("08", "各チームの状況", "チーム1〜11の個別状況（1チーム1枚）")]
s2 = prs.slides[1]
for sh in list(s2.shapes):
    if sh.is_placeholder and sh.placeholder_format.idx in (0, 2):
        continue
    if sh.has_text_frame and sh.text_frame.text.strip() == "2":
        continue
    sh._element.getparent().remove(sh._element)
ty = Inches(1.5)
for num, ttl, note in toc_items:
    box(s2, CX, ty, Inches(0.56), Inches(0.56), AC4)
    txt(s2, CX, ty, Inches(0.56), Inches(0.56), num, size=SZ_BODY, color=DK2,
        bold=True, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    txt(s2, CX + Inches(0.76), ty - Inches(0.02), Inches(5.4), Inches(0.32),
        ttl, size=SZ_HEAD, color=DK1, bold=True)
    txt(s2, CX + Inches(0.76), ty + Inches(0.3), Inches(9.8), Inches(0.26),
        note, size=SZ_FINE, color=MUTE)
    ty += Inches(0.66)

for i, s in enumerate(prs.slides, start=1):
    for sh in s.shapes:
        if not sh.has_text_frame or sh.left is None or sh.top is None:
            continue
        if sh.left > Inches(12.4) and sh.top > Inches(6.8):
            t0 = sh.text_frame.text.strip()
            if t0.isdigit():
                set_text(sh, str(i))

prs.save(OUT)
print("saved:", OUT)
print("slides:", len(prs.slides._sldIdLst))
