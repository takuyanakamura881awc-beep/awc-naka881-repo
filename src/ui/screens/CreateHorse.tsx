import { useEffect, useMemo, useState } from "react";
import { useGame } from "../../state/GameContext";
import { SIRES, DAMS } from "../../data/sires_dams";
import { toGrade } from "../../domain/grade";
import { breedingPotency, potencyStars, type ParentRef } from "../../domain/breeding";
import { listRaceEntriesByHorse } from "../../db/repo";
import {
  DISTANCE_KEYS,
  DISTANCE_LABELS,
  SURFACE_LABELS,
  type Aptitudes,
  type DistanceKey,
} from "../../domain/types";
import type { View } from "../nav";

interface Option {
  ref: ParentRef;
  key: string;
  name: string;
  aptitudes: Aptitudes;
  gen: number;
  note?: string;
  potency?: number; // 引退馬のみ
}

export function CreateHorse({ go }: { go: (v: View) => void }) {
  const { createHorse, horses } = useGame();
  const [sireRef, setSireRef] = useState<ParentRef | null>(null);
  const [damRef, setDamRef] = useState<ParentRef | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [potencies, setPotencies] = useState<Record<string, number>>({});

  const retired = useMemo(() => horses.filter((h) => h.retired), [horses]);

  // 引退馬の配合強化(potency)を成績から算出。
  useEffect(() => {
    (async () => {
      const map: Record<string, number> = {};
      for (const h of retired) {
        map[h.id] = breedingPotency(await listRaceEntriesByHorse(h.id));
      }
      setPotencies(map);
    })();
  }, [retired]);

  const sireOptions: Option[] = [
    ...SIRES.map((s) => ({
      ref: { kind: "master" as const, id: s.id },
      key: `m-${s.id}`,
      name: s.name,
      aptitudes: s.aptitudes,
      gen: 0,
      note: s.note,
    })),
    ...retired.map((h) => ({
      ref: { kind: "horse" as const, id: h.id },
      key: `h-${h.id}`,
      name: h.name,
      aptitudes: h.aptitudes,
      gen: h.generation,
      potency: potencies[h.id],
    })),
  ];
  const damOptions: Option[] = [
    ...DAMS.map((d) => ({
      ref: { kind: "master" as const, id: d.id },
      key: `m-${d.id}`,
      name: d.name,
      aptitudes: d.aptitudes,
      gen: 0,
      note: d.note,
    })),
    ...retired.map((h) => ({
      ref: { kind: "horse" as const, id: h.id },
      key: `h-${h.id}`,
      name: h.name,
      aptitudes: h.aptitudes,
      gen: h.generation,
      potency: potencies[h.id],
    })),
  ];

  const canCreate = sireRef && damRef && name.trim() && !busy;

  async function onCreate() {
    if (!sireRef || !damRef) return;
    setBusy(true);
    setError(null);
    const res = await createHorse(sireRef, damRef, name);
    setBusy(false);
    if (res.ok) go("home");
    else setError(res.error ?? "作成に失敗しました");
  }

  return (
    <div className="screen">
      <h2 className="screen-title">育成馬を作成</h2>
      {retired.length > 0 && (
        <p className="muted small">
          引退馬を父・母に選ぶと<strong>継承配合</strong>。成績が良い親ほど強い子に。
        </p>
      )}

      <label className="field-label">馬名</label>
      <input
        className="text-input"
        value={name}
        maxLength={18}
        placeholder="例：ミラクルスター"
        onChange={(e) => setName(e.target.value)}
      />

      <h3 className="section-head">父を選ぶ</h3>
      <div className="parent-list">
        {sireOptions.map((o) => (
          <ParentCard
            key={o.key}
            opt={o}
            selected={sireRef?.kind === o.ref.kind && sireRef?.id === o.ref.id}
            onClick={() => setSireRef(o.ref)}
          />
        ))}
      </div>

      <h3 className="section-head">母を選ぶ</h3>
      <div className="parent-list">
        {damOptions.map((o) => (
          <ParentCard
            key={o.key}
            opt={o}
            selected={damRef?.kind === o.ref.kind && damRef?.id === o.ref.id}
            onClick={() => setDamRef(o.ref)}
          />
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="sticky-actions">
        <button className="ghost-btn" onClick={() => go("home")}>
          戻る
        </button>
        <button className="primary-btn" disabled={!canCreate} onClick={onCreate}>
          この配合で作成
        </button>
      </div>
    </div>
  );
}

function ParentCard({
  opt,
  selected,
  onClick,
}: {
  opt: Option;
  selected: boolean;
  onClick: () => void;
}) {
  const dist = DISTANCE_KEYS.reduce<DistanceKey>(
    (a, b) => (opt.aptitudes.distance[b] > opt.aptitudes.distance[a] ? b : a),
    DISTANCE_KEYS[0],
  );
  const surf =
    opt.aptitudes.surface.turf >= opt.aptitudes.surface.dirt ? "turf" : "dirt";
  const isHorse = opt.ref.kind === "horse";
  return (
    <button className={`parent-card ${selected ? "selected" : ""}`} onClick={onClick}>
      <div className="pc-head">
        <span className="pc-name">
          {isHorse && <span className="gen-badge">継承 G{opt.gen}</span>}
          {opt.name}
        </span>
        {selected && <span className="pc-check">✓</span>}
      </div>
      <div className="pc-tags">
        <span className="tag">
          {DISTANCE_LABELS[dist]} {toGrade(opt.aptitudes.distance[dist])}
        </span>
        <span className="tag">
          {SURFACE_LABELS[surf]} {toGrade(opt.aptitudes.surface[surf])}
        </span>
        {isHorse && opt.potency != null && (
          <span className="tag potency">{potencyStars(opt.potency)}</span>
        )}
      </div>
      {opt.note && <div className="pc-note muted">{opt.note}</div>}
    </button>
  );
}
