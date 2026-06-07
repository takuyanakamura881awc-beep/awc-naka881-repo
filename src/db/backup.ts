// セーブデータの手動バックアップ（JSONエクスポート/インポート）。
// ローカル保管唯一の弱点＝データ消失への対策。アカウント不要。
import { getDB } from "./idb";
import { SCHEMA_VERSION, STORES } from "./schema";
import type { Horse, RaceLog, UsageMeta } from "../domain/types";

export interface BackupFile {
  app: "stable-saga";
  schema_version: number;
  exportedAt: number;
  data: {
    horses: Horse[];
    race_logs: RaceLog[];
    usage_meta: UsageMeta[];
  };
}

export async function exportBackup(): Promise<BackupFile> {
  const db = await getDB();
  return {
    app: "stable-saga",
    schema_version: SCHEMA_VERSION,
    exportedAt: Date.now(),
    data: {
      horses: await db.getAll(STORES.horses),
      race_logs: await db.getAll(STORES.raceLogs),
      usage_meta: await db.getAll(STORES.usage),
    },
  };
}

export function isBackupFile(value: unknown): value is BackupFile {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.app === "stable-saga" && typeof v.data === "object" && v.data !== null;
}

export async function importBackup(file: BackupFile): Promise<void> {
  if (!isBackupFile(file)) throw new Error("不正なバックアップファイルです");
  const db = await getDB();
  const tx = db.transaction([STORES.horses, STORES.raceLogs, STORES.usage], "readwrite");
  await tx.objectStore(STORES.horses).clear();
  await tx.objectStore(STORES.raceLogs).clear();
  await tx.objectStore(STORES.usage).clear();
  for (const h of file.data.horses ?? []) tx.objectStore(STORES.horses).put(h);
  for (const l of file.data.race_logs ?? []) tx.objectStore(STORES.raceLogs).put(l);
  for (const u of file.data.usage_meta ?? []) tx.objectStore(STORES.usage).put(u);
  await tx.done;
}

export function downloadBackup(file: BackupFile): void {
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date(file.exportedAt).toISOString().slice(0, 10);
  a.href = url;
  a.download = `staho-r-backup-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
