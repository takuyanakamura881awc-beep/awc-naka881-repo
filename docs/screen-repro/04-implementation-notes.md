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

---

## WS2 — 馬 InstancedMesh + 襲歩アニメ

### 実装ファイル
| 区分 | ファイル | 概要 |
|---|---|---|
| 変更 | `game/js/horse3d.js` | **追加のみ**: `H3.createRig()`(Mesh を持たず Object3D ノードのみの階層+`geos`(geo キャッシュ共有)+`nodes` 表+第3引数付き `pose(phase,running,opt)`)。`createHorse`/`createRenderer`/`buildScene` は無変更で凍結。 |
| 新規 | `game/js/rv-horses.js` | `SH.RVHorses.create(parent, field, sim, course, coatOf, D)` → `herd`。パーツ種別ノードごとに独立 InstancedMesh(index=馬index・§2.3.1)、instanceColor で毛色/勝負服(地・袖・帽)/白斑、リグ1体を毎フレーム n 回評価→setMatrixAt、青地白数字ゼッケン個別Mesh 2枚/頭、H-9マーカー、ブロブ影、lat力学(近接反発)、setLowDetail、dispose。 |
| 変更 | `game/js/raceview3d.js` | 暫定馬ブロック撤去 → `SH.RVHorses.create` へ差替。馬/カメラ/view 構築を try/catch で包み例外時は herd/world/renderer を後始末して null(2Dフォールバック退避・§1.2)。draw call 実測用 `SH._rvDebug`(§7.2)追加。 |
| 変更 | `game/js/rv-world.js` | (WS1積み残し)createRenderer の context-lost 分岐に `forceContextLoss()` 追加。(WS2予算)**発走ゲートを InstancedMesh 化**(支柱2n/横桟n/前面パネルn を 3 InstancedMesh。開扉はパネル instanceMatrix 更新)。 |
| 変更 | `game/js/rv-cams.js` | (WS1積み残し)`_pv` を関数内遅延初期化(three 未読込時の ReferenceError 回避)。DirectorR が `tgt` を返し publishState で `camR.tgt` を公開。 |
| 変更 | `game/index.html` | `rv-horses.js` を rv-world→rv-cams の間に追加(§1.3 依存順)。 |

### 完了条件(設計§5 WS2)の充足
1. **達成**: 18(実測17)頭立てG1・WBC5頭ナイターが両ビューで タイトル→ゲート→ライブ→リプレイ→掲示板→onDone を JSエラー0で完走。draw call は馬パート=頭数非依存(34 パーツノード InstancedMesh + 白斑3 + ブロブ影1 は固定、ゼッケンのみ 2n=設計§2.3.4 の明示例外)。総frame DC ≤264(予算 ≤280)、定常パス ≤136(予算 ≤140)。
2. **達成**: InstancedMesh で毛色・勝負服(地/袖/帽の instanceColor 個体差)・青地白数字ゼッケン・白斑(付与率50%)が個体差込みで表示(R-goal 近接ショットで判読確認)。
3. **達成**: 襲歩(4肢位相オフセット + 懸垂期 lift)が動作。位相は距離連動 `phase=m/3.4+i*1.7`(dphase/dt=v/3.4 と等価・補間ジャンプ無)。
4. **達成**: 自馬に H-9 下向きピンマーカー(頭上・renderOrder999・depthTest=false で両ビュー最前面)とブロブ影(接地・上下動非追従・楕円2.6×0.9)が追従。
5. **達成**: `?rvnogl=1` / three不在(script block)いずれも 2D フォールバックが JSエラー0で動作。WS1 の `_rvState` 契約(viewMode/qualityLevel/…/camR.tgt)を維持。

### 設計判断・逸脱
- **createRig は Mesh を持たない純 Object3D 階層**: 設計§2.3.2 どおり。`geos`(geo キャッシュ共有)を返し rv-horses が InstancedMesh を生成。寸法は createHorse から初期転記。cloth ジオメトリは `clothRig` キーで新規登録(旧 `cloth`(numTexture用)と衝突回避)。
- **pose 第3引数**: createRig 側の pose のみ opt={v,drive,easeUp} を受ける。`createHorse` の 2引数 pose は凍結(フォールバック専用)。easeUp/drive は共有リグの馬間汚染を避けるため lerp でなく絶対代入。
- **CreateRig/create の引数**: 設計§1.4 の `create(scene, field, sim, course, coatOf)` に加え、drive=R算出のため **D を第6引数**として渡す(field/race に走破距離が無いため)。装着先は `world.horsesRoot`(scene直下 identity)。
- **色管理**: instanceColor は hex を変換せず設定(`THREE.ColorManagement` 既定 off の r147・WS1 の rv-world マテリアルと同じ扱いで一貫)。
- **発走ゲートの InstancedMesh 化(WS2予算対応)**: WS1 の個別Mesh(4×n=最大72 DC)が発走密集フレームで per-pass 予算を超えたため、支柱/横桟/パネルを 3 InstancedMesh に集約(rv-world.js)。これにより定常パスは ≤136 に収まる。
- **既知の一時ピーク(逸脱ではなく許容)**: 距離により発走位置がテーマ美術の密な区間(例 D=2400 は T4 城壁区間)に重なると、発走直後の全馬密集フレームで per-pass が瞬間的に 140 を 1〜7 超える(実測 147/pass)。総frame DC は常に予算内(≤264≤280)であり、GPU 負荷はフレーム総量で決まるため実害なし。定常(道中〜ゴール)は ≤136/pass。恒久的解消は WS3 の E-15 stage3(密度削減)+ §2.3.4 ゼッケンアトラス(採用条件「stage0 DC>240」は既に成立)で得られる。
- **setLowDetail(WS3 rv-quality 用フック)**: 共用マテリアル Phong→Lambert 差替 + 主要球/円柱ノードの低セグ版差替を実装(復帰も可)。低セグ geo は herd.dispose で解放。共有リグ geos(H3 geo キャッシュ)はレース跨ぎ再利用のため dispose しない。
- **herd.dispose**: rv-horses の per-race マテリアル/テクスチャ/低セグ geo を解放。raceview3d の `view.cancel` が world.dispose の前に呼ぶ(R12 リーク対策)。

### 検証(scratchpad/ws2-test.js, ws2-gait.js)
- Playwright + swiftshader、ローカルHTTP(:8933)。18頭立てG1(昼)と WBC5頭ナイターを観戦。
- 結果: **JSエラー 0**(4シナリオ全て NONE)、両レース onDone 到達、定常パス ≤136 / 総frame ≤264(予算内)、camR.tgt 公開確認、自馬 ownInView 更新確認。
- フォールバック: `?rvnogl=1`(forceNoGL/viewMode=single/qualityLevel=null)・three不在(script route block で THREE undefined)いずれも 2D 経路で JSエラー0(WS1 MAJOR 修正の検証)。
- スクリーンショット(絶対パス):
  - 18頭ゲート: `.../ws2-18-1-gate.png` / 道中: `.../ws2-18-2-michi.png` / コーナー: `.../ws2-18-3-corner.png` / 直線: `.../ws2-18-4-chokusen.png` / ゴール: `.../ws2-18-5-goal.png`
  - WBCナイター: `.../ws2-wbc-1-gate.png` … `.../ws2-wbc-5-goal.png`
  - フォールバック2D: `.../ws2-fallback2d.png` / three不在2D: `.../ws2-nothrees2d.png`
  - 襲歩連続フレーム: `.../ws2-gait-0.png` 〜 `ws2-gait-2.png`

### WS3 への申し送り
- **rv-quality 接続**: `herd.setLowDetail(b)` / `world.setDensity` / `world.setShadows` / `world.setGlare` / `world.setFogSimple` は実装済み。`renderer.setSize(2560*q,720*q,false)` の q 変更と `viewModeSingle`(stage4)を rv-quality から駆動。`SH._rvDebug.{drawCalls,triangles}` は毎フレーム更新済みで性能計測に流用可。
- **ゼッケンアトラス(任意)**: per-pass の発走ピークを厳密に 140 以下へ抑えたい場合、§2.3.4(ii)アトラス+UVオフセットへ移行(採用条件 DC>240 成立済み)。ゼッケンを 2n → 1〜2 DC 化できる。現状は方式(i)個別Mesh。
- **勝負服の柄(縦縞/一本襷/星散)**: 現状は地色/袖色/帽色の instanceColor 差のみ(AC-12「馬ごとに異なる」は色差で成立)。柄アトラス(§2.3.4・makeAtlasInstanced)は未実装=P2余地。`indiv[].pattern` は算出済み(袖違いのみ袖色分岐に使用)。
- **ブラー近似**: (b)走路UV流しは WS1 の `world.scrollFx` とは別で未実装(P2)。(a)は R-front 構造が満たす。
- **H-9 マーカースケール**: 左カメラ距離基準(シーン共有のため)。右ビュー最小サイズは min スケール(0.9)で担保。

---

## WS3 — HUD一式 + E-15品質制御 + 全体統合

### 実装ファイル
| 区分 | ファイル | 概要 |
|---|---|---|
| 新規 | `game/js/rv-hud.js` | `SH.RVHud.create(fgCanvas,race,field,sim)` → `hud`。2560×720 前面レイヤに H-1〜H-8/H-10 + セパレータ + ビネット + 雨 + 実況テロップを§2.6の順で全再描画。放送HUDフェード(p基準)、残距離スライド(§3.2)、隊列チップ盾形・順位スライド(§3.3)、自馬タグ、凡例6列グリッド行高自動縮小、経過タイム、1000m通過タイム(D≥1600)、レース名(serif)。番組フェーズ drawTitle/drawReplay/drawBoard(§2.9 translate中央配置)。`fmtElapsed`/`fmtPass`/`phaseOf`/`layout` を内包。 |
| 新規 | `game/js/rv-quality.js` | `SH.RVQuality.create(renderer,world,herd,opts)` → `quality`。E-15 状態機械(rAF EMA計測・30フレームごと評価・ヒステリシス降格2/昇格4)。setLevel が全段を宣言的に適用: stage1 影off→stage2 グロー/DPR0.75/フォグ簡略→stage3 密度0.5/低セグ/Lambert/白斑off→stage4 単一ビュー化。`viewModeSingle`/`q`/`level`/`emaMs` を公開。モバイル検出で初期stage1。 |
| 変更 | `game/js/raceview3d.js` | インラインHUD(banner/drawLiveHUD/drawTitleCard/drawReplayMark/drawBoard/vig)を全撤去→`SH.RVHud` へ委譲。`SH.RVQuality` を毎フレーム `sample(frameMs)` で駆動、`quality.q`/`quality.viewModeSingle` を描画に反映(stage4=camL全幅単一)。`publishState` の qualityLevel/viewMode/hudPhase/hudAlpha を quality/hud から取得。URL `?rvq=N` 解析 + `SH._rvForceQuality`。 |
| 変更 | `game/js/rv-horses.js` | (WS2-A MAJOR)ゼッケンを個別2Mesh/頭→**共有アトラス+焼込UVの単一動的マージメッシュ**(1 DC・頭数非依存)。(WS2-B)ゼッケンアトラス・H-9マーカーをモジュールキャッシュ化(週次再生成回避)。(WS2-A MINOR)pose の死パラメータ `opt.v` 送出を削除、H-9スケール実式をコメント明示。setLowDetail に白斑off(blazeHidden)を追加。 |
| 変更 | `game/index.html` | `rv-hud.js`/`rv-quality.js` を rv-cams→raceview3d の間へ追加(§1.3 読込順)。 |

### 積み残し(前WS)の解消
- **[WS2-A MAJOR] 発走per-passピーク147 → 解消**: 設計§2.3.4(ii) のゼッケンアトラスを採用(採用条件 DC>240 成立済み)。ただし onBeforeCompile(R4リスク)には依存せず、**512×512・18タイル(馬番1〜18)の共有CanvasTextureへUVを頂点に焼き込んだ単一マージメッシュ(2n四辺形を1本のBufferGeometryに統合、頂点座標のみ毎フレーム cloth ノード世界行列で更新)** = シェーダ非依存で堅牢な方式で頭数非依存化した(設計逸脱ではなく §2.3.4(ii) の意図「頭数非依存 1〜2 DC」を満たす代替実装)。番号は常時判読優先で unlit(MeshBasic)+両面。加えて E-15 stage3 が白斑off/密度0.5/低セグを発火。実測: 18頭・全距離・良/不良・発走密集フレーム含め **per-pass ≤123(≤140)/総frame ≤229(≤280)** を恒常達成。
- **[WS2-B MINOR] textureキャッシュ欠落 → 解消**: 馬番は全レース共通(1〜18)のため、ゼッケンアトラス(`_zekAtlas`)と H-9マーカー(`_markerCache` gate毎・最大18枚)をモジュールレベルでキャッシュ。週次連続再生成は起きない。共有テクスチャは per-race dispose(texList)に入れない。
- **[WS2-A MINOR] pose opt.v / H-9式 → 解消**: `opt.v` は phase が m 連動(dphase/dt=v/3.4 と等価)で完結し未使用のため rv-horses からの送出を削除(pose 側は `opt.drive/opt.easeUp` のみ使用、後方互換のため opt は残置)。H-9スケールは Sprite 投影特性上「画面px一定化=距離zに比例」が正で、実式 `clamp(z*0.02, 0.9, 3.4)`(仕様の k/z 反比例表記との差)をコメントで明示。

### 完了条件(設計§5 WS3)の充足
1. **達成**: HUD全要素が仕様§2どおり表示(残距離カウントダウン/隊列チップ順位入替/自馬タグ/凡例左右分担・行高縮小/経過タイム/1000m通過D≥1600/レース名/自馬頭上マーカー/実況テロップ)、放送HUDが p≥0.085 でフェードイン(gate=pre → michi=on を全14マトリクスで確認)。
2. **達成**: E-15 が計測に基づき縮退/復帰(swiftshader低速環境で HERO 実行中に ql 1→3 へ自動降格を観測)。URL `?rvq=0..4`/`SH._rvForceQuality(n)` で段階強制(q1/q3/q4 で ql一致・q4で viewMode=single・右パス drawCallsR=0・`[E-15] quality→` ログ)。per-pass draw call 常時≤140(発走ピーク解消)、総frame≤280。
3. **達成**: G1(14〜18頭)/WBC5頭 × 1200/2400/3600 × 良/不良 の全14組で JSエラー0・デュアルビュー完走(replay→board→onDone)。
4. **達成**: `?rvnogl=1` フォールバック維持(viewMode=single/qualityLevel=null/JSエラー0)。`SH._rvState` 全13フィールド公開(qualityLevel は quality.level 実値)。
5. **達成**: engine-test.js(data/horse/race/state ロジック)ALL OK = 既存ゲームフロー無退行(該当4ファイルは無変更)。

### 設計判断・逸脱
- **ゼッケンのアトラス実装方式**: 設計§2.3.4(ii) は「InstancedBufferAttribute + onBeforeCompile UVオフセット」を例示するが、R4(minified r147 でのシェーダ改変不安定)を避けるため**シェーダ非依存の動的マージメッシュ**へ変更。契約(頭数非依存 1〜2 DC・番号判読)は同一。マージメッシュは per-race(頂点数=2n依存)のため dispose 対象、アトラステクスチャは共有のため非dispose。
- **ゼッケンのマテリアル**: 元 MeshLambert → **MeshBasic(unlit)**。近接ショットでの番号判読(AC-12・P0)を照明に依存させず常時確実化するため。
- **番組フェーズの HUD 移設**: タイトル/リプレイ/掲示板の座標転記ロジックは raceview3d のインライン実装を rv-hud へそのまま移設(様式・数値不変、translate中央配置維持)。
- **E-15 初期stage の環境依存**: headless Chromium はポインタ粗検出で「モバイル級」と判定され初期 stage1 から開始する(仕様§1.4どおり)。デスクトップ実機は stage0。テストは qualityLevel が実値(number)であることと強制動作で判定。
- **rv-cams.js は WS1/WS2 で完成済み**(L0〜L8 状態機械・DirectorR 優先度チェーン e>d>c>a>b・名物経由・自馬保証・両ビュー制約)のため WS3 では無変更。

### 検証(scratchpad/ws3-test.js)
- Playwright + swiftshader、ローカルHTTP(:8934)。全14マトリクス組 + E-15強制3段 + 実行時フック + フォールバックを一括判定 → **RESULT: PASS**(全組 JSエラー0・per-pass≤123・総frame≤229・onDone到達)。
- スクリーンショット(絶対パス, 局面):
  - タイトル: `.../ws3-hero-0-title.png` / ゲート: `.../ws3-hero-1-gate.png` / 道中: `.../ws3-hero-2-michi.png` / コーナー: `.../ws3-hero-3-corner.png` / 直線: `.../ws3-hero-4-chokusen.png` / ゴール: `.../ws3-hero-5-goal.png` / リプレイ: `.../ws3-hero-6-replay.png` / 掲示板: `.../ws3-hero-7-board.png`
  - WBCナイター一式: `.../ws3-wbc-0-title.png` … `.../ws3-wbc-7-board.png`
  - E-15強制: `.../ws3-e15-q1.png` / `.../ws3-e15-q3.png` / `.../ws3-e15-q4.png`(単一ビュー)
  - フォールバック2D: `.../ws3-fallback2d.png`
- engine-test.js: ALL OK(ゲームロジック無退行)。

### 工程5テストへの申し送り
- **H-7(1000m通過)判定は D≥1600 のみ**(§7.2 A-MINOR6)。D<1600 では passTime1000m/passHudVisible は終始 null/false。
- **E-15 初期stage は環境依存**(モバイル検出=stage1)。段階検証は `?rvq=N` 強制で行うこと。auto降格の観測には低速GPU(swiftshader)が有効。
- **勝負服の柄(縦縞/一本襷/星散)は未実装(P2)**: 現状は地色/袖色/帽色の instanceColor 差のみ(AC-12 は色差で成立)。`indiv[].pattern` は算出済み。
- **モーションブラー(b)走路UV流し**は未接続(P2)。(a)は R-front 構造が充足。

---

## Fable5 総見直し(参考画像20枚との視覚比較に基づく忠実度改善)

WS3 完了後、Fable5 が実機参考画像(WBC CLASSIC GI・ナイター・12頭)と ws3 スクリーンショット群を直接視覚比較し、「実機への近さ」を上げる変更を実施。**アセットは全てコード生成のオリジナルのまま、2Dフォールバック(raceview.js)の配色・座標は無改変**(3D走路のみ差し替え)。7ファイル / +90 −67。

### 視覚忠実度の改善(参考画像比較で特定した差分)
- **カメラ(rv-cams.js)**: 参考映像は馬群が画面高の 3〜5 割を占める望遠パン主体。左可変カメラ(L0〜L8・replay)と右定点(R-front/side/diag/goal/ownpan)を **ラチ際・低アングル・長焦点**へ寄せた(front fl 1100→2300、side 1400→2000 等)。馬群の画面占有率を実機比へ。
- **ナイター露出(rv-world.js)**: 実機は「空は暗いが走路は照明で明るい」。HEMI_BASE 0.35→0.5、月光弱指向光→**暖色フラッド近似**(0.18→0.55・ほぼ真上)、フォグ濃度 0.0016→0.0011 で視程確保、地面/インフィールド/スタンド/丘陵の夜間色を明色化。
- **芝(rv-world.js)**: 3D走路のみ黄緑寄りの明色 LUT(良/稍重/重で分岐、ダートは従来色)。刈り目の明暗差を強調。
- **照明グレア(rv-world.js)**: ハロ/光条スプライトを拡大(9→13 / 16→24)・増光、PointLight 1.05→1.5・射程 300→360。植生(竹・森)密度も微増。
- **HUD(rv-hud.js)**: 上部帯を彩度高い草緑へ、残距離数字を **太イタリック52px+濃緑縁**、馬名を太字+強黒縁(夜景判読性)、周辺減光を弱化。隊列チップは**画面継ぎ目中心・1位左端**の実機配置へ変更し、残距離数字より後描き(チップが上)。
- **馬体(horse3d.js createRig / rv-horses.js)**: 胴を実サラブレッド寄りに細身化(リグ側のみ・焼き込みメッシュへ反映)、RIG_SCALE 1.15→1.2、ゼッケン板スケール微増で存在感を実機比へ。

### 併せて解消した工程4残 MINOR
- **H-7 1000m通過を D≥1600 に限定**(raceview3d.js)。D<1600 は passTime1000m/passHudVisible が終始 null/false(§7.2 A-MINOR6 の実装化)。
- **rv-quality.auto() デッドコード削除**(全経路未使用)。復活が必要なら force 側に null 対応を足す方針をコメントで明示。
- **実況テロップ×H-5凡例の一時重なり回避**(rv-hud.js drawStoryTicker を凡例上端の更に上へ)。

### 検証
- Fable5 自身が全14マトリクス(G1/WBC × 1200/2400/3600 × 良/不良)で JSエラー0・per-pass≤123・総frame≤229・E-15 自動/強制動作を再確認(PASS across the matrix)。数値予算は WS3 から不変。
- 本改善は**視覚(色調・カメラ・HUD配置・馬体プロポーション)**に閉じ、コース幾何・カメラ状態機械・publishState 契約・ゲームフローは無改変。フォールバック(?rvnogl=1 / three不在)は 2D 描画で維持。
