<script setup>
import { computed, ref, watch } from 'vue'
import { shortName } from '@/lib/modeIcons'
import { formatCo2 } from '@/lib/format'
import { formatMoney, fuelCostFor, treeDaysFor, litresFor } from '@/lib/benefits'
import { WEEKS_PER_YEAR } from '@/lib/timeframe'

/**
 * A commuting week, one card per day, each a round trip.
 *
 * This is a PLANNER, not a record. Nothing here is written to `trip_logs` — the
 * Impact page counts journeys that actually happened, and a week someone
 * sketched would corrupt that total. The yearly line is explicitly a
 * projection and names the number of weeks it assumes.
 */
const props = defineProps({
  /** ModeResult[] for this journey. */
  modes: { type: Array, required: true },
  baseline: { type: Object, default: null },
  distanceKm: { type: Number, default: null },
  fuelPrice: { type: Object, default: null }
})

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

/** The modes a day card cycles through on tap, in order. */
const CYCLE = ['car_average', 'train_national', 'bus_city', 'cycling']

const week = ref(['car_average', 'train_national', 'car_average', 'bus_city', 'car_average'])

const byKey = computed(() => Object.fromEntries(props.modes.map((m) => [m.modeKey, m])))

/** Only offer modes this journey actually has factors for. */
const cycleAvailable = computed(() => {
  const list = CYCLE.filter((k) => byKey.value[k])
  return list.length ? list : props.modes.slice(0, 4).map((m) => m.modeKey)
})

// A journey whose factors change (the car sub-type, say) must not leave the
// week pointing at modes that no longer resolve.
watch(
  () => props.modes,
  () => {
    const fallback = cycleAvailable.value[0]
    if (!fallback) return
    week.value = week.value.map((k) => (byKey.value[k] ? k : fallback))
  }
)

/** Each day is a round trip, so twice the one-way figure. */
const days = computed(() =>
  week.value.map((key, i) => {
    const m = byKey.value[key]
    return {
      index: i,
      day: DAYS[i],
      modeKey: key,
      label: m?.label ?? key,
      short: shortName(key, m?.label ?? ''),
      kg: (m?.kg ?? 0) * 2,
      isCar: m?.category === 'car'
    }
  })
)

const weekKg = computed(() => days.value.reduce((sum, d) => sum + d.kg, 0))
const carWeekKg = computed(() => (props.baseline?.kg ?? 0) * 2 * DAYS.length)
const savedKg = computed(() => Math.max(0, carWeekKg.value - weekKg.value))
const yearSavedKg = computed(() => savedKg.value * WEEKS_PER_YEAR)

const meterWidth = computed(() =>
  carWeekKg.value > 0 ? `${Math.min(100, (weekKg.value / carWeekKg.value) * 100).toFixed(1)}%` : '0%'
)

/**
 * Car kilometres a year of this week would avoid.
 *
 * Every car day counts as driven, electric ones included. An EV avoids petrol
 * but not the cost of charging it, so counting an EV day as "fuel money saved"
 * would overstate the saving by the price of the electricity — which we hold no
 * figure for. Excluding it understates instead, which is the safer error.
 */
const yearKmAvoided = computed(() => {
  if (!props.distanceKm || !carWeekKg.value) return 0
  const carFreeDays = days.value.filter((d) => !d.isCar).length
  return props.distanceKm * 2 * carFreeDays * WEEKS_PER_YEAR
})

const yearMoney = computed(() =>
  props.fuelPrice ? fuelCostFor(yearKmAvoided.value, props.fuelPrice) : null
)
const yearLitres = computed(() => litresFor(yearKmAvoided.value))
const yearTreeDays = computed(() => treeDaysFor(yearSavedKg.value))

const int = (n) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n)

function cycleDay(index) {
  const list = cycleAvailable.value
  const current = week.value[index]
  const next = list[(list.indexOf(current) + 1) % list.length]
  week.value = week.value.map((k, i) => (i === index ? next : k))
}

function preset(name) {
  const [car, train, bus, bike] = CYCLE
  const pick = (k) => (byKey.value[k] ? k : cycleAvailable.value[0])
  if (name === 'car') week.value = DAYS.map(() => pick(car))
  if (name === 'mix') week.value = [car, train, car, train, car].map(pick)
  if (name === 'green') week.value = [train, bike, train, bus, train].map(pick)
}
</script>

<template>
  <section class="card planner" aria-labelledby="week-heading">
    <header class="head">
      <div>
        <h2 id="week-heading">Plan your week</h2>
        <p class="lead">
          Tap a day to change how you get there. Each day is a round trip, and nothing
          here is logged.
        </p>
      </div>
      <div class="presets">
        <button type="button" class="preset" @click="preset('car')">All car</button>
        <button type="button" class="preset" @click="preset('mix')">Train twice</button>
        <button type="button" class="preset" @click="preset('green')">Car-free week</button>
      </div>
    </header>

    <div class="days">
      <button
        v-for="d in days"
        :key="d.index"
        type="button"
        class="day"
        :class="{ car: d.isCar }"
        :aria-label="`${d.day}: ${d.label}, ${formatCo2(d.kg)}. Activate to change.`"
        @click="cycleDay(d.index)"
      >
        <span class="dow">{{ d.day }}</span>
        <span class="mode">{{ d.short }}</span>
        <span class="kg">{{ d.kg.toFixed(2) }} kg</span>
      </button>
    </div>

    <div class="meters">
      <div class="meter-row">
        <span class="meter-label">All by car</span>
        <span class="track"><span class="fill base" /></span>
        <span class="meter-value">{{ carWeekKg.toFixed(1) }} kg</span>
      </div>
      <div class="meter-row">
        <span class="meter-label strong">Your week</span>
        <span class="track"><span class="fill yours" :style="{ width: meterWidth }" /></span>
        <span class="meter-value strong">{{ weekKg.toFixed(1) }} kg</span>
      </div>
    </div>

    <p v-if="savedKg > 0" class="projection">
      <span class="proj-label">Keep this up for a year ({{ WEEKS_PER_YEAR }} weeks)</span>
      <strong class="proj-figure">{{ int(yearSavedKg) }} kg saved</strong>
      <span class="proj-detail">
        ≈ <template v-if="yearMoney">{{ formatMoney(yearMoney, fuelPrice.currency_code) }} ·
        </template>{{ int(yearLitres) }} litres · {{ int(yearTreeDays) }} tree-days
      </span>
    </p>
    <p v-else class="muted">
      This week matches driving every day, so there is nothing projected to save.
    </p>
  </section>
</template>

<style scoped>
.planner { display: flex; flex-direction: column; gap: 1.125rem; }

.head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-end;
  gap: 0.75rem;
}
.head h2 { margin: 0; }
.lead { margin: 0.125rem 0 0; font-size: 0.8125rem; color: var(--text-secondary); }

.presets { display: flex; flex-wrap: wrap; gap: 0.375rem; }
.preset {
  min-height: 36px;
  padding: 0 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface-1);
  color: var(--text-primary);
  font-size: 0.75rem;
  font-weight: 600;
}
.preset:hover { border-color: var(--axis); }

.days { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 0.5rem; }

/*
 * Car days are blue, everything else green — the same pairing as the route
 * strip, so the colour means the same thing twice. The mode name is written on
 * every card, so the colour is reinforcement, never the only signal.
 */
.day {
  min-height: 112px;
  padding: 0.75rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--accent-soft-border);
  background: var(--accent-soft);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  text-align: left;
  gap: 0.25rem;
  transition: background 0.2s, border-color 0.2s;
}
.day.car { background: var(--series-1-soft); border-color: var(--series-1-soft-border); }

.dow {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-secondary);
}
.mode {
  font-family: var(--font-display);
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--accent-soft-text);
}
.day.car .mode { color: var(--series-1-soft-text); }
.kg { font-size: 0.75rem; color: var(--text-secondary); font-variant-numeric: tabular-nums; }

.meters { display: flex; flex-direction: column; gap: 0.625rem; }
.meter-row { display: grid; grid-template-columns: 110px minmax(0, 1fr) 80px; gap: 0.75rem; align-items: center; }
.meter-label { font-size: 0.8125rem; color: var(--text-secondary); }
.meter-value { font-size: 0.8125rem; text-align: right; font-variant-numeric: tabular-nums; color: var(--text-secondary); }
.strong { font-weight: 600; color: var(--text-primary); }

.track { height: 12px; background: var(--surface-2); border-radius: 4px; display: block; }
.fill { display: block; height: 100%; border-radius: 4px; transition: width 0.5s cubic-bezier(0.2, 0.8, 0.2, 1); }
.fill.base { width: 100%; background: var(--series-1); }
.fill.yours { background: var(--accent); }

.projection {
  margin: 0;
  background: var(--page);
  border-radius: var(--radius-md);
  padding: 1rem 1.125rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1.5rem;
}
.proj-label { font-size: 0.8125rem; color: var(--text-secondary); font-weight: 500; }
.proj-figure { font-family: var(--font-display); font-size: 1.375rem; font-weight: 600; color: var(--accent); }
.proj-detail { font-size: 0.875rem; color: var(--text-secondary); }

@media (max-width: 480px) {
  .meter-row { grid-template-columns: 84px minmax(0, 1fr) 68px; gap: 0.5rem; }
}
</style>
