/**
 * Shaping a country's yearly emissions series for the dashboard.
 *
 * Pure functions over `country_series()` rows. No DOM, no stores — the chart
 * component decides how to draw; this decides what the numbers say.
 */

/** Percentage change from `from` to `to`. Null when `from` is zero or missing. */
export function percentChange(from, to) {
  const a = Number(from)
  const b = Number(to)
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null
  return (b / a - 1) * 100
}

/**
 * "+42%" / "−8.3%".
 *
 * Uses U+2212 MINUS SIGN rather than a hyphen: at the size these are set, a
 * hyphen reads as a dash in a list of numbers, and the two align differently
 * in tabular figures.
 */
export function signedPercent(value, digits = 1) {
  if (value == null || !Number.isFinite(value)) return '—'
  const sign = value >= 0 ? '+' : '−'
  return `${sign}${Math.abs(value).toFixed(digits)}%`
}

/** The rows that have a transport figure, oldest first. */
export function usableRows(rows) {
  return (rows ?? [])
    .filter((r) => r.transport_mt_co2e != null && Number.isFinite(Number(r.transport_mt_co2e)))
    .map((r) => ({
      year: Number(r.year),
      value: Number(r.transport_mt_co2e),
      total: r.total_mt_co2e == null ? null : Number(r.total_mt_co2e),
      sharePct: r.transport_share_pct == null ? null : Number(r.transport_share_pct)
    }))
    .sort((a, b) => a.year - b.year)
}

/**
 * Build the line and fill paths for an area chart in a 0..width by 0..height
 * box, y inverted so larger values sit higher.
 *
 * The y axis starts at zero and is NOT clipped to the data range. A truncated
 * axis exaggerates change, and the whole question this chart answers is how
 * much things have changed.
 */
export function areaPath(points, { width = 1000, height = 280, max = null } = {}) {
  if (!points.length) return { line: '', area: '', max: 0, x: () => 0, y: () => height }

  const first = points[0].year
  const last = points[points.length - 1].year
  const span = Math.max(1, last - first)
  const ceiling = max ?? niceCeiling(Math.max(...points.map((p) => p.value)))

  const x = (year) => ((year - first) / span) * width
  const y = (value) => height - (value / ceiling) * height

  const line = points
    .map((p, i) => `${i ? 'L' : 'M'}${x(p.year).toFixed(1)} ${y(p.value).toFixed(1)}`)
    .join('')

  return { line, area: `${line}L${width} ${height}L0 ${height}Z`, max: ceiling, x, y }
}

/** Round an axis maximum up to something a person would choose. */
export function niceCeiling(value) {
  if (!Number.isFinite(value) || value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  for (const step of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]) {
    if (value <= step * magnitude) return step * magnitude
  }
  return 10 * magnitude
}

/**
 * Mean emissions per decade, with growth on the decade before.
 *
 * A part-decade at the end is kept and labelled with its real range, because
 * dropping it would hide the most recent years — but it is a mean, so a short
 * final decade is not thereby understated.
 */
export function decadeAverages(points) {
  if (!points.length) return []

  const buckets = new Map()
  for (const p of points) {
    const decade = Math.floor(p.year / 10) * 10
    if (!buckets.has(decade)) buckets.set(decade, [])
    buckets.get(decade).push(p)
  }

  const out = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([decade, rows]) => {
      const firstYear = rows[0].year
      const lastYear = rows[rows.length - 1].year
      const complete = lastYear - firstYear === 9
      return {
        decade,
        label: complete ? `${decade}s` : `${firstYear}–${String(lastYear).slice(-2)}`,
        average: rows.reduce((sum, r) => sum + r.value, 0) / rows.length,
        years: rows.length
      }
    })

  return out.map((d, i) => ({
    ...d,
    growth: i === 0 ? null : percentChange(out[i - 1].average, d.average)
  }))
}

/**
 * Fixed, roughly logarithmic bins for the choropleth.
 *
 * Transport emissions span five orders of magnitude — 0.006 Mt to 1,700 Mt —
 * so equal intervals would put every country except about six in the palest
 * shade. These are quantile-LIKE in effect (on 2024 data they split 209
 * countries into bands of roughly 58, 36, 40, 37, 18, 15 and 5) but the edges
 * are round numbers a reader can hold, which true quantiles never are.
 */
export const EMISSION_BINS = [
  { min: 0, max: 1, label: 'Under 1' },
  { min: 1, max: 3, label: '1–3' },
  { min: 3, max: 10, label: '3–10' },
  { min: 10, max: 30, label: '10–30' },
  { min: 30, max: 100, label: '30–100' },
  { min: 100, max: 300, label: '100–300' },
  { min: 300, max: Infinity, label: '300+' }
]

/**
 * Sequential single-hue ramp for those bins, pale to deep.
 *
 * One hue because this encodes a magnitude, not a category; seven steps
 * because that is about the most a reader can still match back to a legend.
 * Lives here beside the bins so the map and its legend cannot drift apart.
 */
export const EMISSION_RAMP = [
  '#f0fdf4', '#dcfce7', '#bbf7d0', '#86efac', '#22c55e', '#15803d', '#14532d'
]

/** Index into EMISSION_BINS, or -1 when there is no figure. */
export function binIndex(value) {
  const v = Number(value)
  if (!Number.isFinite(v) || v <= 0) return -1
  return EMISSION_BINS.findIndex((b) => v <= b.max)
}
