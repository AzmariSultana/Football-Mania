// Gameplay randomness goes through here so the Daily Challenge can be seeded:
// everyone gets the same spots, wind, bosses and keeper decisions on the same day.
// Purely cosmetic randomness (particles, crowd) keeps using Math.random.

let generator = Math.random;

export function random() {
  return generator();
}

/** mulberry32 */
export function seedRandom(seed) {
  let a = seed >>> 0;
  generator = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function unseedRandom() {
  generator = Math.random;
}

/** Local calendar date as YYYY-MM-DD. */
export function dateKey(date = new Date()) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

export function dateSeed(date = new Date()) {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}
