<script setup>
import { onMounted, ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import LocationInput from '@/components/LocationInput.vue'
import JourneyHero from '@/components/JourneyHero.vue'
import WeekPlanner from '@/components/WeekPlanner.vue'
import TripLogger from '@/components/TripLogger.vue'
import { useTripStore } from '@/stores/trip'
import { useFactorsStore } from '@/stores/factors'
import { useStatsStore } from '@/stores/stats'
import { formatCo2 } from '@/lib/format'
import { DETOUR_FACTOR } from '@/lib/routing'

/** E1, E2, E3 — define a trip, compare the modes, log the one you took. */
const trip = useTripStore()
const factorsStore = useFactorsStore()
const stats = useStatsStore()

const { origin, destination, returnTrip, carMode } = storeToRefs(trip)

/**
 * One selection, two jobs: the mode the hero explores, and the mode the logger
 * will record. Keeping them as one value is what makes the hero's pills and the
 * logger's icons stay in step — picking in either place moves both.
 */
const chosenMode = ref(null)

/**
 * The page is one thing at a time: the form, or the results.
 *
 * An empty results column beside a form is the blank half-page the single
 * centred layout was meant to kill, and a placeholder card describing what
 * *would* appear is the same blankness with words in it. So the form stands
 * alone until there is something to show, then steps aside — the journey is
 * still named in the hero, and Back brings the form straight back with both
 * addresses still in it.
 */
const editing = ref(true)

onMounted(() => factorsStore.load())

const carOptions = computed(() => factorsStore.factors.filter((f) => f.category === 'car'))

/** Pump price for the country the trip starts in (never stored with the trip). */
const fuelPrice = computed(() => factorsStore.fuelPriceFor(origin.value?.countryCode ?? 'ZZ'))

const baseline = computed(
  () => trip.allModes.find((m) => m.isBaseline) ?? trip.allModes.at(-1) ?? null
)

/**
 * Open on the swap worth suggesting rather than on nothing. `headlineSwap`
 * deliberately skips walking and cycling, so a 30 km commute opens on the train
 * instead of proposing a two-hour walk.
 */
watch(
  () => trip.allModes,
  (modes) => {
    if (!modes.length) return
    if (chosenMode.value && modes.some((m) => m.modeKey === chosenMode.value)) return
    chosenMode.value = trip.headlineSwap?.to?.modeKey ?? trip.best?.modeKey ?? null
  },
  { immediate: true }
)

async function onCalculate() {
  chosenMode.value = null
  await trip.calculate()
  // Only leave the form once there is something to leave it for. A routing
  // failure keeps you here, next to the fields you would need to correct.
  if (trip.comparison.length) editing.value = false
}

async function onLog() {
  if (!chosenMode.value) return
  const result = await trip.logTrip(chosenMode.value)
  if (result) await stats.load({ force: true })
}

function swapEnds() {
  const from = origin.value
  origin.value = destination.value
  destination.value = from
}
</script>

<template>
  <div class="container page">
    <div class="layout" :class="{ centred: editing }">
      <!-- ------------------------------------------------------------ E1 -- -->
      <form v-if="editing" class="card trip" @submit.prevent="onCalculate">
        <div>
          <h1>Compare your commute</h1>
          <p class="lead">See the CO₂ cost of every way to make the trip.</p>
        </div>

        <div class="route">
          <!-- The rail: a dot, a dashed run and a square, tying the two fields
               into one journey rather than two unrelated inputs. -->
          <div class="rail" aria-hidden="true">
            <span class="dot" />
            <span class="line" />
            <span class="square" />
          </div>

          <div class="fields">
            <LocationInput
              v-model="origin"
              label="From"
              placeholder="Enter start address"
              allow-current-location
            />
            <LocationInput
              v-model="destination"
              label="To"
              placeholder="Enter destination"
              :bias="origin"
            />
          </div>

          <button
            type="button"
            class="swap"
            aria-label="Swap start and end"
            :disabled="!origin && !destination"
            @click="swapEnds"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4" />
            </svg>
          </button>
        </div>

        <div v-if="carOptions.length" class="field">
          <label for="car-type">Compare against</label>
          <select id="car-type" v-model="carMode">
            <option v-for="c in carOptions" :key="c.mode_key" :value="c.mode_key">
              {{ c.mode_label }}
            </option>
          </select>
        </div>

        <div class="toggle-row">
          <span>
            <span class="toggle-title">Return trip</span>
            <span class="toggle-sub">Doubles the distance</span>
          </span>
          <button
            type="button"
            role="switch"
            class="switch"
            :class="{ on: returnTrip }"
            :aria-checked="String(returnTrip)"
            aria-label="Return trip"
            @click="returnTrip = !returnTrip"
          >
            <span class="knob" />
          </button>
        </div>

        <button type="submit" :disabled="!trip.ready || trip.calculating">
          {{ trip.calculating ? 'Calculating…' : 'Compare routes' }}
        </button>

        <p class="privacy">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          Addresses are never stored.
        </p>

        <p v-if="factorsStore.usingFallback" class="notice">{{ factorsStore.error }}</p>
      </form>

      <!-- ------------------------------------------------------- E2, E3 --- -->
      <div v-else class="results">
        <p v-if="trip.error" class="notice error">{{ trip.error }}</p>

        <template v-if="trip.comparison.length">
          <button type="button" class="secondary back" @click="editing = true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
            Change trip
          </button>

          <p v-if="trip.approximate" class="notice">
            We could not reach the routing service, so this is a straight-line distance
            with a {{ DETOUR_FACTOR }}× allowance for real roads. Treat it as approximate.
          </p>

          <JourneyHero
            v-model="chosenMode"
            :modes="trip.allModes"
            :baseline="baseline"
            :distance-km="trip.effectiveKm"
            :return-trip="returnTrip"
            :fuel-price="fuelPrice"
            :origin-label="origin?.label ?? ''"
            :destination-label="destination?.label ?? ''"
          />

          <WeekPlanner
            :modes="trip.allModes"
            :baseline="baseline"
            :distance-km="trip.distanceKm"
            :fuel-price="fuelPrice"
          />

          <TripLogger
            v-model="chosenMode"
            :modes="trip.allModes"
            :logging="trip.logging"
            :last-log="trip.lastLog"
            @log="onLog"
          />

          <p v-if="trip.sessionSavedKg > 0" class="muted session">
            This session you have logged {{ formatCo2(trip.sessionSavedKg) }} avoided. That
            figure lives in this tab only and is gone when you close it.
          </p>
        </template>

      </div>
    </div>
  </div>
</template>

<style scoped>
.page { padding: 2rem 0 3.5rem; }

/*
 * One pane at a time. While editing, the form is alone and centred at reading
 * width; once there are results it has the full column to itself. Nothing here
 * ever reserves space for a pane that is not on screen.
 */
.layout { display: flex; flex-wrap: wrap; gap: 1.5rem; align-items: flex-start; }
.layout.centred { justify-content: center; }

.trip { flex: 1 1 320px; max-width: 100%; display: flex; flex-direction: column; gap: 1.25rem; }
.centred .trip { flex: 0 1 30rem; }

.results { flex: 1 1 100%; min-width: 0; display: flex; flex-direction: column; gap: 1.25rem; }

/* Sits above the hero, aligned to the column's leading edge. */
.back {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 40px;
  padding: 0 0.875rem;
  font-size: 0.875rem;
}

.trip h1 { margin: 0; font-size: 1.625rem; }
.lead { margin: 0.375rem 0 0; font-size: 0.875rem; color: var(--text-secondary); }

/* --- the route rail ---------------------------------------------------- */
.route { display: flex; gap: 0.75rem; align-items: stretch; }

.rail { display: flex; flex-direction: column; align-items: center; padding: 2.1rem 0 1.1rem; }
.dot { width: 10px; height: 10px; border-radius: 50%; border: 2px solid var(--text-primary); }
.line {
  flex: 1;
  width: 2px;
  margin: 4px 0;
  background: repeating-linear-gradient(var(--axis) 0 4px, transparent 4px 8px);
}
.square { width: 10px; height: 10px; border-radius: 2px; background: var(--accent); }

.fields { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.625rem; }

.swap {
  align-self: center;
  width: 44px;
  height: 44px;
  flex: none;
  padding: 0;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface-1);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}
.swap:hover:not(:disabled) { border-color: var(--axis); }

/* --- the return switch -------------------------------------------------- */
.toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
.toggle-title { display: block; font-size: 0.875rem; font-weight: 600; }
.toggle-sub { display: block; font-size: 0.8125rem; color: var(--text-secondary); }

.switch {
  width: 52px;
  height: 30px;
  min-height: 30px;
  flex: none;
  padding: 0;
  border-radius: var(--radius-pill);
  border: 0;
  background: var(--axis);
  position: relative;
  transition: background 0.2s;
}
.switch.on { background: var(--accent); }
.knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #ffffff;
  transition: left 0.2s;
}
.switch.on .knob { left: 25px; }

.privacy {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

/* --- results ------------------------------------------------------------ */

.session { margin: 0; }
</style>
