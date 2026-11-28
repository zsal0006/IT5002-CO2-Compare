<script setup>
import { computed } from 'vue'
import { decadeAverages, signedPercent, usableRows } from '@/lib/series'
import { formatNumber } from '@/lib/format'

/**
 * Mean emissions per decade, and growth on the decade before.
 *
 * Decade means rather than end-of-decade values: a single year can be a
 * pandemic or an oil shock, and the question here is the trend underneath that
 * noise. The final bar is usually a part-decade, so it carries its real year
 * range as its label instead of a decade name.
 *
 * Bars share one hue because they are one series over time; the most recent
 * decade is darker to mark where the reader is.
 */
const props = defineProps({
  rows: { type: Array, required: true },
  countryName: { type: String, default: '' }
})

const decades = computed(() => {
  const list = decadeAverages(usableRows(props.rows))
  const max = Math.max(...list.map((d) => d.average), 0.0001)
  return list.map((d, i) => ({
    ...d,
    width: `${Math.max((d.average / max) * 100, 2).toFixed(1)}%`,
    latest: i === list.length - 1
  }))
})
</script>

<template>
  <section v-if="decades.length > 1" class="decades" aria-labelledby="decade-heading">
    <h3 id="decade-heading">Decade by decade</h3>
    <p class="unit">Average Mt CO₂e a year, and growth on the decade before.</p>

    <ul class="rows">
      <li v-for="d in decades" :key="d.decade">
        <span class="name">{{ d.label }}</span>
        <span class="track">
          <span class="bar" :class="{ latest: d.latest }" :style="{ width: d.width }" />
        </span>
        <span class="value">{{ formatNumber(d.average, 0) }}</span>
        <span class="growth">{{ d.growth == null ? 'start' : signedPercent(d.growth, 0) }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.decades { display: flex; flex-direction: column; gap: 0.375rem; }
h3 { margin: 0; font-size: 0.9375rem; }
.unit { margin: 0 0 0.25rem; font-size: 0.75rem; color: var(--text-secondary); }
.rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; }
.rows li { display: grid; grid-template-columns: 3.25rem minmax(0, 1fr) 2.25rem 2.5rem; align-items: center; gap: 0.5rem; font-size: 0.75rem; }
.name { font-weight: 600; }
.track { height: 10px; border-radius: var(--radius-pill); background: var(--surface-2); overflow: hidden; }
.bar { display: block; height: 100%; background: var(--seq-250); border-radius: var(--radius-pill); transition: width 0.8s cubic-bezier(0.2, 0.8, 0.2, 1); }
.bar.latest { background: var(--accent); }
.value { font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
.growth { text-align: right; color: var(--text-secondary); font-size: 0.6875rem; font-weight: 600; }
</style>
