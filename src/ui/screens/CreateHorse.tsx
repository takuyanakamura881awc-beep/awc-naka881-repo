import { useState } from "react";
import { useGame } from "../../state/GameContext";
import { SIRES, DAMS } from "../../data/sires_dams";
import { toGrade } from "../../domain/grade";
import {
  DISTANCE_KEYS,
  DISTANCE_LABELS,
  SURFACE_LABELS,
  type DistanceKey,
  type SireDam,
} from "../../domain/types";
import type { View } from "../nav";

export function CreateHorse({ go }: { go: (v: View) => void }) {
  const { createHorse } = useGame();
  const [sireId, setSireId] = useState<string | null>(null);
  const [damId, setDamId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canCreate = sireId && damId && name.trim() && !busy;

  async function onCreate() {
    if (!sireId || !damId) return;
    setBusy(true);
    setError(null);
    const res = await createHorse(sireId, damId, name);
    setBusy(false);
    if (res.ok) {
      go("home");
    } else {
      setError(res.error ?? "作成に失敗しました");
    }
  }

  return (
    <div className="screen">
      <h2 className="screen-title">育成馬を作成</h2>

      <label className="field-label">馬名</label>
      <input
        className="text-input"
        value={name}
        maxLength={18}
        placeholder="例：ミラクルスター"
        onChange={(e) => setName(e.target.value)}
      />

      <h3 className="section-head">父馬を選ぶ</h3>
      <div className="parent-list">
        {SIRES.map((s) => (
          <ParentCard
            key={s.id}
            sd={s}
            selected={sireId === s.id}
            onClick={() => setSireId(s.id)}
          />
        ))}
      </div>

      <h3 className="section-head">母馬を選ぶ</h3>
      <div className="parent-list">
        {DAMS.map((d) => (
          <ParentCard
            key={d.id}
            sd={d}
            selected={damId === d.id}
            onClick={() => setDamId(d.id)}
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
  sd,
  selected,
  onClick,
}: {
  sd: SireDam;
  selected: boolean;
  onClick: () => void;
}) {
  const dist = DISTANCE_KEYS.reduce<DistanceKey>(
    (a, b) => (sd.aptitudes.distance[b] > sd.aptitudes.distance[a] ? b : a),
    DISTANCE_KEYS[0],
  );
  const surf = sd.aptitudes.surface.turf >= sd.aptitudes.surface.dirt ? "turf" : "dirt";
  return (
    <button className={`parent-card ${selected ? "selected" : ""}`} onClick={onClick}>
      <div className="pc-head">
        <span className="pc-name">{sd.name}</span>
        {selected && <span className="pc-check">✓</span>}
      </div>
      <div className="pc-tags">
        <span className="tag">{DISTANCE_LABELS[dist]} {toGrade(sd.aptitudes.distance[dist])}</span>
        <span className="tag">{SURFACE_LABELS[surf]} {toGrade(sd.aptitudes.surface[surf])}</span>
      </div>
      {sd.note && <div className="pc-note muted">{sd.note}</div>}
    </button>
  );
}
