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
import { hashSeed } from "../domain/rng";
import {
  breed,
  horseGenes,
  sireDamGenes,
  type ParentGenes,
} from "../domain/genetics";
import { breedingPotency, type ParentRef } from "../domain/breeding";
import { applyTraining, DEFAULT_MAX_TURNS, isTrainable } from "../domain/training";
import { bestStyle, simulateRace } from "../domain/raceSim";
import { canCreateHorse, consumeSuggestion, stableLimit } from "../domain/plan";
import { SCHEMA_VERSION } from "../db/schema";
import { getSireDam } from "../data/sires_dams";
import { getRace } from "../data/races";
import type {
  PlayerHorse,
  RaceEntry,
  RaceResult,
  StyleKey,
  TrainingAction,
  UsageMeta,
} from "../domain/types";

interface ActionResult {
  ok: boolean;
  error?: string;
}

interface GameState {
  loading: boolean;
  horses: PlayerHorse[];
  usage: UsageMeta | null;
  refresh: () => Promise<void>;
  createHorse: (
    sire: ParentRef,
    dam: ParentRef,
    name: string,
  ) => Promise<ActionResult>;
  train: (horseId: string, action: TrainingAction) => Promise<ActionResult>;
  runRace: (
    horseId: string,
    raceId: string,
    style?: StyleKey,
  ) => Promise<{ ok: boolean; error?: string; result?: RaceResult }>;
  removeHorse: (id: string) => Promise<void>;
  useSuggestionCredit: () => Promise<{ allowed: boolean }>;
  upgradeToPro: (days: number) => Promise<void>;
  cancelPro: () => Promise<void>;
}

const Ctx = createContext<GameState | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [horses, setHorses] = useState<PlayerHorse[]>([]);
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

  const resolveParent = useCallback(
    async (ref: ParentRef): Promise<ParentGenes | null> => {
      if (ref.kind === "master") {
        const sd = getSireDam(ref.id);
        return sd ? sireDamGenes(sd) : null;
      }
      const horse = await repo.getHorse(ref.id);
      if (!horse || !horse.retired) return null;
      const entries = await repo.listRaceEntriesByHorse(ref.id);
      return horseGenes(horse, breedingPotency(entries));
    },
    [],
  );

  const parentName = useCallback(async (ref: ParentRef): Promise<string> => {
    if (ref.kind === "master") return getSireDam(ref.id)?.name ?? "?";
    return (await repo.getHorse(ref.id))?.name ?? "?";
  }, []);

  const createHorse = useCallback(
    async (sire: ParentRef, dam: ParentRef, name: string): Promise<ActionResult> => {
      if (sire.kind === "horse" && dam.kind === "horse" && sire.id === dam.id) {
        return { ok: false, error: "同じ馬を父母には指定できません" };
      }
      const sireGenes = await resolveParent(sire);
      const damGenes = await resolveParent(dam);
      if (!sireGenes) return { ok: false, error: "父馬を選択してください" };
      if (!damGenes) return { ok: false, error: "母馬を選択してください" };
      const trimmed = name.trim();
      if (!trimmed) return { ok: false, error: "馬名を入力してください" };

      const now = Date.now();
      const meta = await repo.getUsage(now);
      const count = await repo.countHorses();
      if (!canCreateHorse(meta, count, now)) {
        return {
          ok: false,
          error: `無料プランの厩舎枠（${stableLimit(meta, now)}頭）が上限です。アップグレードで30頭まで管理できます。`,
        };
      }

      const id = newId();
      const bred = breed(sireGenes, damGenes, `${id}:${sire.id}:${dam.id}`);
      const horse: PlayerHorse = {
        id,
        schema_version: SCHEMA_VERSION,
        name: trimmed,
        sireId: sire.id,
        damId: dam.id,
        sireName: await parentName(sire),
        damName: await parentName(dam),
        generation: bred.generation,
        stats: bred.stats,
        potential: bred.potential,
        aptitudes: bred.aptitudes,
        temperament: bred.temperament,
        energy: 100,
        turn: 0,
        maxTurns: DEFAULT_MAX_TURNS,
        createdAt: now,
        retired: false,
      };
      await repo.putHorse(horse);
      await refresh();
      return { ok: true };
    },
    [refresh, resolveParent, parentName],
  );

  const train = useCallback(
    async (horseId: string, action: TrainingAction): Promise<ActionResult> => {
      const horse = await repo.getHorse(horseId);
      if (!horse) return { ok: false, error: "馬が見つかりません" };
      if (!isTrainable(horse)) return { ok: false, error: "育成期間が終了しています" };

      const outcome = applyTraining(horse, action);
      await repo.putHorse(outcome.horse);
      await repo.addTrainingLog({
        id: newId(),
        schema_version: SCHEMA_VERSION,
        horseId,
        turn: horse.turn,
        action,
        delta: outcome.delta,
        energyAfter: outcome.energyAfter,
        at: Date.now(),
      });
      await refresh();
      return { ok: true };
    },
    [refresh],
  );

  const runRace = useCallback(
    async (horseId: string, raceId: string, style?: StyleKey) => {
      const horse = await repo.getHorse(horseId);
      if (!horse) return { ok: false, error: "馬が見つかりません" };
      const race = getRace(raceId);
      if (!race) return { ok: false, error: "レースが見つかりません" };

      const chosenStyle = style ?? bestStyle(horse);
      const seed = hashSeed(`${horseId}:${raceId}:${Date.now()}`);
      const result = simulateRace(horse, race, chosenStyle, seed);
      const entry: RaceEntry = {
        id: newId(),
        schema_version: SCHEMA_VERSION,
        horseId,
        raceId,
        style: chosenStyle,
        seed,
        result,
        at: Date.now(),
      };
      await repo.addRaceEntry(entry);
      await refresh();
      return { ok: true, result };
    },
    [refresh],
  );

  const removeHorse = useCallback(
    async (id: string) => {
      await repo.deleteHorse(id);
      await refresh();
    },
    [refresh],
  );

  const useSuggestionCredit = useCallback(async () => {
    const now = Date.now();
    const meta = await repo.getUsage(now);
    const res = consumeSuggestion(meta, now);
    if (res.meta !== meta) {
      await repo.saveUsage(res.meta);
      setUsage(res.meta);
    }
    return { allowed: res.allowed };
  }, []);

  const upgradeToPro = useCallback(async (days: number) => {
    const now = Date.now();
    const meta = await repo.getUsage(now);
    const base = meta.proUntil && meta.proUntil > now ? meta.proUntil : now;
    const next: UsageMeta = {
      ...meta,
      proUntil: base + days * 24 * 60 * 60 * 1000,
      lastCheckedAt: now,
    };
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
      createHorse,
      train,
      runRace,
      removeHorse,
      useSuggestionCredit,
      upgradeToPro,
      cancelPro,
    }),
    [
      loading,
      horses,
      usage,
      refresh,
      createHorse,
      train,
      runRace,
      removeHorse,
      useSuggestionCredit,
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
