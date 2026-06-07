import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as repo from "../db/repo";
import { newId } from "../domain/ids";
import { canAddHorse, horseLimit } from "../domain/plan";
import { SCHEMA_VERSION } from "../db/schema";
import { getCpuHorse } from "../data/cpuHorses";
import type { Bet, Horse, ParentRef, RaceLog, UsageMeta } from "../domain/types";

export type HorseDraft = Omit<
  Horse,
  "id" | "schema_version" | "createdAt" | "updatedAt" | "sireName" | "damName"
>;

interface ActionResult {
  ok: boolean;
  error?: string;
}

interface GameState {
  loading: boolean;
  horses: Horse[];
  usage: UsageMeta | null;
  refresh: () => Promise<void>;
  resolveParentName: (ref: ParentRef) => string;
  addHorse: (draft: HorseDraft) => Promise<ActionResult>;
  updateHorse: (horse: Horse) => Promise<void>;
  removeHorse: (id: string) => Promise<void>;
  saveLog: (log: RaceLog) => Promise<void>;
  deleteLog: (id: string) => Promise<void>;
  saveBet: (bet: Bet) => Promise<void>;
  deleteBet: (id: string) => Promise<void>;
  upgradeToPro: (days: number) => Promise<void>;
  cancelPro: () => Promise<void>;
}

const Ctx = createContext<GameState | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [usage, setUsage] = useState<UsageMeta | null>(null);

  const refresh = useCallback(async () => {
    const [h, u] = await Promise.all([repo.listHorses(), repo.getUsage()]);
    setHorses(h);
    setUsage(u);
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  // 親名の解決（CPUマスタ or 所有馬）。所有馬はstateから引く。
  const resolveParentName = useCallback(
    (ref: ParentRef): string => {
      if (ref.kind === "cpu") return getCpuHorse(ref.id)?.name ?? "?";
      if (ref.kind === "owned") return horses.find((h) => h.id === ref.id)?.name ?? "?";
      return "";
    },
    [horses],
  );

  const addHorse = useCallback(
    async (draft: HorseDraft): Promise<ActionResult> => {
      const now = Date.now();
      const meta = await repo.getUsage(now);
      const count = await repo.countHorses();
      if (!canAddHorse(meta, count, now)) {
        return {
          ok: false,
          error: `無料プランの管理枠（${horseLimit(meta, now)}頭）が上限です。PROで30頭まで管理できます。`,
        };
      }
      if (!draft.name.trim()) return { ok: false, error: "馬名を入力してください" };

      const horse: Horse = {
        ...draft,
        id: newId(),
        schema_version: SCHEMA_VERSION,
        sireName: resolveParentName(draft.sire),
        damName: resolveParentName(draft.dam),
        createdAt: now,
        updatedAt: now,
      };
      await repo.putHorse(horse);
      await refresh();
      return { ok: true };
    },
    [refresh, resolveParentName],
  );

  const updateHorse = useCallback(
    async (horse: Horse) => {
      await repo.putHorse({
        ...horse,
        sireName: resolveParentName(horse.sire),
        damName: resolveParentName(horse.dam),
      });
      await refresh();
    },
    [refresh, resolveParentName],
  );

  const removeHorse = useCallback(
    async (id: string) => {
      await repo.deleteHorse(id);
      await refresh();
    },
    [refresh],
  );

  const saveLog = useCallback(
    async (log: RaceLog) => {
      await repo.putLog(log);
      // 出走でG1勝利が増えるなど、馬側の派生値は詳細画面側で再計算するためrefreshのみ。
      await refresh();
    },
    [refresh],
  );

  const deleteLog = useCallback(
    async (id: string) => {
      await repo.deleteLog(id);
      await refresh();
    },
    [refresh],
  );

  const saveBet = useCallback(
    async (bet: Bet) => {
      await repo.putBet(bet);
      await refresh();
    },
    [refresh],
  );

  const deleteBet = useCallback(
    async (id: string) => {
      await repo.deleteBet(id);
      await refresh();
    },
    [refresh],
  );

  const upgradeToPro = useCallback(async (days: number) => {
    const now = Date.now();
    const meta = await repo.getUsage(now);
    const base = meta.proUntil && meta.proUntil > now ? meta.proUntil : now;
    const next: UsageMeta = { ...meta, proUntil: base + days * 86400000, lastCheckedAt: now };
    await repo.saveUsage(next);
    setUsage(next);
  }, []);

  const cancelPro = useCallback(async () => {
    const meta = await repo.getUsage();
    const next: UsageMeta = { ...meta, proUntil: null };
    await repo.saveUsage(next);
    setUsage(next);
  }, []);

  const value = useMemo<GameState>(
    () => ({
      loading,
      horses,
      usage,
      refresh,
      resolveParentName,
      addHorse,
      updateHorse,
      removeHorse,
      saveLog,
      deleteLog,
      saveBet,
      deleteBet,
      upgradeToPro,
      cancelPro,
    }),
    [
      loading,
      horses,
      usage,
      refresh,
      resolveParentName,
      addHorse,
      updateHorse,
      removeHorse,
      saveLog,
      deleteLog,
      saveBet,
      deleteBet,
      upgradeToPro,
      cancelPro,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGame(): GameState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}
