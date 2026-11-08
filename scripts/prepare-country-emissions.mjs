/**
 * Turn the GIZ country-level GHG download into a CSV matching
 * `staging_country_emissions` (Sprint 1, T-1.1).
 *
 *   node scripts/prepare-country-emissions.mjs
 *   node scripts/prepare-country-emissions.mjs --inspect        # report only
 *   node scripts/prepare-country-emissions.mjs --in f.csv --out o.csv
 *
 * ---------------------------------------------------------------------------
 * THE SHAPE OF THE SOURCE
 *
 * GIZ ships this as a single XLSX in WIDE form: one row per country, and ten
 * columns per year repeating from 1970 to 2024 — roughly 552 columns.
 *
 *   EDGAR Country Code | Global_Emissions_1970 [MtCO2e] | Transport_Emissions_1970 [MtCO2e] | …
 *   AUS                | 311.2                          | 55.7                              | …
 *
 * Our table is LONG — one row per country per year — so this script unpivots.
 * There is no year column to find; the year is inside each column name.
 *
 * There is also no country NAME column: the only identifier is an ISO3 code, so
 * names are derived from `src/lib/iso.js` plus Intl.DisplayNames.
 *
 * The file is XLSX and its CKAN datastore is empty, so there is no CSV to
 * download and no API to query. Open the XLSX in Excel and save Sheet1 as CSV
 * first — see docs/06 §6.4.
 * ---------------------------------------------------------------------------
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { toAlpha2 } from '../src/lib/iso.js'

const RAW_DIR = 'data/raw'
const DEFAULT_OUT = 'data/country_transport_emissions.csv'

/**
 * Which wide measure feeds which of our columns.
 *
 * `Global_Emissions_YYYY` is read as the country's all-sector total, which is
 * what `total_mt_co2e` means. That reading is CHECKED, not assumed: the script
 * recomputes transport ÷ total and compares it with the file's own
 * `Share_Transport_National_YYYY`. If the two disagree the interpretation is
 * wrong and the script says so loudly rather than loading bad data.
 */
const MEASURES = {
  transport_mt_co2e: /^transport_emissions$/,
  total_mt_co2e: /^global_emissions$/,
  share_national: /^share_transport_national$/
}

const COUNTRY_CODE_HEADER = /(edgar.*country.*code|^iso_?3$|^country_?code$|^iso3c$)/

/**
 * EDGAR codes that pass the three-letter test but are NOT countries.
 *
 * International shipping and aviation are booked against no nation — that is
 * the point of them. Both are large: on 2024 figures SEA would rank third in
 * the world and AIR fourth, on a page headed "transport emissions by country".
 * They are excluded rather than shown, because a reader scanning a country
 * ranking has no way to know those two rows mean something else.
 *
 * Dropping them also keeps the choropleth honest: neither has a boundary, so
 * they would silently vanish from the map while still sitting near the top of
 * the table beside it.
 */
const NOT_COUNTRIES = new Map([
  ['SEA', 'International shipping'],
  ['AIR', 'International aviation']
])

/**
 * States that no longer exist. Their data is real and historical, so it is
 * kept — but `Intl.DisplayNames` has no name for a dissolved country, and a
 * bare "SCG" in a dropdown is not a label.
 */
const HISTORICAL_NAMES = new Map([
  ['SCG', 'Serbia and Montenegro (to 2006)'],
  ['ANT', 'Netherlands Antilles (to 2010)']
])

// ---------------------------------------------------------------- CSV parsing

/** Minimal RFC-4180 parser: quoted fields, embedded commas, CRLF. */
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (c !== '\r') field += c
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((v) => v.trim() !== ''))
}

function toCsv(rows) {
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return rows.map((r) => r.map(esc).join(',')).join('\n') + '\n'
}

const slug = (h) => h.toLowerCase().replace(/\[.*?\]/g, '').trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

/** Split "Transport_Emissions_1994 [MtCO2e]" into { measure, year }. */
function splitYearColumn(header) {
  const m = slug(header).match(/^(.*?)_(\d{4})$/)
  if (!m) return null
  const year = Number(m[2])
  if (year < 1900 || year > 2100) return null
  return { measure: m[1], year }
}

/**
 * Parse a numeric cell.
 *
 * THE FILE MIXES DECIMAL SEPARATORS. Roughly 57,000 cells write the decimal
 * point as a comma (`14230,22955`) and 22,000 as a dot (`928.601913036`), which
 * is what a European-locale export looks like when some cells were stored as
 * text and some as real numbers.
 *
 * A comma here is ALWAYS a decimal point, never thousands grouping. Two things
 * establish that, and both were checked against this file rather than assumed:
 *
 *   - `CHN` 2020 reads `14230,22955` — five digits ahead of the comma, where a
 *     thousands separator would fall after three.
 *   - No cell in the file contains both a comma and a dot, so nothing is
 *     grouped and then pointed.
 *
 * Stripping commas — which this function used to do — turned `0,0492…` into
 * the integer 4927269082996931 and made every share-of-total check fail. Any
 * future source must be re-checked the same way before this rule is reused.
 */
const num = (v) => {
  const s = String(v ?? '').trim()
  if (s === '' || s === '-' || /^(na|n\/a|null|nan)$/i.test(s)) return null

  let cleaned = s.replace(/\s/g, '')

  if (cleaned.includes(',')) {
    if (cleaned.includes('.')) {
      // Not seen in the GIZ file. Rather than guess which separator means what,
      // refuse the cell so the sanity check reports it instead of quietly
      // loading a figure that is out by a factor of a thousand.
      return null
    }
    cleaned = cleaned.replace(',', '.')
  }

  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
function nameFor(alpha3) {
  if (HISTORICAL_NAMES.has(alpha3)) return HISTORICAL_NAMES.get(alpha3)
  const a2 = toAlpha2(alpha3)
  if (a2 === 'ZZ') return alpha3
  try { return regionNames.of(a2) ?? alpha3 } catch { return alpha3 }
}

// ---------------------------------------------------------------------- main

const args = process.argv.slice(2)
const argOf = (f) => { const i = args.indexOf(f); return i === -1 ? null : args[i + 1] }

let input = argOf('--in')
if (!input) {
  if (!existsSync(RAW_DIR)) {
    console.error(`No ${RAW_DIR}/ directory. Create it and put the export inside.`)
    process.exit(1)
  }
  const found = readdirSync(RAW_DIR).filter((f) => /\.csv$/i.test(f))
  if (found.length === 0) {
    console.error(
      `No CSV in ${RAW_DIR}/.\n` +
        `The GIZ download is an XLSX — open it in Excel and save Sheet1 as CSV first.`
    )
    process.exit(1)
  }
  if (found.length > 1) {
    console.error(`Several CSVs in ${RAW_DIR}/ — pass --in <file>:\n  ${found.join('\n  ')}`)
    process.exit(1)
  }
  input = join(RAW_DIR, found[0])
}

const rows = parseCsv(readFileSync(input, 'utf8'))
if (rows.length < 2) { console.error(`${input} has no data rows.`); process.exit(1) }

const headers = rows[0]
const body = rows.slice(1)

console.log(`\nSource: ${input}`)
console.log(`Columns: ${headers.length}   Data rows: ${body.length}`)

// --- locate the country code column -----------------------------------------
const codeIndex = headers.findIndex((h) => COUNTRY_CODE_HEADER.test(slug(h)))
if (codeIndex === -1) {
  console.error(
    `\nNo country-code column found. Headers start:\n  ${headers.slice(0, 8).join(' | ')}\n` +
      `Add the real name to COUNTRY_CODE_HEADER at the top of this script.`
  )
  process.exit(1)
}
console.log(`Country code column: "${headers[codeIndex]}"`)

// --- index the per-year columns ---------------------------------------------
/** @type {Map<number, Record<string, number>>} year -> { ourColumn: headerIndex } */
const byYear = new Map()
const unmatchedMeasures = new Set()

headers.forEach((header, i) => {
  const split = splitYearColumn(header)
  if (!split) return
  const target = Object.entries(MEASURES).find(([, re]) => re.test(split.measure))?.[0]
  if (!target) { unmatchedMeasures.add(split.measure); return }
  if (!byYear.has(split.year)) byYear.set(split.year, {})
  byYear.get(split.year)[target] = i
})

const years = [...byYear.keys()].sort((a, b) => a - b)
if (!years.length) {
  console.error(
    `\nNo YEAR-suffixed columns found — this file may already be in long form,\n` +
      `or the headers differ from what MEASURES expects. First headers:\n  ${headers.slice(0, 8).join(' | ')}`
  )
  process.exit(1)
}

console.log(`Years detected: ${years[0]}–${years.at(-1)} (${years.length} of them)`)
console.log('Measures mapped:')
for (const target of Object.keys(MEASURES)) {
  const present = years.filter((y) => byYear.get(y)[target] !== undefined).length
  const example = headers[byYear.get(years[0])[target]]
  console.log(
    `  ${target.padEnd(18)} ${String(present).padStart(3)}/${years.length} years` +
      `${example ? `   e.g. "${example}"` : '   *** NOT FOUND ***'}`
  )
}
if (unmatchedMeasures.size) {
  console.log(`Ignored measures: ${[...unmatchedMeasures].join(', ')}`)
}

if (args.includes('--inspect')) { console.log('\n(--inspect: nothing written)\n'); process.exit(0) }

if (byYear.get(years[0]).transport_mt_co2e === undefined) {
  console.error('\nNo transport emissions column — cannot continue.')
  process.exit(1)
}

// --- unpivot -----------------------------------------------------------------
const out = [['country_code', 'country_name', 'year', 'transport_mt_co2e', 'total_mt_co2e']]
const codes = new Set()
let skippedCode = 0
let emptyCells = 0
const skippedNotCountry = []

// Cross-check of our reading of Global_Emissions (see MEASURES).
let shareChecked = 0
let shareMismatched = 0
const mismatchExamples = []

for (const r of body) {
  const code = String(r[codeIndex] ?? '').trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(code)) { skippedCode++; continue }
  if (NOT_COUNTRIES.has(code)) { skippedNotCountry.push(code); continue }
  codes.add(code)
  const name = nameFor(code)

  for (const year of years) {
    const cols = byYear.get(year)
    const transport = num(r[cols.transport_mt_co2e])
    if (transport === null) { emptyCells++; continue }
    const total = cols.total_mt_co2e === undefined ? null : num(r[cols.total_mt_co2e])

    if (total !== null && total > 0 && cols.share_national !== undefined) {
      const stated = num(r[cols.share_national])
      if (stated !== null && stated > 0) {
        shareChecked++
        // The file states the share as a fraction; ours is transport ÷ total.
        if (Math.abs(transport / total - stated) > 0.02) {
          shareMismatched++
          if (mismatchExamples.length < 3) {
            mismatchExamples.push(
              `${code} ${year}: computed ${(transport / total).toFixed(3)} vs stated ${stated.toFixed(3)}`
            )
          }
        }
      }
    }

    out.push([code, name, year, transport, total ?? ''])
  }
}

const output = argOf('--out') ?? DEFAULT_OUT
writeFileSync(output, toCsv(out), 'utf8')

console.log(`\nWrote ${output}`)
console.log(`  rows:      ${out.length - 1}`)
console.log(`  countries: ${codes.size}`)
console.log(`  skipped:   ${skippedCode} rows without a 3-letter ISO code`)
if (skippedNotCountry.length) {
  console.log(
    `  excluded:  ${skippedNotCountry.map((c) => `${c} (${NOT_COUNTRIES.get(c)})`).join(', ')}
` +
      `             not countries — see NOT_COUNTRIES at the top of this script`
  )
}
console.log(`  blank:     ${emptyCells} country-year cells with no transport figure`)

// --- report the cross-check --------------------------------------------------
console.log('\nSanity check — is Global_Emissions really the national total?')
if (shareChecked === 0) {
  console.log('  Could not check: no usable Share_Transport_National values.')
} else if (shareMismatched / shareChecked > 0.05) {
  console.log(
    `  *** MISMATCH on ${shareMismatched} of ${shareChecked} checks ***\n` +
      mismatchExamples.map((e) => `    ${e}`).join('\n') +
      `\n  transport ÷ Global_Emissions does NOT match the file's own national share.\n` +
      `  Global_Emissions is probably NOT the country total — do not load total_mt_co2e\n` +
      `  until this is understood, or the dashboard's share-of-total will be wrong.`
  )
} else {
  console.log(
    `  OK — ${shareChecked - shareMismatched} of ${shareChecked} agree within 2 points.\n` +
      `  Global_Emissions reads as the national all-sector total, as assumed.`
  )
}
console.log('')
