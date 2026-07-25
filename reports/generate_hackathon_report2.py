# -*- coding: utf-8 -*-
"""
Copilot Studio 活用ハッカソン 第2回 事前相談会 チームごとの状況報告
顧客（事務局）との会議資料として、表紙／サマリ（結論先出し）／一覧／比較／課題／
セクション区切り／各チーム個票の構成で生成する。
- 専門用語は会議で口頭説明しやすい平易な表現に統一
- 進捗は5段階に「意味の分かる名称」を併記（Lv番号だけにしない）
- メンター割当は行わず、難易度・使用アプリ（想定）・ボリュームのみ提示
- 課題は第2回トランスクリプトで実際に挙がった論点のみ／大きく3点に集約
チームメンバーの個人名は不使用。
"""
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

# ---- パレット ----
NAVY      = RGBColor(0x1F, 0x38, 0x5C)
NAVY_DARK = RGBColor(0x14, 0x25, 0x3D)
TEAL      = RGBColor(0x2E, 0x8B, 0x9E)
ORANGE    = RGBColor(0xE8, 0x83, 0x3A)
LIGHT     = RGBColor(0xF2, 0xF4, 0xF7)
DARK      = RGBColor(0x25, 0x2A, 0x31)
WHITE     = RGBColor(0xFF, 0xFF, 0xFF)
GREEN     = RGBColor(0x3F, 0x8F, 0x5B)
AMBER     = RGBColor(0xC9, 0x8A, 0x1B)
RED       = RGBColor(0xB0, 0x3A, 0x2E)
MUTE      = RGBColor(0x6B, 0x74, 0x80)
PALE      = RGBColor(0xBF, 0xD3, 0xE0)
CHEV_OFF  = RGBColor(0xDD, 0xE1, 0xE7)

FONT = "Meiryo"

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
SW, SH = prs.slide_width, prs.slide_height
BLANK = prs.slide_layouts[6]
TOTAL = 18


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
    add_rect(s, 0, 0, SW, Inches(1.08), NAVY)
    add_text(s, Inches(0.55), Inches(0.13), Inches(9.6), Inches(0.3),
             kicker, size=10, color=PALE, bold=True)
    add_text(s, Inches(0.52), Inches(0.40), Inches(11.2), Inches(0.6),
             title, size=23, color=WHITE, bold=True, anchor=MSO_ANCHOR.MIDDLE)
    if no:
        add_text(s, Inches(11.9), Inches(0.13), Inches(1.15), Inches(0.35),
                 f"{no} / {TOTAL}", size=11, color=PALE, bold=True, align=PP_ALIGN.RIGHT)


def footer(s):
    add_text(s, Inches(0.55), SH - Inches(0.42), Inches(9.0), Inches(0.3),
             "Microsoft 365 Copilot Studio 活用ハッカソン｜第2回 事前相談会 状況報告（2026年7月22日〜24日 実施）",
             size=8.5, color=MUTE, anchor=MSO_ANCHOR.MIDDLE)
    add_text(s, SW - Inches(3.2), SH - Inches(0.42), Inches(2.65), Inches(0.3),
             "社外秘 / Confidential", size=8.5, color=MUTE,
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
        p.alignment = align; p.line_spacing = 0.96
        r = p.add_run(); r.text = line
        r.font.size = Pt(size); r.font.bold = bold
        r.font.name = FONT; r.font.color.rgb = color


def rh(t, i, h):
    t.rows[i].height = h


def pill(s, x, y, w, h, text, fill, tcolor=WHITE, size=9.5, bold=True):
    sp = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, h)
    set_fill(sp, fill)
    tf = sp.text_frame; tf.word_wrap = True
    tf.margin_left = Pt(4); tf.margin_right = Pt(4)
    tf.margin_top = Pt(1); tf.margin_bottom = Pt(1)
    p = tf.paragraphs[0]; p.alignment = PP_ALIGN.CENTER
    r = p.add_run(); r.text = text
    r.font.size = Pt(size); r.font.bold = bold; r.font.name = FONT
    r.font.color.rgb = tcolor
    return sp


def chevrons(s, x0, y_center, level, w=Inches(0.26), h=Inches(0.16),
             step=Inches(0.235), on=TEAL):
    for k in range(5):
        col = on if k < level else CHEV_OFF
        sp = s.shapes.add_shape(MSO_SHAPE.CHEVRON, x0 + step * k,
                                y_center - h / 2, w, h)
        set_fill(sp, col)


def tier(level):
    return GREEN if level >= 5 else TEAL if level >= 3 else AMBER


def diff_color(d):
    return TEAL if d == "中" else RED if d == "高" else AMBER


def fc_color(m):
    return GREEN if m == "◎" else TEAL if m == "○" else AMBER


def vol_color(v):
    return TEAL if v == "中" else AMBER if v == "中〜大" else ORANGE


# ==================================================================
# データ
# ==================================================================
# 進捗5段階：番号だけでなく「意味の分かる名称」を併記して口頭説明しやすくする
STAGE = {1: "案の絞り込み中", 2: "2案から選定中", 3: "1案確定",
         4: "設計まで具体化", 5: "効果試算まで完了"}
STAGE_NO = {1: "①", 2: "②", 3: "③", 4: "④", 5: "⑤"}
# 一覧表（列幅が狭い箇所）用の短縮表記。正式名は同スライドの凡例に記載
STAGE_SHORT = {1: "絞り込み中", 2: "2案選定中", 3: "1案確定",
               4: "設計具体化", 5: "効果試算済"}

# (チーム番号, 進捗段階, 案概要, 難易度, 第2回の主な論点, 第2回実施済み)
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

# 使用アプリ（想定）の列定義：key, 2行ラベル, 色, 文字色
APP_COLS = [
    ("CS",  "Copilot\nStudio", RGBColor(0x74, 0x5C, 0xA6), WHITE),
    ("PA",  "Power\nAutomate", RGBColor(0x0B, 0x72, 0xC4), WHITE),
    ("SP",  "Share\nPoint",    RGBColor(0x03, 0x6C, 0x70), WHITE),
    ("Tm",  "Teams",           RGBColor(0x4B, 0x53, 0xBC), WHITE),
    ("OL",  "Outlook",         RGBColor(0x0A, 0x6F, 0xC2), WHITE),
    ("Fm",  "Forms",           RGBColor(0x1F, 0x8A, 0x70), WHITE),
    ("BI",  "Power\nBI",       RGBColor(0xC9, 0x9A, 0x06), WHITE),
    ("Xl",  "Excel",           RGBColor(0x21, 0x73, 0x46), WHITE),
    ("WP",  "Word/\nPPT",      RGBColor(0xB0, 0x47, 0x2A), WHITE),
    ("Ext", "外部/\nその他",   RGBColor(0x6B, 0x72, 0x80), WHITE),
]
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
# 主な制約・留意（メンター検討の材料。短文）
constraint = {
    1: "M365内で完結／判定基準の作り込みが要",
    2: "FAQ・ガイドの整備が前提",
    3: "外部Web・営業システム等の取得制約が大",
    4: "外部Web禁止のため案の再設計が必要",
    5: "M365標準のみ／制約は小さい",
    6: "共有サーバ参照・資料自動生成の検証が要",
    7: "外部連携なし（データは人手取得が前提）",
    8: "予定表・会議室・メールの権限整備が要",
    9: "社外秘資料・共有サーバ・メール送信の可否",
    10: "文字起こしの取得権限・転記精度の検証",
    11: "本番移行・FAQ品質・運用保守が焦点",
}
# ボリューム＝企画着手〜実業務での利用開始（リリース）までの総作業量
volume = {1: "中", 2: "中", 3: "大", 4: "中〜大", 5: "中", 6: "大",
          7: "中", 8: "中", 9: "大", 10: "中", 11: "大"}

# 10月発表の見込み（基準＝発表に向けた道筋の明確さ／自走できるか）
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

# 各チーム個票
detail = {
    1: dict(title="加盟店提出様式の自動チェック", agent="カクニンジャ",
            work="加盟店から提出される様式の記載漏れ・形式不備をAIがチェックする。",
            apps="Copilot Studio ／ Copilot チャット ／ Excel ／ SharePoint（想定）",
            risk="AIの判定結果にばらつきが出る可能性。判定基準と「AIに任せる範囲／人が確認する範囲」の切り分けが必要。",
            q="第2回：構築フェーズで何を優先すべきか。開発手順の型（基本フォーマット）と8〜9月のスケジュール提示が欲しい。",
            a="8〜9月の進め方は事務局から共有する方針。Copilot Studioは通常のチャットより回答範囲・出力形式を制御しやすい点が利点。",
            nxt="チェック項目を分解し、AI判断・自動化・人の確認の境界を設計。サンプル様式で結果の再現性を確認する。"),
    2: dict(title="受付Cエラーの原因案内", agent="受付Cエラー原因ナビゲーター",
            work="カード会社が受付エラーの原因を自分で解決できるよう、AIが原因と対処を案内する。",
            apps="Copilot Studio ／ SharePoint ／ Teams・Web画面 ／ Power Automate（想定）",
            risk="エラーファイルの取り込み形式と、回答の根拠となるFAQ・ガイドの整備状況が成否を左右する。",
            q="第2回：Copilotに設計や成果物を相談するときの指示文（プロンプト）の見本が欲しい。",
            a="企画内容をそのまま貼り付け、「必要な設定・使うべきアプリ・構成案」を尋ねる進め方を助言。ファイル形式は試して見極める。",
            nxt="代表的なエラーパターンと回答テンプレートを絞り、最初に作る範囲の入力・出力例を用意する。"),
    3: dict(title="加盟店防衛マネジメント支援", agent="加盟店防衛マネジメントエージェント",
            work="営業データを統合し、リスク分析や訪問前のサマリをAIが作成する。",
            apps="Power Automate ／ Power Query ／ SharePoint ／ Power BI ／ Copilot Studio ／ 営業システム等（取得可否が論点）",
            risk="外部情報・営業システムからの取得制約が大きい。使うデータを洗い出し、可否の判断を得る必要がある。",
            q="第2回：外部のIR情報等を参照したいが、外部情報の参照禁止によるリスクと代替策を知りたい。",
            a="外部サイトの自動参照は相手先サーバへの負荷などの観点から原則不可。必要な資料は事前に取得し参照資料として登録する方法が現実的。",
            nxt="使うデータを「M365内／M365外／外部Web」に分類し、最初に作る範囲を再定義する。"),
    4: dict(title="市場・企業分析", agent="市場・企業分析エージェント",
            work="企業名やキーワードを起点に、調査結果の整理と提案書のドラフトをAIが作成する。",
            apps="Copilot Studio ／ Power Automate ／ SharePoint ／ Teams ／ Word・PowerPoint（外部Web・RSS・APIは原則不可）",
            risk="企画の中心が外部情報の取得であるため、今回の条件下では実装できる効果が大きく下がる。",
            q="第2回：外部サイトからの情報取得が原則禁止となり、現在の案がガイドラインに抵触する可能性を確認したい。",
            a="Web検索が主機能となる場合は案の練り直しが必要。手元の資料を整えてドラフト化するだけで効果が出るかを検討するよう助言。",
            nxt="外部参照なしで成立する使い方に再設計する（過去の調査結果や社内資料をもとにした整理など）。"),
    5: dict(title="依頼事項の自動リマインド", agent="おはようリマインドくん",
            work="依頼事項の登録・通知・回答集約・未回答者へのリマインドを自動化する。",
            apps="Copilot Studio ／ Microsoft Forms ／ Power Automate ／ Teams ／ 管理ダッシュボード",
            risk="運用の定着と、依頼元の入力ルールが鍵。リマインドの設計と回答形式の標準化が必要。",
            q="第2回：管理表の項目立てをどう始めるか。Copilot Studioの更新に伴う保守リスクも知りたい。",
            a="まず項目を仮決めし、3件程度のサンプルで Power Automate から一連の流れを通す。更新による不具合は運用保守の観点で考慮が必要。",
            nxt="「依頼1件の登録→対象者へ通知→回答集約→未回答リマインド」を8月中に動くデモにする。"),
    6: dict(title="会議資料作成と会議招集の自動化", agent="Forecast ONE",
            work="フォーキャスト会議の資料作成と、会議の招集をあわせて自動化する。",
            apps="Copilot Studio ／ Power Automate ／ SharePoint・OneDrive ／ Outlook ／ Teams ／ PowerPoint",
            risk="資料の保管場所、資料の自動生成、会議招集の自動化は、それぞれ分けて実現性を検証する必要がある。",
            q="第2回は未実施。第1回では Power Automate と Copilot Studio の違い、研修の予定、困ったときの相談先を確認。",
            a="Power AutomateはAIではなく自動化の道具だが、時間削減には重要。資料収集・資料生成・会議通知の役割分担を明確にする必要がある。",
            nxt="3つの入力資料・前月資料・出力資料・会議通知について、データの流れをM365内で整理する。"),
    7: dict(title="加盟店課金精算のチェック", agent="加盟店課金精算チェックエージェント",
            work="請求データと関連システムのデータを突き合わせ、差異をAIがチェックする。",
            apps="Copilot Studio ／ SharePoint ／ Excel または CSV ／ 人手で取得したデータ",
            risk="外部システムと直接つながず人手取得データを前提とするため、ファイル名やフォルダ構成の維持が前提条件になる。",
            q="第2回は未実施。第1回では、判断基準と毎月の入力ファイルを分ける構成について確認。",
            a="固定のチェックリストを判断基準として登録し、毎月の入力ファイルは都度読み込んで照合・修正出力する構成は実現しやすい。",
            nxt="まず3種類程度のデータと固定のチェック項目で、突合結果のレポートを作成する。"),
    8: dict(title="会議調整・タスク整理の支援", agent="段取（Dandori）AI",
            work="会議の調整、タスクの洗い出し、レビュー観点の蓄積をAIが支援する。",
            apps="Copilot Studio ／ Power Automate ／ Outlook ／ Teams ／ SharePoint",
            risk="予定表・会議室・メールへのアクセス権限、対象者リストの整備が必要。",
            q="第2回は未実施。第1回では、発表する1案以外の案も並行して進めてよいかを確認。",
            a="発表は1案だが、2案目を並行して進めることは問題ない。会議調整・タスク洗い出しを主軸に、レビュー観点の蓄積は付加価値と整理。",
            nxt="会議調整とタスク洗い出しのどちらを中心にするか決め、デモの筋書きを1本作る。"),
    9: dict(title="レビュー進捗の管理", agent="レビュー進捗管理アシスタント",
            work="レビュー対象の一覧化、依頼、完了確認、リマインドまでを自動化する。",
            apps="Copilot Studio ／ Power Automate ／ Outlook ／ Excel ／ Teams ／ 共有ファイルサーバ（制約あり）",
            risk="開発中案件・社外秘情報の扱い、共有サーバの参照、メール自動送信の可否を整理する必要がある。",
            q="第2回は未実施。第1回では、社外秘ファイルや外部システムからの取得、メールの下書き・送付可否が論点。",
            a="管理ツールとしての性格が強くCopilot Studioで作りやすい一方、社外秘・共有サーバ・外部システムの扱いは事務局の判断が必要。",
            nxt="まずメール検知→管理表への反映→下書き作成までに絞り、共有サーバの処理は別課題として切り出す。"),
    10: dict(title="対面会議の議事録ドラフト生成", agent="議事録ドラフト生成エージェント",
            work="会議資料・文字起こし・出席者情報から、議事録のドラフトをAIが作成する。",
            apps="Copilot Studio ／ Teams の文字起こし ／ SharePoint ／ 議事録フォーマット ／ Word（想定）",
            risk="文字起こしの取得権限、会議形式やライセンス、決まった書式への転記精度の検証が必要。",
            q="第2回：Copilotチャットの回答をそのまま信じて進めてよいか。今後の定例の進め方も知りたい。",
            a="Copilotの回答は必ず正解とは限らないため、根拠の提示を求め、実際の画面操作で確認する。8〜9月は定例で伴走予定。",
            nxt="サンプルの会議資料・文字起こし・議事録テンプレートを用意し、ドラフトの品質を確認する。"),
    11: dict(title="社内LAN問い合わせチャットボット", agent="社内LAN問い合わせチャットボット",
             work="社内LANに関するFAQや申請種別の案内を、チャットボットが一次受付する。",
             apps="Copilot Studio ／ SharePoint（参照資料） ／ Teams またはチャット画面 ／ FAQ",
             risk="FAQの整備状況と参照資料の品質、本番環境への移行、利用ルールと運用保守が焦点。",
             q="第2回：開発環境から本番環境への移行、年度末の展開、手順書・利用ルールを社長報告までに完成させるべきか。",
             a="手順書は完成していれば望ましいが、10月時点では準備中でも可。項目の洗い出しと全体量の把握が重要。本番移行は社内の申請フローを要確認。",
             nxt="FAQをCopilot Studioが扱いやすい形に整備し、段階展開（第1〜第3フェーズ）の運用項目を洗い出す。"),
}


# ==================================================================
# スライド1：表紙
# ==================================================================
s = prs.slides.add_slide(BLANK)
add_rect(s, 0, 0, SW, SH, NAVY_DARK)
add_rect(s, Inches(1.0), Inches(2.42), Inches(1.5), Inches(0.06), TEAL)
add_text(s, Inches(1.0), Inches(1.85), Inches(11.0), Inches(0.4),
         "MICROSOFT 365 COPILOT STUDIO 活用ハッカソン", size=12, color=TEAL, bold=True)
add_text(s, Inches(0.96), Inches(2.68), Inches(11.4), Inches(1.5),
         "第2回 事前相談会\nチームごとの状況報告",
         size=36, color=WHITE, bold=True, ls=1.16)
add_text(s, Inches(1.0), Inches(4.55), Inches(11.0), Inches(0.75),
         "全11チームの進捗状況・使用アプリ・難易度／10月発表に向けた見込みと課題",
         size=13.5, color=PALE, ls=1.2)
add_text(s, Inches(1.0), Inches(6.1), Inches(6.0), Inches(0.3),
         "実施日：2026年7月22日（水）〜 7月24日（金）", size=11, color=PALE)
add_text(s, Inches(1.0), Inches(6.45), Inches(6.0), Inches(0.3),
         "報告日：2026年7月24日", size=11, color=PALE)
add_text(s, SW - Inches(4.2), Inches(6.45), Inches(3.2), Inches(0.3),
         "社外秘 / Confidential", size=10, color=MUTE, align=PP_ALIGN.RIGHT)


# ==================================================================
# スライド2：本日の目的と流れ
# ==================================================================
s = prs.slides.add_slide(BLANK)
header(s, 2, "本日の目的と進め方", "PURPOSE ｜ 第2回 事前相談会の位置づけ")
footer(s)
add_text(s, Inches(0.55), Inches(1.32), Inches(12.2), Inches(0.75),
         "7月22日〜24日に、第1回後に提出された企画書を前提として第2回 事前相談会を実施した。"
         "本資料は、事務局への進捗報告として各チームの状況を整理し、10月発表に向けた課題と依頼事項をまとめたものである。",
         size=12.5, color=DARK, ls=1.2)

by = Inches(2.25); bh = Inches(2.5); bw = Inches(5.9)
lx = Inches(0.6); rx = lx + bw + Inches(0.4)


def purpose(x, tag, tcol, title, items):
    add_rect(s, x, by, bw, bh, LIGHT)
    add_rect(s, x, by, bw, Inches(0.8), tcol)
    add_text(s, x + Inches(0.3), by + Inches(0.1), bw - Inches(0.6), Inches(0.28),
             tag, size=10, color=WHITE, bold=True)
    add_text(s, x + Inches(0.3), by + Inches(0.36), bw - Inches(0.6), Inches(0.38),
             title, size=15.5, color=WHITE, bold=True)
    ty = by + Inches(0.95)
    for head, body in items:
        add_rect(s, x + Inches(0.3), ty + Inches(0.05), Inches(0.13), Inches(0.13), tcol)
        add_text(s, x + Inches(0.53), ty - Inches(0.05), bw - Inches(0.85), Inches(0.28),
                 head, size=12, color=NAVY, bold=True)
        add_text(s, x + Inches(0.53), ty + Inches(0.24), bw - Inches(0.85), Inches(0.5),
                 body, size=10.5, color=DARK, ls=1.08)
        ty += Inches(0.74)


purpose(lx, "進行面 ｜ PROGRESS", NAVY, "進捗の確認と次アクションの整理",
        [("各チームの進捗状況の確認",
          "企画の具体化の度合いと、構築に着手できる準備が整っているかを確認。"),
         ("次アクションの整理",
          "8月：動くデモ／9月：発表準備／10月：発表 に向けた優先順位を明確化。")])
purpose(rx, "技術面 ｜ TECHNOLOGY", TEAL, "適合性と実現可能性の助言",
        [("使うアプリの適合性",
          "Copilot Studio・Power Automate・SharePoint・Teams等の使い分けを助言。"),
         ("実現可能性と制約の早期確認",
          "外部Web参照、M365外システム連携、資料の保管場所、本番移行などを論点化。")])

add_text(s, Inches(0.6), Inches(4.9), Inches(12.1), Inches(0.4),
         "※ 特定の案へ誘導することはせず、各チームの主体的な判断を尊重しながら技術・運用・ガバナンス面の助言を実施。",
         size=10.5, color=MUTE, italic=True)

add_text(s, Inches(0.55), Inches(5.5), Inches(6.0), Inches(0.3),
         "本日の流れ", size=12, color=NAVY, bold=True)
flow = ["① サマリ（結論）", "② 各チームの状況一覧", "③ 使用アプリ・難易度",
        "④ 課題は大きく3点", "⑤ 各チームの個別状況"]
fw = Inches(2.42); fdx = Inches(2.48)
for i, txt in enumerate(flow):
    x = Inches(0.55) + fdx * i
    add_rect(s, x, Inches(5.85), fw, Inches(0.5), LIGHT)
    add_text(s, x, Inches(5.87), fw, Inches(0.46), txt, size=10.5, color=NAVY,
             bold=True, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)


# ==================================================================
# スライド3：サマリ（結論先出し）
# ==================================================================
s = prs.slides.add_slide(BLANK)
header(s, 3, "サマリ", "EXECUTIVE SUMMARY ｜ 結論")
footer(s)
add_rect(s, Inches(0.55), Inches(1.32), Inches(12.25), Inches(0.82), NAVY)
add_text(s, Inches(0.9), Inches(1.36), Inches(11.6), Inches(0.74),
         "全11チームが企画を1案に固め、構築フェーズへ移行。10チームは10月発表に間に合う見込みで、要フォローは1チーム。",
         size=14, color=WHITE, bold=True, anchor=MSO_ANCHOR.MIDDLE)

ty = Inches(2.4); th = Inches(1.92)
tiles = [
    ("◎ 先行", "2チーム", "チーム5・7", "業務の流れ・効果・構成まで\n具体化済み", GREEN,
     Inches(0.55), Inches(3.0)),
    ("○ 概ね順調", "8チーム", "チーム1・2・3・6・8・9・10・11",
     "不明点はCopilotとの相談で解消でき、\n作業量が多い場合も範囲を絞れば発表可能", TEAL,
     Inches(3.7), Inches(5.35)),
    ("△ 要フォロー", "1チーム", "チーム4", "外部Web参照の禁止で再設計中。\n作るものの再定義が最優先", AMBER,
     Inches(9.25), Inches(3.55)),
]
for label, cnt, teams, note, col, x, w in tiles:
    add_rect(s, x, ty, w, th, LIGHT)
    add_rect(s, x, ty, w, Inches(0.48), col)
    add_text(s, x, ty + Inches(0.05), w, Inches(0.38), label, size=12.5, color=WHITE,
             bold=True, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    add_text(s, x, ty + Inches(0.56), w, Inches(0.55), cnt, size=24, color=NAVY,
             bold=True, align=PP_ALIGN.CENTER)
    add_text(s, x + Inches(0.15), ty + Inches(1.12), w - Inches(0.3), Inches(0.28),
             teams, size=10, color=DARK, bold=True, align=PP_ALIGN.CENTER)
    add_text(s, x + Inches(0.15), ty + Inches(1.42), w - Inches(0.3), Inches(0.45),
             note, size=8.8, color=MUTE, align=PP_ALIGN.CENTER, ls=1.08)

add_rect(s, Inches(0.55), Inches(4.55), Inches(12.25), Inches(0.5), LIGHT)
add_text(s, Inches(0.75), Inches(4.57), Inches(11.9), Inches(0.46),
         "事務局への依頼（重点3点） ▶ ① 使えるデータ・環境の可否判断を早期に　"
         "② 進め方の型とスケジュールの提示　③ 8月は「一本通す」デモに集中する方針の共有",
         size=11, color=NAVY, bold=True, anchor=MSO_ANCHOR.MIDDLE)

add_text(s, Inches(0.55), Inches(5.32), Inches(6.0), Inches(0.3),
         "全体スケジュール", size=11.5, color=NAVY, bold=True)
steps = [("7/9〜13", "事前相談会①", TEAL), ("〜7/17", "企画書 提出", NAVY),
         ("7/22〜24", "事前相談会②（今回）", ORANGE), ("8月", "構築・デモ作成", NAVY),
         ("9月", "発表準備・運用整理", NAVY), ("10月初旬", "最終発表", NAVY_DARK)]
tly = Inches(5.68); tlh = Inches(0.56); stw = Inches(2.18); stdx = Inches(2.03)
for idx, (d, lb, col) in enumerate(steps):
    x = Inches(0.55) + stdx * idx
    sp = s.shapes.add_shape(MSO_SHAPE.CHEVRON, x, tly, stw, tlh)
    set_fill(sp, col)
    tf = sp.text_frame; tf.word_wrap = True
    tf.margin_left = Pt(10); tf.margin_right = Pt(6)
    tf.margin_top = Pt(1); tf.margin_bottom = Pt(1)
    p = tf.paragraphs[0]; p.alignment = PP_ALIGN.CENTER
    r = p.add_run(); r.text = d; r.font.size = Pt(10); r.font.bold = True
    r.font.name = FONT; r.font.color.rgb = WHITE
    p2 = tf.add_paragraph(); p2.alignment = PP_ALIGN.CENTER
    r2 = p2.add_run(); r2.text = lb; r2.font.size = Pt(7.5); r2.font.name = FONT
    r2.font.color.rgb = WHITE


# ==================================================================
# スライド4：各チームの状況一覧
# ==================================================================
s = prs.slides.add_slide(BLANK)
header(s, 4, "各チームの状況一覧", "PROGRESS SUMMARY ｜ 全11チーム")
footer(s)
add_text(s, Inches(0.55), Inches(1.26), Inches(12.3), Inches(0.3),
         "全11チームが1案に確定。進捗の段階・難易度・10月発表の見込みをあわせて一覧化。",
         size=11.5, color=DARK)
add_text(s, Inches(0.55), Inches(1.60), Inches(12.3), Inches(0.55),
         "進捗の段階 ▶ ①案の絞り込み中　②2案から選定中　③1案確定（内容の詰めは途上）　④設計まで具体化　⑤効果試算まで完了"
         "　／　第2回 実施済み＝チーム1・2・3・4・5・10・11\n"
         "10月発表の見込み（基準＝発表に向けた道筋の明確さ）▶ ◎ 道筋が明確で自走できる　"
         "○ Copilotとの相談や範囲の絞り込みで間に合う　△ 要フォロー（作るものが未確定・再設計中）",
         size=8.6, color=MUTE, ls=1.15)

tx = Inches(0.55); ty0 = Inches(2.2); rowh = Inches(0.398); hh = Inches(0.36)
t = s.shapes.add_table(12, 6, tx, ty0, Inches(12.25), Inches(4.9)).table
cw = [Inches(0.82), Inches(2.28), Inches(2.75), Inches(3.85), Inches(0.85), Inches(1.7)]
for i, w in enumerate(cw):
    t.columns[i].width = w
for c, htx in enumerate(["チーム", "進捗の段階", "取り組み内容",
                         "第2回の主な論点・相談", "難易度", "10月発表 見込み"]):
    cell(t.cell(0, c), htx, size=9.5, color=WHITE, bold=True, fill=NAVY, align=PP_ALIGN.CENTER)
rh(t, 0, hh)
fc_word = {"◎": "◎ 順調", "○": "○ 概ね順調", "△": "△ 要フォロー"}
for i, (no, lv, name, diff, topic, done) in enumerate(overview, start=1):
    rf = WHITE if i % 2 else LIGHT
    cell(t.cell(i, 0), f"チーム{no}", size=9.5, color=NAVY, bold=True, fill=rf, align=PP_ALIGN.CENTER)
    cell(t.cell(i, 1), "", fill=rf)
    cell(t.cell(i, 2), name, size=8.8, color=DARK, bold=True, fill=rf)
    cell(t.cell(i, 3), topic, size=8.5, color=(MUTE if not done else DARK), fill=rf)
    cell(t.cell(i, 4), diff, size=9.5, color=diff_color(diff), bold=True, fill=rf, align=PP_ALIGN.CENTER)
    fc = forecast[no]
    cell(t.cell(i, 5), fc_word[fc], size=9, color=fc_color(fc), bold=True, fill=rf, align=PP_ALIGN.CENTER)
    rh(t, i, rowh)
# 進捗の段階（矢印＋名称）を重ねる
cx0 = tx + cw[0] + Inches(0.1)
for i, (no, lv, *_r) in enumerate(overview, start=1):
    yc = ty0 + hh + rowh * (i - 1) + rowh / 2
    chevrons(s, cx0, yc, lv, on=tier(lv))
    add_text(s, cx0 + Inches(0.235) * 5 + Inches(0.04), yc - Inches(0.115),
             Inches(1.0), Inches(0.24), f"{STAGE_NO[lv]} {STAGE_SHORT[lv]}", size=7,
             color=tier(lv), bold=True, anchor=MSO_ANCHOR.MIDDLE)


# ==================================================================
# スライド5：使用アプリ（想定）・難易度・ボリュームの比較
# ==================================================================
s = prs.slides.add_slide(BLANK)
header(s, 5, "使用アプリ（想定）・難易度・ボリュームの比較",
       "APPS ・ DIFFICULTY ・ VOLUME ｜ メンター検討の材料")
footer(s)
add_text(s, Inches(0.55), Inches(1.20), Inches(12.3), Inches(0.5),
         "各チームの取り組みから想定される使用アプリ（企画書と相談会の内容にもとづく予想）を列で示し、難易度・ボリューム・主な制約を併記。"
         "全チームがCopilot Studioを使用する。",
         size=9.5, color=DARK, ls=1.1)

tx = Inches(0.55); ty0 = Inches(1.74); rowh = Inches(0.375); hh = Inches(0.5)
ncol = 3 + len(APP_COLS) + 2
t = s.shapes.add_table(12, ncol, tx, ty0, Inches(12.25), Inches(4.6)).table
cw = ([Inches(0.72), Inches(2.05), Inches(0.6)] + [Inches(0.6)] * len(APP_COLS)
      + [Inches(0.68), Inches(2.2)])
for i, w in enumerate(cw):
    t.columns[i].width = w
cell(t.cell(0, 0), "チーム", size=8, color=WHITE, bold=True, fill=NAVY, align=PP_ALIGN.CENTER)
cell(t.cell(0, 1), "取り組み内容", size=8, color=WHITE, bold=True, fill=NAVY, align=PP_ALIGN.CENTER)
cell(t.cell(0, 2), "難易\n度", size=7.5, color=WHITE, bold=True, fill=NAVY, align=PP_ALIGN.CENTER)
for j, (key, label, col, tc) in enumerate(APP_COLS):
    cell(t.cell(0, 3 + j), label, size=6.5, color=tc, bold=True, fill=col, align=PP_ALIGN.CENTER)
cell(t.cell(0, ncol - 2), "ボリ\nューム", size=7, color=WHITE, bold=True, fill=NAVY, align=PP_ALIGN.CENTER)
cell(t.cell(0, ncol - 1), "主な制約・留意点", size=8, color=WHITE, bold=True, fill=NAVY, align=PP_ALIGN.CENTER)
rh(t, 0, hh)
for i, (no, lv, name, diff, topic, done) in enumerate(overview, start=1):
    rf = WHITE if i % 2 else LIGHT
    cell(t.cell(i, 0), f"チーム{no}", size=8.5, color=NAVY, bold=True, fill=rf, align=PP_ALIGN.CENTER)
    cell(t.cell(i, 1), detail[no]["title"], size=7.8, color=DARK, bold=True, fill=rf)
    cell(t.cell(i, 2), diff, size=8.5, color=diff_color(diff), bold=True, fill=rf, align=PP_ALIGN.CENTER)
    used = app_use[no]
    for j, (key, label, col, tc) in enumerate(APP_COLS):
        if key in used:
            cell(t.cell(i, 3 + j), "●", size=8.5, color=tc, bold=True, fill=col, align=PP_ALIGN.CENTER)
        else:
            cell(t.cell(i, 3 + j), "", size=8, fill=rf)
    vv = volume[no]
    cell(t.cell(i, ncol - 2), vv, size=8.5, color=vol_color(vv), bold=True, fill=rf, align=PP_ALIGN.CENTER)
    cell(t.cell(i, ncol - 1), constraint[no], size=7.5, color=DARK, fill=rf)
    rh(t, i, rowh)

sy = ty0 + hh + rowh * 11 + Inches(0.06)
add_rect(s, tx, sy, Inches(12.25), Inches(0.58), LIGHT)
add_text(s, tx + Inches(0.22), sy + Inches(0.02), Inches(11.85), Inches(0.56),
         "● ＝ 想定される使用アプリ（列見出しの色が各アプリ）。難易度：中＝M365標準で実現しやすい／中〜高＝連携・運用の検証項目が多い／高＝外部連携や制約が大きく再設計や判断を伴う。\n"
         "ボリューム ＝ 企画着手から実業務で使い始める（リリース）までに必要な総作業量。開発するもの＋読み込む資料の整備＋連携・権限・本番移行・運用展開を含む（10月のデモまでではない）。※暫定評価",
         size=8.2, color=DARK, ls=1.14)


# ==================================================================
# スライド6：課題は大きく3点
# ==================================================================
s = prs.slides.add_slide(BLANK)
header(s, 6, "第2回で挙がった課題は、大きく3点", "ISSUES ｜ 事務局への依頼事項")
footer(s)
add_text(s, Inches(0.55), Inches(1.26), Inches(12.3), Inches(0.35),
         "第2回（チーム1・2・3・4・5・10・11）で実際に挙がった論点を集約すると、次の3点に整理できる。",
         size=12, color=DARK)

issues = [
    ("1", "使えるデータ・環境", "ガバナンス・制約", ORANGE,
     ["外部Webの参照・M365外システム連携・機密情報は原則不可。依存する案は再設計が必要　… チーム3・4",
      "開発環境から本番環境への移行は、社内の申請・決裁フローを要確認　… チーム11"],
     "事務局へ：可否の判断を早期に。抵触すると案そのものが頓挫するため最優先で確認したい。"),
    ("2", "進め方の型", "構築フェーズの支援", NAVY,
     ["開発手順の型（基本フォーマット）と8〜9月のスケジュール提示　… チーム1・5",
      "設計相談の進め方と、指示文（プロンプト）の見本　… チーム1・2",
      "Copilotの回答は鵜呑みにせず、根拠の提示と実機確認で精度を担保　… チーム10"],
     "事務局へ：進め方の型・スケジュール・指示文の見本を配布いただきたい。"),
    ("3", "10月以降の展開", "運用・定着", TEAL,
     ["8月のデモは範囲を絞り「入力→処理→出力」を一本通す／効果の見極め　… チーム4・5",
      "手順書・利用ルールの整備（項目の洗い出しと全体量の把握）と更新に伴う運用保守　… チーム5・11",
      "8月以降の定例（週次／隔週）の進め方の案内　… チーム2・10"],
     "事務局へ：展開・運用の枠組みと定例の進め方を案内いただきたい。"),
]
cy0 = Inches(1.78); card_h = Inches(1.55); cgap = Inches(0.16)
for k, (num, title, sub, col, bullets, action) in enumerate(issues):
    y = cy0 + (card_h + cgap) * k
    add_rect(s, Inches(0.55), y, Inches(12.25), card_h, LIGHT)
    add_rect(s, Inches(0.55), y, Inches(3.3), card_h, col)
    add_text(s, Inches(0.68), y, Inches(0.8), card_h, num, size=30, color=WHITE,
             bold=True, anchor=MSO_ANCHOR.MIDDLE, align=PP_ALIGN.CENTER)
    add_text(s, Inches(1.5), y + Inches(0.28), Inches(2.2), Inches(0.45),
             title, size=13.5, color=WHITE, bold=True, ls=1.05)
    add_text(s, Inches(1.5), y + Inches(0.78), Inches(2.2), Inches(0.3),
             sub, size=9.5, color=PALE)
    bx = Inches(4.1); by = y + Inches(0.12)
    for b in bullets:
        add_rect(s, bx, by + Inches(0.055), Inches(0.09), Inches(0.09), col)
        add_text(s, bx + Inches(0.19), by - Inches(0.045), Inches(8.4), Inches(0.3),
                 b, size=9.6, color=DARK)
        by += Inches(0.3)
    add_text(s, bx, y + card_h - Inches(0.34), Inches(8.5), Inches(0.3),
             "▶ " + action, size=9.4, color=col, bold=True)


# ==================================================================
# スライド7：セクション区切り
# ==================================================================
s = prs.slides.add_slide(BLANK)
add_rect(s, 0, 0, SW, SH, NAVY_DARK)
add_rect(s, Inches(1.0), Inches(3.02), Inches(1.5), Inches(0.06), TEAL)
add_text(s, Inches(1.0), Inches(2.5), Inches(11.0), Inches(0.4),
         "TEAM DETAIL", size=12, color=TEAL, bold=True)
add_text(s, Inches(0.96), Inches(3.3), Inches(11.4), Inches(0.85),
         "各チームの個別状況", size=32, color=WHITE, bold=True)
add_text(s, Inches(1.0), Inches(4.3), Inches(11.0), Inches(0.4),
         "チーム1〜11／1チーム1枚：取り組み内容・使用アプリ・論点・相談内容と助言・次アクション",
         size=13, color=PALE)
cx = Inches(1.0)
for no in range(1, 12):
    pill(s, cx, Inches(5.25), Inches(0.92), Inches(0.44), f"チーム{no}",
         NAVY, tcolor=WHITE, size=10)
    cx += Inches(1.02)
add_text(s, Inches(11.9), Inches(6.45), Inches(1.15), Inches(0.35),
         f"7 / {TOTAL}", size=11, color=PALE, bold=True, align=PP_ALIGN.RIGHT)


# ==================================================================
# スライド8〜18：各チーム個票
# ==================================================================
def detail_slide(no, idx):
    d = detail[no]
    ov = overview[no - 1]
    lv, diff, done = ov[1], ov[3], ov[5]
    s = prs.slides.add_slide(BLANK)
    header(s, idx, f"チーム{no}：{d['title']}", f"TEAM {no} ｜ 個別状況")
    footer(s)

    # ステータス帯
    sy = Inches(1.3)
    add_rect(s, Inches(0.55), sy, Inches(12.25), Inches(0.52), LIGHT)
    add_text(s, Inches(0.72), sy, Inches(1.2), Inches(0.52),
             "エージェント名", size=8, color=MUTE, bold=True, anchor=MSO_ANCHOR.MIDDLE)
    add_text(s, Inches(1.95), sy, Inches(2.7), Inches(0.52),
             d["agent"], size=9.5, color=NAVY, bold=True, anchor=MSO_ANCHOR.MIDDLE)
    add_text(s, Inches(4.75), sy, Inches(0.55), Inches(0.52),
             "進捗", size=8, color=MUTE, bold=True, anchor=MSO_ANCHOR.MIDDLE)
    chevrons(s, Inches(5.4), sy + Inches(0.26), lv, on=tier(lv))
    add_text(s, Inches(6.65), sy, Inches(1.4), Inches(0.52),
             f"{STAGE_NO[lv]} {STAGE[lv]}", size=9, color=tier(lv), bold=True, anchor=MSO_ANCHOR.MIDDLE)
    pill(s, Inches(8.1), sy + Inches(0.06), Inches(1.35), Inches(0.4),
         f"難易度 {diff}", diff_color(diff), size=9)
    fc = forecast[no]
    pill(s, Inches(9.55), sy + Inches(0.06), Inches(1.45), Inches(0.4),
         f"10月見込み {fc}", fc_color(fc), size=9)
    pill(s, Inches(11.1), sy + Inches(0.06), Inches(1.6), Inches(0.4),
         ("第2回 実施済" if done else "第2回 未実施"), (NAVY if done else MUTE), size=9)

    # 見込みの根拠
    add_text(s, Inches(0.55), Inches(1.93), Inches(12.25), Inches(0.22),
             f"10月発表の見込み（{fc}）の根拠：{fc_reason[no]}"
             f"　｜　ボリューム（実業務で使い始めるまで）：{volume[no]}",
             size=8.6, color=DARK, anchor=MSO_ANCHOR.MIDDLE)

    # 上段3カード
    r1y = Inches(2.24); r1h = Inches(1.56); cwd = Inches(3.93); gap = Inches(0.23)
    cols = [Inches(0.55), Inches(0.55) + cwd + gap, Inches(0.55) + (cwd + gap) * 2]
    cards1 = [("取り組み内容", d["work"], NAVY),
              ("使用アプリ・データ（想定）", d["apps"], TEAL),
              ("リスク・論点", d["risk"], ORANGE)]
    for (title, body, col), cx in zip(cards1, cols):
        add_rect(s, cx, r1y, cwd, r1h, LIGHT)
        add_rect(s, cx, r1y, cwd, Inches(0.38), col)
        add_text(s, cx + Inches(0.16), r1y + Inches(0.04), cwd - Inches(0.32), Inches(0.3),
                 title, size=10.5, color=WHITE, bold=True, anchor=MSO_ANCHOR.MIDDLE)
        add_text(s, cx + Inches(0.16), r1y + Inches(0.46), cwd - Inches(0.32), r1h - Inches(0.56),
                 body, size=9.6, color=DARK, ls=1.14)

    # 中段2カード（相談・助言の記録）
    r2y = Inches(3.98); r2h = Inches(1.5); cwd2 = Inches(6.02)
    cards2 = [("相談された内容", d["q"], NAVY), ("助言した内容", d["a"], TEAL)]
    cols2 = [Inches(0.55), Inches(0.55) + cwd2 + Inches(0.2)]
    for (title, body, col), cx in zip(cards2, cols2):
        add_rect(s, cx, r2y, cwd2, r2h, LIGHT)
        add_rect(s, cx, r2y, cwd2, Inches(0.38), col)
        add_text(s, cx + Inches(0.16), r2y + Inches(0.04), cwd2 - Inches(0.32), Inches(0.3),
                 title, size=10.5, color=WHITE, bold=True, anchor=MSO_ANCHOR.MIDDLE)
        add_text(s, cx + Inches(0.16), r2y + Inches(0.44), cwd2 - Inches(0.32), r2h - Inches(0.54),
                 body, size=9.4, color=DARK, ls=1.14)

    # 次アクション
    ny = Inches(5.66); nh = Inches(0.9)
    add_rect(s, Inches(0.55), ny, Inches(12.25), nh, RGBColor(0xE8, 0xEE, 0xF4))
    add_text(s, Inches(0.78), ny + Inches(0.08), Inches(11.9), Inches(0.28),
             "次アクション", size=10.5, color=NAVY, bold=True)
    add_text(s, Inches(0.78), ny + Inches(0.38), Inches(11.9), Inches(0.45),
             d["nxt"], size=10.2, color=DARK, ls=1.1)


for k, no in enumerate(range(1, 12)):
    detail_slide(no, 8 + k)

OUT = ("/home/user/awc-naka881-repo/reports/"
       "CopilotStudio_ハッカソン_事前相談会②_状況報告_20260724.pptx")
prs.save(OUT)
print("saved OK / slides:", len(prs.slides._sldIdLst))
