<script setup>
/**
 * The co-benefits, as tiles you switch between.
 *
 * Each tile is a button, not a card: picking one changes what the pictogram
 * panel below draws. The tile therefore states its own figure AND stays
 * pressable, so a reader who never clicks still gets every number.
 *
 * Presentation only — the figures, labels and bases come from
 * lib/benefits.benefitMetrics(). The `tone` each metric carries picks a swatch
 * here rather than in the library, so the maths file holds no colours.
 */
defineProps({
  /** BenefitMetric[] from lib/benefits.benefitMetrics(). */
  metrics: { type: Array, required: true },
  selected: { type: String, default: null }
})
defineEmits(['select'])
</script>

<template>
  <div class="tiles" role="group" aria-label="Choose a benefit to visualise">
    <button
      v-for="m in metrics"
      :key="m.key"
      type="button"
      class="tile"
      :class="[m.tone, { on: m.key === selected }]"
      :aria-pressed="String(m.key === selected)"
      @click="$emit('select', m.key)"
    >
      <span class="top">
        <span class="icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <template v-if="m.key === 'money'">
              <circle cx="12" cy="12" r="9" />
              <path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .9-3 2s1.3 1.7 3 2 3 .9 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v2M12 16v2" />
            </template>
            <template v-else-if="m.key === 'tree'">
              <path d="M12 22v-6M12 16c4 0 7-2.5 7-6.5S16 2 12 2 5 5.5 5 9.5 8 16 12 16z" />
            </template>
            <template v-else-if="m.key === 'fuel'">
              <path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M6 9h6M14 8l3 3v6a1.5 1.5 0 0 0 3 0v-7l-3-3" />
            </template>
            <template v-else-if="m.key === 'steps'">
              <path d="M7 3c2 0 3 2 3 5s-1 5-3 5-3-2-3-5 1-5 3-5zM5 16h4v3a2 2 0 0 1-4 0zM17 7c2 0 3 2 3 5s-1 5-3 5-3-2-3-5 1-5 3-5zM15 20h4" />
            </template>
            <template v-else>
              <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 1 2 2 3 3 3 1-3 0-6 0-8z" />
            </template>
          </svg>
        </span>
        <span class="hint">{{ m.key === selected ? 'Showing' : 'See it' }}</span>
      </span>

      <span class="value">{{ m.formatted }}</span>
      <span class="label">{{ m.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.75rem;
}

.tile {
  position: relative;
  text-align: left;
  padding: 1.125rem;
  border-radius: var(--radius-lg);
  border: 2px solid var(--ink-border);
  background: var(--ink-2);
  color: var(--on-ink);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 0;
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s, background 0.2s;
}
.tile:hover { transform: translateY(-3px); box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35); }
.tile:focus-visible { outline: 2px solid var(--on-ink-accent); outline-offset: 2px; }

.tile.on {
  border-color: var(--on-ink-accent);
  background: #13301f;
  transform: translateY(-3px);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
}

.top { display: flex; justify-content: space-between; align-items: center; }

.icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* One swatch per metric family, carried as `tone` so the maths file holds no
   colour. All five are fixed ink-family values: this panel never flips. */
.series-1 .icon { background: #172554; color: var(--on-ink-series-1); }
.accent .icon { background: #13301f; color: var(--on-ink-accent); }
.neutral .icon { background: var(--ink-border); color: var(--on-ink-2); }
.warm .icon { background: #3b1420; color: #fda4af; }

.hint {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--on-ink-3);
}
.tile.on .hint { color: var(--on-ink-accent); }

.value {
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.1;
}

.label { font-size: 0.8125rem; color: var(--on-ink-3); line-height: 1.4; }
</style>
