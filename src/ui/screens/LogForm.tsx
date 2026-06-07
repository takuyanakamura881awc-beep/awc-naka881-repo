import { useState } from "react";
import { useGame } from "../../state/GameContext";
import { ChipGroup, NumberField, TextField } from "../controls";
import { newId } from "../../domain/ids";
import { SCHEMA_VERSION } from "../../db/schema";
import { RACES, getRace } from "../../data/races";
import {
  CONDITION_KEYS,
  DISTANCE_KEYS,
  GRADE_KEYS,
  SURFACE_KEYS,
  type Distance,
  type Grade,
  type RaceLog,
  type Surface,
  type TrackCondition,
} from "../../domain/types";
import type { View } from "../nav";

export function LogForm({
  horseId,
  existing,
  go,
}: {
  horseId: string;
  existing?: RaceLog;
  go: (v: View) => void;
}) {
  const { saveLog } = useGame();
  const editing = !!existing;

  const [raceId, setRaceId] = useState<string>(existing?.raceId ?? RACES[0].id);
  const [raceName, setRaceName] = useState(existing?.raceName ?? "");
  const [grade, setGrade] = useState<Grade>(existing?.grade ?? "G1");
  const [distance, setDistance] = useState<Distance>(existing?.distance ?? "中距離");
  const [surface, setSurface] = useState<Surface>(existing?.surface ?? "芝");
  const [logStatus, setLogStatus] = useState<"予定" | "完了">(existing?.status ?? "完了");
  const [position, setPosition] = useState<number | null>(existing?.position ?? null);
  const [fieldSize, setFieldSize] = useState<number | null>(existing?.fieldSize ?? null);
  const [odds, setOdds] = useState<number | null>(existing?.odds ?? null);
  const [popularity, setPopularity] = useState<number | null>(existing?.popularity ?? null);
  const [prize, setPrize] = useState<number | null>(existing?.prize ?? null);
  const [condition, setCondition] = useState<TrackCondition>(existing?.condition ?? "良");
  const [atWeek, setAtWeek] = useState<number | null>(existing?.atWeek ?? null);
  const [note, setNote] = useState(existing?.note ?? "");
  const [busy, setBusy] = useState(false);

  const isOther = raceId === "__other__";

  function onSelectRace(id: string) {
    setRaceId(id);
    const def = getRace(id);
    if (def) {
      setGrade(def.grade);
      setDistance(def.distanceKey);
      setSurface(def.surface);
    }
  }

  const resolvedName = isOther ? raceName : getRace(raceId)?.name ?? raceName;

  async function onSave() {
    if (!resolvedName.trim()) return;
    setBusy(true);
    const log: RaceLog = {
      id: existing?.id ?? newId(),
      schema_version: SCHEMA_VERSION,
      horseId,
      raceId: isOther ? null : raceId,
      raceName: resolvedName,
      grade,
      distance,
      surface,
      status: logStatus,
      position: logStatus === "完了" ? position : null,
      fieldSize: logStatus === "完了" ? fieldSize : null,
      odds: logStatus === "完了" ? odds : null,
      popularity: logStatus === "完了" ? popularity : null,
      prize: logStatus === "完了" ? prize : null,
      condition: logStatus === "完了" ? condition : null,
      atWeek,
      note,
      at: existing?.at ?? Date.now(),
    };
    await saveLog(log);
    setBusy(false);
    go({ horse: horseId });
  }

  return (
    <div className="screen">
      <h2 className="screen-title">{editing ? "出走を編集" : "出走を記録"}</h2>

      <div className="field">
        <label className="field-label">レース</label>
        <select className="text-input" value={raceId} onChange={(e) => onSelectRace(e.target.value)}>
          {RACES.map((r) => (
            <option key={r.id} value={r.id}>
              [{r.grade}] {r.name}
            </option>
          ))}
          <option value="__other__">その他（自由入力）</option>
        </select>
      </div>

      {isOther && (
        <>
          <TextField label="レース名" value={raceName} onChange={setRaceName} placeholder="レース名" />
          <ChipGroup label="グレード" options={GRADE_KEYS} value={grade} onChange={(v) => setGrade(v as Grade)} />
          <ChipGroup label="距離" options={DISTANCE_KEYS} value={distance} onChange={(v) => setDistance(v as Distance)} />
          <ChipGroup label="馬場" options={SURFACE_KEYS} value={surface} onChange={(v) => setSurface(v as Surface)} />
        </>
      )}

      <ChipGroup
        label="種別"
        options={["予定", "完了"]}
        value={logStatus}
        onChange={(v) => setLogStatus(v as "予定" | "完了")}
        hint="予定＝ローテ計画、完了＝結果を記録"
      />

      {logStatus === "完了" && (
        <>
          <div className="two-col">
            <NumberField label="着順" value={position} onChange={setPosition} min={1} />
            <NumberField label="頭数" value={fieldSize} onChange={setFieldSize} min={1} />
          </div>
          <div className="two-col">
            <NumberField label="オッズ" value={odds} onChange={setOdds} min={1} />
            <NumberField label="人気" value={popularity} onChange={setPopularity} min={1} />
          </div>
          <NumberField label="獲得メダル" value={prize} onChange={setPrize} min={0} />
          <ChipGroup label="馬場状態" options={CONDITION_KEYS} value={condition} onChange={(v) => setCondition(v as TrackCondition)} />
        </>
      )}

      <NumberField label="その時の残り週（任意）" value={atWeek} onChange={setAtWeek} min={0} />
      <TextField label="メモ（任意）" value={note} onChange={setNote} />

      <div className="sticky-actions">
        <button className="ghost-btn" onClick={() => go({ horse: horseId })}>
          戻る
        </button>
        <button className="primary-btn" disabled={busy || !resolvedName.trim()} onClick={onSave}>
          保存
        </button>
      </div>
    </div>
  );
}
