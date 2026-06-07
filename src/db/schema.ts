// IndexedDB のスキーマ定義。全レコードに schema_version を付与し、
// PWA更新時はマイグレーションで吸収する。
import type { DBSchema } from "idb";
import type {
  PlayerHorse,
  RaceEntry,
  TrainingLogEntry,
  UsageMeta,
} from "../domain/types";

export const DB_NAME = "stable-saga";
export const DB_VERSION = 1;

// レコードに埋め込む論理スキーマ版（DBのバージョンとは別管理）。
export const SCHEMA_VERSION = 1;

export const STORES = {
  horses: "player_horses",
  training: "training_log",
  races: "race_entries",
  usage: "usage_meta",
} as const;

export interface StableDB extends DBSchema {
  player_horses: {
    key: string;
    value: PlayerHorse;
  };
  training_log: {
    key: string;
    value: TrainingLogEntry;
    indexes: { byHorse: string };
  };
  race_entries: {
    key: string;
    value: RaceEntry;
    indexes: { byHorse: string };
  };
  usage_meta: {
    key: string;
    value: UsageMeta;
  };
}
