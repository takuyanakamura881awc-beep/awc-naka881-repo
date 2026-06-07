// 簡易ルーティング（依存を増やさず状態ベース）。
import type { ParentRef } from "../domain/types";

export type View =
  | "home"
  | "create"
  | "settings"
  | "breed" // 配合プランナー
  | { create: { sire: ParentRef; dam: ParentRef } } // 配合から登録（親プリフィル）
  | { horse: string } // 詳細
  | { edit: string } // カルテ編集
  | { log: { horseId: string; logId?: string } } // 出走/予定の追加・編集
  | { bets: string }; // ベット記録・一覧（horseId）
