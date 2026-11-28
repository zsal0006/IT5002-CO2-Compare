<script setup>
import { computed, ref } from 'vue'
import SegmentedControl from '@/components/shared/SegmentedControl.vue'
import { iconFor } from '@/lib/modeIcons'
import { isCarFree, plural, summariseModes } from '@/lib/community'
import { formatCo2 } from '@/lib/format'
import { MODE_LABELS } from '@/lib/emissions'

/**
 * How people travel: the mode split, by CO₂e avoided or by number of trips,
 * with the CO₂e each mode generated beside what it avoided versus driving.
 *
 * Those two measures rank differently on purpose, and the toggle is the point —
 * a mode chosen rarely for long journeys out-saves one chosen often for short
 * hops, which is the observation story 4.2 is after.
 *
 * Every mode is named and its figures printed, so nothing depends on colour alone.
 */
const props = defineProps({
  /** Rows from v_savings_by_mode, filtered to the current scope. */
  rows: { type: Array, required: true },
  /** Where this is measured — "worldwide" or a region name. */
  scopeLabel: { type: String, default: '' }
})

const MEASURES = [
  { value: 'kg', label: 'CO₂ saved' },
  { value: 'trips', label: 'Trips' }
]
const measure = ref('kg')

/** Modes nobody has used are noise on a leaderboard. */
const used = computed(() => props.rows.filter((r) => Number(r.trips) > 0))

const totals = computed(() => {
  const { trips, carFreeTrips, savedKg } = summariseModes(used.value)
  return { trips, carFreeTrips, carTrips: trips - carFreeTrips, savedKg }
})

const valueOf = (row) =>
  measure.value === 'kg' ? Number(row.total_saved_kg) || 0 : Number(row.trips) || 0

const MODE_COLORS = {
  cycling: '#a855f7',
  walking: 'var(--accent)',
  bus_city: 'var(--series-2)',
  train_national: 'var(--series-3)',
  car_average: 'var(--series-1)'
}

const percentage = (share) => (share > 0 && share < 0.1 ? '<0.1%' : `${Number(share.toFixed(1))}%`)

/** Conic-gradient pie from [{ color, value }] entries; zero values are skipped. */
function pieOf(entries) {
  const total = entries.reduce((n, e) => n + e.value, 0)
  if (!total) return null
  let start = 0
  const stops = entries
    .filter((e) => e.value > 0)
    .map((e) => {
      const end = start + (e.value / total) * 100
      const stop = `${e.color} ${start}% ${end}%`
      start = end
      return stop
    })
  return `conic-gradient(${stops.join(', ')})`
}

const ranked = computed(() => {
  const list = [...used.value].sort((a, b) => valueOf(b) - valueOf(a))
  const total = list.reduce((n, r) => n + valueOf(r), 0)
  return list.map((r) => ({
    key: r.mode_key,
    name: MODE_LABELS[r.mode_key] ?? r.mode_label,
    icon: iconFor(r.mode_key),
    carFree: isCarFree(r),
    color: MODE_COLORS[r.mode_key] ?? 'var(--series-1)',
    amount: valueOf(r),
    share: total ? (valueOf(r) / total) * 100 : 0,
    emitted: formatCo2(Number(r.total_emitted_kg) || 0),
    saved: formatCo2(Number(r.total_saved_kg) || 0),
    trips: plural(r.trips, 'trip')
  }))
})

const modePie = computed(() =>
  pieOf(ranked.value.map((r) => ({ color: r.color, value: r.amount })))
)

const carSplit = computed(() => {
  const { trips, carFreeTrips, carTrips } = totals.value
  return {
    pie: pieOf([
      { color: 'var(--accent)', value: carFreeTrips },
      { color: 'var(--series-1)', value: carTrips }
    ]),
    freeShare: trips ? (carFreeTrips / trips) * 100 : 0,
    carShare: trips ? (carTrips / trips) * 100 : 0
  }
})

/** One sentence stating the finding rather than leaving it to be inferred. */
const insight = computed(() => {
  const savedTotal = totals.value.savedKg
  if (!used.value.length) return 'No trips logged yet. The first one will appear here.'
  if (savedTotal <= 0) {
    return 'Every trip so far was by car, so none of them avoided CO₂e. One car-free trip changes that.'
  }
  const top = [...used.value].sort(
    (a, b) => (Number(b.total_saved_kg) || 0) - (Number(a.total_saved_kg) || 0)
  )[0]
  const share = Math.round(((Number(top.total_saved_kg) || 0) / savedTotal) * 100)
  const where = props.scopeLabel ? ` ${props.scopeLabel}` : ''
  return (
    `${MODE_LABELS[top.mode_key] ?? top.mode_label} accounts for ${share}% of the CO₂e avoided${where}. ` +
    'Car trips are counted towards total, but save nothing.'
  )
})
</script>

<template>
  <section class="card mix" aria-labelledby="mode-heading">
    <header class="head">
      <div>
        <h2 id="mode-heading">How people travel</h2>
        <p class="sub">
          {{ measure === 'kg' ? 'CO₂e avoided versus driving, by mode' : 'Share of trips, by mode' }}
          <template v-if="scopeLabel"> · {{ scopeLabel }}</template>
        </p>
      </div>
      <SegmentedControl v-model="measure" :options="MEASURES" aria-label="Measure" />
    </header>

    <div v-if="ranked.length" class="body-grid">
      <div class="pies">
        <figure v-if="modePie" class="pie-fig">
          <div class="pie" :style="{ background: modePie }" role="img"
            :aria-label="measure === 'kg' ? 'CO₂e avoided by mode' : 'Trips by mode'" />
          <figcaption>{{ measure === 'kg' ? 'CO₂e avoided' : 'Trips' }}</figcaption>
        </figure>
        <figure class="pie-fig">
          <div class="pie" :style="{ background: carSplit.pie }" role="img" aria-label="Car-free versus car trips" />
          <figcaption>
            <span class="key"><span class="swatch free" />Car-free {{ percentage(carSplit.freeShare) }}</span>
            <span class="key"><span class="swatch" />By car {{ percentage(carSplit.carShare) }}</span>
          </figcaption>
        </figure>
      </div>

      <div class="table" role="table" aria-label="CO₂e generated and avoided by mode">
        <div class="trow thead" role="row">
          <span role="columnheader">Mode</span>
          <span role="columnheader" class="num">Generated</span>
          <span role="columnheader" class="num">Avoided</span>
        </div>
        <div v-for="r in ranked" :key="r.key" class="trow" role="row">
          <span class="mode" role="cell">
            <span class="icon" :class="{ free: r.carFree }" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
                stroke-linecap="round" stroke-linejoin="round">
                <path :d="r.icon" />
              </svg>
            </span>
            <span class="mode-text">
              <span class="name">{{ r.name }}</span>
              <span class="meta">
                <span class="swatch" :style="{ background: r.color }" aria-hidden="true" />
                {{ r.trips }} · {{ percentage(r.share) }}
              </span>
            </span>
          </span>
          <span class="num emitted" role="cell">{{ r.emitted }}</span>
          <span class="num avoided" role="cell">{{ r.saved }}</span>
        </div>
      </div>
    </div>

    <p class="insight">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V16h8v-1.3A7 7 0 0 0 12 2z" />
      </svg>
      <span>{{ insight }} <span class="note">Based on trips, not unique users.</span></span>
    </p>
  </section>
</template>

<style scoped>
.mix { display: flex; flex-direction: column; gap: 0.875rem; padding: 1rem 1.125rem; }

.head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.5rem; }
.head h2 { margin: 0; font-size: 1.0625rem; }
.sub { margin: 0.125rem 0 0; font-size: 0.75rem; color: var(--text-secondary); }

.body-grid { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 1.25rem; align-items: center; }

.pies { display: flex; gap: 1rem; }
.pie-fig { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 0.375rem; }
.pie { width: 104px; aspect-ratio: 1; border-radius: 50%; background: var(--surface-2); }
.pie-fig figcaption {
  display: flex; flex-direction: column; align-items: center; gap: 0.125rem;
  font-size: 0.6875rem; color: var(--text-secondary);
}

.key { display: inline-flex; align-items: center; gap: 0.3rem; }
.swatch { width: 8px; height: 8px; border-radius: 2px; background: var(--series-1); flex: none; }
.swatch.free { background: var(--accent); }

.table { display: flex; flex-direction: column; min-width: 0; }
.trow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 5.5rem 5.5rem;
  gap: 0.5rem;
  align-items: center;
  padding: 0.375rem 0;
  border-top: 1px solid var(--gridline);
  font-size: 0.8125rem;
}
.thead {
  border-top: 0;
  padding-top: 0;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-secondary);
}
.num { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
.thead .num { font-weight: 600; }
.emitted { color: var(--series-1-soft-text); }
.avoided { color: var(--accent); }

.mode { display: flex; align-items: center; gap: 0.5rem; min-width: 0; }
.icon {
  flex: none; width: 28px; height: 28px; border-radius: var(--radius-sm);
  display: flex; align-items: center; justify-content: center;
  background: var(--series-1-soft); color: var(--series-1-soft-text);
}
.icon.free { background: var(--accent-soft); color: var(--accent-soft-text); }
.mode-text { display: flex; flex-direction: column; min-width: 0; line-height: 1.25; }
.name { font-weight: 600; }
.meta { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.6875rem; color: var(--text-secondary); }

.insight {
  display: flex; gap: 0.5rem; align-items: flex-start; margin: 0;
  background: var(--accent-soft); color: var(--accent-soft-text);
  border-radius: var(--radius-md); padding: 0.5rem 0.75rem;
  font-size: 0.75rem; line-height: 1.4;
}
.insight svg { flex: none; margin-top: 1px; }
.note { opacity: 0.8; }

@media (max-width: 720px) {
  .body-grid { grid-template-columns: minmax(0, 1fr); gap: 0.875rem; }
  .pies { justify-content: center; }
}

@media (max-width: 440px) {
  .trow { grid-template-columns: minmax(0, 1fr) 4.5rem 4.5rem; gap: 0.375rem; font-size: 0.75rem; }
  .pie { width: 88px; }
}
</style>
