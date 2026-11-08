<script setup>
import { computed } from 'vue'
import { pictogramUnits } from '@/lib/benefits'

/**
 * One benefit drawn as a row of counted glyphs.
 *
 * A pictogram is an honest chart only if the unit is stated and every glyph is
 * the same size, so the unit sits in a chip beside the title and the last glyph
 * fades to show a part unit rather than being drawn smaller. Scaling the glyph
 * itself would encode the remainder as area, which readers consistently
 * over-estimate.
 *
 * The whole row is one `role="img"` with the figure in its label: forty
 * separate glyphs announced one at a time would be unusable, and the number is
 * already on the tile above.
 */
const props = defineProps({
  /** A single BenefitMetric from lib/benefits.benefitMetrics(). */
  metric: { type: Object, default: null }
})

const units = computed(() => (props.metric ? pictogramUnits(props.metric) : null))

const glyphs = computed(() => {
  if (!units.value) return []
  const { count, full, fraction } = units.value
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    delay: `${i * 25}ms`,
    opacity: i === full ? Math.max(0.3, fraction).toFixed(2) : '1'
  }))
})
</script>

<template>
  <div v-if="metric" class="panel">
    <div class="head">
      <span class="title">{{ metric.title }}</span>
      <span class="unit">{{ units.unitLabel }}</span>
    </div>

    <div class="row" role="img" :aria-label="`${metric.formatted} — ${metric.title}`">
      <span
        v-for="g in glyphs"
        :key="g.id"
        class="glyph"
        :style="{ animationDelay: g.delay, opacity: g.opacity }"
      >
        <svg v-if="metric.key === 'money'" width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
          <circle cx="13" cy="13" r="11" fill="#f6c453" stroke="#a16207" stroke-width="1.5" />
          <circle cx="13" cy="13" r="7" fill="none" stroke="#a16207" stroke-width="1" stroke-dasharray="2 2" />
        </svg>

        <svg v-else-if="metric.key === 'tree'" width="26" height="30" viewBox="0 0 26 30" aria-hidden="true">
          <rect x="11.5" y="19" width="3" height="10" rx="1" fill="#a07a55" />
          <circle cx="13" cy="12" r="10" fill="#22c55e" />
          <circle cx="9" cy="10" r="3" fill="#4ade80" />
        </svg>

        <svg v-else-if="metric.key === 'fuel'" width="22" height="28" viewBox="0 0 22 28" aria-hidden="true">
          <path d="M11 2C11 2 3 12 3 18a8 8 0 0 0 16 0C19 12 11 2 11 2z" fill="#d3d7dd" />
          <path d="M7.5 18a3.5 3.5 0 0 0 3.5 3.5" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" />
        </svg>

        <svg v-else-if="metric.key === 'steps'" width="24" height="28" viewBox="0 0 24 28" aria-hidden="true">
          <ellipse cx="7" cy="9" rx="4" ry="6" fill="#4ade80" />
          <rect x="4" y="16" width="6" height="5" rx="2.5" fill="#4ade80" />
          <ellipse cx="17" cy="12" rx="4" ry="6" fill="#86efac" />
          <rect x="14" y="19" width="6" height="5" rx="2.5" fill="#86efac" />
        </svg>

        <svg v-else width="22" height="28" viewBox="0 0 22 28" aria-hidden="true">
          <path d="M11 1c1 5 8 8 8 16a8 8 0 0 1-16 0c0-4 3-7 4-10 1 3 2 4 4 4 1-4 0-7 0-10z" fill="#fb7185" />
          <path d="M11 13c1 2 4 4 4 7a4 4 0 0 1-8 0c0-2 2-3 2-5 1 1 2 1 2-2z" fill="#fde68a" />
        </svg>
      </span>
    </div>

    <p class="basis">{{ metric.basis }}</p>
  </div>
</template>

<style scoped>
.panel {
  background: var(--ink-2);
  border: 1px solid var(--ink-border);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  min-height: 150px;
}

.head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
}

.title { font-size: 0.9375rem; font-weight: 600; color: var(--on-ink); }

.unit {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--on-ink-2);
  background: var(--ink-border);
  border-radius: var(--radius-pill);
  padding: 0.25rem 0.625rem;
}

.row { display: flex; flex-wrap: wrap; gap: 0.375rem; align-items: flex-end; }

.glyph {
  display: inline-flex;
  animation: co2-popin 0.35s cubic-bezier(0.3, 1.4, 0.5, 1) both;
}

.basis { margin: 0; font-size: 0.8125rem; color: var(--on-ink-3); line-height: 1.45; }
</style>
