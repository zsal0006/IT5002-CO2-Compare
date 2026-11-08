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
 * Bars share one hue because they are one series over time, not categories.
 * The most recent decade is darker to mark where the reader is, which is a
 * position cue rather than a second meaning.
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
    height: `${Math.max((d.average / max) * 100, 2).toFixed(1)}%`,
    latest: i === list.length - 1
  }))
})
</script>

<template>
  <section v-if="decades.length > 1" class="card decades" aria-labelledby="decade-heading">
    <header>
      <h2 id="decade-heading">Decade by decade<span v-if="countryName"> · {{ countryName }}</span></h2>
      <p class="sub">Average yearly emissions, and growth on the decade before.</p>
    </header>

    <!-- The figure above each bar is the value; the bar is only its relative
         size, so nothing here is readable by length alone. -->
    <div class="chart">
      <div v-for="d in decades" :key="d.decade" class="col">
        <span class="value">{{ formatNumber(d.average, 0) }}</span>
        <span class="bar" :class="{ latest: d.latest }" :style="{ height: d.height }" />
      </div>
    </div>

    <div class="labels">
      <div v-for="d in decades" :key="d.decade" class="label">
        <span class="name">{{ d.label }}</span>
        <span class="growth">{{ d.growth == null ? 'start' : signedPercent(d.growth, 0) }}</span>
      </div>
    </div>

    <p class="muted unit">Megatonnes of CO₂e a year, averaged over each decade.</p>
  </section>
</template>

<style scoped>
.decades { display: flex; flex-direction: column; gap: 0.875rem; padding: 1.375rem; }
.decades h2 { margin: 0; font-size: 1.25rem; }
.sub { margin: 0.125rem 0 0; font-size: 0.8125rem; color: var(--text-secondary); }

.chart { display: flex; align-items: flex-end; gap: 0.875rem; height: 200px; padding-top: 1.5rem; }
.col {
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  gap: 0.375rem;
}
.value { font-size: 0.75rem; font-weight: 700; font-variant-numeric: tabular-nums; }

.bar {
  display: block;
  width: 100%;
  max-width: 120px;
  background: var(--seq-250);
  border-radius: 8px 8px 3px 3px;
  transition: height 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.bar.latest { background: var(--accent); }

.labels { display: flex; gap: 0.875rem; }
.label { flex: 1; min-width: 0; text-align: center; display: flex; flex-direction: column; }
.name { font-size: 0.75rem; font-weight: 600; }
.growth { font-size: 0.6875rem; font-weight: 600; color: var(--text-secondary); }

.unit { margin: 0; }
</style>
