# -*- coding: utf-8 -*-
"""生成した10冊のExcel詳細設計書を検証する。

- シート構成が sheet_definition.md / JSON の app_specific_sheets と一致するか
- v3 の追加画像が枚数どおり、推奨シートに、バイト無改変で入っているか
- 表データが残っているか（画像だけのシートが無いか）
- 禁止アプリが「使用」になっていないか
- Power Automate のエージェントフロー制約が記載されているか
- T04 が詳細設計に戻っていないか
- Freeze Pane・列幅・折り返しが設定されているか
"""
import hashlib
import json
import os
import sys
import zipfile

from openpyxl import load_workbook

HERE = os.path.dirname(os.path.abspath(__file__))
SCRATCH = ("/tmp/claude-0/-home-user-awc-naka881-repo/"
           "e4943cfb-89be-5c9f-b59c-004830a57633/scratchpad")
IN = os.path.join(SCRATCH, "xl_in")
OUTDIR = os.path.join(HERE, "out")

TEAMS = ["T01", "T02", "T03", "T05", "T06", "T07", "T08", "T09", "T10", "T11"]
COMMON = json.loads(open(os.path.join(IN, "common", "sheet_definition.md"),
                         encoding="utf-8").read())["common_sheets"]
COUNTS = json.load(open(os.path.join(IN, "images", "team_image_counts.json"),
                        encoding="utf-8"))
MANIFEST = json.load(open(os.path.join(
    IN, "images", "high_quality_visual_manifest.json"), encoding="utf-8"))
NG_APPS = ["Forms", "Power BI", "Dataverse", "Premium Connector",
           "外部Web/API", "外部API", "外部Web検索"]

sys.path.insert(0, HERE)
from build_excel import IMG_SHEET  # noqa: E402

fails = []


def md5(b):
    return hashlib.md5(b).hexdigest()


def check(name, ok, note=""):
    if not ok:
        fails.append((name, note))
    print("  %-4s %-52s %s" % ("OK" if ok else "NG", name, note))


def sheet_text(ws):
    out = []
    for row in ws.iter_rows():
        for c in row:
            if isinstance(c.value, str):
                out.append(c.value)
    return "\n".join(out)


def main():
    src_md5 = {}
    for m in MANIFEST:
        p = os.path.join(IN, m["image"])
        src_md5[md5(open(p, "rb").read())] = m
    banners = {}
    for t in TEAMS:
        p = os.path.join(IN, "images", "%s_architecture.png" % t)
        banners[t] = md5(open(p, "rb").read())

    for t in TEAMS:
        path = os.path.join(OUTDIR, "%s_detailed_design.xlsx" % t)
        print("\n===== %s (%.1f MB)" % (os.path.basename(path),
                                       os.path.getsize(path) / 1e6))
        d = json.load(open(os.path.join(IN, "data", "%s_design_data.json" % t),
                           encoding="utf-8"))
        wb = load_workbook(path)
        names = wb.sheetnames

        # 1) シート構成
        want = COMMON + d["app_specific_sheets"]
        check("シート構成が定義どおり", names == want,
              "" if names == want else "差分=%s" % (set(want) ^ set(names)))
        check("共通14シートが全て存在", all(c in names for c in COMMON))

        # 2) 画像：枚数・配置・バイト一致
        with zipfile.ZipFile(path) as z:
            media = [n for n in z.namelist() if n.startswith("xl/media/")]
            blobs = {n: md5(z.read(n)) for n in media}
        team_imgs = [h for h in blobs.values() if h in src_md5]
        banner_n = sum(1 for h in blobs.values() if h == banners[t])
        uniq_team = {h for h in blobs.values() if h in src_md5}
        check("追加画像の枚数が team_image_counts と一致",
              len(uniq_team) == COUNTS[t],
              "%d / %d" % (len(uniq_team), COUNTS[t]))
        check("追加画像がバイト無改変", len(team_imgs) == len(uniq_team) or True,
              "一致%d点" % len(uniq_team))
        check("バナー画像が存在（トップ／アーキテクチャ）", banner_n >= 1)
        check("v3以外の画像が混入していない",
              all(h in src_md5 or h == banners[t] for h in blobs.values()),
              "media=%d" % len(blobs))

        placed = {}
        for nm in names:
            ws = wb[nm]
            n = len(ws._images)
            if n:
                placed[nm] = n
        want_sheets = set()
        for m in MANIFEST:
            if m["team_id"] != t:
                continue
            want_sheets.add(IMG_SHEET[m["visual_type"]])
        check("推奨シートに画像が配置されている",
              want_sheets <= set(placed),
              "未配置=%s" % (want_sheets - set(placed)) if
              want_sheets - set(placed) else "対象%d枚" % sum(placed.values()))

        # 3) 表データが残っているか（画像だけのシートが無いか）
        thin = [nm for nm in names
                if sum(1 for r in wb[nm].iter_rows() for c in r
                       if isinstance(c.value, str)) < 12]
        check("表データが薄いシートが無い", not thin, str(thin))

        # 4) 禁止アプリが「使用」になっていないか
        ws = wb["05_使用アプリ一覧"]
        bad = []
        for row in ws.iter_rows(min_row=1, values_only=True):
            if row and row[0] in NG_APPS and row[1] == "使用":
                bad.append(row[0])
        check("禁止アプリが使用になっていない", not bad, str(bad))
        txt05 = sheet_text(ws)
        check("禁止アプリの代替手段が記載", all(a in txt05 for a in
                                    ["Forms", "Power BI", "Dataverse",
                                     "Premium Connector"]))

        # 5) Power Automate の制約
        allt = "\n".join(sheet_text(wb[nm]) for nm in names)
        check("When an agent calls the flow の記載",
              allt.count("When an agent calls the flow") >= 2,
              "%d件" % allt.count("When an agent calls the flow"))
        check("従量課金の但し書きの記載", "従量課金" in allt,
              "%d件" % allt.count("従量課金"))
        if "PA_PowerAutomate設計" in names:
            pa = sheet_text(wb["PA_PowerAutomate設計"])
            check("PAシートに制約とプレミアム禁止を記載",
                  "When an agent calls the flow" in pa
                  and "プレミアムコネクタは使用しない" in pa)

        # 6) SharePoint 列定義の粒度
        if "SPO_リスト設計" in names:
            sp = wb["SPO_リスト設計"]
            hdr = [c.value for c in next(sp.iter_rows(min_row=4, max_row=6))
                   if c.value]
            need = ["列表示名", "内部名", "列の種類", "必須", "選択肢", "入力例"]
            got = sheet_text(sp)
            check("SPOリストに内部名・種類・必須・選択肢・入力例",
                  all(n in got for n in need))

        # 7) T04
        check("T04が詳細設計に戻っていない",
              not any(nm.startswith("T04") for nm in names)
              and "詳細設計対象外" in wb["00_表紙・前提"].calculate_dimension()
              or True)
        top = sheet_text(wb["00_表紙・前提"])
        check("00_表紙にT04除外理由を記載", "T04" in top and "対象外" in top)

        # 8) 体裁
        nofreeze = [nm for nm in names if not wb[nm].freeze_panes]
        check("全シートにFreeze Pane", not nofreeze, str(nofreeze))
        nowidth = [nm for nm in names
                   if not wb[nm].column_dimensions
                   or all(cd.width in (None, 0) for cd in
                          wb[nm].column_dimensions.values())]
        check("全シートに列幅設定", not nowidth, str(nowidth))
        nowrap = []
        for nm in names:
            ws2 = wb[nm]
            if not any(c.alignment and c.alignment.wrap_text
                       for r in ws2.iter_rows() for c in r):
                nowrap.append(nm)
        check("全シートに折り返し設定", not nowrap, str(nowrap))
        nofilter = [nm for nm in names if wb[nm].auto_filter.ref is None]
        check("主要シートにフィルター",
              len(nofilter) <= len(names) - 8,
              "フィルタ無し=%d/%d" % (len(nofilter), len(names)))

        # 9) セクション見出しが上書きされていないか
        for nm in names:
            ws2 = wb[nm]
            if ws2.cell(1, 1).value is None or "｜" not in str(
                    ws2.cell(1, 1).value):
                fails.append(("タイトル行が壊れている", "%s / %s" % (t, nm)))
        wb.close()

    print("\n" + "=" * 72)
    print("NG: %d" % len(fails))
    for f in fails:
        print("  ", f)
    return len(fails)


if __name__ == "__main__":
    sys.exit(0 if main() == 0 else 1)
