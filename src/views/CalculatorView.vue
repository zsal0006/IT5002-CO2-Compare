<script setup>
import { onMounted, ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import LocationInput from '@/components/LocationInput.vue'
import ComparisonChart from '@/components/ComparisonChart.vue'
import ComparisonTable from '@/components/ComparisonTable.vue'
import ModeSelector from '@/components/ModeSelector.vue'
import StatTile from '@/components/StatTile.vue'
import { useTripStore } from '@/stores/trip'
import { useFactorsStore } from '@/stores/factors'
import { useStatsStore } from '@/stores/stats'
import { formatCo2, formatKm, countryName } from '@/lib/format'
import { DETOUR_FACTOR } from '@/lib/routing'

const trip = useTripStore()
const factorsStore = useFactorsStore()
const stats = useStatsStore()

const { origin, destination, returnTrip, carMode } = storeToRefs(trip)
const chosenMode = ref(null)

onMounted(() => {
  factorsStore.load()
  stats.load()
})

const carOptions = computed(() =>
  factorsStore.factors.filter((f) => f.category === 'car')
)

async function onCalculate() {
  chosenMode.value = null
  await trip.calculate()
}

async function onLog() {
  if (!chosenMode.value) return
  const result = await trip.logTrip(chosenMode.value)
  if (result) await stats.load({ force: true })
}
</script>

<template>
  <section class="container">
    <header class="intro">
      <h1>What does this journey cost the climate?</h1>
      <p>
        Enter where you are starting and where you are going. We work out the distance
        and show what the same trip emits by car, bus, train, bike and on foot.
      </p>
    </header>

    <div class="layout">
      <!-- ------------------------------------------------------------ inputs -->
      <form class="card inputs" @submit.prevent="onCalculate">
        <LocationInput v-model="origin" label="Start" placeholder="e.g. Edinburgh Waverley" />
        <LocationInput v-model="destination" label="End" placeholder="e.g. Glasgow Central" />

        <div class="field" v-if="carOptions.length">
          <label for="car-type">Car type to compare against</label>
          <select id="car-type" v-model="carMode">
            <option v-for="c in carOptions" :key="c.mode_key" :value="c.mode_key">
              {{ c.mode_label }}
            </option>
          </select>
        </div>

        <label class="check">
          <input type="checkbox" v-model="returnTrip" />
          <span>Return trip (doubles the distance)</span>
        </label>

        <button type="submit" :disabled="!trip.ready || trip.calculating">
          {{ trip.calculating ? 'Calculating…' : 'Compare transport modes' }}
        </button>

        <p v-if="factorsStore.usingFallback" class="notice">
          {{ factorsStore.error }}
        </p>
      </form>

      <!-- ----------------------------------------------------------- results -->
      <div class="results">
        <p v-if="trip.error" class="notice error">{{ trip.error }}</p>

        <div v-if="trip.comparison.length" class="card">
          <p v-if="trip.approximate" class="notice">
            We could not reach the routing service, so this is a straight-line distance
            with a {{ DETOUR_FACTOR }}× allowance for real roads. Treat it as approximate.
          </p>

          <ComparisonChart
            :results="trip.comparison"
            :selected-key="chosenMode"
            :distance-km="trip.effectiveKm"
          />
          <ComparisonTable :results="trip.comparison" />

          <div class="headline">
            <StatTile
              label="Distance"
              :value="formatKm(trip.effectiveKm)"
              :context="returnTrip ? 'Return trip' : 'One way'"
            />
            <StatTile
              label="Worst option"
              :value="formatCo2(trip.worst?.kg ?? 0)"
              :context="trip.worst?.label"
            />
            <StatTile
              tone="good"
              label="Best option"
              :value="formatCo2(trip.best?.kg ?? 0)"
              :context="trip.best?.label"
            />
          </div>
        </div>

        <!-- ----------------------------------------------------------- log -->
        <div v-if="trip.allModes.length" class="card log">
          <ModeSelector v-model="chosenMode" :modes="trip.allModes" :disabled="trip.logging" />

          <button :disabled="!chosenMode || trip.logging" @click="onLog">
            {{ trip.logging ? 'Logging…' : 'Log this trip' }}
          </button>

          <p v-if="trip.lastLog" class="notice good">
            Logged. You avoided <strong>{{ formatCo2(trip.lastLog.savedKg) }}</strong> of CO₂e
            compared with driving, counted towards
            {{ countryName(trip.lastLog.countryCode) }} and the global total.
          </p>

          <p v-if="trip.sessionSavedKg > 0" class="muted">
            This session you have logged {{ formatCo2(trip.sessionSavedKg) }} avoided.
            This figure lives in the tab only and is gone when you close it.
          </p>
        </div>

        <div v-if="stats.global" class="card community">
          <h2>Logged by everyone</h2>
          <div class="headline">
            <StatTile
              tone="good"
              label="CO₂e avoided worldwide"
              :value="formatCo2(stats.global.total_saved_kg)"
              :context="`${stats.global.trips} trips across ${stats.global.countries} countries`"
            />
            <StatTile
              v-if="origin"
              label="Avoided in your country"
              :value="formatCo2(stats.forCountry(origin.countryCode)?.total_saved_kg ?? 0)"
              :context="countryName(origin.countryCode)"
            />
          </div>
          <p class="muted">
            Savings are measured against an average car. See
            <RouterLink to="/learn">how we calculate this</RouterLink>.
          </p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.intro { margin: 1.5rem 0; max-width: 60ch; }

.layout { display: grid; grid-template-columns: minmax(18rem, 22rem) 1fr; gap: 1.25rem; align-items: start; }
@media (max-width: 860px) { .layout { grid-template-columns: 1fr; } }

.inputs button[type='submit'] { width: 100%; margin-top: 0.5rem; }

.check { display: flex; gap: 0.5rem; align-items: center; font-size: 0.9rem; margin: 0.25rem 0 0.75rem; }
.check input { width: auto; }

.results { display: grid; gap: 1.25rem; }

.headline { display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: 0.75rem; margin-top: 1.25rem; }
.headline :deep(.tile) { box-shadow: none; }

.log button { margin-top: 1rem; }
.log .notice { margin-top: 1rem; }
</style>
