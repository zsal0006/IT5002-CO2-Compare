<script setup>
import { formatNumber } from '@/lib/format'

defineProps({
  weather: { type: Object, required: true }
})
</script>

<template>
  <div class="weather-strip" role="group" aria-label="Weather at your start">
    <div class="weather-main">
      <strong class="weather-temp">{{ formatNumber(weather.tempC, 0) }}°C</strong>
      <span class="weather-cond">
        {{ weather.condition }}
        <small>Now at your start</small>
      </span>
    </div>
    <ul class="weather-stats">
      <li><span>Feels like</span><strong>{{ formatNumber(weather.feelsLikeC, 0) }}°C</strong></li>
      <li><span>Wind</span><strong>{{ formatNumber(weather.windKph, 0) }} km/h</strong></li>
      <li><span>Rain</span><strong>{{ formatNumber(weather.rainChancePct, 0) }}%</strong></li>
      <li><span>UV</span><strong>{{ formatNumber(weather.uv, 0) }}</strong></li>
    </ul>
  </div>
</template>

<style scoped>
.weather-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1.25rem;
  margin: 0.75rem 0 0;
  padding: 0.75rem 0.875rem;
  border: 1px solid var(--ink-border);
  border-radius: var(--radius-md);
  background: var(--ink-2);
  color: var(--on-ink-2);
}

.weather-main {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.weather-temp {
  color: var(--on-ink);
  font-size: 1.75rem;
  line-height: 1;
}

.weather-cond {
  display: grid;
  font-size: 0.9375rem;
  color: var(--on-ink);
}

.weather-cond small {
  color: var(--on-ink-2);
  font-size: 0.75rem;
}

.weather-stats {
  display: grid;
  grid-template-columns: repeat(4, auto);
  gap: 0.25rem 1.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.weather-stats li {
  display: grid;
  font-size: 0.75rem;
}

.weather-stats strong {
  color: var(--on-ink);
  font-size: 0.9375rem;
}

@media (max-width: 480px) {
  .weather-stats {
    grid-template-columns: repeat(2, 1fr);
    width: 100%;
  }
}
</style>
