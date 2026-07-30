# Claude Codeへの依頼文

添付の `priority_medium_excel_design_input_v1.zip` を読み込み、1チーム1Excelファイルの詳細設計書を生成してください。

## 入力
- common/excel_template_spec.md
- common/sheet_definition.md
- common/design_style_guide.md
- data/Txx_design_data.json
- images/Txx_architecture.png

## 出力
- T01_detailed_design.xlsx
- T02_detailed_design.xlsx
- T03_detailed_design.xlsx
- T05_detailed_design.xlsx
- T06_detailed_design.xlsx
- T07_detailed_design.xlsx
- T08_detailed_design.xlsx
- T09_detailed_design.xlsx
- T10_detailed_design.xlsx
- T11_detailed_design.xlsx
- priority_medium_detailed_excel_design_final.zip

## 重要ルール
- 1チーム1Excel。
- T04は除外。
- 全チーム共通シートは削除しない。設計不要なら不要理由を記載。
- アプリ固有シートは該当アプリを使用する場合のみ作成。
- Copilot Studio設計は手厚く作成。
- SharePoint設計は列表示名、内部名、列種類、必須有無、選択肢、入力例まで記載。
- Power AutomateはB粒度（実装前設計レベル）。
- ダミーデータはサンプル行つき。
- テストケースは基本ケース中心。
- バナー画像をトップシートとアーキテクチャシートに貼り付ける。
- 画像だけに頼らず、構築に必要な表データを必ず残す。
