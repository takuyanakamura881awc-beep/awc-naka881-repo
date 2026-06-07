import { useCallback, useEffect, useState } from "react";
import { useGame } from "../../state/GameContext";
import { listRaceEntriesByHorse, listTrainingByHorse } from "../../db/repo";
import { StatBars, AptitudeGrades } from "../HorseStats";
import { SuggestionPanel } from "../SuggestionPanel";
import { isTrainable } from "../../domain/training";
import { bestStyle } from "../../domain/raceSim";
import { ratingScore } from "../../domain/suggestions";
import { RACES, getRace } from "../../data/races";
import {
  STAT_LABELS,
  STYLE_LABELS,
  type RaceDef,
  type RaceEntry,
  type RaceResult,
  type TrainingAction,
  type TrainingLogEntry,
} from "../../domain/types";
import type { View } from "../nav";

const TRAIN_ACTIONS: { action: TrainingAction; label: string }[] = [
  { action: "speed", label: STAT_LABELS.speed },
  { action: "stamina", label: STAT_LABELS.stamina },
  { action: "power", label: STAT_LABELS.power },
  { action: "guts", label: STAT_LABELS.guts },
  { action: "wit", label: STAT_LABELS.wit },
  { action: "rest", label: "休養" },
];

export function HorseDetail({ id, go }: { id: string; go: (v: View) => void }) {
  const { horses, train, runRace, removeHorse } = useGame();
  const horse = horses.find((h) => h.id === id);
  const [logs, setLogs] = useState<TrainingLogEntry[]>([]);
  const [entries, setEntries] = useState<RaceEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<
    { race: RaceDef; result: RaceResult; style: string } | null
  >(null);

  const loadHistory = useCallback(async () => {
    setLogs(await listTrainingByHorse(id));
    setEntries(await listRaceEntriesByHorse(id));
  }, [id]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory, horse?.turn]);

  if (!horse) {
    return (
      <div className="screen">
        <p>馬が見つかりません。</p>
        <button className="ghost-btn" onClick={() => go("home")}>
          厩舎へ戻る
        </button>
      </div>
    );
  }

  const trainable = isTrainable(horse);

  async function onTrain(action: TrainingAction) {
    if (busy || !horse) return;
    setBusy(true);
    await train(horse.id, action);
    await loadHistory();
    setBusy(false);
  }

  async function onRace(race: RaceDef) {
    if (busy || !horse) return;
    setBusy(true);
    const res = await runRace(horse.id, race.id);
    if (res.ok && res.result) {
      setLastResult({ race, result: res.result, style: STYLE_LABELS[bestStyle(horse)] });
    }
    await loadHistory();
    setBusy(false);
  }

  async function onDelete() {
    if (!horse) return;
    if (!confirm(`「${horse.name}」を削除しますか？この操作は取り消せません。`)) return;
    await removeHorse(horse.id);
    go("home");
  }

  return (
    <div className="screen">
      <button className="link-btn back" onClick={() => go("home")}>
        ‹ 厩舎
      </button>

      <div className="detail-head">
        <h2 className="screen-title">{horse.name}</h2>
        <span className="hc-rating">総合 {ratingScore(horse)}</span>
      </div>
      <p className="muted">
        {horse.sireName} × {horse.damName} ・ 第{horse.generation}世代
      </p>

      <div className="condition-row">
        <span>育成 {horse.turn}/{horse.maxTurns}ターン</span>
        <span>コンディション {horse.energy}</span>
        {horse.retired && <span className="retired-badge">育成完了</span>}
      </div>

      {horse.retired && (
        <p className="stud-hint muted small">
          🐴 この馬は引退済み。育成馬を作成するとき、父または母として
          <strong>継承配合</strong>に使えます（成績が良いほど強い子が生まれます）。
        </p>
      )}

      <section className="panel">
        <h3 className="section-head">能力</h3>
        <StatBars horse={horse} />
      </section>

      <section className="panel">
        <h3 className="section-head">適性</h3>
        <AptitudeGrades horse={horse} />
      </section>

      <section className="panel">
        <h3 className="section-head">育成（ターン制）</h3>
        {trainable ? (
          <div className="train-grid">
            {TRAIN_ACTIONS.map((t) => (
              <button
                key={t.action}
                className="train-btn"
                disabled={busy}
                onClick={() => onTrain(t.action)}
              >
                {t.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="muted">育成期間が終了しました。レースで実力を試しましょう。</p>
        )}
        {logs.length > 0 && (
          <details className="history">
            <summary>育成ログ（{logs.length}）</summary>
            <ul className="log-list">
              {logs
                .slice()
                .reverse()
                .map((l) => (
                  <li key={l.id}>
                    <span className="log-turn">T{l.turn + 1}</span>
                    <span>{l.action === "rest" ? "休養" : STAT_LABELS[l.action]}</span>
                    <span className="muted">
                      {Object.entries(l.delta)
                        .map(([k, v]) => `${STAT_LABELS[k as keyof typeof STAT_LABELS]}+${v}`)
                        .join(" / ")}
                    </span>
                  </li>
                ))}
            </ul>
          </details>
        )}
      </section>

      <SuggestionPanel horse={horse} onPickRace={onRace} />

      <section className="panel">
        <h3 className="section-head">出走</h3>
        {lastResult && (
          <div className={`race-result ${lastResult.result.position === 1 ? "win" : ""}`}>
            <div className="rr-head">
              {lastResult.race.name}（{lastResult.style}）
            </div>
            <div className="rr-pos">
              {lastResult.result.position}
              <span className="rr-of">/{lastResult.result.fieldSize}着</span>
            </div>
            <div className="muted">
              タイム {lastResult.result.timeSeconds}s ・ 賞金 {lastResult.result.prize}万円
            </div>
          </div>
        )}
        <div className="race-list">
          {RACES.map((r) => (
            <div className="race-row" key={r.id}>
              <div className="race-info">
                <span className={`grade grade-${r.grade}`}>{r.grade}</span>
                <span className="race-name">{r.name}</span>
                <span className="muted small">
                  {r.surface === "turf" ? "芝" : "ダート"}
                  {r.distance}m
                </span>
              </div>
              <button className="race-btn" disabled={busy} onClick={() => onRace(r)}>
                出走
              </button>
            </div>
          ))}
        </div>
        {entries.length > 0 && (
          <details className="history">
            <summary>出走履歴（{entries.length}）</summary>
            <ul className="log-list">
              {entries.map((e) => {
                const race = getRace(e.raceId);
                return (
                  <li key={e.id}>
                    <span className="log-turn">{e.result.position}着</span>
                    <span>{race?.name ?? e.raceId}</span>
                    <span className="muted">{e.result.prize}万円</span>
                  </li>
                );
              })}
            </ul>
          </details>
        )}
      </section>

      <section className="panel danger">
        <button className="danger-btn" onClick={onDelete}>
          この馬を削除
        </button>
      </section>
    </div>
  );
}
