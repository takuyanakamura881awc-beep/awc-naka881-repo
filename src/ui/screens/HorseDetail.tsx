import { useCallback, useEffect, useState } from "react";
import { useGame } from "../../state/GameContext";
import { listBetsByHorse, listLogsByHorse } from "../../db/repo";
import { horseAlerts, summarize } from "../../domain/lifecycle";
import { summarizeBets, supportProgress } from "../../domain/betting";
import type { Bet, RaceLog } from "../../domain/types";
import type { View } from "../nav";

export function HorseDetail({ id, go }: { id: string; go: (v: View) => void }) {
  const { horses, removeHorse, deleteLog } = useGame();
  const horse = horses.find((h) => h.id === id);
  const [logs, setLogs] = useState<RaceLog[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);

  const load = useCallback(async () => {
    const [l, b] = await Promise.all([listLogsByHorse(id), listBetsByHorse(id)]);
    setLogs(l);
    setBets(b);
  }, [id]);

  useEffect(() => {
    load();
  }, [load, horse?.updatedAt]);

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

  const alerts = horseAlerts(horse);
  const rec = summarize(logs);
  const betSum = summarizeBets(bets);
  const support = supportProgress(betSum.staked);
  const planned = logs.filter((l) => l.status === "予定");
  const done = logs.filter((l) => l.status === "完了").sort((a, b) => b.at - a.at);
  const weekPct = Math.round((horse.weeksLeft / Math.max(1, horse.maxWeeks)) * 100);

  async function onDeleteHorse() {
    if (!horse) return;
    if (!confirm(`「${horse.name}」を削除しますか？出走記録も消えます。`)) return;
    await removeHorse(horse.id);
    go("home");
  }
  async function onDeleteLog(logId: string) {
    if (!confirm("この記録を削除しますか？")) return;
    await deleteLog(logId);
    await load();
  }

  return (
    <div className="screen">
      <button className="link-btn back" onClick={() => go("home")}>
        ‹ 厩舎
      </button>

      <div className="detail-head">
        <h2 className="screen-title">
          {horse.generation >= 2 && <span className="gen-badge">G{horse.generation}</span>}
          {horse.name}
          <span className="sex-tag">{horse.sex}</span>
        </h2>
        <span className="hc-rating">{horse.soshitsu}</span>
      </div>
      <p className="muted">
        {horse.sireName || "?"} × {horse.damName || "?"} ・ 継承{horse.inheritType} ・ 第{horse.generation}世代
      </p>

      {alerts.length > 0 && (
        <section className="panel alerts">
          {alerts.map((a, i) => (
            <div key={i} className={`alert-row ${a.level}`}>
              {a.message}
            </div>
          ))}
        </section>
      )}

      {horse.status === "育成中" && (
        <section className="panel">
          <h3 className="section-head">寿命</h3>
          <div className="hc-foot">
            <span className="muted small">残り{horse.weeksLeft} / {horse.maxWeeks}週</span>
            <div className="mini-track">
              <div className={`mini-fill ${horse.weeksLeft <= 12 ? "low" : ""}`} style={{ width: `${weekPct}%` }} />
            </div>
          </div>
        </section>
      )}

      <section className="panel">
        <h3 className="section-head">カルテ</h3>
        <div className="kv-grid">
          <KV k="状態" v={horse.status} />
          <KV k="素質" v={horse.soshitsu} />
          <KV k="脚質" v={horse.leg} />
          <KV k="成長" v={horse.growth} />
          <KV k="距離適性" v={horse.distance} />
          <KV k="ダート適性" v={horse.dirtApt} />
          <KV k="道悪適性" v={horse.mudApt} />
          <KV k="気性" v={horse.temper} />
          <KV k="毛色" v={horse.coat} />
          <KV k="継承型" v={horse.inheritType} />
          <KV k="G1勝利" v={`${horse.g1Wins}勝`} />
        </div>
        {horse.abilityNote && <p className="note-line">表パラ：{horse.abilityNote}</p>}
        {horse.note && <p className="note-line muted">メモ：{horse.note}</p>}
        <button className="ghost-btn full" onClick={() => go({ edit: horse.id })}>
          カルテを編集
        </button>
      </section>

      <section className="panel">
        <h3 className="section-head">成績</h3>
        <div className="record-row">
          <Stat n={rec.starts} label="出走" />
          <Stat n={rec.wins} label="勝利" />
          <Stat n={rec.top3} label="複勝" />
          <Stat n={rec.g1Wins} label="G1" />
        </div>
        <p className="muted small">獲得メダル合計 {rec.prize.toLocaleString()}</p>
      </section>

      <section className="panel">
        <h3 className="section-head">この馬への投資（ベット）</h3>
        <div className="record-row">
          <Stat n={betSum.staked} label="投入枚数" />
          <Stat n={betSum.count} label="ベット数" />
          <Stat n={betSum.hits} label="的中" />
        </div>
        <p className={`bet-net ${betSum.net >= 0 ? "plus" : "minus"}`}>
          収支 {betSum.net >= 0 ? "+" : ""}
          {betSum.net.toLocaleString()} 枚
          <span className="muted small">（払戻 {betSum.returned.toLocaleString()}）</span>
        </p>
        <div className="support-box">
          <div className="support-unlocked">
            応援アイテム：
            {support.unlocked.length === 0 ? (
              <span className="muted">未解放</span>
            ) : (
              support.unlocked.map((s) => (
                <span key={s.name} className="support-pill">
                  {s.name}
                </span>
              ))
            )}
          </div>
          {support.next && (
            <p className="muted small">
              次「{support.next.name}」まであと <b>{support.remaining.toLocaleString()}</b> 枚
              （累計{support.next.threshold.toLocaleString()}枚で解放）
            </p>
          )}
        </div>
        <button className="primary-btn full" onClick={() => go({ bets: horse.id })}>
          ベットを記録 / 一覧
        </button>
      </section>

      {planned.length > 0 && (
        <section className="panel">
          <h3 className="section-head">ローテ予定</h3>
          <ul className="log-list">
            {planned.map((l) => (
              <li key={l.id} className="log-plan">
                <span className={`grade grade-${l.grade}`}>{l.grade}</span>
                <span className="race-name">{l.raceName}</span>
                {l.atWeek != null && <span className="muted small">残{l.atWeek}週</span>}
                <button className="link-btn" onClick={() => go({ log: { horseId: id, logId: l.id } })}>
                  編集
                </button>
                <button className="link-btn danger-link" onClick={() => onDeleteLog(l.id)}>
                  削除
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel">
        <h3 className="section-head">出走履歴</h3>
        {done.length === 0 ? (
          <p className="muted small">まだ記録がありません。</p>
        ) : (
          <ul className="log-list">
            {done.map((l) => (
              <li key={l.id} className="log-done">
                <span className={`pos ${l.position === 1 ? "win" : ""}`}>{l.position}着</span>
                <span className={`grade grade-${l.grade}`}>{l.grade}</span>
                <span className="race-name">{l.raceName}</span>
                <span className="muted small">
                  {l.odds != null ? `${l.odds}倍` : ""} {l.prize ? `${l.prize.toLocaleString()}M` : ""}
                </span>
                <button className="link-btn" onClick={() => go({ log: { horseId: id, logId: l.id } })}>
                  編集
                </button>
              </li>
            ))}
          </ul>
        )}
        <button className="primary-btn full" onClick={() => go({ log: { horseId: id } })}>
          ＋ 出走を記録 / 予定を追加
        </button>
      </section>

      <section className="panel danger">
        <button className="danger-btn" onClick={onDeleteHorse}>
          この馬を削除
        </button>
      </section>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="kv">
      <span className="kv-k">{k}</span>
      <span className="kv-v">{v}</span>
    </div>
  );
}
function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rec-stat">
      <span className="rec-n">{n}</span>
      <span className="rec-l">{label}</span>
    </div>
  );
}
