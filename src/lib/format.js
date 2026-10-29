/** Display formatting. Kept in one place so units read the same everywhere. */

const nf = (digits) =>
  new Intl.NumberFormat('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits })

/** kg CO2e, scaled to a sensible unit. 0.42 kg -> "420 g"; 1240 kg -> "1.24 t". */
export function formatCo2(kg) {
  if (!Number.isFinite(kg)) return '—'
  if (kg === 0) return '0'
  if (kg < 1) return `${nf(0).format(kg * 1000)} g`
  if (kg < 1000) return `${nf(kg < 10 ? 2 : 1).format(kg)} kg`
  return `${nf(2).format(kg / 1000)} t`
}

/** Just the number, for axis ticks and table cells where the unit is in the header. */
export function formatNumber(value, digits = 1) {
  if (!Number.isFinite(value)) return '—'
  return nf(digits).format(value)
}

export function formatKm(km) {
  if (!Number.isFinite(km)) return '—'
  return km < 10 ? `${nf(1).format(km)} km` : `${nf(0).format(km)} km`
}

export function formatPercent(pct) {
  if (!Number.isFinite(pct)) return '—'
  return `${nf(1).format(pct)}%`
}

const regionNames =
  typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null

/** 'GB' -> 'United Kingdom'. Falls back to the code itself. */
export function countryName(code) {
  if (!code || code === 'ZZ') return 'Unknown location'
  try {
    return regionNames?.of(code) ?? code
  } catch {
    return code
  }
}
