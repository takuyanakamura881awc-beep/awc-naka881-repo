# スマホで遊ぶ：Cloudflare Pages + Access（無料・認証つき）

このゲームは静的サイト（ビルド不要）です。Cloudflare Pages で配信し、Cloudflare Access
（Zero Trust 無料枠）で「許可したメールアドレスだけがワンタイムPINで入れる」認証をかけます。

- **課金**：Pages・Zero Trust とも無料枠でOK（個人利用・少人数）。
  Zero Trust 初期設定でカード登録を求められる場合がありますが、**Free プラン（$0）**を
  選べば課金されません。
- **認証**：許可メール宛のワンタイムPIN。自分のメールだけ許可すれば実質自分専用。
- **起動/終了**：下記「オンオフ」を参照。いつでも可能。

---

## 1. Cloudflare Pages にデプロイ

1. https://dash.cloudflare.com にログイン（無料アカウント登録）
2. 左メニュー **Workers & Pages → Create → Pages → Connect to Git**
3. GitHub を連携し、リポジトリ **`awc-naka881-repo`** を選択
4. ビルド設定（**重要**）:
   - Production branch: `claude/starhorse-progress-recreation-fa0a5d`
   - Framework preset: **None**
   - Build command: **空欄**
   - **Build output directory: `game`**  ← これで先頭URLがそのままゲームになる
5. **Save and Deploy** → 数十秒で `https://<プロジェクト名>.pages.dev` が発行される
   - 末尾に `/game/` は不要。トップURLでゲームが開く。
   - 重ければURL末尾に `?rvq=3`（例 `https://xxx.pages.dev/?rvq=3`）

## 2. Cloudflare Access で認証をかける

1. ダッシュボード左の **Zero Trust** を開く（初回はチーム名を決める。プランは **Free** を選択）
2. **Access → Applications → Add an application → Self-hosted**
3. Application domain に発行された `xxx.pages.dev` を入力（Application name は任意）
4. ポリシー作成:
   - Policy name: `self-only`
   - Action: **Allow**
   - Include: **Emails** → 自分のメールアドレスを入力（複数可）
5. Save。以後このURLを開くと**メール認証（ワンタイムPIN）**が必須になり、
   許可メール以外は入れません。

## 3. オンオフ（いつでも）

- **一時的に閉じる**：Access のポリシーを Allow から外す／アプリを無効化する、
  または Include を空にする → 誰も入れなくなる。
- **完全に落とす**：Pages プロジェクトの該当デプロイを削除、またはプロジェクトを削除。
  再開は Git から再デプロイ（約1分）。
- **注意**：Pages の URL は Access を外すと**公開状態**になります。非公開を保つ間は
  Access アプリを残したままにしてください。

## 参考：URLオプション
- `?rvnogl=1` … 2D描画で起動（低スペック/描画不具合時）
- `?rvq=0`〜`?rvq=4` … 描画品質を段階固定（`4`が最軽量・単一ビュー）
