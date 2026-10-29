<script setup>
import { computed } from 'vue'

/**
 * Horizontal bars for a single measure across categories.
 *
 * One hue for every bar: the bars encode magnitude, and length already carries
 * it, so colour would be decoration. Every bar is directly labelled with its
 * value, and anything that needs calling out (a baseline, the user's choice)
 * gets a text chip rather than a colour of its own.
 */
const props = defineProps({
  /**
   * [{ key, label, value:number, valueLabel:string,
   *    chips?: [{ text, tone?: 'good' }], highlight?: boolean }]
   * Pass them in the order you want them drawn.
   */
  items: { type: Array, required: true },
  labelWidth: { type: String, default: 'minmax(7.5rem, 11rem)' }
})

const max = computed(() => Math.max(...props.items.map((i) => Number(i.value) || 0), 0.0001))

function widthPct(value) {
  const n = Number(value) || 0
  return n <= 0 ? 0 : Math.max((n / max.value) * 100, 1.5)
}
</script>

<template>
  <ul class="bars" :style="{ '--label-width': labelWidth }">
    <li v-for="item in items" :key="item.key" :class="{ highlight: item.highlight }">
      <span class="label">
        {{ item.label }}
        <span
          v-for="chip in item.chips ?? []"
          :key="chip.text"
          class="chip"
          :class="{ good: chip.tone === 'good' }"
        >{{ chip.text }}</span>
      </span>
      <span class="track">
        <span class="bar" :style="{ width: widthPct(item.value) + '%' }" aria-hidden="true" />
        <span class="value">{{ item.valueLabel }}</span>
      </span>
    </li>
  </ul>
</template>

<style scoped>
.bars { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.6rem; }
.bars li { display: grid; grid-template-columns: var(--label-width) 1fr; gap: 0.75rem; align-items: center; }

.label { font-size: 0.9rem; color: var(--text-primary); display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: center; }

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
.chip.good { border-color: var(--status-good); color: var(--success-text); }

.track { display: flex; align-items: center; gap: 0.5rem; min-height: 1.25rem; }

/* Thin mark, 4px rounded data-end, anchored to the baseline at the left. */
.bar { height: 0.9rem; background: var(--seq-450); border-radius: 0 4px 4px 0; min-width: 0; }
.highlight .bar { background: var(--status-good); }

.value { font-size: 0.85rem; font-variant-numeric: tabular-nums; color: var(--text-secondary); white-space: nowrap; }

@media (max-width: 520px) {
  .bars li { grid-template-columns: 1fr; gap: 0.2rem; }
}
</style>
