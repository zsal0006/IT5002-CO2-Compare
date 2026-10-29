<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import StatTile from '@/components/StatTile.vue'
import EmissionsTimeSeries from '@/components/EmissionsTimeSeries.vue'
import WorldEmissionsMap from '@/components/WorldEmissionsMap.vue'
import { useCountriesStore } from '@/stores/countries'
import { formatNumber, formatPercent } from '@/lib/format'

/** E5 — national transport emissions: the scale of the problem, by country. */
const countries = useCountriesStore()

const selected = ref('GBR')

onMounted(async () => {
  await Promise.all([countries.loadList(), countries.loadSnapshot()])
  await countries.loadSeries(selected.value)
})

watch(selected, (code) => countries.loadSeries(code))

const selectedName = computed(
  () => countries.list.find((c) => c.country_code === selected.value)?.country_name ?? selected.value
)

const series = computed(() => {
  const rows = countries.series[selected.value]
  if (!rows?.length) return []
  return [{ code: selected.value, name: selectedName.value, rows }]
})

const latest = computed(() => countries.latest(selected.value))
</script>

<template>
  <section class="container">
    <header class="intro">
      <h1>Transport emissions by country</h1>
      <p>
        Transport is one of the largest and fastest-growing sources of greenhouse gas
        emissions. Pick a country — or a country on the map — to see how much of its
        total it accounts for, and how that has moved since 1970.
      </p>
    </header>

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

    <!-- E5.1 -->
    <div class="tiles">
      <StatTile
        label="Transport emissions"
        :value="latest ? `${formatNumber(latest.transport_mt_co2e, 1)} Mt` : '—'"
        :context="latest ? `CO₂e in ${latest.year}` : 'No data for this country'"
      />
      <StatTile
        label="Share of total emissions"
        :value="latest?.transport_share_pct != null ? formatPercent(latest.transport_share_pct) : '—'"
        :context="latest ? `of all emissions in ${latest.year}` : 'Total emissions not reported'"
      />
    </div>

    <!-- E5.3 -->
    <div class="card">
      <WorldEmissionsMap
        :rows="countries.snapshot"
        :year="countries.snapshotYear"
        :selected="selected"
        @select="selected = $event"
      />
    </div>

    <!-- E5.2 -->
    <div class="card">
      <EmissionsTimeSeries
        v-if="series.length"
        :series="series"
        :title="`Transport emissions — ${selectedName}`"
      />
      <p v-else-if="countries.loadingSeries" class="muted">Loading…</p>
      <p v-else class="muted">No time series available for this country.</p>
    </div>

    <p class="muted footnote">
      Source: GIZ / transport-data.org, country-level yearly GHG emissions from the
      transport sector, 1970–2024, CC BY 4.0. Country boundaries from Natural Earth
      (public domain). Full detail on
      <RouterLink to="/learn">how we calculate this</RouterLink>.
    </p>
  </section>
</template>

<style scoped>
.intro { margin: 1.5rem 0; max-width: 65ch; }
.filters { display: flex; gap: 1rem; align-items: end; flex-wrap: wrap; margin-bottom: 1.25rem; }
.filters .field { min-width: 14rem; margin: 0; }

.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem; }
.card { margin-bottom: 1.25rem; }
.footnote { margin: 1.5rem 0 3rem; }
</style>
