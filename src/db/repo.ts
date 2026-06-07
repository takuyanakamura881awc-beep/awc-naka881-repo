// データアクセス層（CRUD）。UIはここ経由でのみ永続化に触れる。
import { getDB } from "./idb";
import { SCHEMA_VERSION, STORES } from "./schema";
import { isoWeekKey } from "../domain/plan";
import type {
  PlayerHorse,
  RaceEntry,
  TrainingLogEntry,
  UsageMeta,
} from "../domain/types";

// --- 育成馬 ---
export async function listHorses(): Promise<PlayerHorse[]> {
  const db = await getDB();
  const all = await db.getAll(STORES.horses);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getHorse(id: string): Promise<PlayerHorse | undefined> {
  const db = await getDB();
  return db.get(STORES.horses, id);
}

export async function putHorse(horse: PlayerHorse): Promise<void> {
  const db = await getDB();
  await db.put(STORES.horses, horse);
}

export async function deleteHorse(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    [STORES.horses, STORES.training, STORES.races],
    "readwrite",
  );
  await tx.objectStore(STORES.horses).delete(id);
  for (const key of await tx
    .objectStore(STORES.training)
    .index("byHorse")
    .getAllKeys(id)) {
    await tx.objectStore(STORES.training).delete(key);
  }
  for (const key of await tx
    .objectStore(STORES.races)
    .index("byHorse")
    .getAllKeys(id)) {
    await tx.objectStore(STORES.races).delete(key);
  }
  await tx.done;
}

export async function countHorses(): Promise<number> {
  const db = await getDB();
  return db.count(STORES.horses);
}

// --- 育成ログ（文脈） ---
export async function addTrainingLog(entry: TrainingLogEntry): Promise<void> {
  const db = await getDB();
  await db.put(STORES.training, entry);
}

export async function listTrainingByHorse(
  horseId: string,
): Promise<TrainingLogEntry[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex(STORES.training, "byHorse", horseId);
  return all.sort((a, b) => a.turn - b.turn);
}

// --- 出走記録（アウトカム） ---
export async function addRaceEntry(entry: RaceEntry): Promise<void> {
  const db = await getDB();
  await db.put(STORES.races, entry);
}

export async function listRaceEntriesByHorse(
  horseId: string,
): Promise<RaceEntry[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex(STORES.races, "byHorse", horseId);
  return all.sort((a, b) => b.at - a.at);
}

// --- 課金/利用メタ（singleton） ---
function defaultUsage(now: number): UsageMeta {
  return {
    id: "singleton",
    schema_version: SCHEMA_VERSION,
    suggestionWeekKey: isoWeekKey(new Date(now)),
    suggestionCount: 0,
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
