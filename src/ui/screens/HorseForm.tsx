import { useState } from "react";
import { useGame, type HorseDraft } from "../../state/GameContext";
import { ChipGroup, NumberField, TextField } from "../controls";
import { DEFAULT_MAX_WEEKS } from "../../domain/lifecycle";
import { CPU_SIRES, CPU_DAMS } from "../../data/cpuHorses";
import {
  APTITUDE_KEYS,
  COAT_KEYS,
  DISTANCE_HINT,
  DISTANCE_KEYS,
  GROWTH_KEYS,
  INHERIT_KEYS,
  LEG_KEYS,
  SEX_KEYS,
  SOSHITSU_KEYS,
  STATUS_KEYS,
  TEMPER_KEYS,
  type Aptitude,
  type Coat,
  type Distance,
  type Growth,
  type Horse,
  type HorseStatus,
  type InheritType,
  type Leg,
  type ParentRef,
  type Sex,
  type Soshitsu,
  type Temper,
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

export function HorseForm({
  existing,
  initialSire,
  initialDam,
  go,
}: {
  existing?: Horse;
  initialSire?: ParentRef;
  initialDam?: ParentRef;
  go: (v: View) => void;
}) {
  const { addHorse, updateHorse, horses } = useGame();
  const editing = !!existing;

  const [name, setName] = useState(existing?.name ?? "");
  const [sex, setSex] = useState<Sex>(existing?.sex ?? "牡");
  const [generation, setGeneration] = useState<number | null>(existing?.generation ?? 1);
  const [sire, setSire] = useState<ParentRef>(existing?.sire ?? initialSire ?? { kind: "none" });
  const [dam, setDam] = useState<ParentRef>(existing?.dam ?? initialDam ?? { kind: "none" });
  const [inheritType, setInheritType] = useState<InheritType>(existing?.inheritType ?? "不明");
  const [soshitsu, setSoshitsu] = useState<Soshitsu>(existing?.soshitsu ?? "不明");
  const [leg, setLeg] = useState<Leg>(existing?.leg ?? "先行");
  const [growth, setGrowth] = useState<Growth>(existing?.growth ?? "普通");
  const [distance, setDistance] = useState<Distance>(existing?.distance ?? "中距離");
  const [dirtApt, setDirtApt] = useState<Aptitude>(existing?.dirtApt ?? "不明");
  const [mudApt, setMudApt] = useState<Aptitude>(existing?.mudApt ?? "不明");
  const [startApt, setStartApt] = useState<Aptitude>(existing?.startApt ?? "不明");
  const [temper, setTemper] = useState<Temper>(existing?.temper ?? "不明");
  const [coat, setCoat] = useState<Coat>(existing?.coat ?? "不明");
  const [birthComment, setBirthComment] = useState(existing?.birthComment ?? "");
  const [abilityNote, setAbilityNote] = useState(existing?.abilityNote ?? "");
  const [first, setFirst] = useState<number | null>(existing?.first ?? 0);
  const [second, setSecond] = useState<number | null>(existing?.second ?? 0);
  const [third, setThird] = useState<number | null>(existing?.third ?? 0);
  const [unplaced, setUnplaced] = useState<number | null>(existing?.unplaced ?? 0);
  const [g1Wins, setG1Wins] = useState<number | null>(existing?.g1Wins ?? 0);
  const [wbcWins, setWbcWins] = useState<number | null>(existing?.wbcWins ?? 0);
  const [prizeMedals, setPrizeMedals] = useState<number | null>(existing?.prizeMedals ?? 0);
  const [weeksLeft, setWeeksLeft] = useState<number | null>(existing?.weeksLeft ?? DEFAULT_MAX_WEEKS);
  const [maxWeeks, setMaxWeeks] = useState<number | null>(existing?.maxWeeks ?? DEFAULT_MAX_WEEKS);
  const [status, setStatus] = useState<HorseStatus>(existing?.status ?? "育成中");
  const [note, setNote] = useState(existing?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      growth,
      distance,
      dirtApt,
      mudApt,
      startApt,
      temper,
      coat,
      birthComment,
      abilityNote,
      first: first ?? 0,
      second: second ?? 0,
      third: third ?? 0,
      unplaced: unplaced ?? 0,
      g1Wins: g1Wins ?? 0,
      wbcWins: wbcWins ?? 0,
      prizeMedals: prizeMedals ?? 0,
      weeksLeft: weeksLeft ?? 0,
      maxWeeks: maxWeeks ?? DEFAULT_MAX_WEEKS,
      status,
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
        hint="H/H=ブレ大、平均=中庸、堅実=安定"
      />
      <NumberField label="代（世代）" value={generation} onChange={setGeneration} min={1} />

      <h3 className="section-head">能力・適性</h3>
      <ChipGroup label="素質" options={SOSHITSU_KEYS} value={soshitsu} onChange={(v) => setSoshitsu(v as Soshitsu)} hint="皐月賞オッズ等で判定（2.8≒MAX上）" />
      <ChipGroup label="脚質" options={LEG_KEYS} value={leg} onChange={(v) => setLeg(v as Leg)} />
      <ChipGroup label="成長" options={GROWTH_KEYS} value={growth} onChange={(v) => setGrowth(v as Growth)} />
      <ChipGroup
        label="距離適性"
        options={DISTANCE_KEYS}
        value={distance}
        onChange={(v) => setDistance(v as Distance)}
        hint={DISTANCE_HINT[distance] ? `${distance}：${DISTANCE_HINT[distance]}` : undefined}
      />
      <ChipGroup label="ダート" options={APTITUDE_KEYS} value={dirtApt} onChange={(v) => setDirtApt(v as Aptitude)} />
      <ChipGroup label="重馬場" options={APTITUDE_KEYS} value={mudApt} onChange={(v) => setMudApt(v as Aptitude)} hint="馬場が悪い状態を走る適性" />
      <ChipGroup label="スタート" options={APTITUDE_KEYS} value={startApt} onChange={(v) => setStartApt(v as Aptitude)} />
      <ChipGroup label="気性" options={TEMPER_KEYS} value={temper} onChange={(v) => setTemper(v as Temper)} />
      <ChipGroup label="毛色" options={COAT_KEYS} value={coat} onChange={(v) => setCoat(v as Coat)} />
      <TextField
        label="誕生/評価コメント（任意）"
        value={birthComment}
        onChange={setBirthComment}
        placeholder="例：この馬ならWBC三冠も狙えるかも"
        hint="素質を示唆するコメント"
      />
      <TextField label="表パラメモ（任意）" value={abilityNote} onChange={setAbilityNote} placeholder="SP/ST/パワー等、実機の数値を自由に" />

      <h3 className="section-head">通算成績</h3>
      <div className="four-col">
        <NumberField label="1着" value={first} onChange={setFirst} min={0} />
        <NumberField label="2着" value={second} onChange={setSecond} min={0} />
        <NumberField label="3着" value={third} onChange={setThird} min={0} />
        <NumberField label="着外" value={unplaced} onChange={setUnplaced} min={0} />
      </div>
      <div className="two-col">
        <NumberField label="GI勝" value={g1Wins} onChange={setG1Wins} min={0} hint="継承可否の判定に使用" />
        <NumberField label="WBC勝" value={wbcWins} onChange={setWbcWins} min={0} />
      </div>
      <NumberField label="獲得賞金（枚）" value={prizeMedals} onChange={setPrizeMedals} min={0} />

      <h3 className="section-head">状態・寿命</h3>
      <ChipGroup label="状態" options={STATUS_KEYS} value={status} onChange={(v) => setStatus(v as HorseStatus)} />
      <div className="two-col">
        <NumberField label="残り週" value={weeksLeft} onChange={setWeeksLeft} min={0} />
        <NumberField label="寿命(週)" value={maxWeeks} onChange={setMaxWeeks} min={1} />
      </div>
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
