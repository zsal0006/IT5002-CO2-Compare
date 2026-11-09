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
      <!--
        On a wide screen the form alone is a 30rem card adrift in 1900px of
        empty page. The heading and the lead move out of the card and take the
        space beside it, so the width carries the page's one idea instead of
        nothing. Below 60rem the two stack and read as one column.
      -->
      <div v-if="editing" class="intro">
        <h1>Compare your commute</h1>
        <p class="lead">See the CO₂ cost of every way to make the trip.</p>

        <ul class="points">
          <li>
            <strong>Every way of making it.</strong>
            Walking, cycling, bus, train and car, ranked by what each one emits.
          </li>
          <li>
            <strong>What the swap is actually worth.</strong>
            Fuel money, petrol left in the ground, steps and calories — not only kilograms.
          </li>
          <li>
            <strong>Log the trip you took.</strong>
            It joins the running total on the Impact page. No addresses are kept.
          </li>
        </ul>
      </div>

      <form v-if="editing" class="card trip" @submit.prevent="onCalculate">

        <!-- One journey, one control: both ends inside a single box, joined by
             a dotted rail from the start dot to the destination square, with
             the swap button straddling the seam. Two separately bordered
             fields stacked up would read as two unrelated questions. -->
        <div>
          <div class="route-box">
            <LocationInput
              v-model="origin"
              class="end-row"
              label="From"
              placeholder="Start address"
              marker="dot"
              allow-current-location
            />

            <span class="divider" aria-hidden="true" />

            <button
              type="button"
              class="swap"
              aria-label="Swap start and destination"
              :disabled="!origin && !destination"
              @click="swapEnds"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4" />
              </svg>
            </button>

            <LocationInput
              v-model="destination"
              class="end-row"
              label="To"
              placeholder="Destination"
              marker="square"
              :bias="origin"
            />
          </div>

          <p class="route-hint">Type a place and press Enter to search.</p>
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
          <span class="toggle-title">
            Return trip <span class="toggle-sub">· doubles the distance</span>
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

        <div class="submit">
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
        </div>

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
/*
 * Takes whatever height the shell has left, so the editing state can sit in
 * the middle of the screen instead of in a band under the header.
 */
.page {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 2.5rem 0 3rem;
}

/*
 * One pane at a time. While editing, the page is an intro beside the form;
 * once there are results, the results have the full column to themselves.
 * Nothing here ever reserves space for a pane that is not on screen.
 */
.layout { display: flex; flex-wrap: wrap; gap: 1.5rem; align-items: flex-start; }

/*
 * The editing state. It uses the container's full width on a large monitor —
 * the earlier 62rem cap is what left the card looking postage-stamp sized on
 * a 1900px screen — but the text column is capped separately below, because
 * prose set across 700px is unreadable however much room there is.
 *
 * The form card grows with the viewport instead of staying at a fixed 30rem.
 */
.layout.centred {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, clamp(26rem, 32vw, 38rem));
  gap: clamp(2.5rem, 6vw, 7rem);
  align-items: center;
  margin-inline: auto;
}

@media (max-width: 62rem) {
  .layout.centred {
    grid-template-columns: minmax(0, 1fr);
    gap: 1.75rem;
    align-items: start;
    max-width: 32rem;
  }
}

.trip {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1.125rem;
  padding: clamp(1.5rem, 1.1rem + 1vw, 2.25rem);
}
.submit { display: flex; flex-direction: column; gap: 0.625rem; }

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

/* --- the intro column --------------------------------------------------- */
/* The column may be 700px wide on a large monitor; the text inside it is not. */
.intro { min-width: 0; max-width: 34rem; }

/* Fluid rather than stepped: the heading is the only thing on this page that
   can afford to use the width, so it tracks it instead of jumping at a
   breakpoint. */
.intro h1 {
  margin: 0;
  font-size: clamp(1.875rem, 1.1rem + 2.6vw, 3.5rem);
  line-height: 1.08;
  letter-spacing: -0.025em;
}
.lead {
  margin: 0.75rem 0 0;
  font-size: clamp(1rem, 0.95rem + 0.35vw, 1.25rem);
  color: var(--text-secondary);
  max-width: 34rem;
}

.points {
  list-style: none;
  margin: 1.75rem 0 0;
  padding: 0;
  display: grid;
  gap: clamp(0.875rem, 0.7rem + 0.5vw, 1.25rem);
  max-width: 34rem;
  font-size: clamp(0.9375rem, 0.9rem + 0.25vw, 1.0625rem);
  color: var(--text-secondary);
}
.points li { padding-left: 1.375rem; position: relative; line-height: 1.5; }

/* A small square in the accent, matching the destination marker in the box —
   the same mark doing the same job, rather than a new bullet shape. */
.points li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.55em;
  width: 7px;
  height: 7px;
  border-radius: 2px;
  background: var(--accent);
}
.points strong { display: block; color: var(--text-primary); font-weight: 600; }

/* Kept, not hidden: it is the only place the page says what logging a trip
   does. It just stops taking a block of space before the form is reachable. */
@media (max-width: 62rem) {
  .points { margin-top: 1.125rem; gap: 0.625rem; font-size: 0.875rem; }
}

/* --- the journey box ---------------------------------------------------- */
.route-box {
  position: relative;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-1);
}

/*
 * The marker column is widened from the design's 14px so the swap button can
 * live inside it: the markers' centre line lands at 29px, which leaves the
 * 36px button an 11px inset from the box edge.
 */
.route-box .end-row { padding-left: 1.5rem; }

/* Runs from the marker column to just short of the box edge. */
.divider {
  display: block;
  height: 1px;
  margin: 0 0.875rem 0 48px;
  background: var(--border);
}

/*
 * The swap sits on the markers' own centre line, between the start dot and the
 * destination square — the column that already stands for the journey. On the
 * right it had to share an edge with "use my current location", and the two
 * round buttons read as a pair when they do unrelated things.
 *
 * It replaces the dotted rail rather than covering it: at 56px rows the button
 * leaves 5px above and below, which would show as a stray dot at each end
 * rather than as a line passing behind. Three elements in one column connect
 * the two ends on their own.
 */
.swap {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;
  width: 26px;
  height: 26px;
  min-height: 26px;
  padding: 0;
  border-radius: 50%;
  /* --axis, not --border: at 26px on white, the card's hairline left the
     button looking like a loose glyph rather than a control. */
  border: 1px solid var(--axis);
  background: var(--surface-2);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}
.swap:hover:not(:disabled) { background: var(--surface-1); border-color: var(--text-secondary); }

/*
 * Drawn at 26px so it sits between the markers without becoming the loudest
 * thing in the box, but clickable over 36px. Stretching the target any further
 * would reach past the markers into the text the two inputs start with.
 */
.swap::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 36px;
  height: 36px;
  transform: translate(-50%, -50%);
}

.route-hint { margin: 0.5rem 0 0; font-size: 0.75rem; color: var(--text-secondary); }

/* --- the return switch -------------------------------------------------- */
.toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
.toggle-title { font-size: 0.875rem; font-weight: 600; }
.toggle-sub { font-weight: 400; color: var(--text-secondary); }

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

/*
 * The submit control is the one thing on this card that is a decision, so it
 * is drawn larger than the 44px floor the rest of the app uses.
 */
.trip [type='submit'] { height: 50px; border-radius: var(--radius-md); font-size: 0.9375rem; }
.trip select { height: 48px; border-radius: var(--radius-md); }

/*
 * On a large monitor the controls grow with the card rather than sitting as a
 * strip of 48px rows inside a much bigger box.
 */
@media (min-width: 80rem) {
  .route-box .end-row { height: 62px; }
  .trip select { height: 54px; }
  .trip [type='submit'] { height: 56px; font-size: 1rem; }
  .route-hint { font-size: 0.8125rem; }
}

/* Centred under the button it qualifies, not ranged left against the card. */
.privacy {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

/* --- results ------------------------------------------------------------ */

.session { margin: 0; }
</style>
