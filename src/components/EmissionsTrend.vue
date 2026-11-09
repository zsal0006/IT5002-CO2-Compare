<script setup>
import { computed, ref, watch } from 'vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import { areaPath, percentChange, signedPercent, usableRows } from '@/lib/series'
import { formatNumber } from '@/lib/format'

/**
 * One country's transport emissions over time, with a year you can scrub to.
 *
 * Hand-drawn SVG rather than a charting library: the chart is one series, one
 * fill and one marker, and the scrub interaction is the point — a slider bound
 * to the same state the marker reads is simpler than driving a library's
 * tooltip from outside. It also keeps a 200 kB dependency off this route.
 *
 * The y axis starts at zero. Every figure is also in the table behind the
 * disclosure, so nothing here is readable only as a shape.
 */
const props = defineProps({
  /** Rows from country_series(). */
  rows: { type: Array, required: true },
  countryName: { type: String, default: '' }
})

const WIDTH = 1000
const HEIGHT = 280

const PERIODS = [
  { value: 'all', label: 'Full record' },
  { value: 'since2000', label: 'Since 2000' },
  { value: 'recent', label: 'Last 10 years' }
]
const period = ref('all')
const year = ref(null)

const all = computed(() => usableRows(props.rows))

const firstYear = computed(() => {
  if (!all.value.length) return null
  const last = all.value[all.value.length - 1].year
  if (period.value === 'since2000') return Math.max(all.value[0].year, 2000)
  if (period.value === 'recent') return Math.max(all.value[0].year, last - 9)
  return all.value[0].year
})

const points = computed(() => all.value.filter((p) => p.year >= (firstYear.value ?? 0)))

const lastYear = computed(() => points.value.at(-1)?.year ?? null)

/** Keep the scrubbed year inside the visible period as the period changes. */
watch(
  [points, () => period.value],
  () => {
    if (!points.value.length) return
    const lo = points.value[0].year
    const hi = points.value.at(-1).year
    if (year.value == null || year.value < lo || year.value > hi) year.value = hi
  },
  { immediate: true }
)

const geometry = computed(() => areaPath(points.value, { width: WIDTH, height: HEIGHT }))

const selected = computed(
  () => points.value.find((p) => p.year === year.value) ?? points.value.at(-1) ?? null
)

const previous = computed(() => {
  if (!selected.value) return null
  return all.value.find((p) => p.year === selected.value.year - 1) ?? null
})

const yoy = computed(() =>
  previous.value ? percentChange(previous.value.value, selected.value.value) : null
)

const sincePeriodStart = computed(() => {
  if (!selected.value || !points.value.length) return null
  const start = points.value[0]
  if (start.year === selected.value.year) return null
  return percentChange(start.value, selected.value.value)
})

const marker = computed(() => {
  if (!selected.value) return null
  const { x, y } = geometry.value
  return {
    left: `${((x(selected.value.year) / WIDTH) * 100).toFixed(2)}%`,
    top: `${((y(selected.value.value) / HEIGHT) * 100).toFixed(2)}%`,
    x: x(selected.value.year).toFixed(1)
  }
})

/**
 * The 2020–21 band. Drawn only when the visible period actually contains those
 * years, so it never floats at the edge of a chart that does not reach them.
 */
const covid = computed(() => {
  if (!points.value.length) return null
  const lo = points.value[0].year
  const hi = points.value.at(-1).year
  if (hi < 2020 || lo > 2021) return null
  const { x } = geometry.value
  const from = Math.max(lo, 2019.5)
  const to = Math.min(hi, 2021.5)
  return {
    x: x(from).toFixed(1),
    width: Math.max(0, x(to) - x(from)).toFixed(1),
    // The label hangs off the left edge of the band (see the template's
    // translateX), so this is the band's own left edge as a percentage.
    labelLeft: `${((x(from) / WIDTH) * 100).toFixed(2)}%`
  }
})

const xTicks = computed(() => {
  if (points.value.length < 2) return []
  const lo = points.value[0].year
  const hi = points.value.at(-1).year
  const step = Math.max(1, Math.round((hi - lo) / 5))
  const out = []
  for (let y = lo; y <= hi; y += step) out.push(y)
  if (out.at(-1) !== hi) out.push(hi)
  return out
})

const tableRows = computed(() =>
  [...all.value].reverse().map((p, i, arr) => {
    const prev = arr[i + 1]
    return {
      year: p.year,
      value: p.value,
      change: prev ? percentChange(prev.value, p.value) : null,
      sharePct: p.sharePct
    }
  })
)

/**
 * Findings stated in words. A reader who cannot see the chart — or who is not
 * confident reading one — should still leave with what it says.
 */
const insights = computed(() => {
  const pts = all.value
  if (pts.length < 2) return []

  const first = pts[0]
  const last = pts.at(-1)
  const peak = pts.reduce((a, b) => (b.value > a.value ? b : a))
  const out = []

  const overall = percentChange(first.value, last.value)
  out.push({
    key: 'overall',
    tone: 'accent',
    title: overall >= 0 ? 'Long-run rise.' : 'Long-run fall.',
    text: `${signedPercent(overall, 0)} between ${first.year} and ${last.year}, from ${formatNumber(first.value, 1)} to ${formatNumber(last.value, 1)} Mt.`
  })

  const y2019 = pts.find((p) => p.year === 2019)
  const y2021 = pts.find((p) => p.year === 2021)
  if (y2019 && y2021) {
    const dip = percentChange(y2019.value, y2021.value)
    out.push({
      key: 'covid',
      tone: 'series-1',
      title: 'Pandemic dip.',
      text: `${signedPercent(dip, 0)} between 2019 and 2021 as travel stopped.`
    })
  }

  out.push({
    key: 'peak',
    tone: 'ink',
    title: peak.year === last.year ? 'At a record.' : 'Past the peak.',
    text:
      peak.year === last.year
        ? `${last.year} is the highest in the ${pts.length}-year record.`
        : `The peak was ${formatNumber(peak.value, 1)} Mt in ${peak.year}; ${last.year} is ${signedPercent(percentChange(peak.value, last.value), 0)} on that.`
  })

  return out
})
</script>

<template>
  <section class="card trend" aria-labelledby="trend-heading">
    <header class="head">
      <div>
        <h2 id="trend-heading">How it has moved</h2>
        <p class="sub">
          Megatonnes of CO₂e from transport, by year. Drag the slider to read any year.
        </p>
      </div>
      <SegmentedControl v-model="period" :options="PERIODS" aria-label="Period" />
    </header>

    <template v-if="points.length > 1 && selected">
      <p class="readout">
        <span class="figure">{{ formatNumber(selected.value, 1) }} Mt</span>
        <span class="in-year">in {{ selected.year }}</span>
        <span class="yoy" :class="{ up: (yoy ?? 0) > 0 }">
          {{ yoy == null ? 'First year of the record' : `${signedPercent(yoy)} on ${selected.year - 1}` }}
        </span>
        <span v-if="sincePeriodStart != null" class="since">
          {{ signedPercent(sincePeriodStart, 0) }} since {{ points[0].year }}
        </span>
      </p>

      <div class="plot">
        <div class="y-axis" aria-hidden="true">
          <span>{{ formatNumber(geometry.max, 0) }}</span>
          <span>{{ formatNumber(geometry.max / 2, 0) }}</span>
          <span>0</span>
        </div>

        <div class="canvas">
          <svg
            :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
            preserveAspectRatio="none"
            role="img"
            :aria-label="`Transport emissions for ${countryName} from ${points[0].year} to ${lastYear}, ${formatNumber(points[0].value, 1)} to ${formatNumber(points.at(-1).value, 1)} megatonnes. The same figures are in the table below.`"
          >
            <line x1="0" y1="0" :x2="WIDTH" y2="0" class="grid" vector-effect="non-scaling-stroke" />
            <line x1="0" :y1="HEIGHT / 2" :x2="WIDTH" :y2="HEIGHT / 2" class="grid" vector-effect="non-scaling-stroke" />
            <line x1="0" :y1="HEIGHT" :x2="WIDTH" :y2="HEIGHT" class="axis" vector-effect="non-scaling-stroke" />

            <rect v-if="covid" :x="covid.x" y="0" :width="covid.width" :height="HEIGHT" class="covid" />

            <path :d="geometry.area" class="fill" />
            <path :d="geometry.line" class="line" vector-effect="non-scaling-stroke" />

            <line
              v-if="marker"
              :x1="marker.x" y1="0" :x2="marker.x" :y2="HEIGHT"
              class="cursor" vector-effect="non-scaling-stroke"
            />
          </svg>

          <span v-if="covid" class="covid-label" :style="{ left: covid.labelLeft }">2020–21 lockdowns</span>
          <span v-if="marker" class="dot" :style="{ left: marker.left, top: marker.top }" aria-hidden="true" />
        </div>

        <span />
        <div class="x-axis" aria-hidden="true">
          <span v-for="t in xTicks" :key="t">{{ t }}</span>
        </div>
      </div>

      <div class="scrub">
        <label for="trend-year">Year</label>
        <input
          id="trend-year"
          type="range"
          :min="points[0].year"
          :max="lastYear"
          step="1"
          :value="selected.year"
          @input="year = Number($event.target.value)"
        />
        <output for="trend-year">{{ selected.year }}</output>
      </div>

      <ul class="insights">
        <li v-for="i in insights" :key="i.key" :class="i.tone">
          <span class="dot-mark" aria-hidden="true" />
          <span><strong>{{ i.title }}</strong> {{ i.text }}</span>
        </li>
      </ul>

      <details>
        <summary>Show the data table</summary>
        <div class="table-wrap">
          <table class="data">
            <caption class="visually-hidden">
              Transport emissions for {{ countryName }}, by year
            </caption>
            <thead>
              <tr>
                <th scope="col">Year</th>
                <th scope="col" class="num">Mt CO₂e</th>
                <th scope="col" class="num">Change on previous year</th>
                <th scope="col" class="num">Share of national total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in tableRows" :key="r.year">
                <th scope="row">{{ r.year }}</th>
                <td class="num">{{ formatNumber(r.value, 1) }}</td>
                <td class="num">{{ r.change == null ? '—' : signedPercent(r.change) }}</td>
                <td class="num">{{ r.sharePct == null ? '—' : `${formatNumber(r.sharePct, 1)}%` }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </template>

    <p v-else class="muted">No time series available for this country.</p>
  </section>
</template>

<style scoped>
.trend { display: flex; flex-direction: column; gap: 1rem; }

.head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 0.75rem; }
.head h2 { margin: 0; font-size: 1.25rem; }
.sub { margin: 0.125rem 0 0; font-size: 0.8125rem; color: var(--text-secondary); }

.readout { display: flex; flex-wrap: wrap; gap: 0.5rem 1.75rem; align-items: baseline; margin: 0; }
.figure { font-family: var(--font-display); font-size: 2.125rem; font-weight: 600; letter-spacing: -0.02em; color: var(--text-primary); }
.in-year { font-size: 0.875rem; font-weight: 600; color: var(--text-secondary); }
.yoy { font-size: 0.8125rem; font-weight: 600; color: var(--success-text); }
.yoy.up { color: var(--series-1-soft-text); }
.since { font-size: 0.8125rem; color: var(--text-secondary); }

.plot { display: grid; grid-template-columns: 40px minmax(0, 1fr); gap: 0.5rem; }
.y-axis {
  height: 280px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-end;
  font-size: 0.6875rem;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
  /* Pull the end labels onto their gridlines rather than inside the box. */
  margin: -0.5em 0;
  padding: 0.5em 0;
}
.canvas { position: relative; height: 280px; }
.canvas svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }

.grid { stroke: var(--gridline); }
.axis { stroke: var(--axis); }
.covid { fill: var(--series-1-soft); opacity: 0.6; }
.fill { fill: var(--accent-soft); opacity: 0.7; }
.line { fill: none; stroke: var(--accent); stroke-width: 2.5; stroke-linejoin: round; }
.cursor { stroke: var(--text-primary); stroke-width: 1; stroke-dasharray: 3 3; }

/* Sits immediately left of the band it names, rather than floating at the
   edge of the chart where it reads as a title for the whole thing. */
.covid-label {
  position: absolute;
  top: 0.375rem;
  transform: translateX(-100%);
  padding-right: 0.375rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--series-1-soft-text);
  white-space: nowrap;
  pointer-events: none;
}

.dot {
  position: absolute;
  width: 14px;
  height: 14px;
  margin: -7px 0 0 -7px;
  border-radius: 50%;
  background: var(--surface-1);
  border: 3px solid var(--accent);
  transition: left 0.15s ease-out, top 0.15s ease-out;
}

.x-axis { display: flex; justify-content: space-between; font-size: 0.6875rem; color: var(--text-secondary); font-variant-numeric: tabular-nums; }

.scrub { display: flex; align-items: center; gap: 0.875rem; }
.scrub label { font-size: 0.8125rem; font-weight: 600; flex: none; }
.scrub input[type='range'] { flex: 1; accent-color: var(--accent); height: 28px; }
.scrub output {
  flex: none;
  min-width: 56px;
  text-align: center;
  padding: 0.25rem 0.625rem;
  border-radius: var(--radius-pill);
  background: var(--ink);
  color: var(--on-ink);
  font-size: 0.8125rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.insights { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0.625rem; }
.insights li {
  display: flex;
  gap: 0.625rem;
  background: var(--page);
  border-radius: var(--radius-md);
  padding: 0.75rem 0.875rem;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.45;
}
.insights strong { color: var(--text-primary); }
.dot-mark { flex: none; width: 8px; height: 8px; margin-top: 0.4rem; border-radius: 50%; }
.accent .dot-mark { background: var(--accent); }
.series-1 .dot-mark { background: var(--series-1); }
.ink .dot-mark { background: var(--text-primary); }

details { font-size: 0.8125rem; }
summary { cursor: pointer; font-weight: 600; color: var(--accent); min-height: 32px; display: flex; align-items: center; }
.table-wrap {
  overflow: auto;
  max-height: 320px;
  margin-top: 0.625rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.table-wrap thead tr { background: var(--page); }
.table-wrap thead th { position: sticky; top: 0; background: var(--page); }

@media (max-width: 480px) {
  .plot { grid-template-columns: 32px minmax(0, 1fr); }
  .figure { font-size: 1.75rem; }
}
</style>
