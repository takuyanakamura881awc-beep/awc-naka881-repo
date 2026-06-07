import { toGrade } from "../domain/grade";
import {
  DISTANCE_KEYS,
  DISTANCE_LABELS,
  STAT_KEYS,
  STAT_LABELS,
  STAT_MAX,
  STYLE_KEYS,
  STYLE_LABELS,
  SURFACE_KEYS,
  SURFACE_LABELS,
  type PlayerHorse,
} from "../domain/types";

export function StatBars({ horse }: { horse: PlayerHorse }) {
  return (
    <div className="stat-bars">
      {STAT_KEYS.map((k) => {
        const cur = horse.stats[k];
        const pot = horse.potential[k];
        return (
          <div className="stat-row" key={k}>
            <span className="stat-label">{STAT_LABELS[k]}</span>
            <div className="stat-track">
              <div
                className="stat-potential"
                style={{ width: `${(pot / STAT_MAX) * 100}%` }}
              />
              <div
                className="stat-current"
                style={{ width: `${(cur / STAT_MAX) * 100}%` }}
              />
            </div>
            <span className="stat-num">
              {cur}
              <span className="stat-pot-num">/{pot}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function AptitudeGrades({ horse }: { horse: PlayerHorse }) {
  const a = horse.aptitudes;
  return (
    <div className="apt-grid">
      <AptGroup title="距離">
        {DISTANCE_KEYS.map((k) => (
          <GradeChip key={k} label={DISTANCE_LABELS[k]} value={a.distance[k]} />
        ))}
      </AptGroup>
      <AptGroup title="馬場">
        {SURFACE_KEYS.map((k) => (
          <GradeChip key={k} label={SURFACE_LABELS[k]} value={a.surface[k]} />
        ))}
      </AptGroup>
      <AptGroup title="脚質">
        {STYLE_KEYS.map((k) => (
          <GradeChip key={k} label={STYLE_LABELS[k]} value={a.style[k]} />
        ))}
      </AptGroup>
    </div>
  );
}

function AptGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="apt-group">
      <div className="apt-title">{title}</div>
      <div className="apt-chips">{children}</div>
    </div>
  );
}

function GradeChip({ label, value }: { label: string; value: number }) {
  const g = toGrade(value);
  return (
    <span className={`grade-chip grade-${g}`}>
      {label}
      <strong>{g}</strong>
    </span>
  );
}
