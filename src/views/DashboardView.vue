<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import StatTile from '@/components/StatTile.vue'
import EmissionsTimeSeries from '@/components/EmissionsTimeSeries.vue'
import { useCountriesStore } from '@/stores/countries'
import { useStatsStore } from '@/stores/stats'
import { formatCo2, formatNumber, formatPercent, countryName } from '@/lib/format'
import { toAlpha2 } from '@/lib/iso'

const countries = useCountriesStore()
const stats = useStatsStore()

const selected = ref('GBR')

onMounted(async () => {
  await Promise.all([countries.loadList(), stats.load()])
  await countries.loadSeries(selected.value)
})

watch(selected, (code) => countries.loadSeries(code))

const series = computed(() => {
  const rows = countries.series[selected.value]
  if (!rows?.length) return []
  const name = countries.list.find((c) => c.country_code === selected.value)?.country_name ?? selected.value
  return [{ code: selected.value, name, rows }]
})

const latest = computed(() => countries.latest(selected.value))

// The emissions dataset keys on alpha-3; trip logs key on alpha-2.
const selectedAlpha2 = computed(() => toAlpha2(selected.value))
const selectedName = computed(
  () => countries.list.find((c) => c.country_code === selected.value)?.country_name ?? selected.value
)

/** Savings leaderboard, highest first, unknown-location rows last. */
const leaderboard = computed(() =>
  [...stats.byCountry]
    .sort((a, b) => Number(b.total_saved_kg) - Number(a.total_saved_kg))
    .slice(0, 10)
)
</script>

<template>
  <section class="container">
    <header class="intro">
      <h1>Emissions dashboard</h1>
      <p>
        Transport is one of the largest and fastest-growing sources of greenhouse gas
        emissions. Pick a country to see its transport-sector emissions since 1970,
        alongside what people using this tool have avoided.
      </p>
    </header>

    <!-- Filters sit in one row above the charts. -->
    <div class="filters card">
      <div class="field">
        <label for="country">Country</label>
        <select id="country" v-model="selected" :disabled="!countries.list.length">
          <option v-for="c in countries.list" :key="c.country_code" :value="c.country_code">
            {{ c.country_name }}
          </option>
        </select>
      </div>
      <p v-if="countries.error" class="notice error">{{ countries.error }}</p>
    </div>

    <!-- ------------------------------------------------- national emissions -->
    <div class="tiles">
      <StatTile
        label="Transport emissions"
        :value="latest ? `${formatNumber(latest.transport_mt_co2e, 1)} Mt` : '—'"
        :context="latest ? `CO₂e in ${latest.year}` : 'No data for this country'"
      />
      <StatTile
        label="Share of national total"
        :value="latest?.transport_share_pct != null ? formatPercent(latest.transport_share_pct) : '—'"
        :context="latest ? `of all emissions in ${latest.year}` : 'Total emissions not reported'"
      />
      <StatTile
        tone="good"
        label="Avoided here by users"
        :value="formatCo2(stats.forCountry(selectedAlpha2)?.total_saved_kg ?? 0)"
        :context="`${stats.forCountry(selectedAlpha2)?.trips ?? 0} trips logged`"
      />
    </div>

    <div class="card chart-card">
      <EmissionsTimeSeries
        v-if="series.length"
        :series="series"
        :title="`Transport emissions — ${selectedName}`"
      />
      <p v-else-if="countries.loadingSeries" class="muted">Loading…</p>
      <p v-else class="muted">No time series available for this country.</p>
    </div>

    <!-- ------------------------------------------------------- user savings -->
    <h2>What users have avoided</h2>
    <div class="tiles">
      <StatTile
        tone="good"
        label="Avoided worldwide"
        :value="formatCo2(stats.global?.total_saved_kg ?? 0)"
        context="Versus making the same journeys by car"
      />
      <StatTile
        label="Trips logged"
        :value="formatNumber(stats.global?.trips ?? 0, 0)"
        :context="`Across ${stats.global?.countries ?? 0} countries`"
      />
      <StatTile
        label="Distance logged"
        :value="`${formatNumber(stats.global?.total_distance_km ?? 0, 0)} km`"
        context="Total travelled by all logged trips"
      />
    </div>

    <div class="card">
      <h3>Avoided emissions by country</h3>
      <p class="muted">Top ten by CO₂e avoided versus driving.</p>
      <table class="data">
        <caption class="visually-hidden">CO₂e avoided by country</caption>
        <thead>
          <tr>
            <th scope="col">Country</th>
            <th scope="col" class="num">Trips</th>
            <th scope="col" class="num">Distance (km)</th>
            <th scope="col" class="num">Avoided (kg CO₂e)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in leaderboard" :key="row.country_code">
            <th scope="row">{{ countryName(row.country_code) }}</th>
            <td class="num">{{ formatNumber(row.trips, 0) }}</td>
            <td class="num">{{ formatNumber(row.total_distance_km, 0) }}</td>
            <td class="num">{{ formatNumber(row.total_saved_kg, 1) }}</td>
          </tr>
          <tr v-if="!leaderboard.length">
            <td colspan="4" class="muted">No trips logged yet. Be the first.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="muted footnote">
      National emissions: GIZ / transport-data.org, 1970–2024, CC BY 4.0. Avoided
      emissions are self-reported and unverified — they show engagement with the tool,
      not audited reductions.
    </p>
  </section>
</template>

<style scoped>
.intro { margin: 1.5rem 0; max-width: 65ch; }
.filters { display: flex; gap: 1rem; align-items: end; flex-wrap: wrap; margin-bottom: 1.25rem; }
.filters .field { min-width: 14rem; margin: 0; }

.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem; }
.chart-card { margin-bottom: 2rem; }
h2 { margin-top: 2rem; }
.footnote { margin: 1.5rem 0 3rem; }
</style>
