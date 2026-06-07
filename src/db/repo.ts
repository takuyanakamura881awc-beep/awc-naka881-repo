// データアクセス層（CRUD）。UIはここ経由でのみ永続化に触れる。
import { getDB } from "./idb";
import { SCHEMA_VERSION, STORES } from "./schema";
import type { Horse, RaceLog, UsageMeta } from "../domain/types";

// --- 所有馬 ---
export async function listHorses(): Promise<Horse[]> {
  const db = await getDB();
  const all = await db.getAll(STORES.horses);
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getHorse(id: string): Promise<Horse | undefined> {
  const db = await getDB();
  return db.get(STORES.horses, id);
}

export async function putHorse(horse: Horse): Promise<void> {
  const db = await getDB();
  await db.put(STORES.horses, { ...horse, updatedAt: Date.now() });
}

export async function deleteHorse(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction([STORES.horses, STORES.raceLogs], "readwrite");
  await tx.objectStore(STORES.horses).delete(id);
  for (const key of await tx.objectStore(STORES.raceLogs).index("byHorse").getAllKeys(id)) {
    await tx.objectStore(STORES.raceLogs).delete(key);
  }
  await tx.done;
}

export async function countHorses(): Promise<number> {
  const db = await getDB();
  return db.count(STORES.horses);
}

// --- 出走記録／ローテ予定 ---
export async function listLogsByHorse(horseId: string): Promise<RaceLog[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex(STORES.raceLogs, "byHorse", horseId);
  // 予定→完了の順、日付昇順。
  return all.sort((a, b) => a.at - b.at);
}

export async function getLog(id: string): Promise<RaceLog | undefined> {
  const db = await getDB();
  return db.get(STORES.raceLogs, id);
}

export async function putLog(log: RaceLog): Promise<void> {
  const db = await getDB();
  await db.put(STORES.raceLogs, log);
}

export async function deleteLog(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORES.raceLogs, id);
}

// --- 課金/利用メタ（singleton） ---
function defaultUsage(now: number): UsageMeta {
  return {
    id: "singleton",
    schema_version: SCHEMA_VERSION,
    proUntil: null,
    lastCheckedAt: now,
  };
}

export async function getUsage(now = Date.now()): Promise<UsageMeta> {
  const db = await getDB();
  const existing = await db.get(STORES.usage, "singleton");
  if (existing) return existing;
  const fresh = defaultUsage(now);
  await db.put(STORES.usage, fresh);
  return fresh;
}

export async function saveUsage(meta: UsageMeta): Promise<void> {
  const db = await getDB();
  await db.put(STORES.usage, meta);
}
