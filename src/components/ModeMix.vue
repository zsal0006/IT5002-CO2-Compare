<script setup>
import { computed, ref } from 'vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import { iconFor } from '@/lib/modeIcons'
import { isCarFree, plural } from '@/lib/community'
import { formatCo2 } from '@/lib/format'

/**
 * How people travel: the mode split, by CO₂ avoided or by number of trips.
 *
 * Those two measures rank differently on purpose, and the toggle is the point —
 * a mode chosen rarely for long journeys out-saves one chosen often for short
 * hops, which is the observation story 4.2 is after.
 *
 * Car-free and car-borne are told apart by green against blue, the same pairing
 * as the Compare page. That pair narrows under deuteranopia, so every row is
 * also named, every bar is directly labelled, and the legend prints both.
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
  const trips = used.value.reduce((n, r) => n + Number(r.trips), 0)
  const carFreeTrips = used.value
    .filter(isCarFree)
    .reduce((n, r) => n + Number(r.trips), 0)
  return { trips, carFreeTrips, carTrips: trips - carFreeTrips }
})

const valueOf = (row) =>
  measure.value === 'kg' ? Number(row.total_saved_kg) || 0 : Number(row.trips) || 0

const ranked = computed(() => {
  const list = [...used.value].sort((a, b) => valueOf(b) - valueOf(a))
  const max = Math.max(...list.map(valueOf), 0.0001)
  return list.map((r) => ({
    key: r.mode_key,
    name: r.mode_label,
    icon: iconFor(r.mode_key),
    carFree: isCarFree(r),
    width: `${Math.max((valueOf(r) / max) * 100, 1.5).toFixed(1)}%`,
    value:
      measure.value === 'kg'
        ? formatCo2(Number(r.total_saved_kg) || 0)
        : plural(r.trips, 'trip'),
    meta:
      measure.value === 'kg'
        ? plural(r.trips, 'trip')
        : formatCo2(Number(r.total_saved_kg) || 0)
  }))
})

const mix = computed(() => {
  const { trips, carFreeTrips, carTrips } = totals.value
  if (!trips) return []
  return [
    { key: 'free', width: `${((carFreeTrips / trips) * 100).toFixed(1)}%`, carFree: true },
    { key: 'car', width: `${((carTrips / trips) * 100).toFixed(1)}%`, carFree: false }
  ].filter((s) => parseFloat(s.width) > 0)
})

/**
 * One sentence naming what the chart shows, so the finding is stated rather
 * than left for the reader to infer from bar lengths.
 */
const insight = computed(() => {
  const savedTotal = used.value.reduce((n, r) => n + (Number(r.total_saved_kg) || 0), 0)
  if (!used.value.length) return 'No trips logged yet. The first one will appear here.'
  if (savedTotal <= 0) {
    return 'Every trip logged so far was by car, so none of them avoided any CO₂. One walk, ride or train journey changes that.'
  }
  const top = [...used.value].sort(
    (a, b) => (Number(b.total_saved_kg) || 0) - (Number(a.total_saved_kg) || 0)
  )[0]
  const share = Math.round(((Number(top.total_saved_kg) || 0) / savedTotal) * 100)
  const where = props.scopeLabel ? ` ${props.scopeLabel}` : ''
  return (
    `${top.mode_label} accounts for ${share}% of the CO₂ avoided${where}. ` +
    'Car trips are logged too — they count towards participation but save nothing.'
  )
})
</script>

<template>
  <section class="card mix" aria-labelledby="mode-heading">
    <header class="head">
      <div>
        <h2 id="mode-heading">How people travel</h2>
        <p class="sub">
          {{ measure === 'kg' ? 'CO₂ avoided versus driving, by mode' : 'Share of logged trips, by mode' }}
          <template v-if="scopeLabel"> · {{ scopeLabel }}</template>
        </p>
      </div>
      <SegmentedControl v-model="measure" :options="MEASURES" aria-label="Measure" />
    </header>

    <template v-if="ranked.length">
      <div class="mixbar" aria-hidden="true">
        <span
          v-for="s in mix"
          :key="s.key"
          class="seg"
          :class="{ free: s.carFree }"
          :style="{ width: s.width }"
        />
      </div>
      <p class="legend">
        <span class="key"><span class="swatch free" />Car-free</span>
        <span class="key"><span class="swatch" />By car or motorbike</span>
      </p>

      <ul class="rows">
        <li v-for="r in ranked" :key="r.key">
          <span class="icon" :class="{ free: r.carFree }" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
              <path :d="r.icon" />
            </svg>
          </span>

          <span class="body">
            <span class="line">
              <span class="name">{{ r.name }}</span>
              <span class="meta">{{ r.meta }}</span>
            </span>
            <span class="track">
              <span class="bar" :class="{ free: r.carFree }" :style="{ width: r.width }" />
            </span>
          </span>

          <span class="value">{{ r.value }}</span>
        </li>
      </ul>
    </template>

    <p class="insight">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V16h8v-1.3A7 7 0 0 0 12 2z" />
      </svg>
      <span>{{ insight }}</span>
    </p>
  </section>
</template>

<style scoped>
.mix { display: flex; flex-direction: column; gap: 1rem; padding: 1.375rem; }

.head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-end;
  gap: 0.625rem;
}
.head h2 { margin: 0; font-size: 1.25rem; }
.sub { margin: 0.125rem 0 0; font-size: 0.8125rem; color: var(--text-secondary); }

.mixbar { display: flex; height: 14px; border-radius: var(--radius-pill); overflow: hidden; background: var(--surface-2); }
.seg { display: block; height: 100%; background: var(--series-1); transition: width 0.8s cubic-bezier(0.2, 0.8, 0.2, 1); }
.seg.free { background: var(--accent); }

.legend { display: flex; flex-wrap: wrap; gap: 0.375rem 1rem; margin: 0; font-size: 0.75rem; color: var(--text-secondary); }
.key { display: inline-flex; align-items: center; gap: 0.375rem; }
.swatch { width: 10px; height: 10px; border-radius: 3px; background: var(--series-1); }
.swatch.free { background: var(--accent); }

.rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.rows li {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 84px;
  gap: 0.75rem;
  align-items: center;
  padding: 0.5rem 0;
  border-top: 1px solid var(--gridline);
}

.icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--series-1-soft);
  color: var(--series-1-soft-text);
}
.icon.free { background: var(--accent-soft); color: var(--accent-soft-text); }

.body { display: flex; flex-direction: column; gap: 0.375rem; min-width: 0; }
.line { display: flex; justify-content: space-between; gap: 0.5rem; font-size: 0.875rem; }
.name { font-weight: 600; }
.meta { color: var(--text-secondary); font-size: 0.75rem; }

.track { height: 8px; border-radius: var(--radius-pill); background: var(--surface-2); display: block; overflow: hidden; }
.bar {
  display: block;
  height: 100%;
  border-radius: var(--radius-pill);
  background: var(--series-1);
  transition: width 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.bar.free { background: var(--accent); }

.value { font-size: 0.875rem; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }

.insight {
  display: flex;
  gap: 0.625rem;
  align-items: flex-start;
  margin: 0;
  background: var(--accent-soft);
  color: var(--accent-soft-text);
  border-radius: var(--radius-md);
  padding: 0.75rem 0.875rem;
  font-size: 0.8125rem;
  line-height: 1.45;
}
.insight svg { flex: none; margin-top: 1px; }

@media (max-width: 440px) {
  .rows li { grid-template-columns: 32px minmax(0, 1fr) 68px; gap: 0.5rem; }
  .icon { width: 32px; height: 32px; }
}
</style>
