<script setup>
import { computed } from 'vue'
import { formatCo2 } from '@/lib/format'

const props = defineProps({
  /** ModeResult[] from lib/emissions.compare(), already sorted cleanest-first. */
  results: { type: Array, required: true },
  /** mode_key the user has selected as the one they actually took, if any. */
  selectedKey: { type: String, default: null },
  distanceKm: { type: Number, default: null }
})

const max = computed(() => Math.max(...props.results.map((r) => r.kg), 0.0001))

/** Bar width as a percentage of the widest bar. */
function widthPct(kg) {
  return kg <= 0 ? 0 : Math.max((kg / max.value) * 100, 1.5)
}
</script>

<template>
  <figure class="chart">
    <figcaption>
      <h3>CO₂e for this journey</h3>
      <p class="muted">
        Kilograms of CO₂ equivalent, cleanest first<span v-if="distanceKm">
          · {{ distanceKm.toFixed(1) }} km</span
        >
      </p>
    </figcaption>

    <!--
      A single measure across categories: one hue, no legend, every bar directly
      labelled. The baseline and the user's selection are marked with text chips,
      never with colour alone.
    -->
    <ul class="bars">
      <li v-for="r in results" :key="r.modeKey" :class="{ selected: r.modeKey === selectedKey }">
        <span class="label">
          {{ r.label }}
          <span v-if="r.isBaseline" class="chip">baseline</span>
          <span v-if="r.modeKey === selectedKey" class="chip chip-selected">your trip</span>
        </span>
        <span class="track">
          <span class="bar" :style="{ width: widthPct(r.kg) + '%' }" aria-hidden="true" />
          <span class="value">{{ formatCo2(r.kg) }}</span>
        </span>
      </li>
    </ul>
  </figure>
</template>

<style scoped>
.chart figcaption h3 { margin-bottom: 0.15rem; }
.chart figcaption p { margin-bottom: 1rem; }

.bars { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.6rem; }

.bars li { display: grid; grid-template-columns: minmax(7.5rem, 11rem) 1fr; gap: 0.75rem; align-items: center; }

.label {
  font-size: 0.9rem;
  color: var(--text-primary);
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  align-items: center;
}

.chip {
  font-size: 0.68rem;
  font-weight: 650;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  border: 1px solid var(--axis);
  color: var(--text-secondary);
}
.chip-selected { border-color: var(--status-good); color: var(--success-text); }

.track { display: flex; align-items: center; gap: 0.5rem; min-height: 1.25rem; }

/* Thin mark, rounded data-end, anchored to the baseline at the left. */
.bar {
  height: 0.9rem;
  background: var(--seq-450);
  border-radius: 0 4px 4px 0;
  min-width: 0;
}
.selected .bar { background: var(--status-good); }

.value {
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
  white-space: nowrap;
}

@media (max-width: 520px) {
  .bars li { grid-template-columns: 1fr; gap: 0.2rem; }
}
</style>
