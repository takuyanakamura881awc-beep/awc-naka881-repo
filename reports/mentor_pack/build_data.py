# -*- coding: utf-8 -*-
"""priority_medium_mentor_design_v1.zip の内容を機械的に構造化する。

V1 の文言をそのまま抽出するだけで、要約・言い換え・追記は行わない。
（V1 を正本とする方針のため、内容の改変を発生させない）
"""
import json
import os
import re

V1 = ("/tmp/claude-0/-home-user-awc-naka881-repo/"
      "e4943cfb-89be-5c9f-b59c-004830a57633/scratchpad/pm/v1")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "v1_data.json")

TEAMS = ["T01", "T02", "T03", "T05", "T06",
         "T07", "T08", "T09", "T10", "T11"]


def read(*p):
    with open(os.path.join(V1, *p), encoding="utf-8") as f:
        return f.read()


def sections(md):
    """'## 見出し' 単位に分解して {見出し: [行, ...]} を返す"""
    out, cur = {}, None
    for line in md.splitlines():
        m = re.match(r"^##\s+(.*)$", line)
        if m:
            cur = m.group(1).strip()
            out[cur] = []
        elif cur is not None and line.strip():
            out[cur].append(line.rstrip())
    return out


def bullets(lines):
    return [re.sub(r"^[-*]\s*", "", ln).strip()
            for ln in lines if ln.lstrip().startswith(("-", "*"))]


def plain(lines):
    return [ln.strip() for ln in lines if not ln.lstrip().startswith(("-", "*"))]


def parse_team(tid):
    arch = read(tid, "01_architecture.md")
    sec = sections(arch)
    title = re.match(r"^#\s+(\S+)\s+(.*?)\s*アーキテクチャ設計",
                     arch.splitlines()[0])
    name = title.group(2) if title else tid

    ov = bullets(sec["1. 企画概要"])
    kind = next((v.split(":", 1)[1].strip() for v in ov if v.startswith("類型")), "")
    purpose = next((v.split(":", 1)[1].strip() for v in ov if v.startswith("目的")), "")

    mer = read(tid, "02_architecture_mermaid.md")
    mcode = re.search(r"```mermaid\n(.*?)```", mer, re.S).group(1).strip()
    mout = re.search(r"OUT\[出力:\s*(.*?)\]", mcode)

    mvp = sections(read(tid, "04_mvp_design.md"))
    steps_md = read(tid, "05_build_steps_for_mentor.md")
    step_sec = sections(steps_md)
    risk = sections(read(tid, "06_risks_and_advice.md"))
    dummy = sections(read(tid, "07_dummy_data_spec.md"))

    tc_md = read(tid, "08_minimum_test_cases.md")
    rows = [r for r in tc_md.splitlines() if r.strip().startswith("|")]
    tc = [[c.strip() for c in r.strip().strip("|").split("|")] for r in rows]
    tc = [r for r in tc if not set("".join(r)) <= set("-: ")]

    return {
        "id": tid,
        "name": name,
        "kind": kind,
        "purpose": purpose,
        "mvp_idea": " ".join(plain(sec["2. MVPの考え方"])),
        "inputs": " ".join(plain(sec["3. 入力"])),
        "outputs": " ".join(plain(sec["4. 出力"])),
        "apps": bullets(sec["5. 使用アプリと役割"]),
        "roles": bullets(sec["6. 人 / AI / 自動化の分担"]),
        "fit": " ".join(plain(sec["7. 制約への適合"])),
        "mermaid": mcode,
        "mermaid_out": mout.group(1) if mout else "",
        "mvp_goal": " ".join(plain(mvp["MVPゴール"])),
        "mvp_scope": bullets(mvp["MVPスコープ"]),
        "mvp_out": bullets(mvp["非MVP範囲"]),
        "steps": [{"title": k, "items": bullets(v)}
                  for k, v in step_sec.items()],
        "risks": bullets(risk["想定される躓きポイント"]),
        "advice": bullets(risk["メンターからの助言"]),
        "precheck": bullets(risk["先回り検証ポイント"]),
        "dummy_files": bullets(dummy["サンプルファイル"]),
        "dummy_cols": bullets(dummy["推奨列"]),
        "dummy_policy": bullets(dummy["サンプル値の方針"]),
        "dummy_io": bullets(dummy["入力例"]),
        "testcases": tc,
        "banner": os.path.join(V1, tid, f"{tid}_architecture_banner.png"),
    }


def parse_common():
    c = {}
    for key, fn in [
            ("context", "00_request_context_and_assumptions.md"),
            ("constraints", "01_common_constraints.md"),
            ("principles", "02_common_architecture_principles.md"),
            ("apps", "03_allowed_apps.md"),
            ("checklist", "04_mentor_review_checklist.md"),
            ("sample_policy", "05_sample_data_policy.md"),
            ("attention", "99_mentor_attention_points.md")]:
        md = read("common", fn)
        c[key] = {"raw": md, "sections": sections(md),
                  "bullets": bullets(md.splitlines())}
    c["t04"] = read("T04_EXCLUDED_REDESIGN_NOTE.md")
    c["quality"] = sections(read("QUALITY_REVIEW.md"))
    c["img_map"] = os.path.join(V1, "images", "mentor_overview_map.png")
    c["img_principles"] = os.path.join(
        V1, "images", "common_architecture_principles.png")
    return c


def main():
    data = {"teams": [parse_team(t) for t in TEAMS], "common": parse_common()}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print("teams:", len(data["teams"]))
    for t in data["teams"]:
        print(" ", t["id"], t["name"], "| apps:", len(t["apps"]),
              "| risks:", len(t["risks"]), "| steps:", len(t["steps"]),
              "| tc:", len(t["testcases"]))
    print("saved", OUT)


if __name__ == "__main__":
    main()
