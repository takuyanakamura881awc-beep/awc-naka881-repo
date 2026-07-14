# game/test — 工程5(テスト)ハーネス

`docs/screen-repro/01-requirements.md` §7 合格基準、`02-spec.md` §7 性能予算・E-15、
`03-design.md` §7 テストフック設計に対応するテストハーネス。詳細な実行結果・AC判定は
`docs/screen-repro/05-test-report.md` を参照。

## 構成

| ファイル | 内容 |
|---|---|
| `engine-test.js` | ゲームロジック回帰(`game/js/{data,horse,race,state}.js`)。ブラウザ不要、Node単体で実行 |
| `browser-test.js` | Playwright-core によるブラウザ実行マトリクス(距離×天候×頭数、E-15強制、フォールバック、実UI通しフロー、性能実測) |
| `package.json` | `playwright-core` の依存定義(`"type":"commonjs"` — リポジトリルートの `package.json` が `"type":"module"` のため、このディレクトリ配下だけ CommonJS へ戻すために必要) |
| `.gitignore` | `node_modules/` と `shots/`(スクリーンショット等の生成物)を除外 |
| `shots/` | `browser-test.js` 実行時に生成されるスクリーンショット置き場(コミット対象外) |

## 1. engine-test.js の実行

依存なし。プレーンな Node で実行できる。

```bash
node game/test/engine-test.js
```

成功時は末尾に `ALL OK` を出力し exit code 0。失敗があれば `FAIL: ...` 行と共に非0で終了する。

## 2. browser-test.js の実行

### 事前準備(初回のみ)

```bash
cd game/test
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npm install
```

**重要**: `playwright install` は絶対に実行しないこと。Chromium は `/opt/pw-browsers` に
同梱済みであり、`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` で新規ダウンロードを防止する。
`browser-test.js` はブラウザ実行ファイルを `/opt/pw-browsers/chromium-<rev>/chrome-linux/chrome`
から自動解決する(`PLAYWRIGHT_BROWSERS_PATH` 環境変数を尊重)。この環境が無い場合は
`CHROME_PATH` の解決に失敗するため、別環境で実行する際は `resolveChromePath()` の探索先を
調整すること。

### 実行

```bash
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
  node game/test/browser-test.js
```

内部で `game/` をリポジトリルート相対の静的HTTPサーバ(ポート8935)として自前起動するため、
別途サーバを立てる必要はない。所要時間は概ね4〜6分(ヘッドレスsoftware WebGLのため実機より遅い)。

成功時は末尾に `=== RESULT: PASS ===` を出力し exit code 0。1件でもFAILがあれば
`=== RESULT: FAIL ===` で非0終了する。実行中の各チェックは `ok`/`FAIL` 行としてコンソールに
逐次出力され、末尾に AC判定用の生証跡(`AC EVIDENCE`)をJSONで出力する。

### 実行内容の概要

1. **距離{1200,2400,3600}×天候{良,不良}×頭数{5(WBC・ナイター),18(G1・昼)} = 12組**
   のマトリクスを、`window.__view.t` への直接ジャンプ(合成注入)で高速に走査し、
   JSエラー0・draw call予算(per-pass≤140/総frame≤280)・`SH._rvState`主要フィールドの
   整合を確認する。うち2組(G1-2400-良の18頭・WBC-2400-良の5頭ナイター)は
   タイトル→ゲート→道中→コーナー→直線→ゴール→リプレイ→掲示板の全局面スクリーンショットを取得する。
2. **E-15強制(`?rvq=0..4`)**: 各段階で `qualityLevel` が指定値どおりに持続すること、
   stage4で `viewMode="single"` かつ右ビューのdraw callが0であることを確認。
   `SH._rvForceQuality()` 実行時フックも確認。
3. **フォールバック(`?rvnogl=1`)**: 合成注入での即時確認(`SH._rvState`契約・
   キャンバス寸法1280×720)。
4. **ゲームフロー通し(実UI操作)**: タイトル→生産→厩舎→レースタブ→馬券購入→観戦→
   リプレイ→掲示板→払戻→週送りを実クリックで駆動(通常経路・`?rvnogl=1`経路の両方)。
   `SH._rvState` はリプレイ/掲示板フェーズに入ると更新が止まる(工程4の仕様どおり)ため、
   「掲示板への到達」は `SH._rvState` ではなく DOM シグナル(`.canvas-wrap.tv` 要素の消失
   = `onDone` 到達)で検知する。
5. **性能実測**: 18頭立てG1・WBCナイターについて、実時間でのrAF間隔統計を3秒間収集する。
   ヘッドレスsoftware WebGL環境のため fps 実測値は**参考値**(実機の55fps/27fps基準の
   判定には使えない)。E-15の自動縮退が機能していることの確認が主目的。

## 出力アーティファクト

- スクリーンショット: `game/test/shots/*.png`(コミット対象外)。各ファイル名は
  シナリオ名(例 `hero-g1-2-michi.png` = heroのG1レース・道中の1枚)を表す。
- コンソールログの `AC EVIDENCE` セクション: AC判定の生データ(JSON)。
  `docs/screen-repro/05-test-report.md` の根拠として使用した。
