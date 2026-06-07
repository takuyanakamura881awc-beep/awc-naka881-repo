import { ulid } from "ulid";

// 全レコードのIDはクライアント生成のULID（将来クラウド化時の冪等upsert前提）。
export function newId(): string {
  return ulid();
}
