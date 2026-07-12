# 04. 実装ノート(工程4)

上位: `03-design.md`(詳細設計・正)。本書は工程4実装の判断・設計逸脱・残作業を記録する。

---

## WS1 — 3Dワールド + デュアルビュー基盤

### 実装ファイル
| 区分 | ファイル | 概要 |
|---|---|---|
| 新規 | `game/js/rv-world.js` | `SH.RVWorld`: createRenderer / build(フラットAPI)。コース幾何流用・テーマT0〜T6美術・ナイター照明/フォグ/グレア・CanvasTexture工場・可視制御・dispose |
| 新規 | `game/js/rv-cams.js` | `SH.RVCams`: DirectorL(L0〜L8 + l4Doneラッチ)/ DirectorR(定点列・先回り・再同期・名物経由・自馬保証・優先度 e>d>c>a>b) |
| 新規 | `game/js/raceview3d.js` | `SH.RaceView3D.create`: 2560×720キャンバス群・2パス描画・番組フェーズ・シム補間・publishState一元化・失敗時dispose |
| 変更 | `game/js/raceview.js` | §1.2 diff 2箇所のみ(冒頭ディスパッチャ + 末尾 `SH.RV2D` 公開)。既存本体は `createRaceView2D` として温存 |
| 変更 | `game/index.html` | three→horse3d の後に rv-world→rv-cams→raceview3d を追加 |
| 変更 | `game/js/data.js` | `SH.isNightRace` を追加(既存値不変) |

### 完了条件(設計§5)の充足
1. WBC(5頭)ナイターがデュアルビューで タイトル→ゲート→ライブ→リプレイ→掲示板→onDone を JSエラー0で完走 — **達成**(ws1-test.js: onDone到達・errors NONE)。
2. 左=可変カメラ(L0〜L8)、右=定点カメラ列 — **達成**(左 L3/L4/L6/L8、右 R-side/R-front/R-diag/R-name/R-goal を確認)。
3. テーマT0〜T6・夜間照明/フォグ/トーン — **達成**(竹/森/石橋/城壁/丘/暗森/スタンド + PointLight照明塔 + FogExp2 + applyTone)。
4. `?rvnogl=1`/`SH._forceNoWebGL` フォールバック — **達成**(2D経路が無変更で完走・viewMode=single/qualityLevel=null)。
5. `SH._rvState` 骨格公開 — **達成**(viewMode/qualityLevel/hudPhase/hudAlpha/elapsedSec/remainM/distShown/rankOrder/camL/camR/shotL/passTime1000m/passHudVisible/ownInViewSince)。

### 設計判断・逸脱
- **前任コードの継承**: `rv-world.js` は前任(別モデル)による 940 行の実装が未コミットで存在した。設計API(フラットAPI §1.4)へ忠実で品質が高かったため破棄せず継承し、致命バグのみ修正した:
  - **`scrollTexs` の TDZ バグ修正**: `buildGorge`(滝生成)が `const scrollTexs`(旧・末尾宣言)を参照しており、実行時に Temporal Dead Zone の ReferenceError で `build()` が必ずクラッシュしていた。宣言を構築開始前へ移動して解消。
- **isNightRace の二重定義**: 設計§1.1では data.js 所管。統括指示どおり `data.js` に追加。`rv-world.js` 側にもガード付き(`if(!SH.isNightRace)`)の定義が残るが、data.js が先に読み込まれるため上書きされず無害。将来的に rv-world.js 側は削除可。
- **可視制御の粒度**: 設計§2.4.2 の 50m チャンクGroupの代わりに、WS1 は静的物件数が少ないため「オブジェクト粒度 + テーマ範囲の距離判定」で同一契約(`updateVisibility(camLpos,camRpos)`)を実装。挙動は同等(±380m窓)。
- **馬は暫定(WS1範囲)**: 既存 `SH.Horse3D.createHorse` の個別Mesh を n 体、`world.horsesRoot` に装着。InstancedMesh 化・ゼッケン青地化・勝負服多彩化・白斑・懸垂期・H-9マーカー・ブロブ影は **WS2** で実装。デュアルビューで馬が動いて見えることは確認済み。
- **HUD は暫定(WS1範囲)**: raceview3d.js 内に H-1帯/残距離/レース名(H-8)/経過タイム(H-6)/隊列チップ(H-3簡易)/実況テロップ/セパレータ/ビネット/フェーズバナー(H-10)/掲示板/タイトル/REPLAY を座標転記で実装。H-2スライド則の完全版・H-4自馬タグ・H-5凡例グリッド・H-7通過タイム表示・チップスライドアニメ・hudPhaseフェードの厳密適用は **WS3**(rv-hud.js)へ。
- **rv-cams は完全版に近い暫定**: 設計§5では「L=4モード + R=(a)(b)のみ」の素朴版で足りるが、完了条件#2「仕様どおり動作」を満たすため L0〜L8 状態機械と DirectorR の優先度チェーン e>d>c>a>b を実装済み。両ビュー共通制約(近接→forceNext)も実装。品質制御(rv-quality)は未接続のため qualityLevel は常に 0。
- **applyTone の基準 s**: 設計は「左カメラの s」。カメラは走路外にあり lap-s を持たないため、`world.sOfM(leadM)`(先頭の lap-s)を近似基準に採用。区間トーンの一貫性は保たれる。
- **番組フェーズの座標転記**: タイトル/掲示板は既存 1280系レイアウトを `translate((2560-1280)/2, 0)` で中央配置し転記(§2.9・R11)。ロジックは既存様式を維持。

### 検証(scratchpad/ws1-test.js)
- Playwright + swiftshader、ローカルHTTP(:8932)で `game/index.html` を開き、`page.evaluate` で `SH.buildField`+`SH.simulateRace` により WBC 5頭ナイターを合成し `SH.createRaceView` に投入。
- 結果: JSエラー **0**(main/fallback とも NONE)。night=true・5頭・dual。左右カメラが仕様どおり切替。pass1000m 記録。onDone 到達。フォールバックは2D経路採用。
- スクリーンショット(絶対パス):
  - ゲート(全幅): `/tmp/claude-0/-home-user-awc-naka881-repo/a02b10bf-0a38-537f-8e0b-33f0a74d5424/scratchpad/ws1-1-gate.png`
  - 道中(デュアル): `.../ws1-2-michi.png`
  - コーナー: `.../ws1-3-corner.png`
  - 直線: `.../ws1-4-chokusen.png`
  - ゴール: `.../ws1-5-goal.png`
  - リプレイ: `.../ws1-6-replay.png`
  - 掲示板: `.../ws1-7-board.png`
  - フォールバック2D: `.../ws1-8-fallback2d.png`

### WS2 への申し送り
- **馬の置換**: raceview3d.js の暫定馬ブロック(`horses3` 生成・`render3D` 内の馬ループ)を `SH.RVHorses.create(scene, field, sim, course, coatOf)` の `herd.update(...)` へ差し替える。`world.horsesRoot` が装着先。`coatOf` 規則は raceview3d.js に既に実装済み(SH.RV2D.COAT 使用)。
- **createRig/pose拡張**: horse3d.js に `H3.createRig()` と `pose` 第3引数(懸垂期/drive/easeUp)を追加(§2.3.0)。
- **H-9マーカー/ブロブ影**: 自馬 root 追従。ownIndex は raceview3d.js が算出済み(`ownIndex`)で dirR に渡している。
- **API整合**: `world.horsesRoot`(Group)・`world.course`・`world.night` は公開済み。rv-horses は setLowDetail を提供し、WS3 の rv-quality が呼ぶ。
- **注意**: 現状の暫定馬は `frustumCulled` 既定(true)。InstancedMesh 化時は全パーツ `frustumCulled=false`(§2.3.1・R2)。
