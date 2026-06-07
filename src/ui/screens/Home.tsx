import { useGame } from "../../state/GameContext";
import { horseLimit, isPro } from "../../domain/plan";
import { horseAlerts } from "../../domain/lifecycle";
import type { Horse } from "../../domain/types";
import type { View } from "../nav";

export function Home({ go }: { go: (v: View) => void }) {
  const { horses, usage } = useGame();
  const now = Date.now();
  const pro = usage ? isPro(usage, now) : false;
  const limit = usage ? horseLimit(usage, now) : 2;
  const atLimit = horses.length >= limit;

  const active = horses.filter((h) => h.status === "育成中");
  const others = horses.filter((h) => h.status !== "育成中");

  return (
    <div className="screen">
      <div className="home-status">
        <div>
          <span className={`plan-badge ${pro ? "pro" : "free"}`}>{pro ? "PRO" : "無料"}</span>
          <span className="status-text">管理 {horses.length}/{limit}頭</span>
        </div>
        <button className="link-btn" onClick={() => go("settings")}>
          設定
        </button>
      </div>

      {horses.length === 0 ? (
        <div className="empty">
          <p>まだ登録した馬がいません。</p>
          <p className="muted">実機で育てている馬のカルテを作りましょう。</p>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div className="horse-list">
              {active.map((h) => (
                <HorseCard key={h.id} horse={h} onClick={() => go({ horse: h.id })} />
              ))}
            </div>
          )}
          {others.length > 0 && (
            <>
              <h3 className="section-head">引退・殿堂</h3>
              <div className="horse-list">
                {others.map((h) => (
                  <HorseCard key={h.id} horse={h} onClick={() => go({ horse: h.id })} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      <div className="fab-area">
        <button className="ghost-btn full" onClick={() => go("breed")}>
          配合プランナー
        </button>
        <button className="primary-btn" disabled={atLimit} onClick={() => go("create")}>
          ＋ 馬を登録
        </button>
        {atLimit && (
          <p className="limit-note">
            管理枠（{limit}頭）が上限です。
            <button className="link-btn" onClick={() => go("settings")}>
              PROにアップグレード
            </button>
            で30頭まで。
          </p>
        )}
      </div>
    </div>
  );
}

function HorseCard({ horse, onClick }: { horse: Horse; onClick: () => void }) {
  const alerts = horseAlerts(horse);
  const urgent = alerts.find((a) => a.level !== "info");
  const inherit = alerts.find((a) => a.level === "info");
  const weekPct = Math.round((horse.weeksLeft / Math.max(1, horse.maxWeeks)) * 100);

  return (
    <button className="horse-card" onClick={onClick}>
      <div className="hc-head">
        <span className="hc-name">
          {horse.generation >= 2 && <span className="gen-badge">G{horse.generation}</span>}
          {horse.name}
          <span className="sex-tag">{horse.sex}</span>
        </span>
        <span className="hc-rating">{horse.soshitsu}</span>
      </div>
      <div className="hc-parents muted">
        {horse.sireName || "?"} × {horse.damName || "?"}
      </div>
      <div className="hc-tags">
        <span className="tag">{horse.leg}</span>
        <span className="tag">{horse.distance}</span>
        {horse.growth !== "不明" && <span className="tag">{horse.growth}</span>}
      </div>
      {horse.status === "育成中" ? (
        <div className="hc-foot">
          <span className="muted small">残り{horse.weeksLeft}週</span>
          <div className="mini-track">
            <div
              className={`mini-fill ${horse.weeksLeft <= 12 ? "low" : ""}`}
              style={{ width: `${weekPct}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="hc-foot">
          <span className={`status-badge ${horse.status === "殿堂" ? "hall" : ""}`}>
            {horse.status}
          </span>
          <span className="muted small">G1 {horse.g1Wins}勝</span>
        </div>
      )}
      {(urgent || inherit) && (
        <div className="hc-alerts">
          {urgent && <span className={`alert-pill ${urgent.level}`}>{urgent.message}</span>}
          {inherit && <span className="alert-pill info">{inherit.message}</span>}
        </div>
      )}
    </button>
  );
}
