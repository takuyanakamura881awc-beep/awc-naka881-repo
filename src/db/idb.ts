// IndexedDB の開閉とマイグレーション。
import { openDB, type IDBPDatabase } from "idb";
import { DB_NAME, DB_VERSION, STORES, type StableDB } from "./schema";

let dbPromise: Promise<IDBPDatabase<StableDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<StableDB>> {
  if (!dbPromise) {
    dbPromise = openDB<StableDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // v0 -> v1: 初期スキーマ。将来の版は oldVersion で分岐して追加する。
        if (oldVersion < 1) {
          db.createObjectStore(STORES.horses, { keyPath: "id" });
          const logs = db.createObjectStore(STORES.raceLogs, { keyPath: "id" });
          logs.createIndex("byHorse", "horseId");
          db.createObjectStore(STORES.usage, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

export function resetDBHandle(): void {
  dbPromise = null;
}
