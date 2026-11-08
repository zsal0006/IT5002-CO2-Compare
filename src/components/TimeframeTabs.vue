<script setup>
import { TIMEFRAMES } from '@/lib/timeframe'

/**
 * Trip / Week / Month / Year, plus the trips-per-week the last three depend on.
 *
 * The slider only appears once a timeframe needs it. Showing it against "Trip"
 * would imply this journey's figure depends on how often you make it, which it
 * does not — that figure is the journey as calculated.
 */
defineProps({
  modelValue: { type: String, required: true },
  tripsPerWeek: { type: Number, required: true }
})
defineEmits(['update:modelValue', 'update:tripsPerWeek'])
</script>

<template>
  <div class="timeframe">
    <div class="tabs" role="group" aria-label="Timeframe">
      <button
        v-for="t in TIMEFRAMES"
        :key="t.key"
        type="button"
        class="tab"
        :class="{ on: t.key === modelValue }"
        :aria-pressed="String(t.key === modelValue)"
        @click="$emit('update:modelValue', t.key)"
      >
        {{ t.label }}
      </button>
    </div>

    <div v-if="modelValue !== 'trip'" class="freq pop">
      <label for="trips-per-week">One-way trips per week</label>
      <input
        id="trips-per-week"
        type="range"
        min="1"
        max="14"
        step="1"
        :value="tripsPerWeek"
        @input="$emit('update:tripsPerWeek', Number($event.target.value))"
      />
      <output for="trips-per-week">{{ tripsPerWeek }}</output>
    </div>
  </div>
</template>

<style scoped>
.timeframe { display: flex; flex-direction: column; gap: 0.875rem; }

.tabs {
  display: flex;
  align-self: flex-start;
  padding: 4px;
  background: var(--ink-3);
  border-radius: var(--radius-md);
  gap: 2px;
}

.tab {
  min-height: 38px;
  min-width: 64px;
  padding: 0 0.875rem;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--on-ink-2);
  font-size: 0.8125rem;
  font-weight: 600;
  transition: background 0.2s, color 0.2s;
}
.tab.on { background: #ffffff; color: var(--ink); }
.tab:focus-visible { outline: 2px solid var(--on-ink-accent); outline-offset: 2px; }

.freq {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
  padding: 0.75rem 1rem;
  border: 1px dashed var(--ink-border);
  border-radius: var(--radius-md);
}

.freq label { font-size: 0.8125rem; font-weight: 600; color: var(--on-ink-2); }

.freq input[type='range'] {
  flex: 1 1 200px;
  accent-color: var(--on-ink-accent);
  height: 28px;
}

/* The live value, repeated beside the slider: a range input announces its
   number to assistive tech but shows nothing to everyone else. */
.freq output {
  min-width: 44px;
  text-align: center;
  padding: 0.25rem 0.625rem;
  border-radius: var(--radius-pill);
  background: var(--on-ink-accent);
  color: var(--ink);
  font-size: 0.875rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
</style>
