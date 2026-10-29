<script setup>
import { computed, onMounted, ref } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale,
  Tooltip, Legend, Filler
} from 'chart.js'
import { formatNumber } from '@/lib/format'

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler)

const props = defineProps({
  /** [{ code, name, rows: [{ year, transport_mt_co2e }] }] — at most three. */
  series: { type: Array, required: true },
  title: { type: String, default: 'Transport-sector emissions' }
})

// Resolved from CSS so light and dark mode use their own validated steps.
const tokens = ref({})
function readTokens() {
  const s = getComputedStyle(document.documentElement)
  const get = (n) => s.getPropertyValue(n).trim()
  tokens.value = {
    series: [get('--series-1'), get('--series-2'), get('--series-3')],
    grid: get('--gridline'),
    axis: get('--axis'),
    text: get('--text-secondary'),
    muted: get('--text-muted'),
    surface: get('--surface-1')
  }
}
onMounted(readTokens)

const years = computed(() => {
  const all = new Set()
  props.series.forEach((s) => s.rows.forEach((r) => all.add(Number(r.year))))
  return [...all].sort((a, b) => a - b)
})

const chartData = computed(() => ({
  labels: years.value,
  datasets: props.series.map((s, i) => {
    // Colour follows the entity's slot, never its rank, so removing a country
    // never repaints the ones that remain.
    const colour = tokens.value.series?.[i] ?? '#2a78d6'
    const byYear = new Map(s.rows.map((r) => [Number(r.year), Number(r.transport_mt_co2e)]))
    return {
      label: s.name,
      data: years.value.map((y) => (byYear.has(y) ? byYear.get(y) : null)),
      borderColor: colour,
      backgroundColor: colour,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBorderWidth: 2,
      pointHoverBorderColor: tokens.value.surface,
      tension: 0.2,
      spanGaps: true
    }
  })
}))

const options = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  // Crosshair-style shared tooltip: hovering anywhere in the column reads every
  // series at that year.
  interaction: { mode: 'index', intersect: false },
  plugins: {
    // A legend is always present once there are two or more series.
    legend: {
      display: props.series.length > 1,
      position: 'bottom',
      labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, color: tokens.value.text }
    },
    tooltip: {
      backgroundColor: tokens.value.surface,
      titleColor: tokens.value.text,
      bodyColor: tokens.value.text,
      borderColor: tokens.value.axis,
      borderWidth: 1,
      padding: 10,
      displayColors: true,
      callbacks: {
        label: (ctx) => ` ${ctx.dataset.label}: ${formatNumber(ctx.parsed.y, 1)} Mt CO₂e`
      }
    }
  },
  scales: {
    x: {
      grid: { display: false },
      border: { color: tokens.value.axis },
      ticks: { color: tokens.value.muted, maxTicksLimit: 8, autoSkip: true }
    },
    y: {
      beginAtZero: true,
      grid: { color: tokens.value.grid, drawTicks: false },
      border: { display: false },
      ticks: { color: tokens.value.muted, maxTicksLimit: 6, callback: (v) => formatNumber(v, 0) },
      title: { display: true, text: 'Mt CO₂e', color: tokens.value.muted }
    }
  }
}))

const showTable = ref(false)
</script>

<template>
  <figure class="ts">
    <figcaption>
      <h3>{{ title }}</h3>
      <p class="muted">Megatonnes of CO₂ equivalent from the transport sector, by year.</p>
    </figcaption>

    <div class="canvas">
      <Line :data="chartData" :options="options" />
    </div>

    <button class="secondary toggle" :aria-expanded="showTable" @click="showTable = !showTable">
      {{ showTable ? 'Hide' : 'Show' }} the data table
    </button>

    <div v-if="showTable" class="scroll">
      <table class="data">
        <caption class="visually-hidden">{{ title }} by year</caption>
        <thead>
          <tr>
            <th scope="col">Year</th>
            <th v-for="s in series" :key="s.code" scope="col" class="num">{{ s.name }} (Mt)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(y, i) in years" :key="y">
            <th scope="row">{{ y }}</th>
            <td v-for="(s, j) in series" :key="s.code" class="num">
              {{ formatNumber(chartData.datasets[j].data[i], 1) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </figure>
</template>

<style scoped>
.ts figcaption h3 { margin-bottom: 0.15rem; }
.ts figcaption p { margin-bottom: 0.75rem; }
.canvas { height: 320px; }
.toggle { margin-top: 0.75rem; font-size: 0.85rem; padding: 0.35rem 0.7rem; }
.scroll { max-height: 320px; overflow: auto; margin-top: 0.75rem; }
</style>
