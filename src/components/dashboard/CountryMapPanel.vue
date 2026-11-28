<script setup>
import { computed, ref } from 'vue'
import WorldEmissionsMap from '@/components/dashboard/WorldEmissionsMap.vue'
import { useCountriesStore } from '@/stores/countries'
import { formatNumber } from '@/lib/format'
import { EMISSION_BINS, EMISSION_RAMP, binIndex } from '@/lib/series'

/** E5.3 — the world map, its selected-country panel and the range key. */
const props = defineProps({
  selected: { type: String, required: true },
  selectedName: { type: String, default: '' }
})
const emit = defineEmits(['select'])

const countries = useCountriesStore()
const highlightBin = ref(null)

const snapshot = computed(() => countries.snapshot)

const ranked = computed(() =>
  [...snapshot.value]
    .filter((r) => Number(r.transport_mt_co2e) > 0)
    .sort((a, b) => Number(b.transport_mt_co2e) - Number(a.transport_mt_co2e))
)

const binCounts = computed(() => {
  const out = EMISSION_BINS.map(() => 0)
  for (const r of snapshot.value) {
    const i = binIndex(r.transport_mt_co2e)
    if (i >= 0) out[i] += 1
  }
  return out
})

const selectedRow = computed(
  () => snapshot.value.find((r) => r.country_code === props.selected) ?? null
)

const selectedRank = computed(() => {
  const i = ranked.value.findIndex((r) => r.country_code === props.selected)
  return i === -1 ? null : i + 1
})

const selectedBin = computed(() =>
  selectedRow.value ? binIndex(selectedRow.value.transport_mt_co2e) : -1
)

const leader = computed(() => ranked.value[0] ?? null)

const shareOfLeader = computed(() => {
  if (!selectedRow.value || !leader.value) return '0%'
  const pct =
    (Number(selectedRow.value.transport_mt_co2e) / Number(leader.value.transport_mt_co2e)) * 100
  return `${Math.max(pct, 1).toFixed(1)}%`
})

function toggleBin(i) {
  highlightBin.value = highlightBin.value === i ? null : i
}
</script>

<template>
  <section class="card map-card" aria-labelledby="map-heading">
    <header class="map-head">
      <div>
        <h2 id="map-heading">
          Around the world<span v-if="countries.snapshotYear">, {{ countries.snapshotYear }}</span>
        </h2>
        <p class="sub">
          Countries coloured by their transport emissions. Select a country on the map,
          or a range in the key to highlight it.
        </p>
      </div>
    </header>

    <div class="map-row">
      <div class="map-pane">
        <WorldEmissionsMap
          :rows="snapshot"
          :year="countries.snapshotYear"
          :selected="selected"
          :highlight-bin="highlightBin"
          @select="emit('select', $event)"
        />
      </div>

      <aside class="pane">
        <span class="pane-label">Selected</span>
        <span class="pane-name">{{ selectedName }}</span>
        <span class="pane-figure">
          {{ selectedRow ? formatNumber(selectedRow.transport_mt_co2e, 1) : '—' }}
          <span class="pane-unit">Mt CO₂e</span>
        </span>

        <span v-if="selectedBin >= 0" class="pane-bin">
          <span class="swatch" :style="{ background: EMISSION_RAMP[selectedBin] }" aria-hidden="true" />
          {{ EMISSION_BINS[selectedBin].label }} Mt range
        </span>

        <div v-if="selectedRank" class="pane-rank">
          <span>Rank <strong>{{ selectedRank }}</strong> of {{ ranked.length }} countries</span>
          <span class="htrack"><span class="hfill" :style="{ width: shareOfLeader }" /></span>
          <span class="pane-note">
            Compared with the largest emitter shown ({{ leader?.country_name }})
          </span>
        </div>

        <a href="#trend-heading" class="pane-zoom">See its trend</a>
      </aside>
    </div>

    <!-- The key doubles as a filter: picking a band dims the rest, which is
         the only way to see where a single band actually sits. -->
    <div class="legend">
      <span class="legend-unit">Mt CO₂e</span>
      <button
        v-for="(b, i) in EMISSION_BINS"
        :key="b.label"
        type="button"
        class="bin"
        :class="{ on: highlightBin === i }"
        :aria-pressed="String(highlightBin === i)"
        @click="toggleBin(i)"
      >
        <span class="swatch" :style="{ background: EMISSION_RAMP[i] }" aria-hidden="true" />
        {{ b.label }}
        <span class="count">{{ binCounts[i] }}</span>
      </button>
      <button v-if="highlightBin !== null" type="button" class="clear" @click="highlightBin = null">
        Show all
      </button>
    </div>
  </section>
</template>

<style scoped>
.map-card { display: flex; flex-direction: column; gap: 1rem; }
.map-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 0.625rem; }
.map-head h2 { margin: 0; font-size: 1.25rem; }
.sub { margin: 0.125rem 0 0; font-size: 0.8125rem; color: var(--text-secondary); }

/*
 * The map takes every pixel the panel does not need. Stretch rather than
 * start-aligned, so the map grows to the panel's height instead of floating
 * above a strip of empty card.
 */
.map-row { display: flex; flex-wrap: wrap; gap: 1.25rem; align-items: stretch; }
.map-pane { flex: 999 1 560px; min-width: 0; display: flex; }

.pane {
  flex: 1 1 220px;
  max-width: 280px;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 1.125rem;
}
/* Below the wrap point the panel is full width, so the cap must lift or it
   sits in a narrow column with the rest of the row empty beside it. */
@media (max-width: 900px) {
  .pane { max-width: none; }
}
.pane-label { font-size: 0.75rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-secondary); }
.pane-name { font-family: var(--font-display); font-size: 1.25rem; font-weight: 600; line-height: 1.15; }
.pane-figure { font-family: var(--font-display); font-size: 2rem; font-weight: 600; letter-spacing: -0.02em; color: var(--accent); line-height: 1.05; }
.pane-unit { font-size: 1rem; color: var(--text-secondary); }

.pane-bin {
  display: inline-flex;
  align-self: flex-start;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.625rem;
  border-radius: var(--radius-pill);
  background: var(--page);
  font-size: 0.75rem;
  font-weight: 600;
}
.swatch { width: 14px; height: 14px; border-radius: 4px; border: 1px solid var(--axis); flex: none; }

.pane-rank { display: flex; flex-direction: column; gap: 0.375rem; font-size: 0.8125rem; color: var(--text-secondary); }
.pane-rank strong { color: var(--text-primary); }
.pane-note { font-size: 0.75rem; }

.htrack { display: block; height: 8px; border-radius: var(--radius-pill); background: var(--surface-2); overflow: hidden; }
.hfill {
  display: block;
  height: 100%;
  background: var(--accent);
  transition: width 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
}

/* An anchor, not a button: it moves the reader to the trend section, which is
   navigation. Styled as a button because that is what it looks like it does. */
.pane-zoom {
  margin-top: auto;
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background: var(--ink);
  color: var(--on-ink);
  font-size: 0.8125rem;
  font-weight: 600;
  text-decoration: none;
}
.pane-zoom:hover { color: var(--on-ink); opacity: 0.9; }

.legend { display: flex; flex-wrap: wrap; align-items: center; gap: 0.375rem; }
.legend-unit { font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); margin-right: 0.25rem; }
.bin {
  min-height: 34px;
  padding: 0 0.625rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface-1);
  color: var(--text-primary);
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
}
.bin:hover { border-color: var(--axis); }
.bin.on { border-color: var(--accent); background: var(--accent-soft); }
.count { color: var(--text-secondary); font-weight: 500; }

.clear { min-height: 34px; padding: 0 0.625rem; border: 0; background: transparent; color: var(--accent); font-size: 0.75rem; font-weight: 600; }
</style>
