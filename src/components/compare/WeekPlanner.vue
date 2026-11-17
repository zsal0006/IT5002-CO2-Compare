<script setup>
import { computed, ref, watch } from 'vue'
import { caloriesBurned, treeAbsorptionDays } from '@/lib/journeyImpact'
import { formatNumber } from '@/lib/format'

const props = defineProps({
  modes: { type: Array, required: true },
  distanceKm: { type: Number, required: true }
})

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const DEFAULT_WEEK = ['car_average', 'train_national', 'car_average', 'bus_city', 'car_average']
const modeByKey = computed(() => Object.fromEntries(props.modes.map((mode) => [mode.modeKey, mode])))
const plan = ref([...DEFAULT_WEEK])

watch(
  () => props.modes.map((mode) => mode.modeKey).join(','),
  () => {
    const available = props.modes.map((mode) => mode.modeKey)
    if (!available.length) return
    plan.value = plan.value.map((key) => available.includes(key) ? key : available[0])
  }
)

const roundTripKm = computed(() => props.distanceKm * 2)
const carMode = computed(() => props.modes.find((mode) => mode.isBaseline))
const carDayKg = computed(() =>
  carMode.value ? (carMode.value.factor * roundTripKm.value) / 1000 : 0
)

const days = computed(() =>
  plan.value.map((modeKey, index) => {
    const mode = modeByKey.value[modeKey]
    return {
      day: DAYS[index],
      modeKey,
      label: mode?.label ?? '—',
      kg: mode ? (mode.factor * roundTripKm.value) / 1000 : 0,
      calories: caloriesBurned(modeKey, roundTripKm.value)
    }
  })
)

const weekKg = computed(() => days.value.reduce((sum, day) => sum + day.kg, 0))
const carWeekKg = computed(() => carDayKg.value * DAYS.length)
const savedKg = computed(() => Math.max(0, carWeekKg.value - weekKg.value))
const calories = computed(() => days.value.reduce((sum, day) => sum + day.calories, 0))
const treeDays = computed(() => treeAbsorptionDays(savedKg.value))

const emissionsLabel = (kg) => `${formatNumber(kg, kg < 10 ? 2 : 1)} kg CO₂e`
</script>

<template>
  <section class="card planner" aria-labelledby="week-heading">
    <header>
      <h2 id="week-heading">Plan your commuting week</h2>
      <p class="hint">Choose a mode for each weekday. Each planned day is a round trip; nothing here is logged.</p>
    </header>

    <div class="days">
      <label v-for="(day, index) in days" :key="day.day" class="day">
        <span class="weekday">{{ day.day }}</span>
        <select v-model="plan[index]" :aria-label="`${day.day} travel mode`">
          <option v-for="mode in modes" :key="mode.modeKey" :value="mode.modeKey">
            {{ mode.label }}
          </option>
        </select>
        <span class="day-emissions">{{ emissionsLabel(day.kg) }}</span>
      </label>
    </div>

    <div class="totals">
      <p><span>All car</span><strong>{{ emissionsLabel(carWeekKg) }}</strong></p>
      <p><span>Your plan</span><strong>{{ emissionsLabel(weekKg) }}</strong></p>
      <p><span>Estimated difference</span><strong>{{ emissionsLabel(savedKg) }} avoided</strong></p>
    </div>

    <p class="equivalents">
      {{ formatNumber(treeDays, 1) }} tree-days of CO₂ absorption
      <span v-if="calories > 0"> - {{ formatNumber(calories, 0) }} kcal from walking or cycling</span>
    </p>
  </section>
</template>

<style scoped>
.planner {
  display: grid;
  gap: 1rem;
}

.planner h2 {
  margin: 0;
}

.hint {
  margin: 0.25rem 0 0;
  color: var(--text-secondary);
  font-size: 0.8125rem;
}

.days {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(125px, 1fr));
  gap: 0.625rem;
}

.day {
  display: grid;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.weekday {
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.day select {
  width: 100%;
  min-width: 0;
}

.day-emissions {
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
}

.totals {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.75rem;
}

.totals p {
  display: grid;
  gap: 0.25rem;
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.8125rem;
}

.totals strong {
  color: var(--text-primary);
}

.equivalents {
  margin: 0;
  padding: 0.875rem;
  border-radius: var(--radius-md);
  background: var(--surface-2);
  font-size: 0.875rem;
}

@media (max-width: 34rem) {
  .equivalents {
    font-size: 0.8125rem;
  }
}
</style>
