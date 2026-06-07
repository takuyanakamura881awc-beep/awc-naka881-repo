// IndexedDB のスキーマ定義。全レコードに schema_version を付与し、
// PWA更新時はマイグレーションで吸収する。
import type { DBSchema } from "idb";
import type { Bet, Horse, RaceLog, UsageMeta } from "../domain/types";

export const DB_NAME = "stable-saga";
export const DB_VERSION = 2;

export const SCHEMA_VERSION = 2;

export const STORES = {
  horses: "horses",
  raceLogs: "race_logs",
  bets: "bets",
  usage: "usage_meta",
} as const;

export interface StableDB extends DBSchema {
  horses: {
    key: string;
    value: Horse;
  };
  race_logs: {
    key: string;
    value: RaceLog;
    indexes: { byHorse: string };
  };
  bets: {
    key: string;
    value: Bet;
    indexes: { byHorse: string };
  };
  usage_meta: {
    key: string;
    value: UsageMeta;
  };
}
