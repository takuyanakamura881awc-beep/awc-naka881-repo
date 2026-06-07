// 簡易ルーティング（依存を増やさず状態ベース）。
export type View =
  | "home"
  | "create"
  | "settings"
  | { horse: string } // 詳細
  | { edit: string } // カルテ編集
  | { log: { horseId: string; logId?: string } }; // 出走/予定の追加・編集
