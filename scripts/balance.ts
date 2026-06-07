// バランス検証ハーネス（A0）。決定論エンジンで多数の育成→出走を自動シミュレーションし、
// 育成到達値・グレード別勝率・適性の効きをレポートする。手調整の前に歪みを炙り出す。
// 実行: npx vite-node scripts/balance.ts
import { breed, sireDamGenes, horseGenes } from "../src/domain/genetics";
import { applyTraining, DEFAULT_MAX_TURNS, isTrainable } from "../src/domain/training";
import { simulateRace, bestStyle, estimatePerformance } from "../src/domain/raceSim";
import { suggestTraining, ratingScore, bestDistance } from "../src/domain/suggestions";
import { createRng, hashSeed } from "../src/domain/rng";
import { SIRES, DAMS } from "../src/data/sires_dams";
import { RACES } from "../src/data/races";
import {
  STAT_KEYS,
  type DistanceKey,
  type PlayerHorse,
  type RaceEntry,
  type StatKey,
} from "../src/domain/types";
import { statTotal } from "../src/domain/training";
import { breedingPotency } from "../src/domain/breeding";

const N_HORSES = 2000;
const RACE_TRIALS = 12;

function makeHorse(seed: string): PlayerHorse {
  const rng = createRng(hashSeed(seed));
  const sire = SIRES[Math.floor(rng.next() * SIRES.length)];
  const dam = DAMS[Math.floor(rng.next() * DAMS.length)];
  const bred = breed(sireDamGenes(sire), sireDamGenes(dam), seed);
  return {
    id: seed,
    schema_version: 1,
    name: seed,
    sireId: sire.id,
    damId: dam.id,
    sireName: sire.name,
    damName: dam.name,
    generation: bred.generation,
    stats: bred.stats,
    potential: bred.potential,
    aptitudes: bred.aptitudes,
    temperament: bred.temperament,
    energy: 100,
    turn: 0,
    maxTurns: DEFAULT_MAX_TURNS,
    createdAt: 0,
    retired: false,
  };
}

// 自動育成方針：毎ターン提案に従う（energy<30で休養）。＝平均的なプレイ。
function autoRaise(horse: PlayerHorse): { horse: PlayerHorse; rests: number } {
  let h = horse;
  let rests = 0;
  while (isTrainable(h)) {
    const action = suggestTraining(h).action;
    if (action === "rest") rests++;
    h = applyTraining(h, action).horse;
  }
  return { horse: h, rests };
}

// 集中育成方針：得意距離の重要2能力だけを鍛える（energy<25で休養）。＝上手いプレイ。
function focusedRaise(horse: PlayerHorse): PlayerHorse {
  const dist = bestDistance(horse);
  const focus = FOCUS[dist];
  let h = horse;
  let fi = 0;
  while (isTrainable(h)) {
    const action = h.energy < 25 ? "rest" : focus[fi++ % focus.length];
    h = applyTraining(h, action).horse;
  }
  return h;
}

const FOCUS: Record<DistanceKey, StatKey[]> = {
  short: ["speed", "power"],
  mile: ["speed", "stamina"],
  middle: ["stamina", "speed"],
  long: ["stamina", "guts"],
};

function pct(arr: number[], p: number): number {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

const ratings: number[] = [];
const totals: number[] = [];
const restCounts: number[] = [];
const peaks: number[] = []; // 最良マッチでの素の性能
// レースごと: 全試行の着順・勝利・複勝
const raceStats = RACES.map(() => ({ pos: [] as number[], win: 0, top3: 0, n: 0 }));
// 適性の効き: 得意距離が一致するG1で勝てるか
let matchG1Win = 0, matchG1N = 0, offG1Win = 0, offG1N = 0;

for (let i = 0; i < N_HORSES; i++) {
  const { horse, rests } = autoRaise(makeHorse(`h-${i}`));
  ratings.push(ratingScore(horse));
  totals.push(statTotal(horse.stats));
  restCounts.push(rests);
  const style = bestStyle(horse);
  const myDist = bestDistance(horse);
  peaks.push(Math.max(...RACES.map((r) => estimatePerformance(horse, r, style))));

  RACES.forEach((race, ri) => {
    for (let t = 0; t < RACE_TRIALS; t++) {
      const r = simulateRace(horse, race, style, hashSeed(`${i}-${ri}-${t}`));
      raceStats[ri].pos.push(r.position);
      raceStats[ri].n++;
      if (r.position === 1) raceStats[ri].win++;
      if (r.position <= 3) raceStats[ri].top3++;
      if (race.grade === "G1") {
        if (race.distanceKey === myDist) {
          matchG1N++;
          if (r.position === 1) matchG1Win++;
        } else {
          offG1N++;
          if (r.position === 1) offG1Win++;
        }
      }
    }
  });
}

console.log(`\n=== バランス検証レポート（自動育成 N=${N_HORSES} / 各レース${RACE_TRIALS}試行） ===\n`);

console.log("■ 育成到達（自動方針で最後まで育成）");
console.log(`  総合レーティング(0-100)  min ${pct(ratings, 0)} / p25 ${pct(ratings, 25)} / 中央 ${pct(ratings, 50)} / p75 ${pct(ratings, 75)} / max ${pct(ratings, 100)}`);
console.log(`  能力値合計(/${STAT_KEYS.length * 1200})    平均 ${mean(totals).toFixed(0)} / 中央 ${pct(totals, 50)}`);
console.log(`  休養ターン数             平均 ${mean(restCounts).toFixed(1)} / ${DEFAULT_MAX_TURNS}ターン中`);
console.log(`  最良マッチ性能(perf)     p10 ${pct(peaks, 10).toFixed(0)} / p25 ${pct(peaks, 25).toFixed(0)} / 中央 ${pct(peaks, 50).toFixed(0)} / p75 ${pct(peaks, 75).toFixed(0)} / p90 ${pct(peaks, 90).toFixed(0)} / p99 ${pct(peaks, 99).toFixed(0)}\n`);

console.log("■ グレード別レース成績（全頭・全試行）");
console.log("  " + "レース".padEnd(20) + "G   距離   勝率   複勝率  平均着順");
RACES.forEach((race, ri) => {
  const s = raceStats[ri];
  const win = ((s.win / s.n) * 100).toFixed(1);
  const top3 = ((s.top3 / s.n) * 100).toFixed(1);
  const avg = mean(s.pos).toFixed(1);
  console.log(
    "  " +
      race.name.padEnd(18) +
      race.grade.padEnd(4) +
      `${race.distance}`.padStart(4) +
      "  " +
      `${win}%`.padStart(6) +
      `${top3}%`.padStart(8) +
      `${avg}`.padStart(9),
  );
});

console.log("\n■ 適性の効き（G1勝率）");
console.log(`  得意距離が一致するG1   勝率 ${((matchG1Win / Math.max(1, matchG1N)) * 100).toFixed(1)}%`);
console.log(`  得意距離が外れるG1     勝率 ${((offG1Win / Math.max(1, offG1N)) * 100).toFixed(1)}%`);

// 集中育成（上手いプレイ）の上限確認：得意G1での勝率。
const fPeaks: number[] = [];
let fG1Win = 0, fG1N = 0;
for (let i = 0; i < N_HORSES; i++) {
  const horse = focusedRaise(makeHorse(`f-${i}`));
  const style = bestStyle(horse);
  const myDist = bestDistance(horse);
  fPeaks.push(Math.max(...RACES.map((r) => estimatePerformance(horse, r, style))));
  for (const race of RACES) {
    if (race.grade !== "G1" || race.distanceKey !== myDist) continue;
    for (let t = 0; t < RACE_TRIALS; t++) {
      const r = simulateRace(horse, race, style, hashSeed(`f${i}-${race.id}-${t}`));
      fG1N++;
      if (r.position === 1) fG1Win++;
    }
  }
}
console.log("\n■ 集中育成（上手いプレイ）の上限");
console.log(`  最良マッチ性能(perf)     中央 ${pct(fPeaks, 50).toFixed(0)} / p90 ${pct(fPeaks, 90).toFixed(0)} / p99 ${pct(fPeaks, 99).toFixed(0)}`);
console.log(`  得意距離G1の勝率         ${((fG1Win / Math.max(1, fG1N)) * 100).toFixed(1)}%`);

// 引退馬の成績から potency を算出（シミュレートした最高成績ベース）。
function potencyOf(horse: PlayerHorse): number {
  const style = bestStyle(horse);
  const entries: RaceEntry[] = RACES.map((race) => {
    let best = race.fieldSize;
    for (let t = 0; t < RACE_TRIALS; t++) {
      const r = simulateRace(horse, race, style, hashSeed(`pot-${horse.id}-${race.id}-${t}`));
      best = Math.min(best, r.position);
    }
    return {
      id: "",
      schema_version: 1,
      horseId: horse.id,
      raceId: race.id,
      style,
      seed: 0,
      result: { position: best, fieldSize: race.fieldSize, timeSeconds: 0, performance: 0, prize: 0 },
      at: 0,
    };
  });
  return breedingPotency(entries);
}

// 多世代継承：毎世代「ベスト2頭」を親に集中育成を繰り返し、G1勝率の推移を見る。
console.log("\n■ 多世代 継承配合（毎世代ベスト2頭を親に集中育成）");
const M = 150;
let parentA = focusedRaise(makeHorse("lin-a"));
let parentB = focusedRaise(makeHorse("lin-b"));
for (let gen = 1; gen <= 6; gen++) {
  const potA = potencyOf(parentA);
  const potB = potencyOf(parentB);
  const aGenes = horseGenes(parentA, potA);
  const bGenes = horseGenes(parentB, potB);

  let g1Win = 0, g1N = 0;
  const children: { horse: PlayerHorse; peak: number }[] = [];
  for (let i = 0; i < M; i++) {
    const bred = breed(aGenes, bGenes, `gen${gen}-${i}`);
    const child = focusedRaise({
      ...parentA,
      id: `c${gen}-${i}`,
      stats: bred.stats,
      potential: bred.potential,
      aptitudes: bred.aptitudes,
      temperament: bred.temperament,
      generation: bred.generation,
      energy: 100,
      turn: 0,
      retired: false,
    });
    const style = bestStyle(child);
    const myDist = bestDistance(child);
    const peak = Math.max(...RACES.map((r) => estimatePerformance(child, r, style)));
    children.push({ horse: child, peak });
    for (const race of RACES) {
      if (race.grade !== "G1" || race.distanceKey !== myDist) continue;
      for (let t = 0; t < RACE_TRIALS; t++) {
        const r = simulateRace(child, race, style, hashSeed(`win-${gen}-${i}-${race.id}-${t}`));
        g1N++;
        if (r.position === 1) g1Win++;
      }
    }
  }
  children.sort((x, y) => y.peak - x.peak);
  const medPeak = children[Math.floor(M / 2)].peak;
  console.log(
    `  第${bred_gen(gen)}世代  perf中央 ${medPeak.toFixed(0)}  得意G1勝率 ${((g1Win / Math.max(1, g1N)) * 100).toFixed(1)}%  potency(親) ${potA.toFixed(3)}/${potB.toFixed(3)}`,
  );
  parentA = children[0].horse;
  parentB = children[1].horse;
}
function bred_gen(g: number): number {
  return g + 1;
}
console.log("");
