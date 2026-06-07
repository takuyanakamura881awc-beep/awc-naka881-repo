import { useCallback, useEffect, useState } from "react";
import { useGame } from "../../state/GameContext";
import { listBetsByHorse } from "../../db/repo";
import { ChipGroup, NumberField, TextField } from "../controls";
import { summarizeBets, supportProgress } from "../../domain/betting";
import { newId } from "../../domain/ids";
import { SCHEMA_VERSION } from "../../db/schema";
import { BET_TYPE_KEYS, type Bet, type BetType } from "../../domain/types";
import type { View } from "../nav";

export function Bets({ horseId, go }: { horseId: string; go: (v: View) => void }) {
  const { horses, saveBet, deleteBet } = useGame();
  const horse = horses.find((h) => h.id === horseId);
  const [bets, setBets] = useState<Bet[]>([]);

  const load = useCallback(async () => {
    setBets(await listBetsByHorse(horseId));
  }, [horseId]);
  useEffect(() => {
    load();
  }, [load]);

  // 入力フォーム
  const [raceName, setRaceName] = useState("");
  const [betType, setBetType] = useState<BetType>("単勝");
  const [stake, setStake] = useState<number | null>(100);
  const [hit, setHit] = useState<"的中" | "不的中">("不的中");
  const [payout, setPayout] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const sum = summarizeBets(bets);
  const support = supportProgress(sum.staked);

  async function onAdd() {
    if (!stake || stake <= 0) return;
    setBusy(true);
    const bet: Bet = {
      id: newId(),
      schema_version: SCHEMA_VERSION,
      horseId,
      raceName: raceName.trim(),
      betType,
      stake,
      hit: hit === "的中",
      payout: hit === "的中" ? payout ?? 0 : 0,
      note: note.trim(),
      at: Date.now(),
    };
    await saveBet(bet);
    await load();
    // 次の入力に備え一部リセット
    setPayout(null);
    setNote("");
    setHit("不的中");
    setBusy(false);
  }

  async function onDelete(id: string) {
    await deleteBet(id);
    await load();
  }

  return (
    <div className="screen">
      <button className="link-btn back" onClick={() => go({ horse: horseId })}>
        ‹ {horse?.name ?? "馬"}
      </button>
      <h2 className="screen-title">ベット記録</h2>

      <section className="panel">
        <div className="record-row">
          <Stat n={sum.staked} label="累計投入" />
          <Stat n={sum.net} label="収支" signed />
          <Stat n={Math.round(sum.hitRate * 100)} label="的中率%" />
        </div>
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
            </p>
          )}
          <p className="muted xsmall">※1枠（味噌汁枠）に入ると必要ベット数が約1/6に軽減</p>
        </div>
      </section>

      <section className="panel">
        <h3 className="section-head">ベットを追加</h3>
        <TextField label="レース名（任意）" value={raceName} onChange={setRaceName} placeholder="例：有馬記念" />
        <ChipGroup label="券種" options={BET_TYPE_KEYS} value={betType} onChange={(v) => setBetType(v as BetType)} hint="サイドは自分の所有馬への応援ベット" />
        <NumberField label="投入枚数（メダル）" value={stake} onChange={setStake} min={1} />
        <ChipGroup label="結果" options={["的中", "不的中"]} value={hit} onChange={(v) => setHit(v as "的中" | "不的中")} />
        {hit === "的中" && <NumberField label="払い戻し（メダル）" value={payout} onChange={setPayout} min={0} />}
        <TextField label="メモ（任意）" value={note} onChange={setNote} />
        <button className="primary-btn full" disabled={busy || !stake} onClick={onAdd}>
          ＋ 記録する
        </button>
      </section>

      <section className="panel">
        <h3 className="section-head">履歴</h3>
        {bets.length === 0 ? (
          <p className="muted small">まだ記録がありません。</p>
        ) : (
          <ul className="log-list">
            {bets.map((b) => (
              <li key={b.id} className="bet-row">
                <span className="bet-type">{b.betType}</span>
                <span className="race-name">{b.raceName || "（レース未記入）"}</span>
                <span className="muted small">{b.stake}枚</span>
                <span className={`bet-result ${b.hit ? "hit" : "miss"}`}>
                  {b.hit ? `的中 +${(b.payout - b.stake).toLocaleString()}` : "不的中"}
                </span>
                <button className="link-btn danger-link" onClick={() => onDelete(b.id)}>
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ n, label, signed }: { n: number; label: string; signed?: boolean }) {
  const text = signed && n >= 0 ? `+${n.toLocaleString()}` : n.toLocaleString();
  return (
    <div className="rec-stat">
      <span className={`rec-n ${signed ? (n >= 0 ? "plus" : "minus") : ""}`}>{text}</span>
      <span className="rec-l">{label}</span>
    </div>
  );
}
