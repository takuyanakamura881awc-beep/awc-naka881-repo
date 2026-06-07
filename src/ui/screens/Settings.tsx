import { useEffect, useRef, useState } from "react";
import { useGame } from "../../state/GameContext";
import { isPro } from "../../domain/plan";
import {
  downloadBackup,
  exportBackup,
  importBackup,
  isBackupFile,
} from "../../db/backup";
import {
  isPersisted,
  requestPersistentStorage,
  storageEstimate,
} from "../../pwa/persist";
import {
  canInstall,
  isStandalone,
  onInstallAvailabilityChange,
  promptInstall,
} from "../../pwa/install";
import type { View } from "../nav";

export function Settings({ go }: { go: (v: View) => void }) {
  const { usage, upgradeToPro, cancelPro, refresh } = useGame();
  const [persisted, setPersisted] = useState(false);
  const [estimate, setEstimate] = useState<string>("");
  const [installable, setInstallable] = useState(canInstall());
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const now = Date.now();
  const pro = usage ? isPro(usage, now) : false;

  useEffect(() => {
    isPersisted().then(setPersisted);
    storageEstimate().then((e) => {
      if (e?.usage != null) {
        setEstimate(`${(e.usage / 1024).toFixed(0)} KB 使用中`);
      }
    });
    return onInstallAvailabilityChange(setInstallable);
  }, []);

  async function onPersist() {
    const ok = await requestPersistentStorage();
    setPersisted(ok);
    setMsg(ok ? "永続ストレージが有効になりました" : "ブラウザが永続化を許可しませんでした");
  }

  async function onExport() {
    const file = await exportBackup();
    downloadBackup(file);
    setMsg("バックアップを書き出しました");
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const json = JSON.parse(await f.text());
      if (!isBackupFile(json)) throw new Error("形式が不正です");
      await importBackup(json);
      await refresh();
      setMsg("バックアップから復元しました");
    } catch (err) {
      setMsg(`復元に失敗しました：${(err as Error).message}`);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onInstall() {
    const ok = await promptInstall();
    setMsg(ok ? "インストールしました" : "インストールは見送られました");
  }

  return (
    <div className="screen">
      <button className="link-btn back" onClick={() => go("home")}>
        ‹ 厩舎
      </button>
      <h2 className="screen-title">設定</h2>

      {msg && <p className="info-text">{msg}</p>}

      <section className="panel">
        <h3 className="section-head">プラン</h3>
        <p>
          現在：<strong>{pro ? "PRO" : "無料"}</strong>
          {pro && usage?.proUntil && (
            <span className="muted small">
              （{new Date(usage.proUntil).toLocaleDateString()} まで）
            </span>
          )}
        </p>
        <p className="muted small">
          無料：管理枠2頭 ／ PRO：管理枠30頭
        </p>
        {pro ? (
          <button className="ghost-btn" onClick={cancelPro}>
            無料に戻す
          </button>
        ) : (
          <button className="primary-btn" onClick={() => upgradeToPro(30)}>
            PROにアップグレード（1ヶ月）
          </button>
        )}
        <p className="muted xsmall">
          ※ 決済は今後のバージョンで Stripe を統合予定（現在は動作確認用の仮アップグレード）。
        </p>
      </section>

      <section className="panel">
        <h3 className="section-head">データのバックアップ</h3>
        <p className="muted small">
          データは端末内に保存されます。消失に備え、定期的に書き出しましょう。
        </p>
        <div className="btn-row">
          <button className="ghost-btn" onClick={onExport}>
            エクスポート
          </button>
          <button className="ghost-btn" onClick={() => fileRef.current?.click()}>
            インポート
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={onImportFile}
          />
        </div>
      </section>

      <section className="panel">
        <h3 className="section-head">ストレージ</h3>
        <p className="muted small">
          永続化：{persisted ? "有効" : "未設定"}
          {estimate && ` ・ ${estimate}`}
        </p>
        {!persisted && (
          <button className="ghost-btn" onClick={onPersist}>
            永続ストレージを有効化
          </button>
        )}
      </section>

      {!isStandalone() && (
        <section className="panel">
          <h3 className="section-head">アプリとしてインストール</h3>
          <p className="muted small">
            ホーム画面に追加すると、オフラインでも遊べてデータが消えにくくなります。
          </p>
          {installable ? (
            <button className="primary-btn" onClick={onInstall}>
              ホーム画面に追加
            </button>
          ) : (
            <p className="muted xsmall">
              ブラウザのメニューから「ホーム画面に追加」を選んでください。
            </p>
          )}
        </section>
      )}
    </div>
  );
}
