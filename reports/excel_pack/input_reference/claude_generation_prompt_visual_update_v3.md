# Claude Codeへの追加依頼：高品質画像版 v3

添付の `priority_medium_excel_design_input_v3_high_quality_visuals.zip` を、既存の `priority_medium_excel_design_input_v1.zip` と一緒に読み込んでください。

## 目的
前回の追加画像は簡素化されてしまったため、今回はV1のような高密度・業務設計書風の画像をチームごとに適切な枚数だけ再作成しています。

## 重要ルール
- このZIP内の画像だけを追加画像として使用してください。
- 前回の `priority_medium_excel_design_input_v2_visuals.zip` は使用しないでください。
- 画像はExcel理解補助として積極的に貼り付けてください。
- ただし、画像だけで終わらせず、構築に必要な表データは必ず残してください。
- チームごとに画像枚数は固定ではありません。`images/team/` 配下に存在する枚数を、そのチームに必要な画像枚数として扱ってください。
- 1チーム最大10枚まで貼り付け可ですが、無理に枚数を増やさないでください。
- 画像を縮小しすぎると読めなくなるため、必要なら1画像を1シートの上部または専用セクションに大きく配置してください。

## 推奨配置
- `*_02_mvp_flow.png`: 02_MVPスコープ または 03_全体業務フロー
- `*_03_role_split.png`: 06_人AI自動化分担
- `*_04_sharepoint_*` または `*_04_storage_design.png`: SPO_リスト設計 / SPO_ライブラリ設計 / OneDrive_保管設計
- `*_05_copilot_*`: CS_CopilotStudio設計
- `*_06_power_automate_*`: PA_PowerAutomate設計
- `*_07_outlook_boundary.png`: Outlook_メール予定表設計
- `*_06_test_plan.png` / `*_07_test_plan.png` / `*_08_test_plan.png`: 09_テストケース または 11_メンター確認チェックリスト
- `*_05_word_output.png`: WordPPT_出力設計
- `*_05_risk_constraints.png`: 10_リスク・躓きポイント

## チーム別画像枚数
`images/team_image_counts.json` を参照してください。
T01〜T11で使用アプリや設計範囲に応じて枚数を変えています。
