<script setup>
import { computed } from 'vue'
import { formatKm, formatNumber } from '@/lib/format'
import { carEquivalentKm } from '@/lib/emissions'
import { caloriesBurned, treeAbsorptionDays } from '@/lib/journeyImpact'

const props = defineProps({
  modes: { type: Array, required: true },
  distanceKm: { type: Number, required: true },
  originLabel: { type: String, default: '' },
  destinationLabel: { type: String, default: '' },
  returnTrip: { type: Boolean, default: false },
  selectedModeKey: { type: String, default: null },
  logging: { type: Boolean, default: false }
})

const emit = defineEmits(['update:selectedModeKey', 'log'])
const shortPlace = (label) => label.split(',')[0].trim()

const rows = computed(() => {
  const baseline = props.modes.find((mode) => mode.isBaseline)
  if (!baseline) return []

  const grams = props.modes.map((mode) => mode.factor * props.distanceKm)
  const maxGrams = Math.max(...grams, 0)

  return props.modes
    .map((mode, index) => {
      const emissionsGrams = grams[index]
      return {
        ...mode,
        emissionsGrams,
        equivalentCarKm: carEquivalentKm(
          props.distanceKm,
          mode.factor,
          baseline.factor
        ),
        treeDays: mode.isBaseline
          ? null
          : treeAbsorptionDays(Math.max(0, (baseline.factor - mode.factor) * props.distanceKm / 1000)),
        calories: caloriesBurned(mode.modeKey, props.distanceKm),
        width: maxGrams > 0 ? `${(emissionsGrams / maxGrams) * 100}%` : '0%'
      }
    })
    .sort((a, b) => b.emissionsGrams - a.emissionsGrams || a.label.localeCompare(b.label))
})

const selectedMode = computed(() =>
  rows.value.find((mode) => mode.modeKey === props.selectedModeKey)
)
</script>

<template>
  <section class="card comparison" aria-labelledby="comparison-heading">
    <header>
      <h2 id="comparison-heading">Emissions for this trip</h2>
      <p class="route">
        <span>{{ shortPlace(originLabel) || 'Journey' }}</span>
        <template v-if="originLabel || destinationLabel">
          <span aria-hidden="true">→</span>
          <span>{{ shortPlace(destinationLabel) || 'Destination' }}</span>
        </template>
        <span aria-hidden="true">·</span>
        <span>{{ formatKm(distanceKm) }} {{ returnTrip ? 'return' : 'one way' }}</span>
      </p>
      <p class="hint">
        Grams CO₂e generated per trip (Note: CO2e is a measurement of carbon dioxide equivalent averaged over 100 years)
      </p>
    </header>

    <ol v-if="rows.length" class="rows">
      <li v-for="mode in rows" :key="mode.modeKey">
        <label class="row" :class="{ selected: mode.modeKey === selectedModeKey }">
          <input type="radio" name="trip-mode" :value="mode.modeKey" :checked="mode.modeKey === selectedModeKey"
            @change="emit('update:selectedModeKey', mode.modeKey)">
          <span class="row-content">
            <span class="row-heading">
              <span class="mode-name">
                <strong>{{ mode.label }}</strong>

              </span>
              <strong class="value">
                {{ formatNumber(mode.emissionsGrams, mode.emissionsGrams < 10 ? 1 : 0) }} g CO₂e </strong>
            </span>
            <span class="track" role="img"
              :aria-label="`${mode.label}: ${formatNumber(mode.factor, 0)} grams CO₂e per passenger-kilometre`">
              <span class="bar" :class="{ baseline: mode.isBaseline }" :style="{ width: mode.width }" />
            </span>
            <span class="row-detail">
              <small v-if="!mode.isBaseline" class="mode-context">
                <template v-if="mode.calories > 0">
                  {{ formatNumber(mode.calories, 0) }} kcal -
                </template>
                {{ formatNumber(mode.treeDays, 1) }} tree-days
              </small>
              <span>{{ formatNumber(mode.equivalentCarKm, 1) }} km equivalent by average car</span>
            </span>
          </span>
        </label>
      </li>
    </ol>

    <footer v-if="rows.length" class="log-action">
      <p v-if="!selectedMode" class="hint">Select the method of travel for this trip.</p>
      <p v-if="rows.length" class="equivalent-note">
        Calories are estimates. Tree-days show an approximate CO₂ absorption-time equivalent.
      </p>
      <button type="button" class="log-button" :disabled="!selectedMode || logging"
        @click="emit('log', selectedMode?.modeKey)">
        {{ logging ? 'Logging trip…' : `Confirm ${selectedMode?.label ?? 'selected mode'}` }}
      </button>

    </footer>

  </section>
</template>

<style scoped>
.comparison {
  display: grid;
  gap: 1.25rem;
  background: var(--ink);
  color: var(--on-ink);
  border-color: var(--ink-border);
}

header h2 {
  margin: 0;
  color: var(--on-ink);
}

.route {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin: 0.25rem 0 0;
  color: var(--on-ink-accent);
  font-size: 0.9375rem;
  font-weight: 600;
}

.hint {
  margin: 0.25rem 0 0;
  color: var(--on-ink-2);
  font-size: 0.875rem;
}

.rows {
  display: grid;
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.row {
  display: grid;
  grid-template-columns: 1.25rem minmax(0, 1fr);
  align-items: start;
  gap: 0.75rem;
  padding: 0.875rem;
  border: 1px solid var(--ink-border);
  border-radius: var(--radius-md);
  background: var(--ink-2);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.row:hover {
  border-color: var(--on-ink-muted);
}

.row.selected {
  border-color: var(--on-ink-accent);
  background: var(--ink-3);
}

.row input {
  width: 1.125rem;
  height: 1.125rem;
  margin: 0.125rem 0 0;
  accent-color: var(--on-ink-accent);
  cursor: pointer;
}

.row-content {
  display: grid;
  gap: 0.5rem;
  min-width: 0;
}

.row-heading,
.row-detail {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem 1rem;
}

.mode-name {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.375rem 0.625rem;
}

.mode-context {
  color: var(--on-ink-3);
  font-size: 0.75rem;
  font-weight: 400;
}

.value {
  font-variant-numeric: tabular-nums;
  color: var(--on-ink);
}

.track {
  height: 0.625rem;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--ink-border);
}

.bar {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--on-ink-accent);
}

.bar.baseline {
  background: var(--series-1);
}

.row-detail {
  color: var(--on-ink-2);
  font-size: 0.8125rem;
}

.equivalent-note {
  margin: -0.5rem 0 0;
  color: var(--on-ink-3);
  font-size: 0.75rem;
}

.log-action {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding-top: 0.25rem;
  border-top: 1px solid var(--ink-border);
}

.log-action .hint {
  margin: 0;
}

.log-action .hint strong {
  color: var(--on-ink);
}

.log-button {
  min-height: 44px;
  margin-left: auto;
  background: var(--on-ink-accent);
  color: var(--ink);
}

.log-button:hover:not(:disabled) {
  background: var(--accent-strong);
}

.comparison a {
  color: var(--on-ink-accent);
}

@media (max-width: 34rem) {
  .row {
    padding: 0.75rem;
  }

  .log-button {
    width: 100%;
  }
}
</style>
