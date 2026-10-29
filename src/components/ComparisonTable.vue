<script setup>
import { ref } from 'vue'
import { formatCo2, formatNumber } from '@/lib/format'

defineProps({
  results: { type: Array, required: true }
})

// Every chart in the app has a table equivalent (NFR-4). Collapsed by default
// so it does not crowd the page, but always reachable by keyboard.
const open = ref(false)
</script>

<template>
  <div class="table-view">
    <button class="secondary toggle" :aria-expanded="open" @click="open = !open">
      {{ open ? 'Hide' : 'Show' }} the data table
    </button>

    <table v-if="open" class="data">
      <caption class="visually-hidden">
        CO₂ equivalent emissions by transport mode for this journey
      </caption>
      <thead>
        <tr>
          <th scope="col">Mode</th>
          <th scope="col" class="num">Factor (g/passenger-km)</th>
          <th scope="col" class="num">This journey (kg CO₂e)</th>
          <th scope="col" class="num">Saved vs driving (kg)</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in results" :key="r.modeKey">
          <th scope="row">{{ r.label }}</th>
          <td class="num">{{ formatNumber(r.factor, 0) }}</td>
          <td class="num">{{ formatCo2(r.kg) }}</td>
          <td class="num">{{ r.isBaseline ? '—' : formatCo2(r.savedVsBaselineKg) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.table-view { margin-top: 1rem; }
.toggle { font-size: 0.85rem; padding: 0.35rem 0.7rem; }
table { margin-top: 0.75rem; }
</style>
