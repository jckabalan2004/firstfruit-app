export const YEAR = 2027

// Every Sunday of YEAR as "YYYY-MM-DD" strings (52 Sundays: Jan 3 – Dec 26, 2027).
export function sundaysOf(year = YEAR) {
  const out = []
  const d = new Date(Date.UTC(year, 0, 1))
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7))
  while (d.getUTCFullYear() === year) {
    out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 7)
  }
  return out
}

export const SUNDAYS = sundaysOf()

export function formatSunday(iso, opts = { month: 'short', day: 'numeric', year: 'numeric' }) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-PH', opts)
}

// The Sunday on or just before today, clamped to YEAR.
export function defaultSunday() {
  const today = new Date().toISOString().slice(0, 10)
  if (today < SUNDAYS[0]) return SUNDAYS[0]
  let pick = SUNDAYS[0]
  for (const s of SUNDAYS) if (s <= today) pick = s
  return pick
}

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })
export const money = (n) => peso.format(Number(n) || 0)

export const pct = (given, commitment) =>
  Number(commitment) > 0 ? Math.min(100, (Number(given) / Number(commitment)) * 100) : 0
