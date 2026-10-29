<script setup>
import { computed } from 'vue'
import BarList from '@/components/BarList.vue'
import { formatCo2 } from '@/lib/format'

const props = defineProps({
  /** ModeResult[] from lib/emissions.compare(), already sorted cleanest-first. */
  results: { type: Array, required: true },
  /** mode_key the user has selected as the one they actually took, if any. */
  selectedKey: { type: String, default: null },
  distanceKm: { type: Number, default: null }
})

const items = computed(() =>
  props.results.map((r) => {
    const chips = []
    if (r.isBaseline) chips.push({ text: 'baseline' })
    if (r.modeKey === props.selectedKey) chips.push({ text: 'your trip', tone: 'good' })
    return {
      key: r.modeKey,
      label: r.label,
      value: r.kg,
      valueLabel: formatCo2(r.kg),
      chips,
      highlight: r.modeKey === props.selectedKey
    }
  })
)
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

    <BarList :items="items" />
  </figure>
</template>

<style scoped>
.chart { margin: 0; }
.chart figcaption h3 { margin-bottom: 0.15rem; }
.chart figcaption p { margin-bottom: 1rem; }
</style>
