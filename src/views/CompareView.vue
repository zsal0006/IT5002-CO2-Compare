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
import { formatCo2, formatKm } from '@/lib/format'
import { DETOUR_FACTOR } from '@/lib/routing'

/** E1, E2, E3 — define a trip, compare the modes, log the one you took. */
const trip = useTripStore()
const factorsStore = useFactorsStore()
const stats = useStatsStore()

const { origin, destination, returnTrip, carMode } = storeToRefs(trip)
const chosenMode = ref(null)

onMounted(() => factorsStore.load())

const carOptions = computed(() => factorsStore.factors.filter((f) => f.category === 'car'))

const journeyTitle = computed(() => {
  if (!origin.value || !destination.value) return ''
  const name = (place) => place.label.split(',')[0].trim()
  return `${name(origin.value)} to ${name(destination.value)}`
})

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
      <h1>Compare your commute</h1>
      <p>See the environmental impact of your daily travel.</p>
    </header>

    <div class="layout">
      <!-- ----------------------------------------------------------- E1 ---- -->
      <form class="card inputs" @submit.prevent="onCalculate">
        <LocationInput
          v-model="origin"
          label="Start location"
          placeholder="Enter start address"
          allow-current-location
        />
        <LocationInput
          v-model="destination"
          label="End location"
          placeholder="Enter end address"
        />

        <div v-if="carOptions.length" class="field">
          <label for="car-type">Vehicle type</label>
          <select id="car-type" v-model="carMode">
            <option v-for="c in carOptions" :key="c.mode_key" :value="c.mode_key">
              {{ c.mode_label }}
            </option>
          </select>
        </div>

        <label class="check">
          <input v-model="returnTrip" type="checkbox" />
          <span>Return trip (doubles the distance)</span>
        </label>

        <button type="submit" :disabled="!trip.ready || trip.calculating">
          {{ trip.calculating ? 'Calculating…' : 'Compare routes' }}
        </button>

        <p class="privacy muted">Addresses are not stored.</p>

        <p v-if="factorsStore.usingFallback" class="notice">{{ factorsStore.error }}</p>
      </form>

      <!-- ----------------------------------------------------------- E2 ---- -->
      <div class="results">
        <p v-if="trip.error" class="notice error">{{ trip.error }}</p>

        <div v-if="trip.comparison.length" class="card">
          <header class="journey">
            <h2>{{ journeyTitle }}</h2>
            <p class="distance">{{ formatKm(trip.effectiveKm) }}</p>
          </header>

          <p v-if="trip.approximate" class="notice">
            We could not reach the routing service, so this is a straight-line distance
            with a {{ DETOUR_FACTOR }}× allowance for real roads. Treat it as approximate.
          </p>

          <ComparisonChart
            :results="trip.comparison"
            :selected-key="chosenMode"
            :distance-km="trip.effectiveKm"
          />

          <!-- E2.2: the headline swap, stated as a sentence rather than left
               for the reader to subtract two bars. -->
          <p v-if="trip.headlineSwap" class="notice good swap">
            Switching from {{ trip.headlineSwap.from.label.toLowerCase() }} to
            {{ trip.headlineSwap.to.label.toLowerCase() }} saves
            <strong>{{ formatCo2(trip.headlineSwap.savedKg) }}</strong> CO₂e.
          </p>

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

        <!-- ----------------------------------------------------------- E3 -- -->
        <div v-if="trip.allModes.length" class="card log">
          <ModeSelector v-model="chosenMode" :modes="trip.allModes" :disabled="trip.logging" />

          <button :disabled="!chosenMode || trip.logging" @click="onLog">
            {{ trip.logging ? 'Logging…' : 'Log this trip' }}
          </button>

          <p v-if="trip.lastLog" class="notice good">
            Logged. You avoided <strong>{{ formatCo2(trip.lastLog.savedKg) }}</strong> of
            CO₂e compared with driving. See it counted on the
            <RouterLink to="/impact">Impact</RouterLink> page.
          </p>

          <p v-if="trip.sessionSavedKg > 0" class="muted">
            This session you have logged {{ formatCo2(trip.sessionSavedKg) }} avoided.
            That figure lives in this tab only and is gone when you close it.
          </p>
        </div>

        <p v-if="trip.comparison.length" class="how">
          <RouterLink to="/learn">How we calculate this</RouterLink>
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.intro { margin: 1.5rem 0; max-width: 60ch; }
.intro p { font-size: 1.05rem; }

.layout { display: grid; grid-template-columns: minmax(18rem, 22rem) 1fr; gap: 1.25rem; align-items: start; }
@media (max-width: 860px) { .layout { grid-template-columns: 1fr; } }

.inputs button[type='submit'] { width: 100%; margin-top: 0.5rem; }
.privacy { text-align: center; margin: 0.6rem 0 0; }

.check { display: flex; gap: 0.5rem; align-items: center; font-size: 0.9rem; margin: 0.25rem 0 0.75rem; }
.check input { width: auto; }

.results { display: grid; gap: 1.25rem; }

.journey { text-align: center; margin-bottom: 1.25rem; }
.journey h2 { margin-bottom: 0.1rem; }
.distance { font-size: 1.1rem; color: var(--series-1); font-weight: 600; margin: 0; }

.swap { margin-top: 1rem; }

.headline { display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: 0.75rem; margin-top: 1.25rem; }
.headline :deep(.tile) { box-shadow: none; }

.log button { margin-top: 1rem; }
.log .notice { margin-top: 1rem; }

.how { text-align: center; margin: 0 0 2rem; font-size: 0.9rem; }
</style>
