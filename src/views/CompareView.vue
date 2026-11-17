<script setup>
import { onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import LocationInput from '@/components/compare/LocationInput.vue'
import AddressAttribution from '@/components/compare/AddressAttribution.vue'
import ComparisonBars from '@/components/compare/ComparisonBars.vue'
import WeekPlanner from '@/components/compare/WeekPlanner.vue'
import { useTripStore } from '@/stores/trip'
import { useFactorsStore } from '@/stores/factors'
import { useStatsStore } from '@/stores/stats'
import { formatCo2 } from '@/lib/format'
import { DETOUR_FACTOR } from '@/lib/routing'

const trip = useTripStore()
const factors = useFactorsStore()
const stats = useStatsStore()
const { origin, destination, returnTrip } = storeToRefs(trip)
const editing = ref(true)
const selectedModeKey = ref(null)

onMounted(() => factors.load())

async function calculate() {
  await trip.calculate()
  if (trip.comparison.length) {
    selectedModeKey.value = null
    editing.value = false
  }
}

async function logMode() {
  if (!selectedModeKey.value) return
  const result = await trip.logTrip(selectedModeKey.value)
  if (result) await stats.load({ force: true })
}

function swapPlaces() {
  const place = origin.value
  origin.value = destination.value
  destination.value = place
}
</script>

<template>
  <div class="container page compare-page" :class="{ 'results-page': !editing }">
    <template v-if="editing">
      <header class="intro">
        <h1>Compare your commute</h1>
        <p class="lead">See the impact of every way to make the same journey.</p>
        <ul class="points">
          <li><strong>All five modes, side by side.</strong> Compare cycling, walking, bus, train and car emissions
            together.</li>
          <li><strong>Put the numbers in context.</strong> See average-car distance equivalents, tree absorption time
            and estimated calories for walking or cycling.</li>
          <li><strong>Confirm your choice</strong> Add it to the community total; your addresses are never stored.</li>
        </ul>
      </header>

      <form class="card trip-form" @submit.prevent="calculate">
        <h2>Where are you going?</h2>
        <div class="route-box">
          <LocationInput v-model="origin" class="end-row" label="From" placeholder="Start address" marker="dot"
            allow-current-location />
          <span class="divider" aria-hidden="true" />
          <button type="button" class="swap" aria-label="Swap start and destination" :disabled="!origin && !destination"
            @click="swapPlaces">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"
              stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4" />
            </svg>
          </button>
          <LocationInput v-model="destination" class="end-row" label="To" placeholder="Destination" marker="square" />
        </div>

        <label class="return-toggle">
          <span>Return trip <span class="muted">· doubles the distance</span></span>
          <input v-model="returnTrip" type="checkbox">
        </label>

        <button type="submit" :disabled="!trip.ready || trip.calculating">
          {{ trip.calculating ? 'Calculating…' : 'Compare all modes' }}
        </button>
        <p class="privacy">This app does not save your addresses.</p>
        <p v-if="factors.usingFallback" class="notice">{{ factors.error }}</p>
        <p v-if="trip.error" class="notice error" role="alert">{{ trip.error }}</p>
      </form>
    </template>

    <section v-else class="results-shell" aria-label="Journey comparison results">
      <button type="button" class="secondary back-button" @click="editing = true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Change journey
      </button>

      <p v-if="trip.error" class="notice error" role="alert">{{ trip.error }}</p>
      <p v-if="trip.approximate" class="notice">
        Routing was unavailable. The displayed distance uses a {{ DETOUR_FACTOR }}× straight-line
        estimate and is approximate.
      </p>
      <p v-if="origin || destination" class="provider-credit">
        Address data:
        <AddressAttribution :places="[origin, destination]" />
      </p>
      <p v-if="trip.routeAttribution" class="provider-credit">
        Route data: {{ trip.routeAttribution }}
      </p>

      <div class="results">
        <ComparisonBars :modes="trip.comparison" :distance-km="trip.effectiveKm" :origin-label="origin?.label ?? ''"
          :destination-label="destination?.label ?? ''" :return-trip="returnTrip"
          v-model:selected-mode-key="selectedModeKey" :logging="trip.logging" @log="logMode" />
        <WeekPlanner :modes="trip.comparison" :distance-km="trip.distanceKm" />
        <p v-if="trip.lastLog" class="notice success" role="status">
          Logged. You avoided {{ formatCo2(trip.lastLog.savedKg) }} CO₂e compared with driving.
          View the <RouterLink to="/impact">community impact</RouterLink>.
        </p>
        <p v-if="trip.sessionSavedKg > 0" class="session-total">
          This session: {{ formatCo2(trip.sessionSavedKg) }} CO₂e avoided.
        </p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.compare-page {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  align-items: center;
  align-content: safe center;
  gap: 1.5rem 2rem;
  max-width: 66rem;
  padding-block: 2rem;
}

.compare-page.results-page {
  flex: none;
  grid-template-columns: minmax(0, 1fr);
  max-width: 60rem;
  align-items: start;
  align-content: start;
  padding-block: 0;
}

.intro h1 {
  margin: 0;
}

.lead {
  margin: 0.5rem 0 0;
  color: var(--text-secondary);
}

.points {
  display: grid;
  gap: 0.875rem;
  margin: 1.25rem 0 0;
  padding-left: 1.2rem;
  color: var(--text-secondary);
}

.points strong {
  color: var(--text-primary);
}

.trip-form {
  display: grid;
  gap: 1rem;
  padding: 1.25rem;
}

.trip-form h2 {
  margin: 0;
  font-size: 1.125rem;
}

.results-shell {
  display: grid;
  gap: 1rem;
  width: 100%;
}

.results {
  display: grid;
  gap: 1.25rem;
}

.back-button {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 42px;
}

.provider-credit {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.75rem;
}

.route-box {
  position: relative;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-1);
}

.route-box .end-row {
  padding-left: 1.5rem;
}

.divider {
  display: block;
  height: 1px;
  margin: 0 0.875rem 0 48px;
  background: var(--border);
}

.swap {
  position: absolute;
  z-index: 1;
  top: 50%;
  left: 16px;
  display: grid;
  width: 30px;
  height: 30px;
  min-height: 30px;
  padding: 0;
  place-items: center;
  transform: translateY(-50%);
  border: 1px solid var(--axis);
  border-radius: 50%;
  background: var(--surface-2);
  color: var(--text-primary);
}

.return-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  font-weight: 600;
}

.return-toggle input {
  width: 1.125rem;
  height: 1.125rem;
  accent-color: var(--accent);
}

.trip-form>button[type='submit'] {
  min-height: 48px;
}

.privacy,
.session-total {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.8125rem;
}

.success {
  margin: 0;
}

.session-total {
  margin: 0;
}

.muted {
  color: var(--text-secondary);
  font-weight: 400;
}

@media (max-width: 56rem) {
  .compare-page {
    grid-template-columns: minmax(0, 1fr);
    max-width: 42rem;
  }
}

@media (max-width: 34rem) {
  .trip-form {
    padding: 1rem;
  }

  .return-toggle {
    font-size: 0.875rem;
  }
}
</style>
