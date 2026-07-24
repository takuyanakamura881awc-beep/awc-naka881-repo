# -*- coding: utf-8 -*-
"""
Copilot Studio 活用ハッカソン 第2回 事前相談会 チームごとの状況報告
Copilot生成のたたき台をベースに、第1回と同一のデザインで再構成する。
- 一覧（全11チーム）＋各チーム詳細1枚
- 難易度・使用アプリの比較（メンター担当検討の材料）を追加。メンター割当は行わない。
- 課題整理は第2回トランスクリプトで実際に挙がった論点のみを対象とする。
個人名（各チームメンバー）は不使用。
"""
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

# ---- パレット（第1回と統一）----
NAVY      = RGBColor(0x1F, 0x38, 0x5C)
NAVY_DARK = RGBColor(0x16, 0x28, 0x42)
TEAL      = RGBColor(0x2E, 0x8B, 0x9E)
ORANGE    = RGBColor(0xE8, 0x83, 0x3A)
LIGHT     = RGBColor(0xF2, 0xF4, 0xF7)
MIDGRAY   = RGBColor(0xD9, 0xDE, 0xE5)
DARK      = RGBColor(0x25, 0x2A, 0x31)
WHITE     = RGBColor(0xFF, 0xFF, 0xFF)
GREEN     = RGBColor(0x3F, 0x8F, 0x5B)
AMBER     = RGBColor(0xC9, 0x8A, 0x1B)
RED       = RGBColor(0xB0, 0x3A, 0x2E)
MUTE      = RGBColor(0x6B, 0x74, 0x80)
CHEV_OFF  = RGBColor(0xDD, 0xE1, 0xE7)
MENTOR_N  = RGBColor(0x24, 0x5A, 0x8C)   # 中村
MENTOR_K  = RGBColor(0x2E, 0x7D, 0x5B)   # 甲佐

FONT = "Meiryo"

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
SW, SH = prs.slide_width, prs.slide_height
BLANK = prs.slide_layouts[6]
TOTAL = 16


def set_fill(sp, color):
    sp.fill.solid(); sp.fill.fore_color.rgb = color
    sp.line.fill.background(); sp.shadow.inherit = False


def add_rect(s, x, y, w, h, color, shape=MSO_SHAPE.RECTANGLE):
    sp = s.shapes.add_shape(shape, x, y, w, h)
    set_fill(sp, color)
    return sp


def add_text(s, x, y, w, h, text, size=14, color=DARK, bold=False,
             align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, ls=1.0, italic=False):
    tb = s.shapes.add_textbox(x, y, w, h); tf = tb.text_frame
    tf.word_wrap = True; tf.vertical_anchor = anchor
    tf.margin_left = Pt(2); tf.margin_right = Pt(2)
    tf.margin_top = Pt(1); tf.margin_bottom = Pt(1)
    for i, line in enumerate(text.split("\n")):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align; p.line_spacing = ls
        r = p.add_run(); r.text = line
        r.font.size = Pt(size); r.font.bold = bold; r.font.italic = italic
        r.font.name = FONT; r.font.color.rgb = color
    return tb


def header(s, no, title, kicker):
    add_rect(s, 0, 0, SW, SH, WHITE)
    add_rect(s, 0, 0, Inches(0.14), SH, TEAL)
    add_rect(s, 0, 0, SW, Inches(1.12), NAVY)
    add_rect(s, 0, Inches(1.12), SW, Inches(0.05), ORANGE)
    add_text(s, Inches(0.55), Inches(0.15), Inches(9.6), Inches(0.3),
             kicker, size=10.5, color=RGBColor(0xBF, 0xD3, 0xE0), bold=True)
    add_text(s, Inches(0.52), Inches(0.42), Inches(11.2), Inches(0.62),
             title, size=24, color=WHITE, bold=True, anchor=MSO_ANCHOR.MIDDLE)
    add_text(s, Inches(11.9), Inches(0.15), Inches(1.15), Inches(0.35),
             f"{no} / {TOTAL}", size=11.5, color=RGBColor(0xBF, 0xD3, 0xE0),
             bold=True, align=PP_ALIGN.RIGHT)


def footer(s):
    add_rect(s, 0, SH - Inches(0.32), SW, Inches(0.32), LIGHT)
    add_text(s, Inches(0.55), SH - Inches(0.31), Inches(9.0), Inches(0.3),
             "Microsoft 365 Copilot Studio 活用ハッカソン｜第2回 事前相談会 報告（2026/7/22〜24）",
             size=8.5, color=RGBColor(0x8A, 0x93, 0x9E), anchor=MSO_ANCHOR.MIDDLE)
    add_text(s, SW - Inches(3.2), SH - Inches(0.31), Inches(2.65), Inches(0.3),
             "社外秘 / Confidential", size=8.5, color=RGBColor(0x8A, 0x93, 0x9E),
             align=PP_ALIGN.RIGHT, anchor=MSO_ANCHOR.MIDDLE)


def cell(c, text, size=10, color=DARK, bold=False, fill=None,
         align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.MIDDLE):
    c.margin_left = Pt(5); c.margin_right = Pt(5)
    c.margin_top = Pt(2); c.margin_bottom = Pt(2)
    c.vertical_anchor = anchor
    c.fill.solid(); c.fill.fore_color.rgb = fill if fill else WHITE
    tf = c.text_frame; tf.word_wrap = True
    for i, line in enumerate(text.split("\n")):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align; p.line_spacing = 0.98
        r = p.add_run(); r.text = line
        r.font.size = Pt(size); r.font.bold = bold
        r.font.name = FONT; r.font.color.rgb = color


def rh(t, i, h):
    t.rows[i].height = h


def chevrons(s, x0, y_center, level, w=Inches(0.28), h=Inches(0.16),
             step=Inches(0.24), on=TEAL):
    for k in range(5):
        col = on if k < level else CHEV_OFF
        sp = s.shapes.add_shape(MSO_SHAPE.CHEVRON, x0 + step * k,
                                y_center - h / 2, w, h)
        set_fill(sp, col)


def tier(level):
    return GREEN if level >= 5 else TEAL if level >= 3 else AMBER


def diff_color(d):
    return TEAL if d == "中" else RED if d == "高" else AMBER


def pill(s, x, y, w, h, text, fill, tcolor=WHITE, size=10.5, bold=True):
    sp = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, h)
    set_fill(sp, fill)
    tf = sp.text_frame; tf.word_wrap = True
    tf.margin_left = Pt(4); tf.margin_right = Pt(4)
    tf.margin_top = Pt(1); tf.margin_bottom = Pt(1)
    p = tf.paragraphs[0]; p.alignment = PP_ALIGN.CENTER
    r = p.add_run(); r.text = text
    r.font.size = Pt(size); r.font.bold = bold; r.font.name = FONT
    r.font.color.rgb = tcolor


# ==================================================================
# データ
# ==================================================================
# level, 案概要(短), 難易度, メンター, 第2回主トピック, 実施済みか
overview = [
    (1, 3, "様式チェックAI（カクニンジャ）", "中", "中村",
     "構築の優先順位・開発フォーマット/スケジュール提示の要望", True),
    (2, 3, "受付Cエラー原因ナビ", "中", "中村",
     "設計相談用のプロンプト見本が欲しい", True),
    (3, 3, "加盟店防衛マネジメント支援", "高", "甲佐",
     "外部情報参照禁止のリスクと代替策", True),
    (4, 2, "市場・企業分析", "高", "甲佐",
     "外部Web参照禁止で現行案がガイドラインに抵触", True),
    (5, 5, "自動リマインド（おはようリマインドくん）", "中", "中村",
     "タスク列の作り方・更新に伴う運用保守", True),
    (6, 3, "PPT資料作成・会議招集（Forecast ONE）", "中〜高", "甲佐",
     "（第2回未実施）Automate/CSの使い分け・役割分担", False),
    (7, 5, "課金精算チェック", "中", "中村",
     "（第2回未実施）ナレッジと入力ファイルの分離構成", False),
    (8, 4, "段取りAI", "中", "中村",
     "（第2回未実施）1案以外を裏で進めてよいか", False),
    (9, 3, "レビュー進捗管理", "中〜高", "甲佐",
     "（第2回未実施）社外秘/Salesforce/メール送付可否", False),
    (10, 4, "議事録ドラフト生成", "中", "中村",
     "Copilot回答の信頼性・メンター定例の進め方", True),
    (11, 4, "社内LAN問合せBot", "中〜高", "甲佐",
     "本番環境移行・手順書/利用ルールの完成時期", True),
]

# メンター比較用：外部連携・制約（S3の右端に表示）
mentor = {
    1: ("", "M365内中心／判定基準の作り込みが肝"),
    2: ("", "FAQ・ガイド整備が成否を左右"),
    3: ("", "外部Web・Salesforce等の取得制約が大"),
    4: ("", "外部Web参照禁止で案の再設計が必要"),
    5: ("", "M365標準のみ／制約は小さい"),
    6: ("", "ファイルサーバ／PPT自動生成の検証"),
    7: ("", "外部連携なし（人手取得データ前提）"),
    8: ("", "予定表・会議室・メール権限の整備"),
    9: ("", "社外秘・共有サーバ・メール送信可否"),
    10: ("", "トランスクリプト取得権限・転記精度"),
    11: ("", "本番移行・FAQ品質・運用保守"),
}

# アプリ列（key, 2行ラベル, 色, 文字色）— 列＝アプリ、色タイル＝使用
APP_COLS = [
    ("CS",  "Copilot\nStudio", RGBColor(0x74, 0x5C, 0xA6), WHITE),
    ("PA",  "Power\nAutomate", RGBColor(0x0B, 0x72, 0xC4), WHITE),
    ("SP",  "Share\nPoint",    RGBColor(0x03, 0x6C, 0x70), WHITE),
    ("Tm",  "Teams",           RGBColor(0x4B, 0x53, 0xBC), WHITE),
    ("OL",  "Outlook",         RGBColor(0x0A, 0x6F, 0xC2), WHITE),
    ("Fm",  "Forms",           RGBColor(0x1F, 0x8A, 0x70), WHITE),
    ("BI",  "Power\nBI",       RGBColor(0xE3, 0xB1, 0x0A), DARK),
    ("Xl",  "Excel",           RGBColor(0x21, 0x73, 0x46), WHITE),
    ("WP",  "Word/\nPPT",      RGBColor(0xB0, 0x47, 0x2A), WHITE),
    ("Ext", "外部/\nその他",   RGBColor(0x6B, 0x72, 0x80), WHITE),
]
# 各チームが使用するアプリ（APP_COLSのkey集合）
app_use = {
    1: {"CS", "SP", "Xl"},
    2: {"CS", "PA", "SP", "Tm"},
    3: {"CS", "PA", "SP", "BI", "Ext"},
    4: {"CS", "PA", "SP", "Tm", "WP", "Ext"},
    5: {"CS", "PA", "Fm", "Tm"},
    6: {"CS", "PA", "SP", "Tm", "OL", "WP"},
    7: {"CS", "SP", "Xl", "Ext"},
    8: {"CS", "PA", "SP", "Tm", "OL"},
    9: {"CS", "PA", "SP", "Tm", "OL", "Xl", "Ext"},
    10: {"CS", "SP", "Tm", "WP"},
    11: {"CS", "SP", "Tm"},
}
# 10月発表の見込み（暫定）: ◎=順調 / ○=概ね順調 / △=要フォロー
forecast = {1: "○", 2: "○", 3: "△", 4: "△", 5: "◎",
            6: "○", 7: "◎", 8: "○", 9: "△", 10: "○", 11: "○"}


def fc_color(m):
    return GREEN if m == "◎" else TEAL if m == "○" else AMBER

# 各チーム詳細
detail = {
    1: dict(title="様式チェックAI", diff="中", mentor="中村",
            work="カクニンジャ／加盟店提出様式の記載漏れ・形式不備を自動チェック",
            apps="Copilot Studio／Copilot Chat／Excel／SharePoint（想定）",
            risk="出力結果の揺れが残る。検証条件・判定基準と、AIが担う範囲/人が見る範囲の分離が必要。",
            q="第2回：構築フェーズで何を優先すべきか、開発の基本フォーマット・スケジュール提示への要望。第1回：回答範囲・フォーマット制御を確認。",
            a="8〜9月の進め方・運用設計の道筋を事務局から共有する方向。Copilot Studioは単なるチャットより回答範囲・形式を制御しやすい。",
            nxt="チェック項目を分解し、AI判断・自動化・人手確認の境界を設計。サンプル様式で再現性を確認。"),
    2: dict(title="受付Cエラー原因ナビ", diff="中", mentor="中村",
            work="受付Cエラー原因ナビゲーター／カード会社向けセルフ解決エージェント",
            apps="Copilot Studio／SharePoint／Teams・Web UI／Power Automate（想定）",
            risk="エラーファイルの取り込み形式と、回答根拠となるFAQ・ガイドの整備が成否を左右。",
            q="第2回：設計内容を相談する際のプロンプト見本が欲しいとの要望。第1回：Excel/PDF読込精度が論点。",
            a="企画内容を貼り付け、必要な設定・使うべきアプリ・構成案をCopilot Chatに確認する進め方を助言。Excel/PDFは試行で見極める。",
            nxt="代表的なエラーパターンと回答テンプレートを絞り、MVP対象の入力・出力例を作成。"),
    3: dict(title="加盟店防衛マネジメント支援", diff="高", mentor="甲佐",
            work="加盟店防衛マネジメントエージェント／営業データ統合・リスク分析・訪問前サマリ",
            apps="Power Automate／Power Query／SharePoint／Power BI／Copilot Studio／Salesforce・N-MARK等（取得可否が論点）",
            risk="外部情報・Salesforce等の取得制約が大きい。データソースの棚卸しとOK/NG判断が必要。",
            q="第2回：外部IR等を参照したいが外部情報参照禁止のリスクと代替策。やりたいこと起点で考えるべきかも確認。",
            a="外部サイト自動参照は先方サイト負荷・リスク観点で原則NG。必要なら事前取得資料をナレッジ化。To-Beは既存フローに引きずられず設計。",
            nxt="使用データをM365内・M365外・外部Webに分類し、MVPで扱う範囲を再定義。"),
    4: dict(title="市場・企業分析", diff="高", mentor="甲佐",
            work="市場・企業分析エージェント／企業名・キーワード起点の調査・提案書生成",
            apps="Copilot Studio／Power Automate／SharePoint／Teams／Word・PPT／外部Web・RSS・APIは原則不可",
            risk="企画価値の中心が外部情報取得の場合、ハッカソン条件下では実装効果が大きく低下。",
            q="第2回：外部サイトの情報取得が原則禁止となり、現行案がガイドラインに抵触する可能性を確認。",
            a="Webサーチを主機能とする場合は案の練り直しが必要。内部資料の整形・ドラフト化だけで効果が出るかを検討するよう助言。",
            nxt="外部参照なしで成立するユースケースへ再設計。過去調査DB・社内資料ベースの差分整理などに軸足変更を検討。"),
    5: dict(title="自動リマインド", diff="中", mentor="中村",
            work="おはようリマインドくん／依頼事項の登録・通知・回答集約・未回答リマインド",
            apps="Copilot Studio／Microsoft Forms／Power Automate／Teams／管理ダッシュボード",
            risk="運用定着と依頼元の入力ルールが鍵。リマインド設計・回答形式の標準化が必要。",
            q="第2回：タスク列構成をどう始めるか、Copilot Studio更新に伴う運用保守リスク。第1回：共有フォルダ参照制約。",
            a="まずタスク列を仮決めし、3件程度のサンプルを作成してAutomateから一本通す。クラウド更新に伴う不具合は運用保守観点で考慮。",
            nxt="MVPは「1依頼登録→対象者通知→回答集約→未回答リマインド」の一連実行を8月中にデモ化。"),
    6: dict(title="PPT資料作成・会議招集", diff="中〜高", mentor="甲佐",
            work="Forecast ONE／フォーキャスト会議の資料作成と会議招集を自動化",
            apps="Copilot Studio／Power Automate／SharePoint・OneDrive／Outlook／Teams／PowerPoint",
            risk="ファイルサーバ・OneDrive/SharePoint格納、PPTの自動生成、会議招集の自動化可否を分けて検証が必要。",
            q="第2回トランスクリプト未添付。第1回：AutomateとCopilot Studioの違い、研修スケジュール、相談先を確認。",
            a="AutomateはAIではなく自動化ツールだが時間削減に重要。ファイル収集・PPT生成・会議通知の役割分担を明確化する必要。",
            nxt="3つの入力ファイル・前月PPT・出力PPT・会議通知のデータフローをM365内で再設計。"),
    7: dict(title="課金精算チェック", diff="中", mentor="中村",
            work="加盟店課金精算チェックエージェント／請求・N-Mark・J-SCRUM・CNCデータの突合",
            apps="Copilot Studio／SharePoint／ExcelまたはCSV／手動取得データ",
            risk="外部システム連携は行わず人手取得データを前提。ファイル命名・フォルダ構成の維持が前提条件。",
            q="第2回トランスクリプト未添付。第1回：判断基準（ナレッジ）と毎月の入力ファイルを分ける構成を確認。",
            a="固定のチェックリストをナレッジとし、毎月の入力ファイルを都度読み込ませて照合・修正出力する設計は実現しやすい。",
            nxt="MVPは3種類程度のデータと固定チェック項目で突合結果レポートを作成。"),
    8: dict(title="段取りAI", diff="中", mentor="中村",
            work="段取（Dandori）AI／会議調整・タスク整理・レビュー観点の蓄積",
            apps="Copilot Studio／Power Automate／Outlook／Teams／SharePoint",
            risk="予定表・会議室・メールへの権限、退職者除外や対象者候補の整備が必要。",
            q="第2回トランスクリプト未添付。第1回：発表対象の1案以外を裏で作ってよいかを確認。",
            a="最終発表は1案だが、2案目を並行して進めることは可。会議調整・タスク抽出を主軸に、レビュー観点蓄積は付加価値と整理。",
            nxt="会議調整とタスク抽出のどちらをMVPの中心にするかを確定し、1本のデモシナリオを作る。"),
    9: dict(title="レビュー進捗管理", diff="中〜高", mentor="甲佐",
            work="レビュー進捗管理アシスタント／レビュー対象一覧・依頼・完了確認・リマインド",
            apps="Copilot Studio／Power Automate／Outlook／Excel／Teams／共有ファイルサーバ（制約あり）",
            risk="開発中案件・社外秘情報の扱い、ファイルサーバ参照、メール自動送信の可否を整理する必要。",
            q="第2回トランスクリプト未添付。第1回：社外秘ファイルやSalesforce取得、メール下書き・送付可否が論点。",
            a="管理ツール化の色が強くCopilot Studioで作りやすい一方、社外秘・共有サーバ・Salesforce等の扱いは事務局判断が必要。",
            nxt="まずメール検知→管理表反映→下書き作成までを対象に絞り、ファイルサーバ処理は別論点化。"),
    10: dict(title="議事録ドラフト生成", diff="中", mentor="中村",
             work="対面クライテリア議事録ドラフト生成／資料・トランスクリプト・出席者情報から議事録を生成",
             apps="Copilot Studio／Teamsトランスクリプト／SharePoint／議事録フォーマット／Word（想定）",
             risk="トランスクリプト取得権限、会議形式・ライセンス、フォーマット転記の精度検証が必要。",
             q="第2回：Copilot Chatの回答をそのまま信じてよいか、今後のメンター定例の進め方を確認。",
             a="Copilot回答は必ず正解とは限らないため、根拠提示を求め画面操作・実検証で確認。8〜9月はメンター定例で伴走予定。",
             nxt="サンプル会議資料・トランスクリプト・議事録テンプレを用意し、ドラフト生成品質を確認。"),
    11: dict(title="社内LAN問合せBot", diff="中〜高", mentor="甲佐",
             work="社内LAN問い合わせチャットボット／FAQ・申請種別案内の一次受付",
             apps="Copilot Studio／SharePointナレッジ／TeamsまたはチャットUI／FAQ整備",
             risk="FAQ整備、参照先ナレッジの品質、本番環境移行、利用ルール・運用保守が焦点。",
             q="第2回：開発環境から本番環境への移行、年度末展開、手順書・利用ルールを社長報告までに完了すべきか。",
             a="手順書は完成していれば望ましいが10月時点では準備中でも可。項目出しと全量把握が重要。本番移行は社内申請フローを要確認。",
             nxt="FAQをCopilot Studioが処理しやすい形式に整備し、Ph1→Ph2→Ph3展開の運用項目を洗い出す。"),
}


# ==================================================================
# スライド1：目的
# ==================================================================
s = prs.slides.add_slide(BLANK)
header(s, 1, "第2回 事前相談会の目的", "MICROSOFT 365 COPILOT STUDIO 活用ハッカソン")
footer(s)
add_text(s, Inches(0.55), Inches(1.4), Inches(12.2), Inches(0.9),
         "7月22日〜24日に実施した第2回 事前相談会では、第1回後に提出された各チームの企画書を前提に、"
         "構築フェーズへ進むための「進捗確認」「技術論点の整理」「ネクストアクションの明確化」を行った。"
         "本資料では、各チームの状況を一覧・個票で整理し、あわせて難易度・使用アプリの種類・10月発表の見込みを比較整理する。",
         size=13, color=DARK, ls=1.15)

by = Inches(2.6); bh = Inches(2.75); bw = Inches(5.9)
lx = Inches(0.6); rx = lx + bw + Inches(0.4)


def purpose(x, tag, tcol, title, items):
    add_rect(s, x, by, bw, bh, LIGHT)
    add_rect(s, x, by, bw, Inches(0.85), tcol)
    add_text(s, x + Inches(0.32), by + Inches(0.10), bw - Inches(0.6), Inches(0.3),
             tag, size=10.5, color=WHITE, bold=True)
    add_text(s, x + Inches(0.32), by + Inches(0.38), bw - Inches(0.6), Inches(0.4),
             title, size=16, color=WHITE, bold=True)
    ty = by + Inches(1.05)
    for head, body in items:
        add_rect(s, x + Inches(0.32), ty + Inches(0.05), Inches(0.14), Inches(0.14), tcol)
        add_text(s, x + Inches(0.56), ty - Inches(0.05), bw - Inches(0.9), Inches(0.3),
                 head, size=12.5, color=NAVY, bold=True)
        add_text(s, x + Inches(0.56), ty + Inches(0.26), bw - Inches(0.85), Inches(0.55),
                 body, size=11, color=DARK, ls=1.05)
        ty += Inches(0.82)


purpose(lx, "進行面 ｜ PROGRESS", NAVY, "進捗確認・伴走支援",
        [("各チームの進捗状況の確認", "1案の具体化・構築着手に向けた準備度を確認。"),
         ("ネクストアクションの整理", "8月デモ化／9月発表準備／10月役職者向け発表に向け優先順位を明確化。")])
purpose(rx, "技術面 ｜ TECHNOLOGY", TEAL, "適合性・実現可能性の助言",
        [("Copilot Studio／M365アプリの使い分け", "CS・Power Automate・SharePoint・Teams・Forms・Outlook等を助言。"),
         ("実現可能性・制約の早期論点化", "外部Web参照・M365外連携・共有フォルダ・情報区分・本番移行など。")])

add_text(s, Inches(0.6), Inches(5.55), Inches(12.1), Inches(0.5),
         "第2回は「企画書提出後の棚卸し」。特に外部参照禁止・M365外連携・本番移行・手順書整備など、"
         "事務局判断や横断整理が必要な論点が増加。本資料では各チームの難易度・使用アプリの種類も比較整理する。",
         size=11, color=MUTE, ls=1.1)
add_text(s, Inches(0.6), Inches(6.35), Inches(12.1), Inches(0.4),
         "※ 特定案への誘導は行わず、各チームの主体的な意思決定を尊重しながら技術・運用・ガバナンス面の助言を実施。",
         size=10.5, color=MUTE, italic=True)


# ==================================================================
# スライド2：各チーム状況 一覧
# ==================================================================
s = prs.slides.add_slide(BLANK)
header(s, 2, "各チームの状況一覧", "PROGRESS SUMMARY ｜ 全11チーム")
footer(s)
add_text(s, Inches(0.55), Inches(1.28), Inches(12.3), Inches(0.3),
         "全11チームが企画書提出を経て原則1案に整理済み。進捗レベル・難易度・10月発表の見込みとあわせて一覧化。",
         size=11, color=DARK)
add_text(s, Inches(0.55), Inches(1.60), Inches(12.3), Inches(0.5),
         "進捗レベル ▶ Lv1:未絞込／Lv2:2案まで／Lv3:1案確定・理解途上／Lv4:To-Be・アーキ具体化／Lv5:定量効果まで概ね完成"
         "　／　10月見込み ◎:順調 ○:概ね ○ △:要フォロー　（第2回実施済＝1・2・3・4・5・10・11）",
         size=9, color=MUTE, ls=1.1)

tx = Inches(0.55); ty0 = Inches(2.16); rowh = Inches(0.415); hh = Inches(0.36)
t = s.shapes.add_table(12, 6, tx, ty0, Inches(12.25), Inches(5.0)).table
cw = [Inches(0.55), Inches(2.0), Inches(3.1), Inches(3.95), Inches(0.9), Inches(1.75)]
for i, w in enumerate(cw):
    t.columns[i].width = w
for c, htx in enumerate(["チーム", "進捗レベル", "案概要（エージェント名）",
                         "第2回の主な論点・相談", "難易度", "10月発表 見込み"]):
    cell(t.cell(0, c), htx, size=9.5, color=WHITE, bold=True, fill=NAVY, align=PP_ALIGN.CENTER)
rh(t, 0, hh)
fc_word = {"◎": "◎ 順調", "○": "○ 概ね順調", "△": "△ 要フォロー"}
for i, (no, lv, name, diff, mt, topic, done) in enumerate(overview, start=1):
    rf = WHITE if i % 2 else LIGHT
    cell(t.cell(i, 0), f"T{no}", size=10.5, color=NAVY, bold=True, fill=rf, align=PP_ALIGN.CENTER)
    cell(t.cell(i, 1), "", fill=rf)
    cell(t.cell(i, 2), name, size=8.8, color=DARK, bold=True, fill=rf)
    cell(t.cell(i, 3), topic, size=8.5, color=(MUTE if not done else DARK), fill=rf)
    cell(t.cell(i, 4), diff, size=9.5, color=diff_color(diff), bold=True, fill=rf, align=PP_ALIGN.CENTER)
    fc = forecast[no]
    cell(t.cell(i, 5), fc_word[fc], size=9, color=fc_color(fc), bold=True, fill=rf, align=PP_ALIGN.CENTER)
    rh(t, i, rowh)
# 進捗レベル矢印を重ねる
cx0 = tx + cw[0] + Inches(0.12)
for i, (no, lv, *_r) in enumerate(overview, start=1):
    yc = ty0 + hh + rowh * (i - 1) + rowh / 2
    chevrons(s, cx0, yc, lv, on=tier(lv))
    add_text(s, cx0 + Inches(0.24) * 5 + Inches(0.03), yc - Inches(0.11),
             Inches(0.5), Inches(0.24), f"Lv{lv}", size=8.5,
             color=tier(lv), bold=True, anchor=MSO_ANCHOR.MIDDLE)


# ==================================================================
# スライド3：難易度・使用アプリの比較（メンター担当検討の材料）
# ==================================================================
s = prs.slides.add_slide(BLANK)
header(s, 3, "難易度・使用アプリの比較", "DIFFICULTY & APPS ｜ チーム別比較")
footer(s)
add_text(s, Inches(0.55), Inches(1.22), Inches(12.3), Inches(0.42),
         "各チームの使用アプリを列（アプリ別）で可視化し、難易度・アプリ数（ボリューム）とあわせて比較（メンター担当検討の材料）。"
         "色タイル＝使用アプリ。全チームがCopilot Studioを使用。",
         size=10, color=DARK, ls=1.1)

tx = Inches(0.55); ty0 = Inches(1.76); rowh = Inches(0.37); hh = Inches(0.52)
ncol = 4 + len(APP_COLS)   # チーム,案概要,難易度 + apps + アプリ数
t = s.shapes.add_table(12, ncol, tx, ty0, Inches(12.25), Inches(4.6)).table
cw = [Inches(0.5), Inches(1.95), Inches(0.7)] + [Inches(0.85)] * len(APP_COLS) + [Inches(0.6)]
for i, w in enumerate(cw):
    t.columns[i].width = w
# ヘッダー
cell(t.cell(0, 0), "チーム", size=8.5, color=WHITE, bold=True, fill=NAVY, align=PP_ALIGN.CENTER)
cell(t.cell(0, 1), "案概要", size=8.5, color=WHITE, bold=True, fill=NAVY, align=PP_ALIGN.CENTER)
cell(t.cell(0, 2), "難易度", size=8.5, color=WHITE, bold=True, fill=NAVY, align=PP_ALIGN.CENTER)
for j, (key, label, col, tc) in enumerate(APP_COLS):
    cell(t.cell(0, 3 + j), label, size=7, color=tc, bold=True, fill=col, align=PP_ALIGN.CENTER)
cell(t.cell(0, ncol - 1), "アプリ\n数", size=7.5, color=WHITE, bold=True, fill=NAVY, align=PP_ALIGN.CENTER)
rh(t, 0, hh)
for i, (no, lv, name, diff, mt, topic, done) in enumerate(overview, start=1):
    rf = WHITE if i % 2 else LIGHT
    cell(t.cell(i, 0), f"T{no}", size=9.5, color=NAVY, bold=True, fill=rf, align=PP_ALIGN.CENTER)
    cell(t.cell(i, 1), name.split("（")[0], size=8, color=DARK, bold=True, fill=rf)
    cell(t.cell(i, 2), diff, size=9, color=diff_color(diff), bold=True, fill=rf, align=PP_ALIGN.CENTER)
    used = app_use[no]
    for j, (key, label, col, tc) in enumerate(APP_COLS):
        if key in used:
            cell(t.cell(i, 3 + j), "●", size=9, color=tc, bold=True, fill=col, align=PP_ALIGN.CENTER)
        else:
            cell(t.cell(i, 3 + j), "", size=8, fill=rf)
    cell(t.cell(i, ncol - 1), str(len(used)), size=9.5, color=NAVY, bold=True, fill=rf, align=PP_ALIGN.CENTER)
    rh(t, i, rowh)
# 下部：凡例
sy = ty0 + hh + rowh * 11 + Inches(0.12)
add_rect(s, tx, sy, Inches(12.25), Inches(0.5), LIGHT)
add_text(s, tx + Inches(0.25), sy + Inches(0.01), Inches(11.8), Inches(0.48),
         "●＝使用アプリ（列見出しの色が各アプリ）。「アプリ数」＝使用アプリの種類数（実装ボリュームの目安）。"
         "難易度・見込みは暫定評価・要調整。",
         size=9, color=DARK, anchor=MSO_ANCHOR.MIDDLE)


# ==================================================================
# スライド4：課題カテゴライズ
# ==================================================================
s = prs.slides.add_slide(BLANK)
header(s, 4, "質疑で挙がった課題の整理", "ISSUE CATEGORIZATION ｜ 横断的な論点")
footer(s)
add_text(s, Inches(0.55), Inches(1.26), Inches(12.3), Inches(0.35),
         "第2回の相談会（チーム1・2・3・4・5・10・11）で実際に挙がった論点のみを整理。構築に向けた具体的な進め方・制約・展開に関する相談が中心。",
         size=11, color=DARK)
cats = [
    ("外部サイト参照・Web検索の制約／案の再設計",
     "外部Web・IR情報の取得は原則禁止（相手先サーバ負荷・訴訟リスク）。抵触する案は練り直しが必要。代替は事前取得してナレッジ化。", "3, 4"),
    ("開発の進め方・基本フォーマット／スケジュール提示",
     "何を優先しどの手順で進めるかの基本フォーマットが欲しい。8〜9月のスケジュール案内の要望。", "1, 5"),
    ("設計相談の進め方・プロンプト見本",
     "成果物の作り方・使うアプリ・設定をCopilotチャットで相談する型と、プロンプト見本の提供要望。", "1, 2"),
    ("8月デモ設計・効果の見極め",
     "タスク列を仮決め→サンプル数件→Automateで一本通すMVP。整形/ドラフトのみで効果が出るかの見極め。", "4, 5"),
    ("Copilot回答の信頼性・検証",
     "Copilotチャットの回答をそのまま信じてよいか。根拠提示を求め、画面操作・実検証で精度を確認。", "10"),
    ("本番環境移行・展開時期・社内申請フロー",
     "開発環境→本番環境移行の申請/決裁フロー、年度末（3月末）展開を見据えたスピード感・フェーズ設定。", "11"),
    ("手順書・利用ルール／運用保守",
     "手順書・利用ルールの整備時期（項目出し・全量把握が重要）。Copilot Studio更新に伴う運用保守の懸念。", "5, 11"),
    ("メンター制・今後の進め方",
     "8月以降のメンター定例（週次/隔週）の進め方を事務局から案内予定。", "2, 10"),
]
tx = Inches(0.55); ty0 = Inches(1.7)
t = s.shapes.add_table(len(cats) + 1, 3, tx, ty0, Inches(12.25), Inches(3.5)).table
for i, w in enumerate([Inches(4.1), Inches(6.45), Inches(1.7)]):
    t.columns[i].width = w
for c, htx in enumerate(["カテゴリ（第2回で挙がった論点）", "主な内容", "該当チーム"]):
    cell(t.cell(0, c), htx, size=10, color=WHITE, bold=True, fill=TEAL, align=PP_ALIGN.CENTER)
rh(t, 0, Inches(0.34))
for i, (cat, pt, tms) in enumerate(cats, start=1):
    rf = WHITE if i % 2 else LIGHT
    cell(t.cell(i, 0), cat, size=9.3, color=NAVY, bold=True, fill=rf)
    cell(t.cell(i, 1), pt, size=8.8, color=DARK, fill=rf)
    cell(t.cell(i, 2), tms, size=9, color=DARK, bold=True, fill=rf, align=PP_ALIGN.CENTER)
    rh(t, i, Inches(0.38))
cy = ty0 + Inches(0.34) + Inches(0.38) * len(cats) + Inches(0.12)
add_rect(s, tx, cy, Inches(12.25), Inches(0.62), RGBColor(0xFC, 0xF1, 0xE6))
add_rect(s, tx, cy, Inches(0.13), Inches(0.62), ORANGE)
add_text(s, tx + Inches(0.3), cy + Inches(0.03), Inches(11.7), Inches(0.58),
         "▲ 重要：外部Web参照・M365外システム連携・個人情報/機密情報の取り扱いはガイドライン上の制約がある。"
         "これらに依存する案は抵触時に再設計が必要となるため、可否は早めに事務局へ確認を（第2回ではチーム3・4が該当）。",
         size=10.5, color=DARK, bold=True, anchor=MSO_ANCHOR.MIDDLE, ls=1.05)


# ==================================================================
# スライド5：全体総括＋スケジュール
# ==================================================================
s = prs.slides.add_slide(BLANK)
header(s, 5, "全体総括", "OVERALL ASSESSMENT")
footer(s)
add_rect(s, Inches(0.55), Inches(1.35), Inches(12.25), Inches(1.15), NAVY)
add_text(s, Inches(0.9), Inches(1.5), Inches(11.6), Inches(0.85),
         "第1回→第2回で「未集約」チームは解消し、各チームが構築フェーズの具体論点へ移行。"
         "一方、外部Web参照・M365外連携・ファイル格納場所など、実装前に事務局判断が必要な論点が明確化した。",
         size=13.5, color=WHITE, bold=True, ls=1.18, anchor=MSO_ANCHOR.MIDDLE)
cy = Inches(2.78); ch = Inches(2.65); cwd = Inches(3.95)
xs = [Inches(0.55), Inches(4.7), Inches(8.85)]


def scol(x, tcol, title, bullets):
    add_rect(s, x, cy, cwd, ch, LIGHT)
    add_rect(s, x, cy, cwd, Inches(0.55), tcol)
    add_text(s, x + Inches(0.22), cy + Inches(0.08), cwd - Inches(0.44), Inches(0.4),
             title, size=13, color=WHITE, bold=True, anchor=MSO_ANCHOR.MIDDLE)
    yy = cy + Inches(0.72)
    for b in bullets:
        add_rect(s, x + Inches(0.22), yy + Inches(0.06), Inches(0.1), Inches(0.1), tcol)
        add_text(s, x + Inches(0.42), yy - Inches(0.04), cwd - Inches(0.6), Inches(0.7),
                 b, size=10, color=DARK, ls=1.05)
        yy += Inches(0.62)


scol(xs[0], GREEN, "先行・順調なチーム",
     ["T5：業務フロー・効果試算・M365標準活用が具体化。8月デモ化に着手可能。",
      "T7：固定ナレッジ＋入力ファイル照合の構成が明確。",
      "T10・11：構成・前提は見えており、権限・運用項目の洗い出しが次フェーズ。"])
scol(xs[1], AMBER, "フォローが必要なチーム",
     ["T4：外部Web参照禁止で企画価値の中核が揺らぎ、再設計が必要。",
      "T3・9：Salesforce・社外秘・外部/共有サーバ等の扱いが重要論点。",
      "T1・2・6：構築ステップ・プロンプト例・アプリ使い分けの具体化支援が必要。"])
scol(xs[2], TEAL, "事務局からの提言",
     ["ガバナンス判断を早めに（外部Web・M365外連携・社外秘ファイル読込）。",
      "8月は「一本通るデモ」優先。入力→処理→出力の流れを示す。",
      "9月は発表資料・削減効果・運用項目・手順書/利用ルールの棚卸し。"])

# 下部：スケジュール
add_text(s, Inches(0.55), Inches(5.62), Inches(6.0), Inches(0.3),
         "全体スケジュール", size=12, color=NAVY, bold=True)
steps = [("7/9〜13", "事前相談会①", TEAL), ("〜7/17", "企画書提出", NAVY),
         ("7/22〜24", "事前相談会②（今回）", ORANGE), ("8月", "構築・デモ化", NAVY),
         ("9月", "発表準備・運用整理", NAVY), ("10月", "最終発表", NAVY_DARK)]
tly = Inches(5.95); tlh = Inches(0.58); stw = Inches(2.18); stdx = Inches(2.03)
for idx, (d, lb, col) in enumerate(steps):
    x = Inches(0.55) + stdx * idx
    sp = s.shapes.add_shape(MSO_SHAPE.CHEVRON, x, tly, stw, tlh)
    set_fill(sp, col)
    tf = sp.text_frame; tf.word_wrap = True
    tf.margin_left = Pt(10); tf.margin_right = Pt(6)
    tf.margin_top = Pt(1); tf.margin_bottom = Pt(1)
    p = tf.paragraphs[0]; p.alignment = PP_ALIGN.CENTER
    r = p.add_run(); r.text = d; r.font.size = Pt(10.5); r.font.bold = True
    r.font.name = FONT; r.font.color.rgb = WHITE
    p2 = tf.add_paragraph(); p2.alignment = PP_ALIGN.CENTER
    r2 = p2.add_run(); r2.text = lb; r2.font.size = Pt(8); r2.font.name = FONT
    r2.font.color.rgb = WHITE


# ==================================================================
# スライド6〜16：各チーム詳細
# ==================================================================
def detail_slide(no, idx):
    d = detail[no]
    ov = overview[no - 1]
    lv = ov[1]
    s = prs.slides.add_slide(BLANK)
    header(s, idx, f"チーム{no}：{d['title']}", f"TEAM {no} DETAIL ｜ 状況整理")
    footer(s)
    # ステータス帯
    sy = Inches(1.35)
    pill(s, Inches(0.55), sy, Inches(1.35), Inches(0.42), "1案 絞込済", GREEN)
    add_text(s, Inches(2.05), sy - Inches(0.02), Inches(0.9), Inches(0.45),
             "進捗", size=10, color=MUTE, bold=True, anchor=MSO_ANCHOR.MIDDLE)
    chevrons(s, Inches(2.62), sy + Inches(0.21), lv, w=Inches(0.30),
             h=Inches(0.18), step=Inches(0.27), on=tier(lv))
    add_text(s, Inches(2.62) + Inches(0.27) * 5 + Inches(0.05), sy - Inches(0.02),
             Inches(0.7), Inches(0.45), f"Lv{lv}", size=11, color=tier(lv),
             bold=True, anchor=MSO_ANCHOR.MIDDLE)
    pill(s, Inches(4.5), sy, Inches(1.7), Inches(0.42),
         f"難易度：{d['diff']}", diff_color(d['diff']))
    fc = forecast[no]
    pill(s, Inches(6.35), sy, Inches(2.4), Inches(0.42),
         f"10月見込み：{fc}", fc_color(fc))
    done = ov[6]
    pill(s, Inches(8.9), sy, Inches(3.5), Inches(0.42),
         ("第2回：実施済" if done else "第2回：未実施（第1回＋企画書）"),
         (NAVY if done else MUTE))

    # 3カード
    r1y = Inches(2.0); r1h = Inches(1.72); cwd = Inches(3.93); gap = Inches(0.23)
    cols = [Inches(0.55), Inches(0.55) + cwd + gap, Inches(0.55) + (cwd + gap) * 2]
    cards1 = [("取り組み内容", d['work'], NAVY),
              ("使用アプリ・データ", d['apps'], TEAL),
              ("リスク・論点", d['risk'], ORANGE)]
    for (title, body, col), cx in zip(cards1, cols):
        add_rect(s, cx, r1y, cwd, r1h, LIGHT)
        add_rect(s, cx, r1y, cwd, Inches(0.4), col)
        add_text(s, cx + Inches(0.18), r1y + Inches(0.05), cwd - Inches(0.36), Inches(0.3),
                 title, size=11, color=WHITE, bold=True, anchor=MSO_ANCHOR.MIDDLE)
        add_text(s, cx + Inches(0.18), r1y + Inches(0.5), cwd - Inches(0.36), r1h - Inches(0.6),
                 body, size=10, color=DARK, ls=1.12)

    # 2カード（質問／回答）
    r2y = Inches(3.9); r2h = Inches(1.5); cwd2 = Inches(6.02)
    cards2 = [("主な質問・相談", d['q'], NAVY),
              ("回答・助言", d['a'], TEAL)]
    cols2 = [Inches(0.55), Inches(0.55) + cwd2 + Inches(0.2)]
    for (title, body, col), cx in zip(cards2, cols2):
        add_rect(s, cx, r2y, cwd2, r2h, LIGHT)
        add_rect(s, cx, r2y, cwd2, Inches(0.4), col)
        add_text(s, cx + Inches(0.18), r2y + Inches(0.05), cwd2 - Inches(0.36), Inches(0.3),
                 title, size=11, color=WHITE, bold=True, anchor=MSO_ANCHOR.MIDDLE)
        add_text(s, cx + Inches(0.18), r2y + Inches(0.48), cwd2 - Inches(0.36), r2h - Inches(0.58),
                 body, size=9.8, color=DARK, ls=1.1)

    # ネクストアクション
    ny = Inches(5.58); nh = Inches(0.95)
    add_rect(s, Inches(0.55), ny, Inches(12.25), nh, RGBColor(0xE8, 0xEE, 0xF4))
    add_rect(s, Inches(0.55), ny, Inches(0.13), nh, NAVY)
    add_text(s, Inches(0.8), ny + Inches(0.08), Inches(11.8), Inches(0.3),
             "ネクストアクション", size=11, color=NAVY, bold=True)
    add_text(s, Inches(0.8), ny + Inches(0.4), Inches(11.8), Inches(0.5),
             d['nxt'], size=10.5, color=DARK, ls=1.08)


for k, no in enumerate(range(1, 12)):
    detail_slide(no, 6 + k)

prs.save("/home/user/awc-naka881-repo/reports/CopilotStudio_ハッカソン_事前相談会②_状況報告_20260724.pptx")
print("saved OK / slides:", len(prs.slides._sldIdLst))
