<script setup>
/**
 * A small set of mutually exclusive choices, as one pill-shaped control.
 *
 * Used three times on the Impact page — scope, measure, sort — so it exists
 * once rather than three times. `tone` picks which surface family it is sitting
 * on: "ink" for the dark hero, "paper" for the white cards. Getting that wrong
 * is the one way to make it illegible, which is why it is an explicit prop
 * rather than something inherited.
 */
defineProps({
  /** [{ value, label }] */
  options: { type: Array, required: true },
  modelValue: { type: [String, Number], default: null },
  tone: { type: String, default: 'paper' }, // paper | ink
  ariaLabel: { type: String, required: true }
})
defineEmits(['update:modelValue'])
</script>

<template>
  <div class="seg" :class="tone" role="group" :aria-label="ariaLabel">
    <button
      v-for="o in options"
      :key="o.value"
      type="button"
      class="opt"
      :class="{ on: o.value === modelValue }"
      :aria-pressed="String(o.value === modelValue)"
      @click="$emit('update:modelValue', o.value)"
    >
      {{ o.label }}
    </button>
  </div>
</template>

<style scoped>
.seg { display: inline-flex; gap: 2px; border-radius: var(--radius-md); }
.seg.paper { padding: 3px; background: var(--surface-2); }
.seg.ink { padding: 4px; background: var(--ink-3); }

.opt {
  min-height: 34px;
  padding: 0 0.75rem;
  border: 0;
  border-radius: 8px;
  background: transparent;
  font-size: 0.75rem;
  font-weight: 600;
  transition: background 0.2s, color 0.2s;
}
.ink .opt { min-height: 38px; padding: 0 1rem; border-radius: 9px; font-size: 0.8125rem; }

.paper .opt { color: var(--text-secondary); }
.ink .opt { color: var(--on-ink-2); }

.paper .opt:hover, .ink .opt:hover { color: var(--text-primary); }
.ink .opt:hover { color: var(--on-ink); }

.paper .opt.on {
  background: var(--surface-1);
  color: var(--text-primary);
  box-shadow: 0 1px 3px rgba(21, 23, 26, 0.14);
}
.ink .opt.on { background: #ffffff; color: var(--ink); }

.ink .opt:focus-visible { outline: 2px solid var(--on-ink-accent); outline-offset: 2px; }
</style>
