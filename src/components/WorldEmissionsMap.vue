<script setup>
import { onMounted, onBeforeUnmount, ref, watch, computed } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { formatNumber } from '@/lib/format'

/**
 * Choropleth of transport-sector emissions by country (E5.3).
 *
 * Deliberately has no basemap tiles: a photographic basemap under a choropleth
 * competes with the very thing the fill is encoding, and it would put us on a
 * tile server for no informational gain. Leaflet here is a projection and
 * pan/zoom engine over a single GeoJSON layer.
 */

const props = defineProps({
  /** [{ country_code (alpha-3), country_name, transport_mt_co2e }] for one year. */
  rows: { type: Array, required: true },
  year: { type: [Number, String], default: null },
  /** alpha-3 of the country selected elsewhere on the page; gets a ring. */
  selected: { type: String, default: null }
})
const emit = defineEmits(['select'])

const container = ref(null)
const status = ref('loading')
let map = null
let layer = null

const byCode = computed(() => new Map(props.rows.map((r) => [r.country_code, r])))

/**
 * Sequential single-hue ramp, light to dark. Transport emissions are heavily
 * skewed — a handful of countries dwarf the rest — so the breaks are quantiles
 * of the actual data rather than equal intervals, and the legend prints the
 * real range of each bin so the non-linearity is visible rather than hidden.
 */
const LIGHT_RAMP = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b']

function isDark() {
  const attr = document.documentElement.getAttribute('data-theme')
  if (attr) return attr === 'dark'
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

// On a dark surface the near-zero end must recede towards the surface, so the
// ramp runs dark-to-light instead of light-to-dark. Same hue, same steps.
const ramp = computed(() => (isDark() ? [...LIGHT_RAMP].reverse() : LIGHT_RAMP))

const breaks = computed(() => {
  const values = props.rows
    .map((r) => Number(r.transport_mt_co2e))
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b)
  if (!values.length) return []
  const n = ramp.value.length
  return Array.from({ length: n - 1 }, (_, i) =>
    values[Math.floor(((i + 1) / n) * (values.length - 1))]
  )
})

function colourFor(value) {
  if (!Number.isFinite(value) || value <= 0) return 'transparent'
  const idx = breaks.value.findIndex((b) => value <= b)
  return ramp.value[idx === -1 ? ramp.value.length - 1 : idx]
}

function styleFor(feature) {
  const row = byCode.value.get(feature.id)
  const value = row ? Number(row.transport_mt_co2e) : NaN
  const isSelected = feature.id === props.selected
  return {
    fillColor: colourFor(value),
    fillOpacity: Number.isFinite(value) && value > 0 ? 0.95 : 0.15,
    // A 1px surface-coloured stroke keeps adjacent fills from bleeding together;
    // the selected country gets a heavier ring, which is a shape cue, not a hue.
    color: isSelected ? getCss('--text-primary') : getCss('--surface-1'),
    weight: isSelected ? 2.5 : 1
  }
}

function getCss(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function onEachFeature(feature, lyr) {
  const row = byCode.value.get(feature.id)
  const name = row?.country_name || feature.properties?.name || feature.id
  const value = row ? Number(row.transport_mt_co2e) : null

  lyr.bindTooltip(
    `<strong>${escapeHtml(name)}</strong><br>${
      value == null ? 'No data' : `${formatNumber(value, 1)} Mt CO₂e`
    }`,
    { sticky: true, direction: 'top' }
  )

  lyr.on({
    mouseover: () => lyr.setStyle({ weight: 2.5, color: getCss('--text-primary') }),
    mouseout: () => lyr.setStyle(styleFor(feature)),
    click: () => row && emit('select', feature.id),
    keydown: (e) => e.originalEvent.key === 'Enter' && row && emit('select', feature.id)
  })
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  )
}

async function build() {
  try {
    const res = await fetch('/geo/countries.geo.json')
    if (!res.ok) throw new Error(String(res.status))
    const geo = await res.json()

    map = L.map(container.value, {
      attributionControl: false,
      zoomControl: true,
      worldCopyJump: false,
      minZoom: 1,
      maxZoom: 6
    })
    layer = L.geoJSON(geo, { style: styleFor, onEachFeature }).addTo(map)
    map.fitBounds(layer.getBounds(), { padding: [4, 4] })
    status.value = 'ready'
  } catch (err) {
    console.warn('[CO2 Compare] world map could not load:', err.message)
    status.value = 'error'
  }
}

function restyle() {
  if (!layer) return
  layer.eachLayer((lyr) => lyr.setStyle(styleFor(lyr.feature)))
}

onMounted(build)
onBeforeUnmount(() => map?.remove())
watch(() => [props.rows, props.selected], restyle, { deep: true })

const showTable = ref(false)
const ranked = computed(() =>
  [...props.rows]
    .filter((r) => Number(r.transport_mt_co2e) > 0)
    .sort((a, b) => Number(b.transport_mt_co2e) - Number(a.transport_mt_co2e))
)
</script>

<template>
  <figure class="map-figure">
    <figcaption>
      <h3>Transport emissions by country</h3>
      <p class="muted">
        Megatonnes of CO₂e from the transport sector<span v-if="year"> in {{ year }}</span>.
        Select a country to load its trend.
      </p>
    </figcaption>

    <div v-if="status === 'error'" class="notice error">
      The country boundary file is missing. Download
      <code>countries.geo.json</code> into <code>public/geo/</code> — see
      §6.4 of the setup guide.
    </div>

    <div v-show="status === 'ready'" ref="container" class="map" role="img"
         aria-label="World map shaded by transport-sector emissions. The same figures are in the table below." />

    <!-- The legend prints real bin ranges, so the quantile scaling is visible. -->
    <ul v-if="status === 'ready' && breaks.length" class="legend">
      <li v-for="(colour, i) in ramp" :key="i">
        <span class="swatch" :style="{ background: colour }" aria-hidden="true" />
        <span class="range">
          {{ i === 0 ? '0' : formatNumber(breaks[i - 1], 0) }}–{{
            i === ramp.length - 1 ? 'max' : formatNumber(breaks[i], 0)
          }}
        </span>
      </li>
      <li class="unit">Mt CO₂e</li>
    </ul>

    <button class="secondary toggle" :aria-expanded="showTable" @click="showTable = !showTable">
      {{ showTable ? 'Hide' : 'Show' }} the data table
    </button>

    <div v-if="showTable" class="scroll">
      <table class="data">
        <caption class="visually-hidden">Transport emissions by country</caption>
        <thead>
          <tr>
            <th scope="col">Country</th>
            <th scope="col" class="num">Transport emissions (Mt CO₂e)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in ranked" :key="r.country_code">
            <th scope="row">{{ r.country_name }}</th>
            <td class="num">{{ formatNumber(r.transport_mt_co2e, 1) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </figure>
</template>

<style scoped>
.map-figure { margin: 0; }
.map-figure figcaption h3 { margin-bottom: 0.15rem; }
.map-figure figcaption p { margin-bottom: 0.75rem; }

.map {
  height: 380px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--page);
}
.map :deep(.leaflet-container) { background: var(--page); font-family: var(--font); }
.map :deep(.leaflet-tooltip) {
  background: var(--surface-1);
  color: var(--text-primary);
  border: 1px solid var(--axis);
  box-shadow: none;
}

.legend { display: flex; flex-wrap: wrap; align-items: center; gap: 0.1rem 0.6rem; list-style: none; padding: 0; margin: 0.6rem 0 0; }
.legend li { display: flex; align-items: center; gap: 0.3rem; font-size: 0.72rem; color: var(--text-muted); font-variant-numeric: tabular-nums; }
.swatch { width: 14px; height: 10px; border-radius: 2px; }
.unit { font-weight: 600; }

.toggle { margin-top: 0.75rem; font-size: 0.85rem; padding: 0.35rem 0.7rem; }
.scroll { max-height: 320px; overflow: auto; margin-top: 0.75rem; }
</style>
