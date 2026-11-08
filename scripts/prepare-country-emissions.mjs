/**
 * Turn the GIZ country-level transport emissions download into a CSV that
 * matches the `staging_country_emissions` table exactly (Sprint 1, T-1.1).
 *
 *   node scripts/prepare-country-emissions.mjs
 *   node scripts/prepare-country-emissions.mjs --inspect     # headers only
 *   node scripts/prepare-country-emissions.mjs --in path.csv --out out.csv
 *
 * Put the raw download anywhere under data/raw/ (git-ignored) and run it.
 * The script reports which source column it mapped to each target column, so a
 * wrong guess is visible before anything reaches the database rather than
 * after.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const RAW_DIR = 'data/raw'
const DEFAULT_OUT = 'data/country_transport_emissions.csv'

/** Candidate source header names per target column, best guess first. */
const MAPPING = {
  country_code: ['iso3', 'iso_3', 'iso3c', 'country_code', 'countrycode', 'iso', 'code', 'country_iso3'],
  country_name: ['country_name', 'country', 'name', 'countryname', 'area', 'region'],
  year: ['year', 'yr', 'date', 'period'],
  transport_mt_co2e: [
    'transport_mt_co2e', 'transport', 'transport_emissions', 'transport_ghg',
    'value', 'emissions', 'co2e', 'mt_co2e', 'ghg_transport'
  ],
  total_mt_co2e: [
    'total_mt_co2e', 'total', 'total_emissions', 'total_ghg', 'national_total',
    'economy_wide', 'all_sectors'
  ]
}

// ---------------------------------------------------------------- CSV parsing

/** Minimal RFC-4180 parser: handles quoted fields, embedded commas, CRLF. */
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

// ------------------------------------------------------------------- mapping

const normalise = (h) => h.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

function resolveColumns(headers) {
  const normalised = headers.map(normalise)
  const chosen = {}
  const used = new Set()

  for (const [target, candidates] of Object.entries(MAPPING)) {
    let index = -1
    // Exact match first, then a contains-match, so "transport_co2_mt" still lands.
    for (const candidate of candidates) {
      index = normalised.findIndex((h, i) => h === candidate && !used.has(i))
      if (index !== -1) break
    }
    if (index === -1) {
      for (const candidate of candidates) {
        index = normalised.findIndex((h, i) => h.includes(candidate) && !used.has(i))
        if (index !== -1) break
      }
    }
    if (index !== -1) used.add(index)
    chosen[target] = index
  }
  return chosen
}

// ---------------------------------------------------------------------- main

const args = process.argv.slice(2)
const argOf = (flag) => {
  const i = args.indexOf(flag)
  return i === -1 ? null : args[i + 1]
}

let input = argOf('--in')
if (!input) {
  if (!existsSync(RAW_DIR)) {
    console.error(`No ${RAW_DIR}/ directory. Create it and put the GIZ download inside.`)
    process.exit(1)
  }
  const candidates = readdirSync(RAW_DIR).filter((f) => /\.(csv|tsv|txt)$/i.test(f))
  if (candidates.length === 0) {
    console.error(`No CSV found in ${RAW_DIR}/. Put the GIZ download there.`)
    process.exit(1)
  }
  if (candidates.length > 1) {
    console.error(`Several CSVs in ${RAW_DIR}/ — pass --in <file>:\n  ${candidates.join('\n  ')}`)
    process.exit(1)
  }
  input = join(RAW_DIR, candidates[0])
}

const rows = parseCsv(readFileSync(input, 'utf8'))
if (rows.length < 2) {
  console.error(`${input} has no data rows.`)
  process.exit(1)
}

const headers = rows[0]
const body = rows.slice(1)

console.log(`\nSource: ${input}`)
console.log(`Columns (${headers.length}): ${headers.join(' | ')}`)
console.log(`Data rows: ${body.length}`)
console.log('\nFirst two rows:')
body.slice(0, 2).forEach((r) => console.log('  ' + r.join(' | ')))

const columns = resolveColumns(headers)
console.log('\nColumn mapping:')
for (const [target, index] of Object.entries(columns)) {
  console.log(
    `  ${target.padEnd(20)} <- ${index === -1 ? '*** NOT FOUND ***' : `"${headers[index]}"`}`
  )
}

if (args.includes('--inspect')) {
  console.log('\n(--inspect: nothing written)')
  process.exit(0)
}

const required = ['country_code', 'year', 'transport_mt_co2e']
const missing = required.filter((t) => columns[t] === -1)
if (missing.length) {
  console.error(
    `\nCannot continue — no column matched: ${missing.join(', ')}.` +
      `\nAdd the real header name to MAPPING at the top of this script and re-run.`
  )
  process.exit(1)
}

const out = [['country_code', 'country_name', 'year', 'transport_mt_co2e', 'total_mt_co2e']]
const skipped = { noCode: 0, badYear: 0, noValue: 0 }

for (const r of body) {
  const pick = (t) => (columns[t] === -1 ? '' : (r[columns[t]] ?? '').trim())

  const code = pick('country_code').toUpperCase()
  const year = pick('year').match(/\d{4}/)?.[0]
  const transport = pick('transport_mt_co2e').replace(/[, ]/g, '')

  if (!/^[A-Z]{3}$/.test(code)) { skipped.noCode++; continue }
  if (!year || +year < 1970 || +year > 2100) { skipped.badYear++; continue }
  if (transport === '' || Number.isNaN(Number(transport))) { skipped.noValue++; continue }

  const total = pick('total_mt_co2e').replace(/[, ]/g, '')
  out.push([
    code,
    pick('country_name') || code,
    year,
    transport,
    total !== '' && !Number.isNaN(Number(total)) ? total : ''
  ])
}

const output = argOf('--out') ?? DEFAULT_OUT
writeFileSync(output, toCsv(out), 'utf8')

const countries = new Set(out.slice(1).map((r) => r[0]))
const years = out.slice(1).map((r) => +r[2])

console.log(`\nWrote ${output}`)
console.log(`  rows:      ${out.length - 1}`)
console.log(`  countries: ${countries.size}`)
console.log(`  years:     ${Math.min(...years)}–${Math.max(...years)}`)
console.log(
  `  skipped:   ${skipped.noCode} without a 3-letter code, ` +
    `${skipped.badYear} without a usable year, ${skipped.noValue} without a transport value`
)
console.log(
  '\nRows without a 3-letter ISO code are usually aggregates such as WORLD or EU27.' +
    '\nIf the skipped count looks high, run with --inspect and check the mapping.\n'
)
