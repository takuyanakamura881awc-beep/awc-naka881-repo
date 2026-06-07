// IndexedDB の開閉とマイグレーション。
import { openDB, type IDBPDatabase } from "idb";
import { DB_NAME, DB_VERSION, STORES, type StableDB } from "./schema";

let dbPromise: Promise<IDBPDatabase<StableDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<StableDB>> {
  if (!dbPromise) {
    dbPromise = openDB<StableDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // v0 -> v1: 初期スキーマ。
        if (oldVersion < 1) {
          db.createObjectStore(STORES.horses, { keyPath: "id" });
          const logs = db.createObjectStore(STORES.raceLogs, { keyPath: "id" });
          logs.createIndex("byHorse", "horseId");
          db.createObjectStore(STORES.usage, { keyPath: "id" });
        }
        // v1 -> v2: ベット記録ストアを追加。
        if (oldVersion < 2) {
          const bets = db.createObjectStore(STORES.bets, { keyPath: "id" });
          bets.createIndex("byHorse", "horseId");
        }
      },
    });
  }
  return dbPromise;
}

export function resetDBHandle(): void {
  dbPromise = null;
}
