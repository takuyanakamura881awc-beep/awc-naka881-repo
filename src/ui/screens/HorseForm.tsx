import { useState } from "react";
import { useGame, type HorseDraft } from "../../state/GameContext";
import { ChipGroup, NumberField, TextField } from "../controls";
import { DEFAULT_MAX_WEEKS } from "../../domain/lifecycle";
import { CPU_SIRES, CPU_DAMS } from "../../data/cpuHorses";
import {
  DISTANCE_KEYS,
  INHERIT_KEYS,
  LEG_KEYS,
  SEX_KEYS,
  SOSHITSU_KEYS,
  STATUS_KEYS,
  SURFACE_KEYS,
  TEMPER_KEYS,
  type Distance,
  type Horse,
  type InheritType,
  type Leg,
  type ParentRef,
  type Sex,
  type Soshitsu,
  type Surface,
  type Temper,
  type HorseStatus,
} from "../../domain/types";
import type { View } from "../nav";

function refToValue(ref: ParentRef): string {
  if (ref.kind === "none") return "none";
  return `${ref.kind}:${ref.id}`;
}
function valueToRef(v: string): ParentRef {
  if (v === "none") return { kind: "none" };
  const [kind, id] = v.split(":");
  return { kind: kind as "cpu" | "owned", id };
}

export function HorseForm({ existing, go }: { existing?: Horse; go: (v: View) => void }) {
  const { addHorse, updateHorse, horses } = useGame();
  const editing = !!existing;

  const [name, setName] = useState(existing?.name ?? "");
  const [sex, setSex] = useState<Sex>(existing?.sex ?? "牡");
  const [generation, setGeneration] = useState<number | null>(existing?.generation ?? 1);
  const [sire, setSire] = useState<ParentRef>(existing?.sire ?? { kind: "none" });
  const [dam, setDam] = useState<ParentRef>(existing?.dam ?? { kind: "none" });
  const [inheritType, setInheritType] = useState<InheritType>(existing?.inheritType ?? "不明");
  const [soshitsu, setSoshitsu] = useState<Soshitsu>(existing?.soshitsu ?? "不明");
  const [leg, setLeg] = useState<Leg>(existing?.leg ?? "先行");
  const [distance, setDistance] = useState<Distance>(existing?.distance ?? "中距離");
  const [surface, setSurface] = useState<Surface>(existing?.surface ?? "芝");
  const [temper, setTemper] = useState<Temper>(existing?.temper ?? "不明");
  const [abilityNote, setAbilityNote] = useState(existing?.abilityNote ?? "");
  const [weeksLeft, setWeeksLeft] = useState<number | null>(existing?.weeksLeft ?? DEFAULT_MAX_WEEKS);
  const [maxWeeks, setMaxWeeks] = useState<number | null>(existing?.maxWeeks ?? DEFAULT_MAX_WEEKS);
  const [status, setStatus] = useState<HorseStatus>(existing?.status ?? "育成中");
  const [g1Wins, setG1Wins] = useState<number | null>(existing?.g1Wins ?? 0);
  const [note, setNote] = useState(existing?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 所有馬（自分自身は親候補から除外）。
  const ownedParents = horses.filter((h) => h.id !== existing?.id);

  async function onSave() {
    setBusy(true);
    setError(null);
    const draft: HorseDraft = {
      name,
      sex,
      generation: generation ?? 1,
      sire,
      dam,
      inheritType,
      soshitsu,
      leg,
      distance,
      surface,
      temper,
      abilityNote,
      weeksLeft: weeksLeft ?? 0,
      maxWeeks: maxWeeks ?? DEFAULT_MAX_WEEKS,
      status,
      g1Wins: g1Wins ?? 0,
      note,
    };
    if (editing && existing) {
      await updateHorse({ ...existing, ...draft });
      setBusy(false);
      go({ horse: existing.id });
      return;
    }
    const res = await addHorse(draft);
    setBusy(false);
    if (res.ok) go("home");
    else setError(res.error ?? "保存に失敗しました");
  }

  return (
    <div className="screen">
      <h2 className="screen-title">{editing ? "カルテを編集" : "馬を登録"}</h2>

      <TextField label="馬名" value={name} onChange={setName} maxLength={18} placeholder="例：ミラクルスター" />
      <ChipGroup label="性別" options={SEX_KEYS} value={sex} onChange={(v) => setSex(v as Sex)} />

      <h3 className="section-head">血統（配合）</h3>
      <ParentPicker
        label="父"
        cpu={CPU_SIRES}
        owned={ownedParents.map((h) => ({ id: h.id, name: h.name }))}
        value={sire}
        onChange={setSire}
      />
      <ParentPicker
        label="母"
        cpu={CPU_DAMS}
        owned={ownedParents.map((h) => ({ id: h.id, name: h.name }))}
        value={dam}
        onChange={setDam}
      />
      <ChipGroup
        label="継承型"
        options={INHERIT_KEYS}
        value={inheritType}
        onChange={(v) => setInheritType(v as InheritType)}
        hint="H/H=ハイリスク、堅実=安定、平均=中庸"
      />
      <NumberField label="代（世代）" value={generation} onChange={setGeneration} min={1} />

      <h3 className="section-head">能力・適性</h3>
      <ChipGroup label="素質" options={SOSHITSU_KEYS} value={soshitsu} onChange={(v) => setSoshitsu(v as Soshitsu)} hint="皐月賞オッズ等で判定（2.8≒MAX上）" />
      <ChipGroup label="脚質" options={LEG_KEYS} value={leg} onChange={(v) => setLeg(v as Leg)} />
      <ChipGroup label="距離適性" options={DISTANCE_KEYS} value={distance} onChange={(v) => setDistance(v as Distance)} />
      <ChipGroup label="馬場適性" options={SURFACE_KEYS} value={surface} onChange={(v) => setSurface(v as Surface)} />
      <ChipGroup label="気性" options={TEMPER_KEYS} value={temper} onChange={(v) => setTemper(v as Temper)} />
      <TextField label="表パラメモ（任意）" value={abilityNote} onChange={setAbilityNote} placeholder="SP/ST/パワー等、実機の数値を自由に" />

      <h3 className="section-head">状態・寿命</h3>
      <ChipGroup label="状態" options={STATUS_KEYS} value={status} onChange={(v) => setStatus(v as HorseStatus)} />
      <div className="two-col">
        <NumberField label="残り週" value={weeksLeft} onChange={setWeeksLeft} min={0} />
        <NumberField label="寿命(週)" value={maxWeeks} onChange={setMaxWeeks} min={1} />
      </div>
      <NumberField label="G1勝利数" value={g1Wins} onChange={setG1Wins} min={0} hint="継承可否の判定に使用" />
      <TextField label="メモ（任意）" value={note} onChange={setNote} placeholder="配合方針・狙うレース等" />

      {error && <p className="error-text">{error}</p>}

      <div className="sticky-actions">
        <button className="ghost-btn" onClick={() => go(editing && existing ? { horse: existing.id } : "home")}>
          戻る
        </button>
        <button className="primary-btn" disabled={busy || !name.trim()} onClick={onSave}>
          {editing ? "更新" : "登録"}
        </button>
      </div>
    </div>
  );
}

function ParentPicker({
  label,
  cpu,
  owned,
  value,
  onChange,
}: {
  label: string;
  cpu: { id: string; name: string }[];
  owned: { id: string; name: string }[];
  value: ParentRef;
  onChange: (r: ParentRef) => void;
}) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <select className="text-input" value={refToValue(value)} onChange={(e) => onChange(valueToRef(e.target.value))}>
        <option value="none">未設定</option>
        <optgroup label="CPU名馬">
          {cpu.map((c) => (
            <option key={c.id} value={`cpu:${c.id}`}>
              {c.name}
            </option>
          ))}
        </optgroup>
        {owned.length > 0 && (
          <optgroup label="所有馬（継承）">
            {owned.map((o) => (
              <option key={o.id} value={`owned:${o.id}`}>
                {o.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  );
}
