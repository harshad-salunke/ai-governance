// Deterministic helpers for generating mock data. A fixed "now" keeps every
// relative timestamp stable across reloads.

export const NOW = new Date('2026-11-01T10:30:00+05:30').getTime();

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const minsAgo = (m: number) => new Date(NOW - m * MIN).toISOString();
export const hoursAgo = (h: number) => new Date(NOW - h * HOUR).toISOString();
export const daysAgo = (d: number) => new Date(NOW - d * DAY).toISOString();
export const inHours = (h: number) => new Date(NOW + h * HOUR).toISOString();
export const inDays = (d: number) => new Date(NOW + d * DAY).toISOString();
export const inMinsFrom = (m: number) => new Date(NOW + m * MIN).toISOString();

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(r: () => number, arr: readonly T[]): T {
  return arr[Math.floor(r() * arr.length)];
}

export function weighted<T>(r: () => number, entries: readonly [T, number][]): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let x = r() * total;
  for (const [v, w] of entries) {
    if ((x -= w) <= 0) return v;
  }
  return entries[entries.length - 1][0];
}

export function hex(r: () => number, len = 64) {
  let s = '';
  for (let i = 0; i < len; i++) s += Math.floor(r() * 16).toString(16);
  return s;
}
