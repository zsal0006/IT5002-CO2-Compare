<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import ImpactHero from '@/components/impact/ImpactHero.vue'
import ModeMix from '@/components/impact/ModeMix.vue'
import RegionBoard from '@/components/impact/RegionBoard.vue'
import { useStatsStore } from '@/stores/stats'
import { useTripStore } from '@/stores/trip'
import { summariseModes, plural } from '@/lib/community'
import { formatCo2, countryName } from '@/lib/format'
import { MODE_KEYS } from '@/lib/emissions'

/**
 * E4 — what everyone has avoided together, globally or in one region.
 *
 * Every figure here comes from a database view. The client never touches
 * `trip_logs`, which has RLS with no policy: the aggregates are public, the
 * rows behind them are not. Submitted trips are self-reported and can be
 * repeated, even though direct access to the underlying rows is restricted.
 */
const stats = useStatsStore()
const trip = useTripStore()

const scope = ref('global')
const regionKey = ref(null)
const showRegions = ref(false)

onMounted(() => stats.load())

const keyOf = (r) => `${r.country_code}|${r.region_name}`

/** Default to the leading region so switching scope never lands on nothing. */
watch(
  () => stats.byRegion,
  (rows) => {
    if (!rows.length) return
    if (!regionKey.value || !rows.some((r) => keyOf(r) === regionKey.value)) {
      regionKey.value = keyOf(rows[0])
    }
  },
  { immediate: true }
)
watch(() => stats.warning, (warning) => {
  if (warning) scope.value = 'global'
})

const selectedRegion = computed(
  () => stats.byRegion.find((r) => keyOf(r) === regionKey.value) ?? null
)

/** The mode rows for whichever scope is showing. */
const modeRows = computed(() => {
  const rows = scope.value === 'global'
    ? stats.byMode
    : selectedRegion.value
      ? stats.modesInRegion(selectedRegion.value.country_code, selectedRegion.value.region_name)
      : []
  return rows.filter((row) => MODE_KEYS.includes(row.mode_key))
})

/**
 * Totals for the current scope.
 *
 * Global figures come from `v_savings_global` rather than being re-summed from
 * the mode rows — it is the view the database maintains, and re-deriving it
 * would create a second answer that could disagree with the first. Only the
 * car-free split, which no view carries, is computed from the mode rows.
 */
const summary = computed(() => {
  const fromModes = summariseModes(modeRows.value)
  if (scope.value === 'region') {
    return {
      ...fromModes,
      trips: Number(selectedRegion.value?.trips) || 0,
      savedKg: Number(selectedRegion.value?.total_saved_kg) || 0
    }
  }

  return {
    trips: Number(stats.global?.trips) || 0,
    savedKg: Number(stats.global?.total_saved_kg) || 0,
    carFreeTrips: fromModes.carFreeTrips,
    carFreeKm: fromModes.carFreeKm
  }
})

const modeBreakdownComplete = computed(() => summariseModes(modeRows.value).trips === summary.value.trips)

const scopeLabel = computed(() =>
  scope.value === 'global' ? 'worldwide' : selectedRegion.value?.region_name ?? ''
)

const carFreePct = computed(() =>
  summary.value.trips > 0
    ? Math.round((summary.value.carFreeTrips / summary.value.trips) * 100)
    : 0
)

const averageKg = computed(() =>
  summary.value.trips > 0 ? summary.value.savedKg / summary.value.trips : 0
)

const reach = computed(() => {
  if (scope.value === 'global') {
    const countries = Number(stats.global?.countries) || 0
    return {
      figure: String(countries),
      detail: `${plural(countries, 'country', 'countries')} · ${plural(stats.byRegion.length, 'region')} taking part`
    }
  }
  const r = selectedRegion.value
  return {
    figure: r ? countryName(r.country_code) : '—',
    detail: r ? `${plural(summary.value.trips, 'trip')} logged here` : ''
  }
})

function focusRegion(key) {
  regionKey.value = key
  scope.value = 'region'
}
</script>

<template>
  <section class="container page">
    <header class="intro">
      <div>
        <h1>Community impact</h1>
        <p>
          Every logged trip adds the CO₂e it avoided versus driving to a regional and a
          global total.
        </p>
      </div>
      <p class="anon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        Trip logs include distance, mode, region and timestamp, but not addresses
      </p>
    </header>

    <p v-if="trip.lastLog" class="notice success" role="status">
      Trip logged: {{ formatCo2(trip.lastLog.savedKg) }} CO₂e avoided versus driving.
    </p>
    <p v-if="stats.error" class="notice error">{{ stats.error }}</p>
    <p v-else-if="stats.loading && !stats.global" class="muted">Loading community totals…</p>

    <template v-else-if="stats.global">
      <p v-if="stats.warning" class="notice">{{ stats.warning }}</p>
      <p v-if="!modeBreakdownComplete" class="notice">
        Some logged trips are missing from the available mode breakdown, which covers supported modes only.
      </p>
      <ImpactHero :scope="scope" :region-key="regionKey" :regions="stats.byRegion" :summary="summary"
        :countries="Number(stats.global.countries) || 0" :region-available="!stats.warning"
        :mode-breakdown-complete="modeBreakdownComplete"
        @update:scope="scope = $event" @update:region-key="regionKey = $event" />

      <!-- E4 key figures. "This session" is the only one that is not a
           community total, so it says so and links back to where it changes. -->
      <div class="kpis">
        <div class="card kpi">
          <span class="kpi-label">This session</span>
          <span class="kpi-value">{{ formatCo2(trip.sessionSavedKg) }}</span>
          <span class="kpi-sub">
            {{ trip.sessionTrips ? `${plural(trip.sessionTrips, 'trip')} logged in this session` : 'No recorded trips for this session' }}
          </span>
          <RouterLink to="/" class="kpi-link">Log a trip on Compare →</RouterLink>
        </div>

        <div class="card kpi">
          <span class="kpi-label">Car-free trips</span>
          <span class="kpi-value accent">{{ modeBreakdownComplete ? `${carFreePct}%` : 'Unavailable' }}</span>
          <span v-if="modeBreakdownComplete" class="kpi-sub">
            {{ summary.carFreeTrips }} of {{ plural(summary.trips, 'trip') }} left the car at home
          </span>
          <span v-else class="kpi-sub">Not available for all logged modes.</span>
          <span v-if="modeBreakdownComplete" class="kpi-track">
            <span class="kpi-fill" :style="{ width: `${carFreePct}%` }" />
          </span>
        </div>

        <div class="card kpi">
          <span class="kpi-label">Average per trip</span>
          <span class="kpi-value">{{ formatCo2(averageKg) }}</span>
          <span class="kpi-sub">CO₂e avoided per average trip</span>
        </div>

        <div class="card kpi">
          <span class="kpi-label">Reach</span>
          <span class="kpi-value">{{ reach.figure }}</span>
          <span class="kpi-sub">{{ reach.detail }}</span>
        </div>
      </div>

      <div class="panels">
        <ModeMix :rows="modeRows" :scope-label="scopeLabel" />

        <div class="regions">
          <button type="button" class="regions-toggle" :aria-expanded="String(showRegions)"
            aria-controls="regions-panel" @click="showRegions = !showRegions">
            <span>Regions <span class="count">{{ stats.byRegion.length }}</span></span>
            <span aria-hidden="true">{{ showRegions ? 'Hide ▴' : 'Show ▾' }}</span>
          </button>
          <RegionBoard v-if="showRegions" id="regions-panel" :regions="stats.byRegion"
            :selected="scope === 'region' ? regionKey : null" :selectable="!stats.warning" @select="focusRegion" />
        </div>
      </div>

      <p class="muted caveat">
        Totals are self-reported estimates. They show how people are using this tool, not
        verified emissions reductions. Community totals are rounded to the nearest 10 g.
      </p>
    </template>
  </section>
</template>

<style scoped>
.page {
  padding: 2rem 0 3.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.intro {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-end;
  gap: 0.75rem 1.5rem;
}

.intro h1 {
  margin: 0;
  font-size: clamp(1.75rem, 4vw, 2.125rem);
}

.intro>div {
  max-width: 640px;
}

.intro p {
  margin: 0.5rem 0 0;
}

.anon {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-pill);
  background: var(--surface-1);
  border: 1px solid var(--border);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.625rem;
}

@media (max-width: 900px) {
  .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

.kpi {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: 0.75rem 0.875rem;
}

.kpi-label {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.kpi-value {
  font-family: var(--font-display);
  font-size: 1.375rem;
  font-weight: 600;
  line-height: 1.1;
}

.kpi-value.accent {
  color: var(--accent);
}

.kpi-sub {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.kpi-link {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-decoration: none;
}

.kpi-track {
  margin-top: 0.375rem;
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--series-1-soft);
  overflow: hidden;
  display: block;
}

.kpi-fill {
  display: block;
  height: 100%;
  background: var(--accent);
  transition: width 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.panels {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.regions { display: flex; flex-direction: column; gap: 0.75rem; }

.regions-toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-1);
  color: var(--text-primary);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
}

.regions-toggle .count {
  margin-left: 0.375rem;
  padding: 0.0625rem 0.5rem;
  border-radius: var(--radius-pill);
  background: var(--accent-soft);
  color: var(--accent-soft-text);
  font-size: 0.75rem;
}

.caveat {
  margin: 0;
  max-width: 760px;
}
</style>
