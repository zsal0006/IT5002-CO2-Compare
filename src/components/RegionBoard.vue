<script setup>
import { computed, ref } from 'vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import { plural } from '@/lib/community'
import { formatCo2, formatNumber, countryName } from '@/lib/format'

/**
 * The regional leaderboard (E4.1), ranked by kilograms or by trips.
 *
 * Each row is a button that focuses the whole page on that region, so the
 * ranking and the scope control are the same decision expressed twice rather
 * than two controls that can disagree.
 *
 * The data table behind the disclosure is not an accessibility afterthought:
 * the bars are relative to the leader, so only the table carries the figures in
 * a form that can be read exactly, sorted or copied.
 */
const props = defineProps({
  /** Rows from v_savings_by_region. */
  regions: { type: Array, required: true },
  /** `${country_code}|${region_name}` of the focused region, if any. */
  selected: { type: String, default: null }
})
defineEmits(['select'])

const SORTS = [
  { value: 'kg', label: 'Most saved' },
  { value: 'trips', label: 'Most trips' }
]
const sort = ref('kg')

const keyOf = (r) => `${r.country_code}|${r.region_name}`
const valueOf = (r) =>
  sort.value === 'kg' ? Number(r.total_saved_kg) || 0 : Number(r.trips) || 0

const ranked = computed(() => {
  const list = [...props.regions].sort(
    (a, b) =>
      valueOf(b) - valueOf(a) ||
      (Number(b.total_saved_kg) || 0) - (Number(a.total_saved_kg) || 0)
  )
  const max = Math.max(...list.map(valueOf), 0.0001)

  return list.map((r, i) => ({
    key: keyOf(r),
    rank: i + 1,
    name: r.region_name,
    country: countryName(r.country_code),
    trips: Number(r.trips) || 0,
    savedKg: Number(r.total_saved_kg) || 0,
    distanceKm: Number(r.total_distance_km) || 0,
    width: `${Math.max((valueOf(r) / max) * 100, 1.5).toFixed(1)}%`,
    value:
      sort.value === 'kg'
        ? formatCo2(Number(r.total_saved_kg) || 0)
        : plural(r.trips, 'trip')
  }))
})
</script>

<template>
  <section class="card board" aria-labelledby="region-heading">
    <header class="head">
      <div>
        <h2 id="region-heading">Regions</h2>
        <p class="sub">Select a region to focus the page on it.</p>
      </div>
      <SegmentedControl v-model="sort" :options="SORTS" aria-label="Sort by" />
    </header>

    <ul v-if="ranked.length" class="rows">
      <li v-for="r in ranked" :key="r.key">
        <button
          type="button"
          class="row"
          :class="{ on: r.key === selected }"
          :aria-pressed="String(r.key === selected)"
          @click="$emit('select', r.key)"
        >
          <span class="rank" :class="{ lead: r.rank === 1 }">{{ r.rank }}</span>

          <span class="body">
            <span class="line">
              <span class="name">{{ r.name }}</span>
              <span class="meta">{{ r.country }} · {{ plural(r.trips, 'trip') }}</span>
            </span>
            <span class="track"><span class="bar" :style="{ width: r.width }" /></span>
          </span>

          <span class="value">{{ r.value }}</span>
        </button>
      </li>
    </ul>

    <p v-else class="muted empty">
      No regions yet. The first logged trip creates one.
    </p>

    <details v-if="ranked.length">
      <summary>Show the data table</summary>
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th scope="col">Region</th>
              <th scope="col">Country</th>
              <th scope="col" class="num">Trips</th>
              <th scope="col" class="num">Distance (km)</th>
              <th scope="col" class="num">Saved (kg CO₂e)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in ranked" :key="r.key">
              <td>{{ r.name }}</td>
              <td>{{ r.country }}</td>
              <td class="num">{{ r.trips }}</td>
              <td class="num">{{ formatNumber(r.distanceKm, 1) }}</td>
              <td class="num">{{ formatNumber(r.savedKg, 2) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  </section>
</template>

<style scoped>
.board { display: flex; flex-direction: column; gap: 0.875rem; padding: 1.375rem; }

.head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-end;
  gap: 0.625rem;
}
.head h2 { margin: 0; font-size: 1.25rem; }
.sub { margin: 0.125rem 0 0; font-size: 0.8125rem; color: var(--text-secondary); }

.rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; }

.row {
  width: 100%;
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) 76px;
  gap: 0.75rem;
  align-items: center;
  padding: 0.625rem;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-primary);
  text-align: left;
  font: inherit;
  font-weight: 400;
}
.row:hover { background: var(--page); }
.row.on { border-color: var(--accent); background: var(--accent-soft); }

.rank {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--surface-2);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8125rem;
  font-weight: 700;
}
.rank.lead { background: var(--accent); color: #ffffff; }

.body { display: flex; flex-direction: column; gap: 0.375rem; min-width: 0; }
.line { display: flex; justify-content: space-between; gap: 0.5rem; }
.name { font-size: 0.875rem; font-weight: 600; }
.meta { font-size: 0.75rem; color: var(--text-secondary); }

.track { height: 8px; border-radius: var(--radius-pill); background: var(--surface-2); display: block; overflow: hidden; }
.bar {
  display: block;
  height: 100%;
  border-radius: var(--radius-pill);
  background: var(--accent);
  transition: width 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.value { font-size: 0.875rem; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }

details { font-size: 0.8125rem; }
summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--accent);
  min-height: 32px;
  display: flex;
  align-items: center;
}
.table-wrap {
  overflow-x: auto;
  margin-top: 0.625rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.table-wrap table { min-width: 420px; }
.table-wrap thead tr { background: var(--page); }

.empty { margin: 0; }

@media (max-width: 440px) {
  .row { grid-template-columns: 28px minmax(0, 1fr) 68px; gap: 0.5rem; }
}
</style>
