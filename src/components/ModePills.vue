<script setup>
import { computed } from 'vue'
import { shortName } from '@/lib/modeIcons'

/**
 * The alternatives to driving, as a single scrollable row of pills.
 *
 * The baseline is deliberately absent: this row answers "instead of driving,
 * try…", and offering the car as an alternative to itself is noise. The full
 * list including the car lives in the comparison chart below.
 *
 * Sits on the ink panel, so it uses the --on-ink-* tokens throughout.
 */
const props = defineProps({
  /** ModeResult[] from lib/emissions.compare(), cleanest first. */
  modes: { type: Array, required: true },
  modelValue: { type: String, default: null }
})
defineEmits(['update:modelValue'])

const options = computed(() =>
  props.modes
    .filter((m) => !m.isBaseline)
    .map((m) => ({ ...m, short: shortName(m.modeKey, m.label) }))
)
</script>

<template>
  <div class="pills-block">
    <p class="eyebrow">Instead of driving, try</p>
    <div class="pills" role="group" aria-label="Choose a mode to compare">
      <button
        v-for="m in options"
        :key="m.modeKey"
        type="button"
        class="pill"
        :class="{ on: m.modeKey === modelValue }"
        :aria-pressed="String(m.modeKey === modelValue)"
        @click="$emit('update:modelValue', m.modeKey)"
      >
        {{ m.short }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.pills-block { display: flex; flex-direction: column; gap: 0.5rem; }

.eyebrow {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--on-ink-3);
}

/* Horizontal scroll rather than wrapping: twelve pills over three lines would
   push the headline below the fold on a phone. */
.pills {
  display: flex;
  gap: 0.375rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
  scrollbar-width: thin;
}

.pill {
  flex: none;
  min-height: 40px;
  padding: 0 0.875rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--ink-border);
  background: transparent;
  color: #e5e7eb;
  font-size: 0.8125rem;
  font-weight: 600;
  white-space: nowrap;
  transition: background 0.2s, color 0.2s, border-color 0.2s;
}
.pill:hover { border-color: var(--on-ink-3); }

.pill.on {
  background: var(--on-ink-accent);
  border-color: var(--on-ink-accent);
  color: var(--ink);
}

.pill:focus-visible { outline: 2px solid var(--on-ink-accent); outline-offset: 2px; }
</style>
