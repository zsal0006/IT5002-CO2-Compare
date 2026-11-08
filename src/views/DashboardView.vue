<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import EmissionsTrend from '@/components/EmissionsTrend.vue'
import DecadeBars from '@/components/DecadeBars.vue'
import WorldEmissionsMap from '@/components/WorldEmissionsMap.vue'
import { useCountriesStore } from '@/stores/countries'
import { formatNumber } from '@/lib/format'
import { DEFAULT_COUNTRY_A3 } from '@/lib/locale'
import {
  EMISSION_BINS, EMISSION_RAMP, binIndex,
  percentChange, signedPercent, usableRows
} from '@/lib/series'

/** E5 — national transport emissions: the scale of the problem, by country. */
const countries = useCountriesStore()

const selected = ref(DEFAULT_COUNTRY_A3)
const highlightBin = ref(null)

onMounted(async () => {
  await Promise.all([countries.loadList(), countries.loadSnapshot()])
  await countries.loadSeries(selected.value)
})

watch(selected, (code) => countries.loadSeries(code))

const selectedName = computed(
  () =>
    countries.list.find((c) => c.country_code === selected.value)?.country_name ??
    selected.value
)

const rows = computed(() => countries.series[selected.value] ?? [])
const points = computed(() => usableRows(rows.value))
const latest = computed(() => points.value.at(-1) ?? null)

/** Headline context: is the most recent year the highest on record? */
const peak = computed(() =>
  points.value.length ? points.value.reduce((a, b) => (b.value > a.value ? b : a)) : null
)

const sinceStart = computed(() => {
  if (points.value.length < 2) return null
  return percentChange(points.value[0].value, latest.value.value)
})

const versus2019 = computed(() => {
  const y2019 = points.value.find((p) => p.year === 2019)
  if (!y2019 || !latest.value || latest.value.year <= 2019) return null
  return percentChange(y2019.value, latest.value.value)
})

const subtitle = computed(() => {
  if (!latest.value || !peak.value) return ''
  const multiple = points.value.length
    ? latest.value.value / points.value[0].value
    : null
  if (peak.value.year === latest.value.year) {
    return multiple
      ? `The highest in the ${points.value.length}-year record, about ${multiple.toFixed(1)} times the ${points.value[0].year} level.`
      : `The highest in the ${points.value.length}-year record.`
  }
  return `Below the ${peak.value.year} peak of ${formatNumber(peak.value.value, 1)} Mt.`
})

/**
 * The national figure translated into the unit the rest of the app works in.
 *
 * It is a comparison, not a claim about anyone's commute: it says how many
 * average-car journeys of this length it would take to match a country's
 * transport emissions, which is the only way a nine-figure tonnage becomes
 * imaginable. The assumption is printed beside it.
 */
const BASELINE_TRIP_KG = 4.99
const tripsPerSecond = computed(() => {
  if (!latest.value) return null
  const kg = latest.value.value * 1e9 // Mt -> kg
  return kg / BASELINE_TRIP_KG / (365 * 24 * 3600)
})

// --- map ------------------------------------------------------------------

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
  () => snapshot.value.find((r) => r.country_code === selected.value) ?? null
)

const selectedRank = computed(() => {
  const i = ranked.value.findIndex((r) => r.country_code === selected.value)
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
  <section class="container page">
    <header class="intro">
      <div>
        <h1>Transport emissions by country</h1>
        <p>
          Transport is one of the largest and fastest-growing sources of greenhouse gas
          emissions. See how much of a country's total it accounts for, and how that has
          moved since 1970.
        </p>
      </div>
      <p class="source-chip">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <ellipse cx="12" cy="5" rx="8" ry="3" />
          <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
        </svg>
        GIZ / transport-data.org · 1970–2024
      </p>
    </header>

    <p v-if="countries.error" class="notice error">{{ countries.error }}</p>

    <!-- E5.1 -->
    <section class="hero" aria-labelledby="dash-heading">
      <div class="picker">
        <label for="country">Country</label>
        <select id="country" v-model="selected" :disabled="!countries.list.length">
          <option v-for="c in countries.list" :key="c.country_code" :value="c.country_code">
            {{ c.country_name }}
          </option>
        </select>
        <span class="or">or pick one on the map below</span>
      </div>

      <div v-if="latest">
        <h1 id="dash-heading">
          {{ selectedName }}'s transport emitted
          <span class="figure">{{ formatNumber(latest.value, 1) }} Mt</span>
          CO₂e in {{ latest.year }}
        </h1>
        <p class="hero-sub">{{ subtitle }}</p>
      </div>
      <p v-else class="hero-sub">No data for this country yet.</p>

      <div v-if="latest" class="hero-cards">
        <div class="hcard">
          <span class="hlabel">Share of national emissions</span>
          <span class="hvalue">
            {{ latest.sharePct == null ? '—' : `${formatNumber(latest.sharePct, 1)}%` }}
          </span>
          <span v-if="latest.sharePct != null" class="htrack" aria-hidden="true">
            <span class="hfill" :style="{ width: `${Math.min(100, latest.sharePct)}%` }" />
          </span>
          <span class="hnote">
            {{ latest.sharePct == null
              ? 'National total not reported'
              : `About 1 tonne in every ${Math.round(100 / latest.sharePct)}` }}
          </span>
        </div>

        <div class="hcard">
          <span class="hlabel">Change since {{ points[0]?.year }}</span>
          <span class="hvalue">{{ signedPercent(sinceStart, 0) }}</span>
          <span class="hnote">
            From {{ formatNumber(points[0]?.value ?? 0, 1) }} Mt to
            {{ formatNumber(latest.value, 1) }} Mt
          </span>
        </div>

        <div class="hcard">
          <span class="hlabel">Versus pre-pandemic (2019)</span>
          <span class="hvalue blue">{{ signedPercent(versus2019) }}</span>
          <span class="hnote">
            {{ versus2019 == null
              ? 'No 2019 figure in this record'
              : versus2019 >= 0 ? 'Rebounded past the 2019 level' : 'Still below the 2019 level' }}
          </span>
        </div>

        <div class="hcard accent">
          <span class="hlabel">In Compare terms</span>
          <span class="hvalue">
            {{ tripsPerSecond ? formatNumber(tripsPerSecond, 0) : '—' }} trips/sec
          </span>
          <span class="hnote">
            Average-car journeys of {{ BASELINE_TRIP_KG }} kg each, every second of the year
          </span>
        </div>
      </div>
    </section>

    <!-- E5.2 -->
    <EmissionsTrend :rows="rows" :country-name="selectedName" />

    <!-- E5.3 -->
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
            @select="selected = $event"
          />
        </div>

        <aside class="pane">
          <label for="map-pick" class="pane-label">Selected</label>
          <select id="map-pick" v-model="selected" :disabled="!countries.list.length">
            <option v-for="c in countries.list" :key="c.country_code" :value="c.country_code">
              {{ c.country_name }}
            </option>
          </select>

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
            <span class="htrack"><span class="hfill paper" :style="{ width: shareOfLeader }" /></span>
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

    <DecadeBars :rows="rows" :country-name="selectedName" />

    <p class="muted footnote">
      Source: GIZ / transport-data.org, country-level yearly GHG emissions from the
      transport sector, 1970–2024. Country boundaries from Natural Earth (public domain).
      International aviation and shipping are excluded — they belong to no country. Full
      detail on <RouterLink to="/learn">how we calculate this</RouterLink>.
    </p>
  </section>
</template>

<style scoped>
.page { padding: 2rem 0 3.5rem; display: flex; flex-direction: column; gap: 1.25rem; }

.intro { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 0.75rem 1.5rem; }
.intro > div { max-width: 680px; }
.intro h1 { margin: 0; font-size: clamp(1.75rem, 4vw, 2.125rem); }
.intro p { margin: 0.5rem 0 0; }

.source-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-pill);
  background: var(--surface-1);
  border: 1px solid var(--border);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
}

/* --- hero (ink) --------------------------------------------------------- */
.hero {
  background: var(--ink);
  color: var(--on-ink);
  border-radius: var(--radius);
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.375rem;
}

.picker { display: flex; flex-wrap: wrap; align-items: center; gap: 0.625rem 0.875rem; }
.picker label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--on-ink-3);
}
.picker select {
  height: 46px;
  min-width: 220px;
  width: auto;
  border: 1px solid var(--ink-border);
  border-radius: var(--radius-sm);
  background: var(--ink-2);
  color: var(--on-ink);
  font-weight: 600;
}
.or { font-size: 0.8125rem; color: var(--on-ink-3); }

.hero h1 {
  margin: 0;
  font-size: clamp(1.75rem, 4.4vw, 2.625rem);
  line-height: 1.1;
  color: var(--on-ink);
  max-width: 820px;
}
.figure { color: var(--on-ink-accent); }
.hero-sub { margin: 0.625rem 0 0; color: var(--on-ink-2); font-size: 1rem; max-width: 640px; }

.hero-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; }
.hcard {
  background: var(--ink-2);
  border: 1px solid var(--ink-border);
  border-radius: var(--radius-lg);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}
.hcard.accent { background: #13301f; border-color: #1f5133; }
.hlabel { font-size: 0.75rem; color: var(--on-ink-3); }
.hcard.accent .hlabel, .hcard.accent .hnote { color: #bbf7d0; }
.hvalue { font-family: var(--font-display); font-size: 1.625rem; font-weight: 600; }
.hvalue.blue { color: var(--on-ink-series-1); }
.hnote { font-size: 0.75rem; color: var(--on-ink-3); }

.htrack { display: block; height: 8px; border-radius: var(--radius-pill); background: var(--ink-border); overflow: hidden; }
.hfill {
  display: block;
  height: 100%;
  background: var(--on-ink-accent);
  transition: width 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.hfill.paper { background: var(--accent); }

/* --- map ---------------------------------------------------------------- */
.map-card { display: flex; flex-direction: column; gap: 1rem; }
.map-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 0.625rem; }
.map-head h2 { margin: 0; font-size: 1.25rem; }
.sub { margin: 0.125rem 0 0; font-size: 0.8125rem; color: var(--text-secondary); }
.small { min-height: 36px; font-size: 0.8125rem; padding: 0 0.875rem; display: inline-flex; align-items: center; gap: 0.375rem; }

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
.pane select { height: 40px; }
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
.pane-rank .htrack { background: var(--surface-2); }
.pane-note { font-size: 0.75rem; }

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

.footnote { margin: 0; max-width: 860px; }

@media (max-width: 560px) {
  .hero { padding: 1.25rem; border-radius: var(--radius-lg); }
  .picker select { min-width: 0; width: 100%; }
}
</style>
