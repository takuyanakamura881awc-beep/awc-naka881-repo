import { useGame } from "../../state/GameContext";
import { ratingScore } from "../../domain/suggestions";
import { isPro, stableLimit, suggestionsRemaining } from "../../domain/plan";
import { getSireDam } from "../../data/sires_dams";
import type { PlayerHorse } from "../../domain/types";
import type { View } from "../nav";

export function Home({ go }: { go: (v: View) => void }) {
  const { horses, usage } = useGame();
  const now = Date.now();
  const pro = usage ? isPro(usage, now) : false;
  const limit = usage ? stableLimit(usage, now) : 2;
  const remaining = usage ? suggestionsRemaining(usage, now) : 0;
  const atLimit = horses.length >= limit;

  return (
    <div className="screen">
      <div className="home-status">
        <div>
          <span className={`plan-badge ${pro ? "pro" : "free"}`}>
            {pro ? "PRO" : "無料"}
          </span>
          <span className="status-text">
            厩舎 {horses.length}/{limit}頭 ・ 提案 残{remaining === Infinity ? "∞" : remaining}
          </span>
        </div>
        <button className="link-btn" onClick={() => go("settings")}>
          設定
        </button>
      </div>

      {horses.length === 0 ? (
        <div className="empty">
          <p>まだ育成馬がいません。</p>
          <p className="muted">父・母を選んで、自分だけの一頭を作りましょう。</p>
        </div>
      ) : (
        <div className="horse-list">
          {horses.map((h) => (
            <HorseCard key={h.id} horse={h} onClick={() => go({ horse: h.id })} />
          ))}
        </div>
      )}

      <div className="fab-area">
        <button
          className="primary-btn"
          disabled={atLimit}
          onClick={() => go("create")}
        >
          ＋ 育成馬を作成
        </button>
        {atLimit && (
          <p className="limit-note">
            厩舎枠（{limit}頭）が上限です。
            <button className="link-btn" onClick={() => go("settings")}>
              アップグレード
            </button>
            で30頭まで。
          </p>
        )}
      </div>
    </div>
  );
}

function HorseCard({ horse, onClick }: { horse: PlayerHorse; onClick: () => void }) {
  const sire = getSireDam(horse.sireId);
  const dam = getSireDam(horse.damId);
  const progress = Math.round((horse.turn / horse.maxTurns) * 100);
  return (
    <button className="horse-card" onClick={onClick}>
      <div className="hc-head">
        <span className="hc-name">{horse.name}</span>
        <span className="hc-rating">総合 {ratingScore(horse)}</span>
      </div>
      <div className="hc-parents muted">
        {sire?.name ?? "?"} × {dam?.name ?? "?"}
      </div>
      <div className="hc-foot">
        {horse.retired ? (
          <span className="retired-badge">育成完了</span>
        ) : (
          <span className="muted">
            育成 {horse.turn}/{horse.maxTurns}ターン
          </span>
        )}
        <div className="mini-track">
          <div className="mini-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </button>
  );
}
