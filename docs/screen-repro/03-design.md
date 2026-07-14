# 03. 詳細設計書 — 実機正面大型スクリーン映像の様式再現(デュアルビュー観戦モード)

- 上位文書: `docs/screen-repro/02-spec.md`(視覚仕様書・承認済み・正)、`docs/screen-repro/01-requirements.md`(AC-1〜26)。本書は第3工程「詳細設計」成果物であり、仕様書の全数値を実装単位(ファイル/関数/データ構造/擬似コード)へ落とし込む。数値の正は常に 02-spec とし、本書の転記と食い違う場合は 02-spec に従う。
- 法的原則(要件§0)を継承: 全アセットはコード生成のオリジナル。複製・模写・トレースの設計は含まない。
- 技術前提: Three.js r147(UMD、`game/js/lib/three.min.js`)、ビルド不要、`window.SH` 名前空間への script タグ直列読み込み(既存パターン踏襲)。`SH.createRaceView(root, race, field, sim, onDone)` のシグネチャ不変。

---

## 1. ファイル構成と責務

### 1.1 ファイル一覧(新規 6 / 変更 3 / 温存)

| 区分 | ファイル | 責務 | 対応仕様 |
|---|---|---|---|
| **新規** | `game/js/rv-world.js` | 3Dワールド生成: コースリボン/地形/ラチ/生垣/テーマ T0〜T6 美術/可搬物(ゲート・距離ポール)/照明(ナイター/昼)/空/フォグ/グレア/CanvasTexture 工場/チャンクカリング/レンダラー生成 | §4, §5 |
| **新規** | `game/js/rv-horses.js` | 馬InstancedMeshシステム: PART_DEFS、リグ評価→行列書込、instanceColor(毛色/勝負服/白斑)、ゼッケン、H-9マーカー、ブロブ影、隊列力学(lat)、ブラー近似、低密度切替 | §6 |
| **新規** | `game/js/rv-cams.js` | カメラ演出: 左 DirectorL(L0〜L8 状態機械)、右 DirectorR(定点列・先回り・再同期・名物経由・自馬保証)、両ビュー共通制約 | §3 |
| **新規** | `game/js/rv-hud.js` | 2D HUD レンダラ(fgCanvas 2560×720): H-1〜H-8/H-10、フェーズ制御(hudPhase)、チップスライドアニメ、ビネット、雨、`fmtElapsed`/`fmtPass` | §2 |
| **新規** | `game/js/rv-quality.js` | E-15 動的品質スケーリング: 計測(EMA)・降格/昇格状態機械・stage0〜4 適用/復帰・強制フック | §7.2 |
| **新規** | `game/js/raceview3d.js` | WebGL 経路のオーケストレータ: `SH.RaceView3D.create` = view 構造体・再生ループ・番組フェーズ(タイトル/ゲート/ライブ/リプレイ/掲示板)・デュアルビューポート描画・操作(速度/スキップ/クリック)・実況ボックス・`SH._rvState` 一元更新 | §1, §6(番組), §7.3 |
| **変更(小)** | `game/js/raceview.js` | (a) `SH.createRaceView` 冒頭にディスパッチ数行を追加(下記 1.2)。(b) 末尾に共有ヘルパー公開 1 行(`SH.RV2D = {...}`)。**それ以外の全 1180 行は一切変更しない = 2D フォールバック経路として温存** | §8 |
| **変更(小)** | `game/js/horse3d.js` | 追加のみ: `H3.createRig()`(ポーズリグ=パーツ名タグ付き階層+ノード表。同一IIFE内の`geo()`/`G`幾何キャッシュを共有するため本ファイルに実装 — §2.3.0)、`pose(phase, running, opt)` の第3引数拡張(懸垂期/追う/流す)。既存 `createHorse`/`createRenderer`/`buildScene` は温存(フォールバック専用としてレガシー凍結・以後無変更。寸法はcreateRig初期実装時に転記するのみで同期対象ではない — §2.3.0) | §6.0, §6.6, §6.7 |
| **変更(小)** | `game/js/data.js` | `SH.isNightRace` を 1 関数追加(既存値は不変) | §5 |
| **変更(小)** | `game/index.html` | 新規 6 ファイルの script タグ追加(下記 1.3) | §1 |
| 温存 | `game/js/race.js` `game/js/horse.js` `game/js/state.js` `game/js/ui-util.js` `game/js/ui-race.js` `game/js/ui-stable.js` `game/js/main.js` `game/css/style.css` | 変更なし。`ui-race.js` の `renderLive` → `SH.createRaceView` 呼び出しはそのまま | 要件§0-4 |

- `style.css` 無変更の根拠: `.canvas-wrap canvas { width:100%; height:auto }` は基底キャンバスの `width`/`height` 属性から縦横比を導くため、基底(bgCanvas)を 2560×720 属性にすれば 32:9 表示は CSS 変更なしで成立する。レイヤー2枚は既存 `.canvas-wrap.tv canvas.layer`(absolute inset:0)で追従する。

### 1.2 フォールバック分岐設計(raceview.js への変更は 2 箇所のみ)

```js
// [変更1] raceview.js — SH.createRaceView の冒頭(既存本体は createRaceView2D として温存)
SH.createRaceView = function (root, race, field, sim, onDone) {
  if (!SH._forceNoWebGL && SH.RaceView3D) {
    const v = SH.RaceView3D.create(root, race, field, sim, onDone); // 失敗時 null
    if (v) return v;
  }
  // フォールバック(WebGL不可 / 強制フラグ): 既存実装そのまま
  SH._rvState = { viewMode: "single", qualityLevel: null };  // §8 仕様
  return createRaceView2D(root, race, field, sim, onDone);   // = 既存本体
};

// [変更2] raceview.js — IIFE 末尾に共有ヘルパー公開(重複実装の禁止。単一情報源)
SH.RV2D = { makeCourse, fmtTime, marginLabel, COAT, COAT_KEYS, skyColors, turfColors };
```

- `SH.RaceView3D.create` は内部で `SH.RVWorld.createRenderer(glCanvas)` を try し、WebGL コンテキスト取得失敗なら**以下の順で後始末してから** `null` を返す(→上記で 2D 経路へ。B-MINOR4・確定、§6 R12 WebGLコンテキストリーク対策): (1) `renderer.dispose()`、(2) `renderer.forceContextLoss()`(コンテキストの明示解放要求)、(3) `create()` 内でここまでに生成した `<canvas>` を DOM から除去、(4) その時点までに生成済みのテクスチャ/ジオメトリ(CanvasTexture キャッシュ等)を `dispose()`。`THREE` 未定義(three.min.js 読込失敗)の場合は renderer 自体が存在しないため (1)(2) を省略し (3)(4) のみ実施する。AC-16 は `SH._forceNoWebGL = true`(URL `?rvnogl=1`、§7 テストフック)で機械的に通す。
- 既存 2D 経路内の `use3d`(2D背景+個別Mesh馬のハイブリッド)は温存するが、WebGL 可の環境では新経路が先取するため実運用では通らない(コード削除はしない=回帰リスク回避)。

### 1.3 index.html の script 順(依存順)

```html
<script src="js/data.js"></script>          <!-- +SH.isNightRace -->
<script src="js/horse.js"></script>
<script src="js/race.js"></script>
<script src="js/state.js"></script>
<script src="js/ui-util.js"></script>
<script src="js/lib/three.min.js"></script>
<script src="js/horse3d.js"></script>       <!-- +createRig / pose拡張 -->
<script src="js/rv-world.js"></script>      <!-- ▼ここから新規(three/horse3dに依存) -->
<script src="js/rv-horses.js"></script>
<script src="js/rv-cams.js"></script>
<script src="js/rv-hud.js"></script>
<script src="js/rv-quality.js"></script>
<script src="js/raceview3d.js"></script>    <!-- 上5モジュールを統合 -->
<script src="js/raceview.js"></script>      <!-- ディスパッチ+2Dフォールバック本体 -->
<script src="js/ui-race.js"></script>
<script src="js/ui-stable.js"></script>
<script src="js/main.js"></script>
```

- `raceview3d.js` は `SH.RV2D`(raceview.js が公開)を**呼び出し時**にのみ参照するため、この読み込み順(raceview.js が後)で問題ない。

### 1.4 公開 API 一覧

| API | 定義ファイル | シグネチャ / 内容 |
|---|---|---|
| `SH.createRaceView(root, race, field, sim, onDone)` | raceview.js | **不変**。ディスパッチャ。返り値 view(`.cancel()`/`.t`/`.speed`/`.phase`) |
| `SH.RaceView3D.create(root, race, field, sim, onDone)` | raceview3d.js | WebGL経路本体。失敗時 `null` |
| `SH.RVWorld.createRenderer(canvas)` | rv-world.js | 不透明クリアの WebGLRenderer(`antialias:true, powerPreference:"high-performance"`)。失敗時 null |
| `SH.RVWorld.build(renderer, race, field)` | rv-world.js | → `world = {scene, course, night, themes, updateVisibility(camLpos,camRpos), applyTone(sOfCamL), scrollFx(dt), setDensity(v), setFogSimple(bool), setGlare(bool), setShadows(bool), poleMs, nameMs, dispose()}`(**フラットAPI・裁定確定**。旧設計の `api` サブオブジェクトは廃止し、全メソッドを `world` 直下に統一する — B-MAJOR3。`world.glareFx.visible=...` 等の内部プロパティ直接参照は禁止、必ず `world.setGlare(bool)` 等のメソッド経由とする。`chunks` は rv-world.js 内部実装(§2.4.2)にとどめ、公開フィールドからは外す) |
| `SH.RVHorses.create(scene, field, sim, course, coatOf)` | rv-horses.js | → `herd = {update(t,dt,pos,vArr,camL,camR), latOf(i), ownRootPos(out), setLowDetail(b), markerSprite}` |
| `SH.RVCams.createL(course, D, world)` / `SH.RVCams.createR(course, D, world, ownIndex)` | rv-cams.js | → director(`update(ctx)` → `{cam, mode/type, fl, empty, ownInView,...}`。`ownInView`=自フレームの自馬視野内判定。§2.5.3)。THREE.PerspectiveCamera を各自1個所有 |
| `SH.RVHud.create(fgCanvas, race, field, sim)` | rv-hud.js | → `hud = {drawLive(ctx), drawTitle, drawReplayMark, drawBoard, drawBanner, layout}`(内部にチップアニメ状態) |
| `SH.RVQuality.create(renderer, world, herd, opts)` | rv-quality.js | → `quality = {sample(ms), level, viewMode(), force(level), q}` |
| `SH.isNightRace(race)` | data.js | `race.grade==="WBC" || (race.week>=48 && race.grade==="G1")`(§5) |
| `SH.RV2D` | raceview.js | 共有ヘルパー(makeCourse/fmtTime/marginLabel/COAT/COAT_KEYS/skyColors/turfColors) |
| `SH._render3d` / `SH._rvState` / `SH._forceNoWebGL` | raceview3d.js / raceview.js | テスト用状態(§7.3、本書§7) |

### 1.5 依存関係図

```
ui-race.js ──▶ SH.createRaceView (raceview.js: ディスパッチ)
                 ├─(WebGL可)──▶ SH.RaceView3D.create (raceview3d.js)
                 │                ├─▶ rv-world.js ──▶ THREE / SH.RV2D.makeCourse
                 │                │                └▶ SH.isNightRace (data.js)
                 │                ├─▶ rv-horses.js ─▶ THREE / SH.Horse3D.createRig (horse3d.js)
                 │                │                 └▶ SH.RV2D.COAT / SH.WAKU_COLORS
                 │                ├─▶ rv-cams.js  ──▶ course(rv-world経由) / world.nameMs
                 │                ├─▶ rv-hud.js   ──▶ SH.WAKU_COLORS/WAKU_TEXT / SH.RV2D.fmtTime(掲示板)
                 │                └─▶ rv-quality.js ▶ renderer/world/herd の縮退フック
                 └─(WebGL不可)─▶ createRaceView2D (raceview.js 既存本体・完全温存)
                                    └─▶ SH.Horse3D(既存経路のまま・実質未使用)
```

---

## 2. モジュール設計

### 2.1 シーングラフ構成(rv-world.js、仕様§4・§5)

```
scene
 ├ .background = Color(夜空基調 or 昼空基調)   … §5.1/5.2(不透明クリア、bgCanvas非依存)
 ├ .fog = FogExp2(0x121a2a, 0.0016) | Fog(昼)   … §5.1/5.2(stage2で簡略)
 ├ lights: HemisphereLight ×1(区間トーン補間対象) / DirectionalLight(昼のみ)
 │         PointLight ×4〜6(ナイター照明塔、T0近傍中心に配置)
 ├ skyFx (Group): 月Mesh+ハロSprite / 星Points(40) / 雲ビルボード(昼)
 ├ trackGroup:
 │   ├ 走路リボン Mesh ×1(lap一周ぶんを1本のBufferGeometryで生成。UV.u=弧長s、
 │   │   刈り目テクスチャ512²RepeatWrapping。§4.3芝。UVスクロールでブラー近似§6.9(b))
 │   ├ 走路外地面 Mesh ×1(大円盤+インフィールド。暗トーン)
 │   ├ 決勝線 Mesh(s=369) / 砂色路肩帯(T3・T5)
 │   └ rails: 内ラチ生垣 InstancedMesh(T1/T2/T5) / 内白ラチ・外白柵(支柱=InstancedMesh、
 │       横桟=区間マージBufferGeometry ×数本)。§4.4寸法
 ├ themeChunks[]: 50m(lap空間s)ごとの Group。中に各テーマの静的美術(§2.4)
 │   … 可視制御はチャンク単位(§2.4 カリング)
 ├ portable (Group): 発走ゲート(m=0基準・毎レース配置) / 紅白距離ポール(D-200k、lat=+12.6)
 │   / ゴール柱(s=369固定, lat=+13.2, 高4.2m)
 ├ glareFx (Group): 照明塔ハロ/光条Sprite(AdditiveBlending)。stage2で一括 visible=false
 │   … 内部Groupであり外部へは公開しない。可視切替は `world.setGlare(bool)`(§1.4フラットAPI)経由のみ
 └ horsesRoot (Group): rv-horses が装着(§2.3)
     ├ 馬体+騎手 InstancedMesh ×34(ノードごとに独立・§2.3.1訂正) / 白斑 InstancedMesh ×3 / ブロブ影 InstancedMesh ×1
     ├ ゼッケン個別 Mesh ×2n / H-9 markerSprite ×1(自馬時のみ)
```

- **座標源**: `course = SH.RV2D.makeCourse(D)` をそのまま流用(§4.1)。美術のオーサリングは lap 空間 `s`(`sPos(s,lat,y) = course.pos(s - startWS_mod, lat, y)` 相当のヘルパー `world.posS(s,lat,y)` を rv-world に置く。実装は `at()` と同じ区分計算を s 直接で行う小関数で、`startWS` に依存しない)。
- **決定的生成**: 美術の乱数は全て `mulberry32(seed = テーマID*1000 + s量子化値)` のシード付きRNG。全レース・全リロードで同一ワールド(§4.1「全距離が同一ワールドを共有」)。
- **区間トーン(§5.3)**: `world.applyTone(sOfCamL)` が HemisphereLight の intensity/色をテーマ係数(T1/T2/T6=×0.8、T3/T5=×1.15)へ毎フレーム lerp(係数0.02)。**基準は左カメラの s のみ**(両パスでシーン状態を共有し、パス間のシーン変更を作らないため。右ビューは定点の PointLight が支配的で差は許容 — 設計判断)。

### 2.2 デュアルビュー描画パイプライン(raceview3d.js、仕様§1.3・§7.1)

1フレーム(ライブフェーズ)の処理順序。**(3)〜(6) の書込は 2 パス描画で共有し 1 回だけ**:

```
loop(now):
  (0) dt算出(≤0.1s) → sp決定(既存踏襲: t<0はsp=1 / R<90でsp*=0.32) → view.t += dt*sp
  (1) シム補間: pos[] = posAt(view.t), vArr[] = vAt(view.t)(frames線形補間・既存式踏襲)
      leadM / R = D-leadM / p = leadM/D / rankIdx(posAt降順)
  (2) カメラ更新: dirL.update(ctx) → camL(位置lerp 0.14/注視0.2/FL 0.1、切替はハードカット)
                  dirR.update(ctx) → camR(三脚固定・カット即値)
      view集約(§2.5.3・A-MINOR3): view.lastOwnInView = (dirL.ownInView || dirR.ownInView) ? view.t : view.lastOwnInView
      両ビュー共通制約チェック(§3.3): 位置距離<12m∧注視内積>0.98 → dirR.forceNext()
  (3) ポーズリグ評価→行列書込(herd.update):
      for i in 0..n-1: lat力学(§6.8) → rig.root配置(course.pos(m+i*0.02, lat[i]))
        → rig.pose(phase[i], running, {v,drive,easeUp}) → rig.root.updateWorldMatrix(false,true)
        → 各PART_DEF・各ノードk: instArr[part][k].setMatrixAt(i, node.matrixWorld)(§2.3.1訂正: ノードごとに独立InstancedMesh・index=馬index) / ゼッケンMesh.matrix直接コピー
      全 instArr[*][*]: instanceMatrix.needsUpdate = true(フレームに1回)
      markerSprite追従(自馬root+2.5m+浮遊) / ブロブ影行列
  (4) ワールド更新: world.updateVisibility(camL.position, camR.position)(±380m球判定)
      world.applyTone(sOf(camL)) / world.scrollFx(dt)(滝UV・ブラー用走路UV)
  (5) WebGL 2パス描画(q = quality.q):
      renderer.setScissorTest(true)
      L: setViewport(0,0,1280q,720q); setScissor(同); render(scene, camL.camera)
      R: setViewport(1280q,0,1280q,720q); setScissor(同); render(scene, camR.camera)
      [stage4] setViewport(0,0,2560q,720q) で camL のみ(aspect=2560/720)
      [t<0(ゲートイン) / リプレイ] 単一全幅ビュー(§2.9)
  (6) HUD描画: hud.drawLive({t,p,R,rankIdx,pos,hudPhase,...})(fgCanvasクリア→§2.6の順)
  (7) 実況 pushStory(view.t+0.8)(既存踏襲・commentBoxへ)
  (8) publishState(view)(§2.8 一元更新)
  (9) quality.sample(frameMs)(30フレームごとに評価→縮退/復帰)
  (10) フェーズ遷移判定(live→replay→board、既存しきい値踏襲) → rAF
```

- **DPR/サイズ**: `renderer.setSize(2560*q, 720*q, false)`(CSSサイズは触らない)。`q` 変更時のみ呼ぶ。fgCanvas は常に 2560×720 等倍(§1.2)。bgCanvas は 2560×720 属性でレイアウト基準のみ(初期化時に暗色1回塗り、以降未使用=§1.1)。
- **クリア**: `renderer.autoClear = true` のまま。シザー有効時の clear はシザー領域に限定されるため、パスごとに背景色クリアが正しく走る(状態リーク対策は§6-R1)。
- 既存 loop の再現項目(無退行、raceview.js から仕様移植): 速度チップ(×1.5/×3/×6)とスキップボタン、fgCanvas クリックのフェーズ送り(P-6)、ゴールфлаッシュ(flash 0.85)、写真判定判定(2着差<0.10)、`REPLAY_FROM = max(0.5, winTime-7)`、リプレイ dt×1.2、掲示板 7 秒→onDone。

### 2.3 InstancedMesh 馬システム(rv-horses.js + horse3d.js 拡張、仕様§6.0)

#### 2.3.0 createRig の配置と寸法管理(裁定確定・B-MAJOR1/B-MAJOR2)

- **配置は horse3d.js に確定**: `H3.createRig()` は rv-horses.js ではなく **horse3d.js 内(既存 IIFE の中)に実装**する。rv-horses.js からは `SH.Horse3D.createRig()` を呼ぶだけの薄い呼び出しに留める。
  - 理由(クロージャ境界): 幾何キャッシュ `geo()`/`G`(horse3d.js 70–72行目)およびマテリアルキャッシュ `matCache`/`mat()` は同ファイルの IIFE 内プライベート変数であり、`SH.Horse3D` として外部公開されていない。createRig をこの IIFE の外(rv-horses.js)に置くと、これらのキャッシュを再利用できず「幾何を再定義してキャッシュを二重化する」か「horse3d.js 側にキャッシュを公開する新規APIを追加する」のいずれかが必要になり、§1.1 が定めた horse3d.js の差分スコープ(**createRig追加+pose第3引数拡張のみ**)を逸脱する。同一クロージャ内に置けば `geo()` をそのまま呼べるため、この最小差分を維持できる。
- **寸法の二重管理は「解消済みの懸念」として扱う**: `createHorse`(既存)と `createRig`(新設)はどちらもパーツ寸法値を持つが、両者を単一の共有定数へ統合する変更は行わない。
  - `createHorse` は**レガシー凍結**(2Dフォールバック `use3d` 経路専用。以後無変更)。
  - `createRig` が**新経路(WebGL主経路)の唯一の正**。初期実装時に `createHorse` の寸法値をそのまま転記するが、転記後は**両者は独立に進化してよい**。
  - フォールバック(`createHorse` 経由の2D描画)と WebGL主経路(`createRig` 経由)の見た目が完全一致することは要件外である — フォールバックに課される要件は AC-16「(WebGL不可時に)動作すること」のみであり、寸法・見た目の一致は要求されていない。
  - したがって、両者の寸法値を自動同期する仕組みや、ドリフトを検知するテスト/lintの類は**設けない**。二重管理はリスクではなく設計上許容された分岐として確定する。
- **RIG_SCALE の適用範囲**: `RIG_SCALE=1.15`(§4.2、仕様§6.1 の実寸化係数)の見直しは**createRig 側(§2.3.2 の `root.scale`)にのみ適用**する。`createHorse` 側(2Dフォールバックの `use3d` 経路)のスケール挙動は変更しない。

#### 2.3.1 パーツ種別一覧(PART_DEFS)

ジオメトリ生成関数は既存 `createHorse` の寸法を**初期転記のみ**で流用し、`geo()` キャッシュは createRig 実装(horse3d.js 内)から共有する(§2.3.0)。以後の寸法改修は createRig 側だけで完結してよく、`createHorse` への同期は不要。§6.1 の実寸化(体高1.6m/視認スケール1.15)は**リグ root のスケール**(`RIG_SCALE`、createRig側のみ適用)で与えるため、パーツ寸法定義自体は不変。

| # | part名 | ジオメトリ生成(既存 geo キー/新規) | 個数/頭 | instanceColor | 備考 |
|---|---|---|---|---|---|
| 1 | torsoSph | Sphere(1,14,10)(既存"torso") | 3(胴/胸/臀) | 毛色 | スケールは行列に内包。§6.1接合重ね |
| 2 | neck | Cylinder(0.13,0.24,0.92,8) | 1 | 毛色 | |
| 3 | mane | Box(0.62,0.16,0.045) | 1 | 毛色×0.72 | |
| 4 | skull | Sphere(1,10,8) | 2(頭/鼻面) | 毛色 / 毛色×0.8 | 鼻面暗色はインスタンス色(§6.0) |
| 5 | ear | Cone(0.045,0.16,5) | 2 | 毛色 | |
| 6 | eye | Sphere(0.022,6,5) | 2 | 固定 0x14100c | |
| 7 | tail | Cone(0.085,0.78,7) | 1 | 毛色×0.72 | |
| 8 | upperF | Cyl(0.075,0.058,0.52,7) | 2 | 毛色 | |
| 9 | upperH | Cyl(0.085,0.058,0.52,7) | 2 | 毛色 | |
| 10 | lower | Cyl(0.05,0.038,0.46,7) | 4 | 毛色×0.72 | |
| 11 | hoof | Cyl(0.052,0.058,0.09,7) | 4 | 固定 0x2b2119 | |
| 12 | saddle | Box(0.46,0.05,0.48) | 1 | 固定 0xf4f2ea | |
| 13 | jtorso | Capsule(0.11,0.26)/Cyl代替 | 1 | 勝負服 base | 柄アトラスUVオフセット付き(§2.3.4) |
| 14 | jhead | Sphere(0.085,8,7) | 1 | 固定 0xe8c39e | |
| 15 | jcap | Sphere部分(0.095,…) | 1 | **WAKU_COLORS[waku-1]**(§6.4帽) | |
| 16 | jarm | Cyl(0.032,0.028,0.34,6) | 2 | 勝負服 sleeve | 袖=別パーツで個体色(§6.4) |
| 17 | jleg | Cyl(0.04,0.035,0.26,6) | 2 | 固定 0xf2f2f2 | |
| 18 | jboot | Cyl(0.036,0.04,0.17,6) | 2 | 固定 0x25201c | |
| 19 | blazeStar | Circle(r0.045) 新規 | 1 | 固定 白 | 額。非該当馬はスケール0行列(§6.5) |
| 20 | blazeStripe | Plane(0.05×0.28) 新規 | 1 | 固定 白 | 鼻筋帯 |
| 21 | blazeSnip | Sphere半球キャップ 新規 | 1 | 固定 白 | 鼻端 |
| 22 | blobShadow | Circle(r1) 新規・y=0.02 | 1 | 固定 黒(opacity0.28) | E-13。接地追従・上下動非追従 |

- **InstancedMesh 数(訂正・B-MINOR5確定)**: 上表の「個数/頭」列は「1頭あたりのノード数」であり、**ノードごとに独立した InstancedMesh を1個持つ**(同一パーツ種別内でも、例えば torsoSph の胴/胸/臀の3ノードはそれぞれ別の InstancedMesh)。各 InstancedMesh の `count = n`(頭数)固定・**インスタンス index = 馬 index(`hi`)のみ**(旧仕様の共有バッファ+`hi*perHorse+k`オフセット方式は廃止)。総 InstancedMesh 数 = Σ(個数/頭)≈36個/パス(+ゼッケン個別 Mesh 2n + markerSprite 1)。§7.1 内訳「≈40」以内、§2.3.2 の「≈36ノード×18頭」とも整合する。
- マテリアル: パーツ種別ごとに共用 1 個。基調白の `MeshPhongMaterial({shininess:18, specular:弱})`(§6.2)。`vertexColors` 不要 — r147 の `instanceColor` は Lambert/Phong 対応(§6.0)。stage3 で共用マテリアルを Lambert へ差替(§7.2)。
- **全馬パーツの `frustumCulled = false`**(InstancedMesh の境界球は原点基準でありデュアルカメラで誤カリングするため。馬は常時どちらかのカメラ近傍にいるので実害なし。§6-R2)。
- `instanceMatrix.setUsage(THREE.DynamicDrawUsage)`。

#### 2.3.2 リグ評価→行列合成のデータフロー(§6.0)

```
horse3d.js:  H3.createRig() → { root, pose(phase,running,opt), nodes: {torso:[o1,o2,o3], neck:[o], ...} }
   … createHorse と同一階層・寸法は初期転記(§2.3.0、以後は独立に改修可)。Mesh を持たず Object3D のみ(マテリアル/テクスチャ非生成)。
     nodes は PART_DEFS と同順のノード配列表。root はシーンに add しない(updateWorldMatrix は独立動作)。
     horse3d.js の同一IIFE内実装のため geo()/G キャッシュをそのまま参照する(§2.3.0のクロージャ境界理由)。

rv-horses.js: リグは全馬で 1 体を共有し、毎フレーム n 回評価(§7.1「リグ1体をn回評価」):
  for hi in 0..n-1:
    root.position/quaternion ← course.pos(m_hi + hi*0.02, lat[hi]) / heading   (§6.8 Z-fight回避)
    root.scale = RIG_SCALE(=1.15、§6.1。createRig側のみに適用 — §2.3.0)
    pose(phase[hi], running_hi, {v:v_hi, drive, easeUp})
    root.updateWorldMatrix(false, true)          // 全ノードの matrixWorld を確定
    for part in PART_DEFS: for k,node of nodes[part]:
       instArr[part][k].setMatrixAt(hi, node.matrixWorld)   // パートのノードごとに独立したInstancedMesh(count=n)。index=馬index(hi)のみ(§2.3.1訂正)
    zekkenMesh[hi*2].matrix.copy(nodes.cloth[0].matrixWorld)  // 個別Mesh(matrixAutoUpdate=false)
  全 instArr[*][*]: instanceMatrix.needsUpdate = true     // フレーム1回・全InstancedMeshぶん。2パスで共有
```

- 行列書込 ≈36ノード×18頭 ≒ 650 回/フレーム(§6.0 想定どおり)。一時 Matrix4 等は再利用しGCゼロ。
- instanceColor は**初期化時に 1 回だけ** `setColorAt` し `instanceColor.needsUpdate=true`。以降不変(白斑の有無もスケール0行列で表現するため色更新なし)。

#### 2.3.3 個体差の決定(§6.2/6.4/6.5)

```
coatOf[i]: 既存 raceview.js と同一規則(owned→COAT[r.ref.coat] / CPU→COAT_POOL[(i*7+name.length)%10])
           … SH.RV2D.COAT を使用し 2D/3D 経路で同一毛色(AC-22 の安定性は seed でなく既存決定式)。
seed  = r.gate*2654435761 ^ hash(r.name)          // §6.4。hash=文字コードFNV簡易
base  = SILKS_PALETTE[seed % 12]                  // 12色パレット(rv-horses内定義・オリジナル配色)
pattern = (seed>>4) % 5                           // {無地,縦縞,袖違い,一本襷,星散}
cap   = WAKU_COLORS[r.waku-1]
sleeve= pattern===袖違い ? SILKS_PALETTE[(seed>>8)%12] : shade(base, ±)
blaze = (seed>>12)%10 < 5 ? [星,流星,鼻白][(seed>>16)%3] : なし   // 付与率50%(§6.5 40〜60%)
```

#### 2.3.4 ゼッケンと勝負服柄の実装方式(§6.3/§6.4 — 決定)

> **実装乖離(WS3 で確定・04-notes 記録済)**: 下記(i)個別 Mesh 案は WS2 まで採用したが、WS3 で **シェーダ非依存の per-race 動的マージメッシュ**(全ゼッケンを 1 メッシュへ焼き込み・共有アトラステクスチャ・MeshBasic unlit)へ変更した。契約(頭数非依存 1〜2 DC・AC-12 番号判読・照明非依存)は同一で、DC はむしろ削減。柄アトラス(下記)の `onBeforeCompile` 依存も同時に解消している。以下の記述は決定当時の設計意図として残す。

- **ゼッケン = 方式(i) 個別 Mesh 2 枚/頭を採用**(§6.0 例外規定の第1案)。
  - テクスチャ: `zekkenTexture(gate)` 128×128 CanvasTexture(地 `#1c4f9e`、白縁、白数字 `bold 74px`、下部に判読不能の飾り文字列)をキャッシュ(最大18枚)。既存 `numTexture` の改修版として rv-horses 内に置く(horse3d の旧版はフォールバック用に温存)。
  - 決定理由: (a) §7.1 予算は本方式の上限(≤36 Mesh、DC≤280)で計上済み、(b) シェーダ改変(onBeforeCompile)非依存で P0 のゼッケン判読(AC-12)を確実化、(c) 実装が行列コピーのみで単純。アトラス方式(ii)は予算超過時の改善オプションとして温存(採用条件: stage0 で DC>240 が実測された場合)。
- **勝負服柄 = 共有柄アトラス+インスタンス毎 UV オフセット(§6.4 の確定仕様どおり)**。
  - 256×256 アトラス(2×3 タイル: 無地/縦縞/袖違い※無地扱い/一本襷/星散。白線画・透過)。jtorso 共用マテリアルに `onBeforeCompile` で `uv += uvOff`(`InstancedBufferAttribute` vec2)を注入し、`map` の白柄を乗算合成。
  - リスク隔離: この機構はヘルパー `makeAtlasInstanced(material, geometry, offsets)` に閉じ、初期化時に 1 度シェーダコンパイルを検証。失敗時は柄なし(instanceColor の base/sleeve/cap のみ)へ自動退避 — AC-12 の「勝負服が馬ごとに異なる」は色差のみでも成立する(退避はログ出力)。

#### 2.3.5 H-9 マーカー/ブロブ影/ブラー近似

- markerSprite: CanvasTexture 96×112(発光黄 `#ffd21a`・下向き五角形ピン・馬番 `bold 48px #3a2a00`)。`depthTest=false, depthWrite=false, renderOrder=999`。毎フレーム自馬 root ワールド位置 + y2.5 + `sin(t*1.4)*0.12`。スケールは両カメラのうち**各パスで描かれる際のカメラ距離**に依存できない(シーン共有)ため、**左カメラ距離基準**で `scale=clamp(k/z, min, max)` とし、右ビューでの最小 28px 相当は min スケール(ワールド0.9m)で担保する(設計判断・§2.1 H-9 の最小サイズ保証)。自馬非出走時は生成しない。
- ブロブ影: blobShadow インスタンスを root の xz(y=0.02)へ、上下動(root.position.y)を除いた行列で書き込む。楕円スケール(2.6×0.9)。
- ブラー近似(§6.9): (b) 走路テクスチャ UV 流し = camL が L6 または camR が R-side の間、`trackMat.map.offset.x -= vLead*dt/UVREP`。(a) は R-front 通過(AC-19(a))が構造的に満たすため追加実装なし。(c) 脚部残像は P2・スコープ外余地として設計のみ(未実装可)。

### 2.4 コース/美術ジェネレータ(rv-world.js、仕様§4.2/4.3)

#### 2.4.1 テーマ別構造物の生成方式

| 区間(s範囲) | 構造物 | ジオメトリ方式 | テクスチャ(CanvasTexture) |
|---|---|---|---|
| T0 260–450 スタンド | 観客スタンド(外側lat≈−18〜−30) | 段状Box×4段マージ+前面観客Plane | 観客=256²カラーノイズ点(既存drawStand配色流用)。ナイターは照明窓ドット |
| | ゴール塔 | Box塔+頂部発光Box(s=369脇) | 単色白基調 |
| | ゴール柱 | Cylinder(紅白縞テクスチャ、高4.2、lat=+13.2) | ポールと共用64×256紅白縞 |
| T1 450–700 竹林 | 竹幹 | InstancedMesh Cylinder(r0.06,h6,5角) ×約220本 | 幹=単色0x7a9a3a |
| | 竹葉 | InstancedMesh Plane(ビルボード風・固定向き2枚交差) | 葉=128²緑ノイズ半透明 |
| T2 700–950 巨木の森 | 近景木 | InstancedMesh 幹Cyl+葉塊Sphere低ポリ(×約40) | 葉=256²ノイズ |
| | 遠景木 | InstancedMesh Plane ビルボード(×約60) | 同上 |
| T3 950–1130 渓谷・石橋 | 谷 | 走路外側(lat<−13)を谷床Plane(y=−18)+岩壁Plane斜面 | 石積256²(矩形石割れ+目地#6a655a) |
| | 石橋 | アーチ=Shape(半円穴2つ)のExtrudeGeometry+デッキBox+白欄干Cyl列(Instanced)。中心 s=1040、コース外側に並走する「見え」の高架(走行座標は不変・視覚のみ) | 石積(共用) |
| | 滝 | 縦Plane半透明 ×2(岩壁に沿わせる) | 128×256白青縦縞、UVスクロール(scrollFx) |
| T4 1130–1280 岩壁・城壁 | 石積壁 | Box壁面の連結(高4〜7、鋸壁上端はBox歯) + 門柱Box×2 | 石積(共用)+鋸壁シルエット |
| T5 1280–1470 丘陵 | 草丘 | 押し潰しSphere(低ポリ)×数個+砂色路肩帯Mesh | 芝明トーン/砂#b08d57系 |
| T6 1470–1654∪0–260 暗森 | 暗い並木・岩 | T1/T2アセット再利用(instanceColor暗め)+岩=Dodecahedron低ポリInstanced | 共用(暗トーン) |
| 全域 E-9小物 | 砂利道帯/木箱/照明塔 | Plane帯 / Box / Cyl+光点Sprite(T3〜T6に疎ら、照明塔はT0周辺+4〜6基) | 単色系 |

- 全テクスチャは `texCache` で 1 回生成(≤24枚・各≤512²、§7.1)。2の冪。
- ナイター/昼は `SH.isNightRace(race)` で分岐(§5)。昼の空色は `SH.RV2D.skyColors(cond)` を background/フォグ色へ移植。雨(sky.rain)は rv-hud が fgCanvas に描く(§5.2)。

#### 2.4.2 配置アルゴリズムとチャンクカリング

```
buildThemes():
  for theme in THEMES:                       // §4.4 テーマ配置テーブル
    rng = mulberry32(theme.id * 7919)
    for s = theme.s0; s < theme.s1; s += theme.step(構造物種別ごと 4〜40m):
      lat = theme.side==="in" ? +(13 + rng()*22) : -(13 + rng()*25)   // ラチ外側に散布
      jitter s' = s + (rng()-0.5)*step*0.6
      instance追加(pos=world.posS(s', lat, 0), rotY=rng()*2π, scale=0.8+rng()*0.5)
      → 所属チャンク chunks[floor(s'/50)] に登録(Instancedはチャンク別countではなく
        「チャンク→インスタンスindex範囲」表を持ち、可視切替は範囲外スケール0…ではなく
        後述の instanceMesh を チャンク単位に分割生成する)
```

- **チャンク化の実装**: テーマ内の InstancedMesh は「チャンク(50m)×パーツ種」でなく**テーマ単位で 1 個**とし、大物(スタンド/橋/壁/丘)のみ個別 Mesh をチャンク Group に入れる。この `chunks`(テーマ→チャンクGroup登録表)は rv-world.js 内部実装にとどまり、`world.updateVisibility()` が内部で参照するのみで、公開 `world` オブジェクト(§1.4フラットAPI)のフィールドとしては露出しない。カリングは 2 段: (a) 個別 Mesh・チャンク Group → `updateVisibility(camLpos, camRpos)` が境界球中心とカメラ位置の距離 ≤380m(いずれか)で `visible` 切替(±350m窓+マージン、§4.1)。(b) InstancedMesh(竹・木・岩等) → `frustumCulled=true` のまま(テーマ全体境界球を明示設定)+ 遠テーマは (a) と同式でテーマごと visible 切替。描画オブジェクト ≤150/ビューポート(§7.1)をこの2段で満たす。
- 可搬物(§4.1): 発走ゲート(既存 drawGates 様式の 3D 化: 枠Box×n、開扉は前面パネルの `open=min(1,t*3)` スライド)を `course.pos(-1.2, gateLat(i), ·)` に毎レース配置。紅白ポールは `for k=200;k<D;k+=200` の `m=D-k`、`lat=+12.6`(既存踏襲・§4.4)。

### 2.5 カメラシステム(rv-cams.js、仕様§3)

各 director は `THREE.PerspectiveCamera` を 1 個ずつ所有(**左右で絶対に共有しない** — aspect/fov 書換リークの根絶、§6-R1)。`update(ctx)` の `ctx = {t, p, R, leadM, packC, ownM, D, dt, lShotIsAway, lastOwnInView}`。`lastOwnInView` は前フレームまでに raceview3d が集約した値(§2.5.3)で、dirR の(c)判定にのみ使う。両 director とも `update(ctx)` は自フレームの `ownInView` 判定を戻り値で返すのみで、`lastOwnInView` 自体を書き換えない。

#### 2.5.1 DirectorL(左・可変追走)状態機械

状態 = ショットID(L0〜L8)。毎フレーム「望ましいショット」を優先度チェーンで決め、変化時はハードカット(lerp状態リセット)。同一ショット内は lerp(位置0.14/注視0.2/FL0.1)+sway。

```
desiredShotL(ctx):
  if t < 0            → L0
  if R <= 400         → L8   (stretch: leadM<D-130相当は望遠正面 / それ以降 goal — 既存流用)
  if 0.47<=p<0.53     → L5   // 単一条件・全距離。優先度 L5 > L4 > L6(§3.1注記)
  if p < 0.08         → L1
  if p < 0.25         → L2   // 内部タイマ: 3sim秒ごとに 引き/寄り をトグル
  if p < 0.45         → L3
  if p < 0.55         → (!l4Done ? L4 : L6)   // l4Done ラッチ(下記)で L4 再訪を禁止。以前の l4Time<2.5 直接比較は廃止(A-MAJOR1)
  if p < 0.75         → L6
  else                → L7

update(ctx):
  want = desiredShotL(ctx)
  if want != shot: shot = want; lerp状態リセット(即値代入); shotTimer=0
  shotTimer += ctx.dt
  if shot==L4:
    l4Time += ctx.dt
    if l4Time >= 2.5: l4Done = true        // (a) L4 を先頭2.5sim秒消化しきったら以降L4へ戻らない
  if shot==L5: l4Done = true               // (b) L5へ遷移した時点でも即ラッチ(L5はL4より優先度が高く、
                                            //     L4を2.5秒未満で打ち切って移った場合でも再訪を防ぐ)
  {posSpec, tgtSpec, fl, sway} = L_TABLE[shot](ctx)      // §4.3 カメラ定義テーブル
  camPos=lerp(camPos,posSpec,0.14); camTgt=lerp(camTgt,tgtSpec,0.2); curFL+=(fl-curFL)*0.1
  cp = camPos + (0, sin(t*1.9)*sway, cos(t*1.3)*sway*0.5)          // 既存sway式
  camera.position=cp; camera.lookAt(camTgt); camera.fov=2atan(360/curFL)deg; updateProjectionMatrix
  L5補正: leadMのlap-s が s=1040±250 なら camTgt を橋中心へ0.5合成(§4.2注記)
  ownInView = ctx.ownM!=null && screenXofL(camera, ctx.ownM)∈[0,VW] && viewZofL(camera, ctx.ownM)>0  // 簡易フラスタム判定(A3): 画面x∈[0,VW]かつz>0(カメラ前方)
  return {camera, mode:shot, fl:curFL, ownInView}          // ownInView はdirLが自ら判定して返すのみで、lastOwnInViewへの書込は行わない(§2.5.3 view集約)
```

- `l4Done`(初期値 `false`)/`l4Time`(初期値 `0`)は director 生成時に確定する内部状態。ラッチ導入前の実装は「`p<0.55` の間、`l4Time<2.5` なら常にL4」という**時間だけの判定**だったため、L5(`p∈[0.47,0.53)`)を経由して `p` が一時的に 0.45〜0.47 側へ戻る、あるいは同一 `p<0.55` 窓内で `l4Time` が未達のまま再評価されるケースで **L6→L4 の逆戻り**が起こり得た。`l4Done` ラッチはショットの再訪自体を禁止することで、02-spec §3.1 の「L4/L5 は上限で自動的に L6 へカット」および「L4 は `p≥0.45` から先頭2.5 sim秒のみ(L5窓 `p≥0.47` 開始で打切り、残りは L6)」= **L4→L5→L6 の一方向遷移**という確定事項と一致する(L5直後は常にL6という結果も、`l4Done=true` により保証される)。
- L8 は既存 `computeCam` の stretch/goal 2 段(残130mでgoalへ)と可変望遠 `clamp(dist*42,950,15000)` をそのまま移植(§3.1表)。
- 1200m の L7 スキップ(R≤400 が p=0.667 で先行)はチェーン順で自然に成立。

#### 2.5.2 DirectorR(右・定点カメラ列)状態機械

状態: `{k(定点index), type, rrCursor(巡回位置), emptySince, ownHold, camIndex}`。カメラは**三脚固定**(lerpなし・sway 0。R-side/自馬パンは注視のみ毎フレーム更新)。`lastOwnInView` は dirR 単独の状態ではなく、dirL/dirR がそれぞれ返す `ownInView`(自フレームの自馬視野内判定)を raceview3d 側で統合した `view.lastOwnInView` に一本化する(§2.5.3)。

- 定点位置: `Mcam(k) = k*200 + 40`(CAM_SPACING=200 / CAM_OFFSET=40)。型はラウンドロビン [R-front → R-side → R-diag] を基本に、`Mcam(k)` が名物 m(§3.4 逆写像で得る石橋 s=1040・スタンド s=355 の各 m、および残600mポール m=D−600)の ±100m 内なら **R-name** に強制。`R≤200` 圏は **R-goal** 固定。
- カット条件と優先度(§3.2: e > d > c > a > b)は §3.1 擬似コードに全文を示す。
- `empty` の定義(§3.2): 注視前方固定型 = `leadM < Mcam(k) - 140`、パン追従型(R-side/自馬パン) = 常に false。
- 両ビュー制約(§3.3): (i) 位置距離<12m∧注視方向内積>0.98 → `forceNext()`(次定点へ即カット)。(ii) 左が L4/L5 の間は条件(a)のカットを 1 sim 秒抑止。

#### 2.5.3 `lastOwnInView` 更新責務(A-MINOR3・確定)

- DirectorL/DirectorR は**それぞれ自フレームの自馬視野内判定**を `update(ctx)` の戻り値 `ownInView`(bool)として返すだけで、`lastOwnInView`/`view.lastOwnInView` へは直接書き込まない(dirR が単独で保持していた旧設計の `lastOwnInView` 状態は廃止 — §2.5.2)。
- 統合(view集約方式)は `raceview3d.js` が担う。§2.2 パイプライン (2) カメラ更新の直後、`publishState`(パイプライン (8))より前に以下を実行する:
  ```
  view.lastOwnInView = (dirL.ownInView || dirR.ownInView) ? ctx.t : view.lastOwnInView
  ```
- dirL 側の判定式(カメラフラスタム簡易判定): `screenXofL(camera, ownM)∈[0,VW] && viewZofL(camera, ownM)>0`(画面x∈[0,VW]かつz>0。§2.5.1 update() 末尾)。dirR 側は前方固定型=視野角×距離の簡易判定、`type==R_OWNPAN`=常に true(§3.1)。
- これにより AC-23(自馬が一定間隔以内にどちらかのビューへ映る)の判定は、両 director の独立判定を単一の統合点でのみ確定させる一元管理になる(§7.1 `ownInViewSince` の供給源と一致)。

### 2.6 HUD レンダラ(rv-hud.js、仕様§2)

論理 2560×720。描画順(drawLive 内、毎フレーム全再描画):

| 順 | 関数 | 内容 | 表示制御 |
|---|---|---|---|
| 1 | `clear + drawSeparator` | 全消去 → x=1278..1282 の 4px 暗色 `#0a0e12` 縦帯 | ライブ・デュアル時のみ(stage4/全幅時は省略) |
| 2 | `drawTopBand(α)` | H-1 緑グラデ帯(0,0,2560,60)+下端明線 | `α = hudAlpha`(§2.0) |
| 3 | `drawDistSlide(α, R)` | H-2 白抜き数字+ポールアイコン、§3.2 擬似コードの x 計算 | hudAlpha、`R≤0`で非表示 |
| 4 | `drawFormation(α, rankIdx, t, xNum, numW)` | H-3 盾チップ(仕様の shield パス転記)+ H-4 自馬タグ(y∈[0,20]専用ゾーン・1.15倍)。`xNum`/`numW` は直前の `drawDistSlide` から渡し、cw を導出(§3.3) | hudAlpha、スライドアニメ§3.3 |
| 5 | `drawLegend()` | H-5 左右分担グリッド(6列×⌈n/6⌉行、行高 rh=clamp(⌊88/Rrow⌋,34,44)、yLegTop公開) | 常時(t≥発走前から) |
| 6 | `drawElapsed(t)` | H-6 `fmtElapsed`(40, yLegTop-52) | 常時(t≥0) |
| 7 | `drawPass1000(t)` | H-7 見出し+赤帯 `fmtPass`(40, yLegTop-130)。D≥1600のみ。保持10sim秒+0.5sフェード | passTime1000m確定後 |
| 8 | `drawRaceName(α)` | H-8 serif 右詰め(2536, yLegTop-52)。gradeLabel写像(WBC/G1/J-G1→GI…) | hudAlpha |
| 9 | `drawRain()` | 雨線(昼・稍重以上、既存式を2560幅へ) | 天候 |
| 10 | `drawVignette()` | 2560×720で再生成したキャッシュ | 常時 |
| 11 | `drawBanner(text,bg,fg)` | H-10 全幅中央(x=1280基準)。既存 banner 様式 | フェーズ(ゲートイン/スタート/写真判定/1着) |
| 12 | `drawStoryTicker()` | 実況テロップ(既存様式を全幅中央へ) | 4.5秒表示 |

- **hudPhase 制御(§2.0)**: `hudPhase = p<0.085 ? "pre" : p<0.105 ? "fadein" : "on"`。`u=(p-0.085)/0.020`、`hudAlpha = pre?0 : on?1 : 1-(1-u)²`(ease-out)。対象 = H-1/H-2/H-3(+H-4)/H-8。H-5/H-6 は発走時から、H-7/H-9/H-10 は各自トリガ(§2.0)。
- 新設フォーマッタ: `fmtElapsed(sec)` → `'03`/`1'15`(分0省略・秒切捨て2桁0詰め)。`fmtPass(sec)` → `'58.7`(`'ss.d`)。掲示板は `SH.RV2D.fmtTime` を使用(既存様式)。
- 全枠色は `SH.WAKU_COLORS`/`SH.WAKU_TEXT` のみを参照(AC-6)。H-2 と H-3 の非重複は `cw = clamp(floor((2540-(xNum+numW+40))/Nchip)-gap, 30, 46)`(§3.3 確定式)を drawFormation 側で毎フレーム保証。

### 2.7 E-15 品質コントローラ(rv-quality.js、仕様§7.2)

```
状態: level(0..4), emaMs(係数0.1), frameCount, downStreak, upStreak, forced(bool)
budget = モバイル判定(hardwareConcurrency<=4 || 粗タッチ) ? 33.3 : 16.7
初期 level = モバイル ? 1 : 0   (§1.4)。URL ?rvq=N で forced=true・自動評価停止。

sample(ms):
  emaMs += (ms - emaMs)*0.1
  if ++frameCount % 30 != 0 or forced: return
  if emaMs > budget*1.25: upStreak=0; if ++downStreak>=2 && level<4: setLevel(level+1); downStreak=0
  elif emaMs < budget*0.7: downStreak=0; if ++upStreak>=4 && level>0: setLevel(level-1); upStreak=0
  else: downStreak=upStreak=0

setLevel(v):                       // 昇降とも「全段を宣言的に適用」(差分適用の状態漏れ防止)
  level=v; console.info("[E-15] quality→", v)
  world.setShadows(v<1 && !world.night)                    // stage1: 影off(昼のshadowMapのみ)。renderer.shadowMap.enabled は world 内部で保持
  world.setGlare(v<2); world.setFogSimple(v>=2)             // stage2(旧 world.glareFx.visible=... 直接代入は廃止 — B-MAJOR3)
  herd.setLowDetail(v>=3); world.setDensity(v>=3 ? 0.5 : 1) // stage3(共有ジオメトリ/マテリアル一括差替+間引き)
  q = [1.0,1.0,0.75,0.6,0.5][v]; renderer.setSize(2560*q,720*q,false)
  viewModeSingle = (v===4)                                 // stage4: 右パス停止(raceview3dが参照)。HUDレイアウトは不変(§2.6注記)
```

- `herd.setLowDetail(true)`: 各 PART_DEFS の低セグメント版ジオメトリ(初回要求時に生成しキャッシュ。パーツ種別ごとに1個、≈22種)を、対応する全ノードの `instArr[part][k].geometry` へ差替(≈36回・§2.3.1訂正の個数と一致)+共用マテリアルを Phong→Lambert へ差替(§6.1/6.2)。復帰は逆差替。
- `world.setDensity(0.5)`: 竹/木/岩 InstancedMesh の `count` を半減(index前半を残す)、生垣インスタンス半減、観客テクスチャ半密度版へ swap。復帰は count 復元。
- **stage4(`viewModeSingle`)時の HUD(A-MINOR5・確定)**: `viewModeSingle` は §2.2 パイプライン (5) の **3D描画のみ**に影響し(2パス→camLのみ全幅 `2560q×720q`)、**HUDレイアウトは一切変更しない**(凡例 H-5・チップ H-3・自馬タグ H-4・H-8 などは通常のデュアル時と同じ座標のまま描画。§2.6 表の 1 行目 `drawSeparator` のみ「dual時のみ」条件で自然に非表示になる)。理由: (a) stage4 は性能逼迫時の一時的な縮退であり常態ではないため、専用HUDレイアウトを別に持つと縮退復帰時の再計算コストとちらつきを招く、(b) HUD は fgCanvas 2560×720 固定で3D描画パイプラインと独立しているため、3D側のビュー数の変化はHUD座標系に影響しない。

### 2.8 `SH._rvState` 更新の一元化(仕様§7.3)

- **書込箇所はちょうど 2 つ**に限定する:
  1. `raceview3d.js: publishState(view)` — ライブ中の毎フレーム末(パイプライン(8))に**全フィールドを一括代入**。リプレイ/掲示板遷移時に `viewMode="single"` を書いて以降凍結(publishState を呼ばない)。他モジュール(rv-cams/rv-hud/rv-quality)は自分の戻り値/プロパティを返すだけで `SH._rvState` に触れない。
  2. `raceview.js` ディスパッチャ — フォールバック時に `{viewMode:"single", qualityLevel:null}` を 1 回だけ(§8)。
- フィールドと供給源は §7 の表(テストフック設計)に全列挙。`SH._render3d` は raceview3d 成功時 true / フォールバック時は既存コードが従来どおり設定。

### 2.9 番組フェーズ統合(P-1〜P-6、全幅1画面の再実装)

新経路のキャンバスは 2560×720 のため、既存 raceview.js の 16:9 前提描画(タイトル/リプレイ表記/掲示板)は**座標系を維持したまま中央配置**で再実装する(raceview.js のプライベート関数は流用不可のため。様式・数値は既存関数から転記):

| フェーズ | 実装 | 備考 |
|---|---|---|
| タイトルカード(t<−2.6) | 3D描画なし。fgCanvas 全幅を `rgba(8,12,22,.88)` で塗り、`octx.translate(640,0)` して既存 drawTitleCard のレイアウト(1280×720系座標)をそのまま描く | P-1。PREROLL=5.4 / TITLE_END=−2.6 踏襲 |
| ゲートイン(−2.6≤t<0) | **単一全幅ビュー**(camL=L0、viewport 0,0,2560q,720q)+「各馬ゲートイン」バナー | P-2 確定「全幅1画面」。t≥0 でデュアルへ |
| ライブ(0≤t) | §2.2 パイプライン(デュアル) | P-3 |
| リプレイ | 単一全幅ビュー+既存リプレイカメラ(外ラチ低位置、DirectorL の replay モードとして移植)+REPLAY表記(右上、既存様式を x+1280 へ) | P-4 |
| 掲示板 | fgCanvas 全幅塗り+`translate(640,0)` で既存 drawBoard レイアウト転記(`SH.RV2D.fmtTime`/`marginLabel` 使用) | P-5 |
| 操作 | fgCanvas click: live(t<0)→t=−0.01 / replay→board / board→onDone(既存踏襲) | P-6 |

---

## 3. 主要アルゴリズムの擬似コード

### 3.1 定点カメラ選択/再同期(DirectorR.update)

```
update(ctx):  // ctx: {t, dt, leadM, R, D, ownM, lShotIsAway(=L4|L5), forceNextFlag, lastOwnInView}
  // ctx.lastOwnInView = 前フレームまでに raceview3d が集約した view.lastOwnInView(§2.5.3)。
  // dirR はこれを読むだけで、自分の ownInView 判定結果を書き戻すことはしない。
  // --- 優先度 e > d > c > a > b (§3.2) ---
  // (e) ゴール固定
  if ctx.R <= 200 and type != R_GOAL:
    type = R_GOAL; camIndex = -1; setCam(pos(D-6,+14,3.0), tgt(D,0,1.6), FL=1000); ownHold=0
  elif type != R_GOAL:
    advanced = false
    // (c) 自馬フレームイン保証(25sim秒経過で次カットを自馬パンに)
    if ownExists and (ctx.t - ctx.lastOwnInView) >= 25 and ownHold <= 0:
      k = ceil((ctx.leadM + 30 - 40) / 200)        // 前方定点(§3.2 再同期式と同形)
      type = R_OWNPAN(R-side扱い); ownHold = 2.5; setFixedCam(k, lat=+22, y=3.2, FL=1400)
      advanced = true
    if ownHold > 0:
      ownHold -= ctx.dt; tgt = pos(ctx.ownM, 0, 1.6)   // 注視のみ自馬追従。empty=false
      if ownHold <= 0: advanced=false; /*通常則へ復帰: 次フレームで(a)判定*/
    // (a) 先回りカット: 先頭が Mcam(k)+25 到達
    elif ctx.leadM >= Mcam(k) + 25 or forceNextFlag:
      if ctx.lShotIsAway and (ctx.t - lastCutT) < 1.0: /*(§3.3-ii) 1秒抑止*/ 
      else:
        k2 = k + 1
        // (d) 名物区間の飛び越し防止: k<kn<k2 の R-name 定点 kn があれば k2=kn
        for kn in nameKs: if k < kn and kn <= k2: k2 = kn
        cutTo(k2)                                   // 型: R-name強制 or ラウンドロビン
    // (b) 空フレーム超過 → 再同期+R-side強制(§3.2 確定式)
    if emptyNow(): 
      emptySince += ctx.dt
      if emptySince > 3.5:
        k = ceil((ctx.leadM + 30 - 40) / 200)      // 恒等的に Mcam(k) ≥ leadM+30(前方保証)
        type = R_SIDE; setFixedCam(k, +22, 3.2, FL=1400); emptySince = 0
    else: emptySince = 0
  // 注視更新(パン追従型のみ毎フレーム)
  if type in {R_SIDE, R_OWNPAN}: camera.lookAt(pos(type==R_OWNPAN? ctx.ownM : ctx.leadM-8, 0, 1.6))
  empty = (type in 前方固定型) ? (ctx.leadM < Mcam(k) - 140) : false
  ownInView = (type in 前方固定型) ? 自馬が視野内(FOV×距離の簡易判定) : (type==R_OWNPAN ? true : 自馬が視野内(FOV×距離の簡易判定))
  return {camera, type, camIndex:k, empty, fl, ownInView}   // lastOwnInViewへは書かない。統合はraceview3d側(§2.5.3)

cutTo(k2):
  k = k2; lastCutT = ctx.t
  type = isNameK(k) ? R_NAME(対応名物の構図) : RR_TYPES[rrCursor++ % 3]  // front→side→diag
  setFixedCam(k, R_TABLE[type])       // §4.3 の型テーブル(位置/注視/FL)
```

### 3.2 残距離数字スライド(H-2、仕様§2.1 確定則)

```
drawDistSlide(α, R):
  if R <= 0 or α <= 0: return
  Vshow = ceil(R/100)*100
  f = (R mod 100)/100                       // 1→0 で次の100m標識に到達
  xNum = 1580 - (1-f)*(1580-380)            // X_R=1580, X_L=380。f減少で右→左スライド
  //  100m通過で f が 0→1 にロールオーバー = xNum は X_R へワープ(補間なし)
  //  X_L<1280<X_R のため毎区間のスライドが必ずビュー境界(x=1280)を横切る(AC-18)
  drawPoleIcon(xNum-17, 8)                  // 幅7×高44 紅白3段縞、数字左10px
  drawOutlinedText(String(Vshow), xNum, yNum=7, "bold 46px sans-serif",
                   fill=#fff, stroke=#0c2a12(5px), shadow=rgba(0,0,0,.4) offset(2,2), alpha=α)
```

### 3.3 隊列チップ順位スライド(H-3、仕様§2.1)

```
状態: chipAnim[runnerIdx] = {x(現表示x), alpha(0..1), from, to, t0} を rv-hud が保持
drawFormation(α, rankIdx, t, xNum, numW):        // xNum/numW は同フレームの H-2(§3.2)から渡される
  Nchip = min(n, 8); shown = rankIdx[0..Nchip); gap = 6
  // H-3/H-2非重複(§2.6・A-MINOR4で確定): 左端 = 2540 − Nchip·(cw+gap) ≥ xNum+numW+40 を cw について解いた式
  cw = clamp(floor((2540 - (xNum + numW + 40)) / Nchip) - gap, 30, 46)
  for slot in 0..Nchip-1:
    i = rankIdx[slot]; targetX = 2540 - (slot+1)*(cw+gap) + gap   // 右端=1位、左へ
    a = chipAnim[i]
    if a == undefined:                                             // 新規イン(A-MINOR4)
      a = chipAnim[i] = {x: 2540+cw, alpha: 0, from: 2540+cw, to: targetX, t0: t}  // 初期位置=右端画面外(x=2540+cw)、alpha=0から開始
    else if a.to != targetX: a.from = a.x; a.to = targetX; a.t0 = t     // 順位変動検知
    u = clamp((t - a.t0)/0.35, 0, 1); ease = 1-(1-u)^2                  // 0.35sim秒 ease-out(位置・alpha共通)
    a.x = a.from + (a.to-a.from)*ease; a.alpha = min(1, ease)
    own = (runners[i].kind==="owned")
    drawShieldChip(a.x, cy=20, cw, chH = own?38*1.15:38, waku色, 馬番, α*a.alpha)  // shieldパスは§2.1転記
    if own: drawOwnTag(a.x, y=0, w=cw, h=20, text=String(slot+1), α*a.alpha)       // H-4 専用ゾーン
  // ウィンドウ外へ落ちた馬の chipAnim は破棄(次回インは上記の新規イン処理で右端画面外から再フェードイン)
```

### 3.4 テーマの m↔s 逆写像(名物定点・L5補正・区間トーン共用)

```
// 順写像(既存 makeCourse と同一): s(m) = ((startWS + m) mod lap + lap) mod lap
//   startWS = 369 - D, lap = 1653.98
sOfM(m) = ((369 - D + m) % lap + lap) % lap

// 逆写像: lap空間の目標 s* に対応する「そのレースの走破距離 m」の列(§4.2)
msOfS(sStar, margin=200):
  m0 = ((sStar - (369 - D)) % lap + lap) % lap    // 最初の通過
  return [ m0 + j*lap  for j = 0,1,2..  while m0 + j*lap <= D + margin ]
// 例: D=3600 は j=0,1 の2要素(2周で同じ景観を2回通る)。名物定点は各 m ごとに
// 最寄り定点 k = round((m - 40)/200) を R-name 化(nameKs へ登録)。
```

### 3.5 ポーズリグ(既存 pose の流用範囲と拡張、horse3d.js)

```
流用(そのまま): setLeg の関節式(pivot.rotation.z = sin(ph)*swing + 基準角 / knee の bend)、
  4肢位相(HL:0, HR:+0.45, FL:π+0.35, FR:π+0.8)、body.rotation.z ピッチング、
  neckPivot / tailPivot のセカンダリ。

拡張 pose(phase, running, opt={v, drive, easeUp}):    // opt省略時は完全に旧挙動(後方互換)
  …既存処理…
  if running:
    // A-6 懸垂期: root上下動ピーク近傍で全肢を引き上げ
    lift = max(0, sin(phase*0.5 + 0.4) - 0.72) / 0.28      // ピーク窓のみ 0→1
    for leg in legs: leg.knee.rotation.z += (hind?-1:+1) * 0.55 * lift
    root.position.y = |sin(phase*0.5+0.4)|*0.10 - 0.02 + lift*0.06
  // A-7 騎手: 終盤の「追う」
  if opt.drive > 0: jockey.rotation.z = sin(phase)*0.18*opt.drive; jockey.position.x += sin(phase)*0.02*opt.drive
  // ゴール後に立ち上がって流す
  if opt.easeUp: jt.rotation.z → 0.55 へ lerp(前傾緩和); 腕角も緩和

呼び出し側(rv-horses): 位相は速度連動 phase[i] += v_i * dt / 3.4(既存 m/3.4 と同一周期・
  連続積分化で補間ジャンプを排除)+初期オフセット i*1.7。
  drive = clamp((400 - R)/400, 0, 1)(R<400)、easeUp = (sim.times[i] < t)、running = t≥0 && !easeUp。
```

---

## 4. データ構造定義

### 4.1 view 構造体(raceview3d.js 内部状態)

```js
view = {
  // 公開(既存互換)
  t: -5.4, speed: 3, raf: 0, done: false, phase: "live",   // live|replay|board
  cancel(),                                // rAF停止 → world.dispose()(§1.4フラットAPI。テクスチャ/ジオメトリ一括解放)+ renderer破棄
  // 内部
  D, n, course, night,                       // 基本
  frames, dtSim, posAt(t), vAt(t),           // シム補間(既存式)
  winTime, goalTime, photoFinish, REPLAY_FROM, replayT, boardT, flash, goalFlashed,
  world,            // SH.RVWorld.build の戻り
  herd,             // SH.RVHorses.create の戻り(lat[], phase[] を内包)
  dirL, dirR,       // SH.RVCams の director(各 .camera を所有)
  hud,              // SH.RVHud
  quality,          // SH.RVQuality(.level/.q/.viewModeSingle)
  hudAlpha, hudPhase,                       // §2.0(hud が算出し view が保持)
  passTime1000m: null, passHudUntil: 0,     // H-7(leadM≥1000 到達フレームで補間確定)
  lastOwnInView: null, ownIndex,            // AC-23。dirL.ownInView || dirR.ownInView をview集約(raceview3d、§2.5.3)で毎フレーム統合
  storyIdx, lastStory,                      // 実況(既存踏襲)
  canvases: { bg, gl, fg }, octx,           // レイヤ(§1.1)
}
```

### 4.2 定数ブロック(RV_CONST、raceview3d.js 冒頭で一元定義し各モジュールへ注入)

```js
VW=1280, VH=720, DW=2560, DH=720, FL_BASE=830,
PREROLL=5.4, TITLE_END=-2.6,                       // 既存踏襲
P_HUD_ON=0.085, DP_FADE=0.020,                     // §2.0
X_L=380, X_R=1580, BAND_H=60, CHIP_MAX=8,          // §2.1 H-1/2/3
LEGEND_COLS=6, RH_MIN=34, RH_MAX=44,               // H-5
PASS_HOLD=10.0, PASS_FADE=0.5, PASS_MIN_D=1600,    // H-7
CAM_SPACING=200, CAM_OFFSET=40, ARRIVE_M=140, LEAD_PASS=25, EMPTY_MAX=3.5,  // §3.2
OWN_EVERY=25, OWN_HOLD=2.5,                        // 自馬保証
SAME_POS_DIST=12, SAME_DIR_DOT=0.98,               // §3.3
CULL_RADIUS=380,                                   // §4.1(±350m+余裕)
RIG_SCALE=1.15,                                    // §6.1
CHIP_SLIDE=0.35, SEP_W=4
```

### 4.3 カメラ定義テーブル(仕様§3.1/§3.2 転記)

```js
// 左: L_TABLE[shot] = (ctx)=>({pos, tgt, fl, sway})   packC = leadM-8
L0: pos(16,+2,2.4)                    tgt(0,0,1.4)                fl 1100  sway 0
L1: pos(packC+6,+14,1.9)              tgt(packC,0,1.5)            fl 830   sway 0.22
L2: 3秒交互 引き pos(packC+2,+26,4.0) / 寄り pos(packC+5,+12,1.8) tgt(packC,0,1.6) fl 830 sway 0.18
L3: pos(packC-30,+34,22)              tgt(packC+10,0,0.6)         fl 760   sway 0.06
L4: pos(leadM+70,+3,3.0)              tgt(leadM+120,0,2.0)        fl 900   sway 0
L5: pos(packC-34,+58,40)              tgt(packC+12,0,0)           fl 700   sway 0.05
L6: pos(packC+4,+11,1.6)              tgt(packC,0,1.6)            fl 950   sway 0.24
L7: pos(packC+4,+22,5.0)              tgt(packC,0,1.6)            fl 830   sway 0.16
L8: stretch pos(D+60,+7,3.2) tgt(min(leadM+15,D+20),0,1.8) fl clamp(dist*42,950,15000) sway 0.12
    goal(残130m以降) pos(D-34,+38,9)  tgt 同上                    fl 830
replay(P-4): pos(min(leadM+24,D+26),-16,1.9) tgt(min(leadM+2,D+6),+2,1.6) fl 830 sway 0.16

// 右: R_TABLE[type](Mcam=k*200+40)
R-front: pos(Mcam+40, 0, 2.4)   tgt(leadM,0,1.6)    fl 1100
R-side:  pos(Mcam, +22, 3.2)    tgt(packC,0,1.6)※パン fl 1400
R-diag:  pos(Mcam+25, +16, 5.5) tgt(packC,0,1.6)    fl 950
R-name:  名物ごとの構図(石橋: 橋を横から+通過馬 / ポール際: ポール+走路 / スタンド前: スタンド+走路) fl 950〜1100
R-goal:  pos(D-6, +14, 3.0)     tgt(D,0,1.6)        fl 1000
```

### 4.4 テーマ配置テーブル(仕様§4.2 転記。rv-world.js の THEMES 定数)

```js
THEMES = [
 {id:0, name:"stand",   s0: 260, s1: 450, tone:1.0,  hedge:false},  // 決勝線 s=369 含む
 {id:1, name:"bamboo",  s0: 450, s1: 700, tone:0.8,  hedge:true },
 {id:2, name:"forest",  s0: 700, s1: 950, tone:0.8,  hedge:true },
 {id:3, name:"gorge",   s0: 950, s1:1130, tone:1.15, hedge:false},  // 石橋中心 s=1040
 {id:4, name:"wall",    s0:1130, s1:1280, tone:1.0,  hedge:false},
 {id:5, name:"hills",   s0:1280, s1:1470, tone:1.15, hedge:true },
 {id:6, name:"darkwood",s0:1470, s1:1654+260, tone:0.8, hedge:false}, // 周回境界またぎ(mod lap)
]
FINISH_S = 369; BRIDGE_S = 1040; STAND_S = 355;      // 名物: 橋/スタンド。ポール際は m=D-600
// 生垣区間 = T1+T2+T5 = 690m ≒ lap の42%(E-2 ≥30%)。E-1 砂色 = T3取付路+T5路肩。
```

### 4.5 PART_DEFS(§2.3.1 の表をコード化)

```js
PART_DEFS = [ {key:"torsoSph", geo:geoTorso, per:3, color:"coat"}, ... ]  // §2.3.1 表の22行
// per の合計 ≈ 36ノード/頭。rig.nodes[key][k] と 1:1 対応(生成順で固定)。
```

---

## 5. 実装ワークストリーム分割(工程4用・直列3本)

### WS1 — 3Dワールド+デュアルビュー基盤

- **実装**: `rv-world.js` 全部 / `raceview3d.js`(パイプライン骨格・番組フェーズ§2.9・操作/実況・シム補間) / `rv-cams.js` 暫定版(L=既存 computeCam 移植の4モード+R=先回り条件(a)(b)のみの素朴チェーン) / raceview.js ディスパッチ+`SH.RV2D` 公開 / data.js `isNightRace` / index.html script 追加。馬は**暫定**: 既存 `SH.Horse3D.createHorse` の個別 Mesh を n 体(WBC 5頭で確認。18頭ではDC超過を許容)。
- **完了条件**: (1) WBC戦(5頭)で タイトル→ゲート→デュアルライブ→リプレイ→掲示板→onDone が console エラー 0 で完走。(2) T0〜T6 の 7 要素+ナイター(夜空/照明塔/明暗/グレア)+昼(良〜不良)が視認できる。(3) `?rvnogl=1` で既存 2D 経路が完走(回帰なし)。(4) 左右ビューが異なる構図。
- **満たすAC**: AC-13, AC-14, AC-16, AC-24, AC-25(基盤)、AC-15(5頭レースでの通し)。
- **WS1完了時点の動作**: 5頭ナイター/昼レースをデュアルビューで完走できる。HUD は暫定(バナー+経過タイムのみ)、馬は旧個別Meshで18頭は重い、カメラは種類が少ない。

### WS2 — 馬 InstancedMesh+アニメ

- **実装**: `horse3d.js` 拡張(createRig/pose 第3引数) / `rv-horses.js` 全部(PART_DEFS・行列書込・instanceColor・ゼッケン個別Mesh・柄アトラス機構・白斑・マーカー・ブロブ影・lat力学・ブラー(b)・setLowDetail)。raceview3d の馬更新を herd.update へ差替(暫定馬を撤去)。
- **完了条件**: (1) 18頭で draw call がパスあたり ≤140(renderer.info で確認)。(2) 青地白数字ゼッケン判読・勝負服が馬ごとに異なる・4拍+懸垂期(スロー再生確認)。(3) 白斑馬が出走中に確認でき2レースで同一。(4) 密集でめり込み/Z-fight なし。(5) 自馬頭上マーカーが両ビュー最前面。
- **満たすAC**: AC-12, AC-20, AC-22, AC-7(a), AC-19, AC-26。
- **WS2完了時点の動作**: 18頭 G1 でも馬群が破綻なく走り、両ビューで判読可能。HUD/カメラ演出はまだ暫定。

### WS3 — HUD+カメラ演出+品質制御+統合

- **実装**: `rv-hud.js` 全部(H-1〜H-10・フェーズ制御・チップスライド・凡例グリッド・fmtElapsed/fmtPass) / `rv-cams.js` 完成(L0〜L8 状態機械・DirectorR 全カット条件 e>d>c>a>b・名物経由・自馬保証・§3.3 制約) / `rv-quality.js` 全部 / `publishState` 全フィールド / URL テストフック / 統合・回帰(距離3種×頭数5/12/18 マトリクス、フォールバック再確認)。
- **完了条件**: (1) `SH._rvState` 全13フィールドが仕様型で毎フレーム更新。(2) 60秒間に右3カット以上+空フレーム→通過を確認。(3) HUD 全要素が p 基準スケジュールで動作(AC-4/5/9/10/11 のログ判定式が通る)。(4) `?rvq=0..4` で各段階を強制でき、縮退順序ログが出る。(5) 5/12/18×1200/2400/3600 で破綻なし。
- **満たすAC**: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7(b)(c), AC-8, AC-9, AC-10, AC-11, AC-17, AC-18, AC-21, AC-23、AC-15(最終確認)。

---

## 6. リスクと対策

| # | リスク | 対策 |
|---|---|---|
| R1 | **2パス描画の状態リーク**: viewport/scissor/カメラaspect/シーン状態がパス間で汚染 | カメラは左右別インスタンス(aspect/fov を共有しない)。パス間のシーン変更を禁止(区間トーンは左カメラ基準の単一値 — §2.1 設計判断)。scissor は毎フレーム明示 set、フレーム末に setScissorTest(false) しない(次フレーム冒頭で再設定)。autoClear=true+シザーで領域別クリア |
| R2 | **InstancedMesh の誤フラスタムカリング**(境界球が原点基準) | 馬パーツ全て `frustumCulled=false`(§2.3.1)。美術 InstancedMesh はテーマ全体の境界球を明示設定 |
| R3 | **instanceMatrix 更新コスト**(650行列合成+22バッファ×~40KB/フレーム転送) | DynamicDrawUsage・needsUpdate はフレーム1回・一時オブジェクト再利用・2パス共有(§2.2)。予算超過時は E-15 stage3(低セグ差替は転送量に無関係だが合成 CPU を setLowDetail の骨格簡略で削減可能な設計余地を残す) |
| R4 | **柄アトラスの onBeforeCompile が r147 minified で不安定** | 機構を 1 ヘルパーに隔離+初期化時コンパイル検証、失敗時は柄なし(色差のみ)へ自動退避(§2.3.4)。ゼッケンは個別Meshでシェーダ非依存 = P0 非連動 |
| R5 | **フォールバック分岐の回帰**(AC-15/16) | raceview.js の diff を「冒頭ディスパッチ+末尾1行」の2箇所に限定。`W/H=1280×720` 系の既存座標は一切触らない(仕様 付記の移行注意)。`?rvnogl=1` の通し録画を WS1/WS3 で2回実施 |
| R6 | **右定点カメラの振動・空フレーム超過** | 再同期式は前方保証式(§3.1、旧 floor 式は仕様で廃止済み)。自馬パンは前方定点+2.5s 保持で条件(a)の即時再満足なし(§3.2)。emptySince/カット時刻をログ可能に |
| R7 | **HUD の頭数×距離マトリクス破綻**(AC-17) | 全レイアウトを clamp 式で定義(cw/rh/yLegTop、§2.6)し、5/12/18 の3値は式の分岐でなく同一式の入力とする。WS3 完了条件にマトリクス確認を含める |
| R8 | **性能未達(中間性能帯)** | E-15(§2.7)。加えて DC 内訳を `SH._rvDebug`(開発補助、§7)で常時観測し、WS2 完了条件に DC 実測を含める |
| R9 | **2560×720 キャンバスのモバイル負荷**(fill rate/メモリ) | 初期 q=min(DPR,1.0)・モバイルは stage1 開始(§1.4)。fgCanvas は等倍固定で再割当なし |
| R10 | **sRGB 出力と instanceColor の色ずれ**(AC-6 の一貫性) | HUD/凡例/掲示板の枠色は 2D 側(正確)。3D 側の帽色等は `THREE.Color(hex).convertSRGBToLinear()` で近似を統一。照明下の色変化は「一貫」の判定対象がHUD群であるため許容 |
| R11 | **タイトル/掲示板の再実装ずれ**(P-1/P-5 無退行) | 既存関数の座標値を転記し `translate(640,0)` のみ(§2.9)。ロジック変更禁止をコードコメントで明示 |
| R12 | **WebGLコンテキストリーク**(週次連続観戦でレース遷移を繰り返すとブラウザのコンテキスト上限に達し以後のレースが真っ黒/クラッシュになる) | `create()` 失敗時(§1.2)・`view.cancel()` 時(§4.1)のいずれも `renderer.dispose()`+`renderer.forceContextLoss()`+生成済みcanvas除去+テクスチャ/ジオメトリdispose を徹底。`world.dispose()`(§1.4フラットAPI)がテーマ/馬/HUD由来のテクスチャ・ジオメトリを一括解放する単一窓口を持つ |

---

## 7. テストフック設計

### 7.1 `SH._rvState` 全フィールドの更新箇所(§7.3 準拠)

書込は `raceview3d.js: publishState(view)`(毎フレーム末・一括)に一元化(§2.8)。各フィールドの**値の供給源**:

| フィールド | 供給源(読み取り元) | 更新頻度 |
|---|---|---|
| `viewMode` | `quality.viewModeSingle ? "single" : "dual"`(リプレイ/掲示板遷移時に "single" を書いて凍結) | 毎フレーム |
| `qualityLevel` | `quality.level`(0–4。setLevel が保持、publishState が転記) | 毎フレーム(変化はsetLevel時) |
| `hudPhase` / `hudAlpha` | hud が p から算出した値(§2.6)を view 経由で転記 | 毎フレーム |
| `elapsedSec` | `view.t` | 毎フレーム |
| `remainM` / `distShown` | パイプライン(1)の `R` / `ceil(R/100)*100` | 毎フレーム |
| `rankOrder` | パイプライン(1)の `rankIdx.slice()`(posAt降順 runner index) | 毎フレーム |
| `camL` | `dirL` 戻り値 `{mode:"L0".."L8", pos:{x,y,z}, tgt, fl}` | 毎フレーム |
| `camR` | `dirR` 戻り値 `{type, camIndex:k, pos, tgt, fl, empty}`(empty は §3.2 機械判定式) | 毎フレーム |
| `shotL` | `camL.mode` と同値(文字列) | 毎フレーム |
| `passTime1000m` | `view.passTime1000m`(leadM≥1000 到達フレームで線形補間確定・1回) | 到達時1回 |
| `passHudVisible` | `view.t < passHudUntil`(=通過時刻+10.0) かつ `D≥1600` | 毎フレーム |
| `ownInViewSince` | `view.lastOwnInView`(dirL/dirR いずれかで自馬が視野内のとき view.t を記録) | 毎フレーム |

- 初期化: `createRaceView3D` 冒頭で全フィールドを既定値で生成(§7.3)。フォールバック時は raceview.js が `{viewMode:"single", qualityLevel:null}`(§1.2)。

### 7.2 テストからの制御(URL パラメータ / グローバルフラグ)

`raceview3d.js` 読み込み時に `URLSearchParams(location.search)` を 1 回解析:

| フック | 効果 | 対応AC |
|---|---|---|
| `?rvq=0..4` / `SH._rvForceQuality(n)` | E-15 を該当 stage に固定し自動評価停止(`quality.force`)。`[E-15] quality→ n` をログ | AC-1(stage4除外規定), AC-21 |
| `?rvnogl=1` / `SH._forceNoWebGL=true` | ディスパッチャが 2D フォールバック経路を強制 | AC-16 |
| `?rvnight=1` | `SH.isNightRace` の結果を true に上書き(raceview3d 内のローカル判定のみ。data.js は不変) | AC-13 検証補助 |
| `console.info("[E-15] quality→", level)` | 縮退/復帰の発動と段階のログ(順序検証) | AC-21 判定注記 |
| `SH._rvDebug`(任意・開発補助) | `{drawCalls, triangles, emaMs, emptySince, cutLog[]}` を毎フレーム更新。`_rvState` の仕様固定フィールドとは分離 | 性能予算の実測(§7.1) |

- AC のログ判定はすべて `SH._rvState` のポーリング(テストハーネス側)で行える: 例 AC-4 = `remainM` と `distShown` の一致±100m、AC-5 = `rankOrder` とチップ順(hud 内部順は rankOrder 起点のため恒等)、AC-10 = `passTime1000m` 確定から `passHudVisible` が false になるまでの `elapsedSec` 差が 8〜12、AC-2 = `camR.camIndex` の変化回数と `camR.empty` の遷移、AC-23 = `ownInViewSince` の更新間隔 ≤30。
- **AC-10 判定範囲の共有(A-MINOR6・確定)**: AC-10(H-7 通過タイム表示)は 02-spec H-7 の確定事項により **`D≥1600`(`PASS_MIN_D`、§4.2)のレースのみが判定対象**。`D<1600` では `passTime1000m`/`passHudVisible` は終始 `null`/`false` のままであり(§2.6 表7行目「D≥1600のみ」)、これはテストハーネス側と共有すべき既知仕様である — `D<1600` のレースで AC-10 を判定しようとしないこと、をテスト設計時の前提として明記する。

---

## 付記: 仕様書パラグラフ→設計セクション対応(実装時の参照表)

| 02-spec | 本書 |
|---|---|
| §1 画面/レイヤー/DPR/分割 | §2.2, §4.2 |
| §2 HUD(H-1〜H-10, 2.0/2.2) | §2.6, §3.2, §3.3, §4.2 |
| §3 カメラ(L/R/共通) | §2.5, §3.1, §4.3 |
| §4 コース・美術(T0〜T6, 4.3/4.4) | §2.1, §2.4, §4.4 |
| §5 照明(ナイター/昼/区間トーン) | §2.1, §2.4 |
| §6 馬体(6.0〜6.10) | §2.3, §3.5, §4.5 |
| §7 性能予算・E-15・_rvState | §2.2, §2.7, §2.8, §7 |
| §8 フォールバック | §1.2, §6-R5 |
| 付記(流用マップ・W/H 移行注意) | §1.2, §2.9, §6-R5/R11 |
