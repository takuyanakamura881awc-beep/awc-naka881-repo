import { useState } from "react";
import { useGame } from "../state/GameContext";
import { suggestRaces, suggestTraining } from "../domain/suggestions";
import { suggestionsRemaining } from "../domain/plan";
import { STAT_LABELS, type PlayerHorse, type RaceDef } from "../domain/types";
import { RACES } from "../data/races";
import type { RaceSuggestion, TrainingSuggestion } from "../domain/suggestions";

export function SuggestionPanel({
  horse,
  onPickRace,
}: {
  horse: PlayerHorse;
  onPickRace: (race: RaceDef) => void;
}) {
  const { usage, useSuggestionCredit } = useGame();
  const [content, setContent] = useState<{
    training: TrainingSuggestion;
    races: RaceSuggestion[];
  } | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);

  const remaining = usage ? suggestionsRemaining(usage, Date.now()) : 0;

  async function onShow() {
    setBusy(true);
    const { allowed } = await useSuggestionCredit();
    if (allowed) {
      setContent({
        training: suggestTraining(horse),
        races: suggestRaces(horse, RACES),
      });
      setBlocked(false);
    } else {
      setBlocked(true);
    }
    setBusy(false);
  }

  return (
    <section className="panel suggest">
      <h3 className="section-head">
        提案 <span className="muted small">残{remaining === Infinity ? "∞" : remaining}</span>
      </h3>

      {!content && !blocked && (
        <button className="primary-btn" disabled={busy} onClick={onShow}>
          育成方針・次走レースの提案を見る
        </button>
      )}

      {blocked && (
        <div className="upsell">
          <p>今週の無料提案（2回）を使い切りました。</p>
          <p className="muted">PROにアップグレードすると提案が無制限になります。</p>
        </div>
      )}

      {content && (
        <div className="suggest-content">
          <div className="suggest-block">
            <div className="suggest-label">育成方針</div>
            <p>
              <strong>
                {content.training.action === "rest"
                  ? "休養"
                  : STAT_LABELS[content.training.action]}
              </strong>{" "}
              を優先
            </p>
            <p className="muted small">{content.training.reason}</p>
          </div>

          <div className="suggest-block">
            <div className="suggest-label">おすすめレース</div>
            {content.races.length === 0 ? (
              <p className="muted small">
                今は勝負になるレースが見当たりません。育成を進めましょう。
              </p>
            ) : (
              <ul className="suggest-races">
                {content.races.map((s) => (
                  <li key={s.race.id}>
                    <div>
                      <span className={`grade grade-${s.race.grade}`}>{s.race.grade}</span>
                      <span className="race-name">{s.race.name}</span>
                      <span className="note-chip">{s.note}</span>
                    </div>
                    <button className="race-btn" onClick={() => onPickRace(s.race)}>
                      出走
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
