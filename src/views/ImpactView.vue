<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import ImpactHero from '@/components/ImpactHero.vue'
import ModeMix from '@/components/ModeMix.vue'
import RegionBoard from '@/components/RegionBoard.vue'
import { useStatsStore } from '@/stores/stats'
import { useTripStore } from '@/stores/trip'
import { summariseModes, plural } from '@/lib/community'
import { formatCo2, countryName } from '@/lib/format'

/**
 * E4 — what everyone has avoided together, globally or in one region.
 *
 * Every figure here comes from a database view. The client never touches
 * `trip_logs`, which has RLS with no policy: the aggregates are public, the
 * rows behind them are not. That is the whole privacy design, and it is also
 * what stops the leaderboard being forged by anyone holding the anon key.
 */
const stats = useStatsStore()
const trip = useTripStore()

const scope = ref('global')
const regionKey = ref(null)

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

const selectedRegion = computed(
  () => stats.byRegion.find((r) => keyOf(r) === regionKey.value) ?? null
)

/** The mode rows for whichever scope is showing. */
const modeRows = computed(() => {
  if (scope.value === 'global') return stats.byMode
  const r = selectedRegion.value
  return r ? stats.modesInRegion(r.country_code, r.region_name) : []
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
  if (scope.value === 'region') return fromModes

  return {
    trips: Number(stats.global?.trips) || 0,
    savedKg: Number(stats.global?.total_saved_kg) || 0,
    carFreeTrips: fromModes.carFreeTrips,
    carFreeKm: fromModes.carFreeKm
  }
})

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
          Every logged trip adds the CO₂ it avoided versus driving to a regional and a
          global total.
        </p>
      </div>
      <p class="anon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        Anonymous: a trip is only a distance, a mode and a region
      </p>
    </header>

    <p v-if="stats.error" class="notice error">{{ stats.error }}</p>
    <p v-else-if="stats.loading && !stats.global" class="muted">Loading community totals…</p>

    <template v-else-if="stats.global">
      <ImpactHero
        :scope="scope"
        :region-key="regionKey"
        :regions="stats.byRegion"
        :summary="summary"
        :countries="Number(stats.global.countries) || 0"
        @update:scope="scope = $event"
        @update:region-key="regionKey = $event"
      />

      <!-- E4 key figures. "This session" is the only one that is not a
           community total, so it says so and links back to where it changes. -->
      <div class="kpis">
        <div class="card kpi">
          <span class="kpi-label">This session</span>
          <span class="kpi-value">{{ formatCo2(trip.sessionSavedKg) }}</span>
          <span class="kpi-sub">
            {{ trip.sessionSavedKg > 0 ? 'Avoided in this tab' : 'Nothing logged in this tab yet.' }}
          </span>
          <RouterLink to="/" class="kpi-link">Log a trip on Compare →</RouterLink>
        </div>

        <div class="card kpi">
          <span class="kpi-label">Car-free trips</span>
          <span class="kpi-value accent">{{ carFreePct }}%</span>
          <span class="kpi-sub">
            {{ summary.carFreeTrips }} of {{ plural(summary.trips, 'trip') }} left the car at home
          </span>
          <span class="kpi-track">
            <span class="kpi-fill" :style="{ width: `${carFreePct}%` }" />
          </span>
        </div>

        <div class="card kpi">
          <span class="kpi-label">Average per trip</span>
          <span class="kpi-value">{{ formatCo2(averageKg) }}</span>
          <span class="kpi-sub">CO₂e avoided per logged trip</span>
        </div>

        <div class="card kpi">
          <span class="kpi-label">Reach</span>
          <span class="kpi-value">{{ reach.figure }}</span>
          <span class="kpi-sub">{{ reach.detail }}</span>
        </div>
      </div>

      <div class="panels">
        <ModeMix :rows="modeRows" :scope-label="scopeLabel" />
        <RegionBoard
          :regions="stats.byRegion"
          :selected="scope === 'region' ? regionKey : null"
          @select="focusRegion"
        />
      </div>

      <p class="muted caveat">
        Totals are self-reported estimates. They show how people are using this tool, not
        audited emissions reductions. Equivalents use the same factors as Compare — see
        <RouterLink to="/learn">how we calculate this</RouterLink>.
      </p>
    </template>
  </section>
</template>

<style scoped>
.page { padding: 2rem 0 3.5rem; display: flex; flex-direction: column; gap: 1.25rem; }

.intro {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-end;
  gap: 0.75rem 1.5rem;
}
.intro h1 { margin: 0; font-size: clamp(1.75rem, 4vw, 2.125rem); }
.intro > div { max-width: 640px; }
.intro p { margin: 0.5rem 0 0; }

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

.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75rem; }

.kpi { display: flex; flex-direction: column; gap: 0.25rem; padding: 1.125rem; }
.kpi-label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-secondary);
}
.kpi-value {
  font-family: var(--font-display);
  font-size: 1.875rem;
  font-weight: 600;
  line-height: 1.1;
}
.kpi-value.accent { color: var(--accent); }
.kpi-sub { font-size: 0.8125rem; color: var(--text-secondary); }
.kpi-link { margin-top: 0.375rem; font-size: 0.8125rem; font-weight: 600; text-decoration: none; }

.kpi-track {
  margin-top: 0.5rem;
  height: 8px;
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

.panels { display: flex; flex-wrap: wrap; gap: 1.25rem; align-items: flex-start; }
.panels > * { flex: 1 1 440px; min-width: 0; }

.caveat { margin: 0; max-width: 760px; }
</style>
