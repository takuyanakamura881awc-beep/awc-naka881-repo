# -*- coding: utf-8 -*-
"""メンター向け設計資料一式の Markdown / Excel 整理版と、納品ZIPを作成する。

V1 の文言は改変せず、読みやすい単位に束ねるだけにとどめる。
"""
import json
import os
import shutil
import zipfile

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

HERE = os.path.dirname(os.path.abspath(__file__))
V1 = ("/tmp/claude-0/-home-user-awc-naka881-repo/"
      "e4943cfb-89be-5c9f-b59c-004830a57633/scratchpad/pm/v1")
OUTDIR = os.path.join(HERE, "out")
PACK = os.path.join(OUTDIR, "priority_medium_mentor_design_final")
PPTX = os.path.join(OUTDIR, "priority_medium_mentor_design_final.pptx")
ZIPF = os.path.join(OUTDIR, "priority_medium_mentor_design_final.zip")

with open(os.path.join(HERE, "v1_data.json"), encoding="utf-8") as f:
    D = json.load(f)
TEAMS, COM = D["teams"], D["common"]

PARTS = ["01_architecture.md", "02_architecture_mermaid.md",
         "03_architecture_banner_image_note.md", "04_mvp_design.md",
         "05_build_steps_for_mentor.md", "06_risks_and_advice.md",
         "07_dummy_data_spec.md", "08_minimum_test_cases.md"]

HDR = ("<!-- V1（priority_medium_mentor_design_v1）の原文をそのまま結合したもの。"
       "文言の要約・言い換え・追記は行っていない。 -->\n")


def build_team_md(tid):
    """V1の01〜08を1ファイルに結合する（本文は原文のまま）"""
    tm = next(t for t in TEAMS if t["id"] == tid)
    out = ["# %s %s メンター向け設計資料" % (tid, tm["name"]), "", HDR,
           "アーキテクチャ画像： `../images/%s_architecture_banner.png`" % tid,
           "", "## 目次", ""]
    for i, fn in enumerate(PARTS, 1):
        with open(os.path.join(V1, tid, fn), encoding="utf-8") as f:
            head = f.readline().lstrip("# ").strip()
        out.append("%d. %s" % (i, head))
    out.append("")
    out.append("---")
    out.append("")
    for fn in PARTS:
        with open(os.path.join(V1, tid, fn), encoding="utf-8") as f:
            body = f.read().rstrip()
        # 見出しレベルを1段下げて1ファイル内で階層が崩れないようにする
        body = "\n".join(("#" + ln) if ln.startswith("#") else ln
                         for ln in body.splitlines())
        out.append(body)
        out.append("")
        out.append("---")
        out.append("")
    return "\n".join(out).rstrip() + "\n"


def build_overview_md():
    L = ["# 00 メンター向け設計資料一式（優先度中） 概要", "", HDR,
         "## 本資料の位置づけ", "",
         "メンターが各チームのMVPを事前に手元で試作し、"
         "各チームが躓きそうな課題を早期に把握するための設計資料一式。",
         "正本は `priority_medium_mentor_design_v1.zip`（V1）。"
         "V2〜V4（アイコン差し替え版）は使用していない。", "",
         "## 収録内容", "",
         "| ファイル | 内容 |", "|---|---|",
         "| `priority_medium_mentor_design_final.pptx` | "
         "メンター向けPowerPoint（32ページ・別ファイルで納品） |",
         "| `common/` | 共通制約・共通アーキテクチャ原則・利用アプリ方針・"
         "レビュー確認リスト・ダミーデータ方針・横断的な要注意ポイント（V1原文） |",
         "| `teams/T0x_design.md` | チーム別設計資料（V1の01〜08を結合、原文のまま） |",
         "| `images/` | V1のアーキテクチャバナー画像・全体俯瞰マップ・共通原則図 |",
         "| `02_team_summary.xlsx` | 10チームの一覧（企画概要・MVP・使用アプリ・"
         "躓きポイント・助言）と共通制約・テストケース |",
         "| `T04_EXCLUDED_REDESIGN_NOTE.md` | T04の除外メモ（V1原文） |",
         "| `QUALITY_REVIEW.md` | V1の品質レビュー結果（V1原文） |", "",
         "## 対象チーム", "",
         "| ID | 名称 | 類型 | 目的 |", "|---|---|---|---|"]
    for t in TEAMS:
        L.append("| %s | %s | %s | %s |"
                 % (t["id"], t["name"], t["kind"], t["purpose"]))
    L += ["| T04 | （対象外） | － | "
          "現行案の中核が外部Web参照に依存するため、今回の詳細構築設計の対象外 |", "",
          "## 前提情報（V1原文）", "", COM["context"]["raw"].split("\n", 1)[1].strip(),
          ""]
    return "\n".join(L)


def build_readme():
    L = ["# priority_medium_mentor_design_final", "",
         "優先度中「メンター向け設計資料一式」の成果物。", "",
         "本ZIPと `priority_medium_mentor_design_final.pptx` の2ファイルで一式。",
         "PowerPointは単体で約17MBあるため、配信サイズの都合で別ファイルとしている。",
         "",
         "## 正本と方針", "",
         "- 正本は `priority_medium_mentor_design_v1.zip`（V1）。",
         "- V2 / V3 / V4 / アイコン差し替え版は使用していない。",
         "- V1の設計内容・文言・画像・情報量は変更していない。",
         "- アーキテクチャ画像はV1のPNGをそのまま使用（再生成・簡略化・"
         "アイコン加工なし）。",
         "- T04は詳細設計対象外のまま（除外メモのみ）。", "",
         "## 品質チェック結果", "",
         "| 観点 | 結果 |", "|---|---|",
         "| V1の設計内容を変更していないか | OK（01〜08の本文は原文のまま結合。"
         "PPTへの転記も原文） |",
         "| V1の画像を再生成・簡略化していないか | OK（12点のPNGをバイト単位で"
         "そのまま使用） |",
         "| T04を詳細設計対象に戻していないか | OK（除外メモのみ。"
         "チーム別ページ・俯瞰マップの対象は10チーム） |",
         "| Forms / Power BI / Dataverse / Premium Connector / 外部Web・API | "
         "OK（利用アプリ方針で「原則使わない」として代替手段まで明記） |",
         "| Power Automateからエージェントフローを呼ぶ制約 | "
         "OK（共通制約・利用アプリ方針・共通構築手順STEP4に記載） |",
         "| メンターが手元でMVPを一本通して試作できるか | "
         "OK（共通構築手順5ステップ＋チーム別のダミーデータ仕様・テストケース） |",
         "| 各チームの躓きポイントが具体的か | "
         "OK（チームごとに3点の躓きポイントと3点の助言を掲載） |", "",
         "## 体裁", "",
         "- 株式会社Low Code の資料作成ガイドライン＆汎用スライド・パーツ集に準拠"
         "（スライドマスター／レイアウト／テーマ色／フォント）。",
         "- アプリアイコンはテンプレートの「アイコン類 2025/11/12更新」に収録の"
         "公式アイコンを使用。", "",
         "## PowerPoint構成（32ページ）", "",
         "| ページ | 内容 |", "|---|---|",
         "| 1 | 表紙 |", "| 2 | 本資料の目的と使い方 |", "| 3 | 本資料の構成 |",
         "| 4 | メンター向け全体俯瞰マップ |", "| 5 | 共通制約 |",
         "| 6 | 共通アーキテクチャ原則／メンターレビュー確認リスト |",
         "| 7 | 利用アプリ方針／Power Automateの扱い |",
         "| 8 | 横断的な要注意ポイント |", "| 9 | メンター試作 共通構築手順 |",
         "| 10 | ダミーデータ方針・MVP範囲・最低限テストケース |",
         "| 11〜30 | チーム別設計（10チーム × 2ページ） |",
         "| 31 | T04 除外メモ |", "| 32 | メンター試作チェックリスト |", "",
         "株式会社Low Code", ""]
    return "\n".join(L)


def build_xlsx(path):
    wb = Workbook()
    hdr_fill = PatternFill("solid", fgColor="1B5C80")
    hdr_font = Font(color="FFFFFF", bold=True, size=10)
    wrap = Alignment(vertical="top", wrap_text=True)

    def sheet(ws, cols, rows, widths):
        ws.append(cols)
        for c in range(1, len(cols) + 1):
            cell = ws.cell(1, c)
            cell.fill = hdr_fill
            cell.font = hdr_font
            cell.alignment = Alignment(vertical="center", horizontal="center",
                                       wrap_text=True)
            ws.column_dimensions[get_column_letter(c)].width = widths[c - 1]
        for r in rows:
            ws.append(r)
        for row in ws.iter_rows(min_row=2):
            for cell in row:
                cell.alignment = wrap
                cell.font = Font(size=10)
        ws.freeze_panes = "B2"
        ws.row_dimensions[1].height = 28

    ws = wb.active
    ws.title = "チーム一覧"
    rows = []
    for t in TEAMS:
        rows.append([
            t["id"], t["name"], t["kind"], t["purpose"], t["mvp_goal"],
            t["inputs"], t["outputs"], "\n".join(t["apps"]),
            "\n".join(t["roles"]), "\n".join(t["risks"]),
            "\n".join(t["advice"]),
            "\n".join(x.replace("`", "") for x in t["dummy_files"]),
            "\n".join(t["dummy_io"]),
        ])
    rows.append(["T04", "（対象外）", "－", COM["t04"].split("\n")[2].strip(),
                 "－", "－", "－", "－", "－", "－", "－", "－", "－"])
    sheet(ws, ["ID", "名称", "類型", "目的", "MVPゴール", "入力", "出力",
               "使用アプリと役割", "人/AI/自動化の分担", "躓きポイント",
               "メンターからの助言", "ダミーデータ サンプルファイル", "入力例"],
          rows, [7, 26, 20, 40, 44, 30, 30, 24, 34, 26, 26, 26, 40])
    for r in range(2, len(rows) + 2):
        ws.row_dimensions[r].height = 74

    ws2 = wb.create_sheet("共通制約")
    sheet(ws2, ["No", "共通制約（V1原文）"],
          [[i + 1, c] for i, c in enumerate(COM["constraints"]["bullets"])],
          [6, 120])
    ws3 = wb.create_sheet("共通アーキテクチャ原則")
    prin = [ln for ln in COM["principles"]["raw"].splitlines() if ln[:1].isdigit()]
    sheet(ws3, ["No", "原則（V1原文）"],
          [[p.split(". ", 1)[0], p.split(". ", 1)[1]] for p in prin], [6, 100])
    ws4 = wb.create_sheet("最低限テストケース")
    tc = TEAMS[0]["testcases"]
    sheet(ws4, tc[0], tc[1:], [6, 12, 30, 40, 30])
    ws5 = wb.create_sheet("横断的な要注意ポイント")
    att = [[k, " ".join(v)] for k, v in COM["attention"]["sections"].items()]
    sheet(ws5, ["項目", "内容（V1原文）"], att, [26, 90])
    ws6 = wb.create_sheet("レビュー確認リスト")
    sheet(ws6, ["No", "確認観点（V1原文）"],
          [[i + 1, c] for i, c in enumerate(COM["checklist"]["bullets"])],
          [6, 90])
    wb.save(path)


def main():
    if os.path.isdir(PACK):
        shutil.rmtree(PACK)
    os.makedirs(os.path.join(PACK, "common"))
    os.makedirs(os.path.join(PACK, "teams"))
    os.makedirs(os.path.join(PACK, "images"))

    # 共通資料（V1原文をそのままコピー）
    for fn in sorted(os.listdir(os.path.join(V1, "common"))):
        shutil.copy2(os.path.join(V1, "common", fn),
                     os.path.join(PACK, "common", fn))
    shutil.copy2(os.path.join(V1, "T04_EXCLUDED_REDESIGN_NOTE.md"), PACK)
    shutil.copy2(os.path.join(V1, "QUALITY_REVIEW.md"), PACK)

    # 画像（V1のPNGをそのままコピー）
    for t in TEAMS:
        shutil.copy2(t["banner"], os.path.join(PACK, "images"))
    shutil.copy2(COM["img_map"], os.path.join(PACK, "images"))
    shutil.copy2(COM["img_principles"], os.path.join(PACK, "images"))

    # チーム別Markdown
    for t in TEAMS:
        with open(os.path.join(PACK, "teams", "%s_design.md" % t["id"]),
                  "w", encoding="utf-8") as f:
            f.write(build_team_md(t["id"]))

    with open(os.path.join(PACK, "00_overview.md"), "w", encoding="utf-8") as f:
        f.write(build_overview_md())
    with open(os.path.join(PACK, "README.md"), "w", encoding="utf-8") as f:
        f.write(build_readme())
    build_xlsx(os.path.join(PACK, "02_team_summary.xlsx"))
    # PowerPoint本体は単体で17MBあり、同梱するとZIPが配信上限を超えるため別ファイルで納品する

    with zipfile.ZipFile(ZIPF, "w", zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(PACK):
            for fn in sorted(files):
                fp = os.path.join(root, fn)
                z.write(fp, os.path.relpath(fp, OUTDIR))

    n = sum(len(fs) for _, _, fs in os.walk(PACK))
    print("files:", n, "zip:", round(os.path.getsize(ZIPF) / 1e6, 1), "MB")


if __name__ == "__main__":
    main()
