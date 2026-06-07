// セーブデータの手動バックアップ（JSONエクスポート/インポート）。
// ローカル保管唯一の弱点＝データ消失への対策。アカウント不要。
import { getDB } from "./idb";
import { SCHEMA_VERSION, STORES } from "./schema";
import type {
  PlayerHorse,
  RaceEntry,
  TrainingLogEntry,
  UsageMeta,
} from "../domain/types";

export interface BackupFile {
  app: "stable-saga";
  schema_version: number;
  exportedAt: number;
  data: {
    player_horses: PlayerHorse[];
    training_log: TrainingLogEntry[];
    race_entries: RaceEntry[];
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
      player_horses: await db.getAll(STORES.horses),
      training_log: await db.getAll(STORES.training),
      race_entries: await db.getAll(STORES.races),
      usage_meta: await db.getAll(STORES.usage),
    },
  };
}

export function isBackupFile(value: unknown): value is BackupFile {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.app === "stable-saga" && typeof v.data === "object" && v.data !== null;
}

// インポート：既存データを置き換える（完全復元）。
export async function importBackup(file: BackupFile): Promise<void> {
  if (!isBackupFile(file)) {
    throw new Error("不正なバックアップファイルです");
  }
  const db = await getDB();
  const tx = db.transaction(
    [STORES.horses, STORES.training, STORES.races, STORES.usage],
    "readwrite",
  );
  await tx.objectStore(STORES.horses).clear();
  await tx.objectStore(STORES.training).clear();
  await tx.objectStore(STORES.races).clear();
  await tx.objectStore(STORES.usage).clear();
  for (const h of file.data.player_horses ?? []) tx.objectStore(STORES.horses).put(h);
  for (const t of file.data.training_log ?? []) tx.objectStore(STORES.training).put(t);
  for (const r of file.data.race_entries ?? []) tx.objectStore(STORES.races).put(r);
  for (const u of file.data.usage_meta ?? []) tx.objectStore(STORES.usage).put(u);
  await tx.done;
}

// ブラウザでファイルとしてダウンロードさせる。
export function downloadBackup(file: BackupFile): void {
  const blob = new Blob([JSON.stringify(file, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date(file.exportedAt).toISOString().slice(0, 10);
  a.href = url;
  a.download = `stable-saga-backup-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
