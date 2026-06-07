// シード付き乱数（mulberry32）。レース算出・遺伝・育成を再現可能にする。

export interface Rng {
  next(): number; // [0,1)
  int(minInclusive: number, maxInclusive: number): number;
  range(min: number, max: number): number; // [min,max)
  gaussian(mean: number, sd: number): number;
  pick<T>(arr: readonly T[]): T;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    range: (min, max) => min + next() * (max - min),
    gaussian: (mean, sd) => {
      // Box-Muller
      const u1 = Math.max(next(), 1e-9);
      const u2 = next();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return mean + z * sd;
    },
    pick: (arr) => arr[Math.floor(next() * arr.length)],
  };
  return rng;
}

// 文字列から安定したシードを得る（保存・再現用）。
export function hashSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
