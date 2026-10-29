<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import StatTile from '@/components/StatTile.vue'
import BarList from '@/components/BarList.vue'
import { useStatsStore } from '@/stores/stats'
import { useTripStore } from '@/stores/trip'
import { formatCo2, formatNumber, countryName } from '@/lib/format'

/** E4 — community impact: what everyone has avoided, by region and by mode. */
const stats = useStatsStore()
const trip = useTripStore()

// "<region>, <country>" — one selector, as in the wireframe.
const selectedKey = ref(null)

onMounted(async () => {
  await stats.load({ force: true })
  if (!selectedKey.value) selectedKey.value = defaultKey()
})

function keyFor(row) {
  return `${row.country_code}|${row.region_name}`
}

/** Prefer the region the user's last trip started in, else the biggest saver. */
function defaultKey() {
  const origin = trip.origin
  if (origin) {
    const mine = stats.forRegion(origin.countryCode, origin.region)
    if (mine) return keyFor(mine)
  }
  return stats.byRegion.length ? keyFor(stats.byRegion[0]) : null
}

watch(
  () => stats.byRegion,
  (rows) => {
    if (!selectedKey.value && rows.length) selectedKey.value = defaultKey()
  }
)

const regionOptions = computed(() =>
  stats.byRegion.map((row) => ({
    key: keyFor(row),
    label: `${row.region_name}, ${countryName(row.country_code)}`
  }))
)

const selectedRegion = computed(
  () => stats.byRegion.find((row) => keyFor(row) === selectedKey.value) ?? null
)

/**
 * E4.2 — savings by mode, measured in kg avoided rather than trip count. A mode
 * picked rarely for long journeys can out-save one picked often for short hops,
 * so counting trips would tell the wrong story.
 */
const modeItems = computed(() =>
  stats.byMode
    .filter((row) => Number(row.total_saved_kg) > 0 || Number(row.trips) > 0)
    .map((row) => ({
      key: row.mode_key,
      label: row.mode_label,
      value: Number(row.total_saved_kg),
      valueLabel: formatCo2(Number(row.total_saved_kg)),
      chips: [{ text: `${formatNumber(row.trips, 0)} trips` }]
    }))
)
</script>

<template>
  <section class="container">
    <header class="intro">
      <h1>Community impact</h1>
      <p>
        Every logged trip adds the CO₂ it avoided versus driving to a regional and a
        global total. Nothing here identifies anybody — a trip contributes a distance,
        a transport mode and a region, and nothing else.
      </p>
    </header>

    <!-- E4.1: this session, your region, global. -->
    <div class="tiles">
      <StatTile
        tone="good"
        label="This session"
        :value="formatCo2(trip.sessionSavedKg)"
        context="Logged in this browser tab; cleared when you close it"
      />
      <StatTile
        label="Your region"
        :value="formatCo2(selectedRegion?.total_saved_kg ?? 0)"
        :context="
          selectedRegion
            ? `${selectedRegion.region_name} · ${formatNumber(selectedRegion.trips, 0)} trips`
            : 'No trips logged here yet'
        "
      />
      <StatTile
        label="Global"
        :value="formatCo2(stats.global?.total_saved_kg ?? 0)"
        :context="`${formatNumber(stats.global?.trips ?? 0, 0)} trips in ${
          stats.global?.countries ?? 0
        } countries`"
      />
    </div>

    <div class="card">
      <div class="field">
        <label for="region">Select region</label>
        <select id="region" v-model="selectedKey" :disabled="!regionOptions.length">
          <option v-for="opt in regionOptions" :key="opt.key" :value="opt.key">
            {{ opt.label }}
          </option>
        </select>
        <p v-if="!regionOptions.length" class="muted">
          No regions yet — log a trip on the Compare page and this fills in.
        </p>
      </div>
    </div>

    <!-- E4.2 -->
    <div class="card">
      <figure class="mode-chart">
        <figcaption>
          <h2>CO₂ saved by mode</h2>
          <p class="muted">
            Total avoided versus driving, worldwide, for each mode people have logged.
          </p>
        </figcaption>

        <BarList v-if="modeItems.length" :items="modeItems" />
        <p v-else class="muted">Nothing logged yet.</p>
      </figure>

      <details v-if="modeItems.length" class="table-view">
        <summary>Show the data table</summary>
        <table class="data">
          <caption class="visually-hidden">CO₂ saved by transport mode</caption>
          <thead>
            <tr>
              <th scope="col">Mode</th>
              <th scope="col" class="num">Trips</th>
              <th scope="col" class="num">Distance (km)</th>
              <th scope="col" class="num">Saved (kg CO₂e)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in stats.byMode" :key="row.mode_key">
              <th scope="row">{{ row.mode_label }}</th>
              <td class="num">{{ formatNumber(row.trips, 0) }}</td>
              <td class="num">{{ formatNumber(row.total_distance_km, 0) }}</td>
              <td class="num">{{ formatNumber(row.total_saved_kg, 1) }}</td>
            </tr>
          </tbody>
        </table>
      </details>
    </div>

    <div class="card">
      <h2>Regions</h2>
      <table class="data">
        <caption class="visually-hidden">CO₂ saved by region</caption>
        <thead>
          <tr>
            <th scope="col">Region</th>
            <th scope="col">Country</th>
            <th scope="col" class="num">Trips</th>
            <th scope="col" class="num">Saved (kg CO₂e)</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in stats.byRegion"
            :key="keyFor(row)"
            :class="{ on: keyFor(row) === selectedKey }"
          >
            <th scope="row">{{ row.region_name }}</th>
            <td>{{ countryName(row.country_code) }}</td>
            <td class="num">{{ formatNumber(row.trips, 0) }}</td>
            <td class="num">{{ formatNumber(row.total_saved_kg, 1) }}</td>
          </tr>
          <tr v-if="!stats.byRegion.length">
            <td colspan="4" class="muted">No trips logged yet. Be the first.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="stats.error" class="notice error">{{ stats.error }}</p>
    <p class="muted footnote">
      Totals are self-reported estimates. They show how people are using this tool, not
      audited emissions reductions. See
      <RouterLink to="/learn">how we calculate this</RouterLink>.
    </p>
  </section>
</template>

<style scoped>
.intro { margin: 1.5rem 0; max-width: 65ch; }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem; }
.card { margin-bottom: 1.25rem; }
.card .field { margin: 0; max-width: 24rem; }

.mode-chart { margin: 0; }
.mode-chart figcaption h2 { margin-bottom: 0.15rem; }
.mode-chart figcaption p { margin-bottom: 1rem; }

.table-view { margin-top: 1rem; }
.table-view summary { cursor: pointer; font-size: 0.85rem; color: var(--text-secondary); }
.table-view table { margin-top: 0.75rem; }

tr.on th, tr.on td { background: color-mix(in srgb, var(--series-1) 8%, transparent); }

.footnote { margin: 1.5rem 0 3rem; }
</style>
