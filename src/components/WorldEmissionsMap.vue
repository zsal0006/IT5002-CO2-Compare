<script setup>
import { computed, onMounted, ref } from 'vue'
import { formatNumber } from '@/lib/format'
import { EMISSION_RAMP, binIndex } from '@/lib/series'

/**
 * Choropleth of transport-sector emissions by country (E5.3).
 *
 * ---------------------------------------------------------------------------
 * WHY THIS DRAWS ITS OWN SVG
 *
 * It used to be Leaflet. Leaflet projects to Web Mercator, which inflates area
 * with latitude — Greenland ends up the size of Africa. On a choropleth that
 * is not a cosmetic problem: the reader judges "how much" partly by how much
 * ink a country occupies, so Mercator silently overstates every high-latitude
 * country and understates the tropics. Equirectangular still distorts shape,
 * but it distorts it evenly across the map rather than as a function of the
 * thing being read.
 *
 * Dropping Leaflet also removes a tile/pan/zoom engine we were using for
 * neither tiles nor, really, panning — and its ~150 kB.
 *
 * ANTARCTICA IS NOT DRAWN. It has no transport emissions to report, it has no
 * population, and under this projection it would occupy the bottom third of
 * the frame. Cutting the view at 58°S hands that space to the countries the
 * chart is actually about. The footnote says so.
 * ---------------------------------------------------------------------------
 */
const props = defineProps({
  /** [{ country_code (alpha-3), country_name, transport_mt_co2e }] for one year. */
  rows: { type: Array, required: true },
  year: { type: [Number, String], default: null },
  /** alpha-3 selected elsewhere on the page; gets a heavy outline. */
  selected: { type: String, default: null },
  /** Bin index to highlight, or null for all. */
  highlightBin: { type: Number, default: null }
})
const emit = defineEmits(['select'])

// Equirectangular. Longitude spans the full globe; latitude is cut below
// Antarctica and just above Greenland's northern tip (83.6°N).
const LON_MIN = -180
const LON_MAX = 180
const LAT_MAX = 84
const LAT_MIN = -58
const WIDTH = 1000
const HEIGHT = Math.round((WIDTH * (LAT_MAX - LAT_MIN)) / (LON_MAX - LON_MIN))

const NO_DATA = '#d5dbe0'
const SKIP = new Set(['ATA', 'ATF']) // Antarctica and the French Southern Territories

const shapes = ref([])
const status = ref('loading')

const project = (lon, lat) => [
  ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * WIDTH,
  ((LAT_MAX - Math.max(LAT_MIN, Math.min(LAT_MAX, lat))) / (LAT_MAX - LAT_MIN)) * HEIGHT
]

/** One ring -> one "M … Z" subpath. */
function ringToPath(ring) {
  let out = ''
  for (let i = 0; i < ring.length; i++) {
    const [x, y] = project(ring[i][0], ring[i][1])
    out += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
  }
  return `${out}Z`
}

function geometryToPath(geometry) {
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.map(ringToPath).join('')
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.map((poly) => poly.map(ringToPath).join('')).join('')
  }
  return ''
}

onMounted(async () => {
  try {
    const res = await fetch('/geo/countries.geo.json')
    if (!res.ok) throw new Error(String(res.status))
    const geo = await res.json()

    shapes.value = geo.features
      .filter((f) => f.id && !SKIP.has(f.id))
      .map((f) => ({
        code: f.id,
        name: f.properties?.name ?? f.id,
        d: geometryToPath(f.geometry)
      }))
      .filter((s) => s.d)

    status.value = 'ready'
  } catch (err) {
    console.warn('[CO2 Compare] world map could not load:', err.message)
    status.value = 'error'
  }
})

const byCode = computed(() => new Map(props.rows.map((r) => [r.country_code, r])))

const painted = computed(() =>
  shapes.value.map((s) => {
    const row = byCode.value.get(s.code)
    const value = row ? Number(row.transport_mt_co2e) : null
    const bin = binIndex(value)
    const dimmed = props.highlightBin != null && bin !== props.highlightBin

    return {
      ...s,
      name: row?.country_name ?? s.name,
      value,
      bin,
      fill: bin === -1 ? NO_DATA : EMISSION_RAMP[bin],
      opacity: dimmed ? 0.25 : 1,
      interactive: Boolean(row),
      title:
        value == null
          ? `${row?.country_name ?? s.name}: no data`
          : `${row?.country_name ?? s.name}: ${formatNumber(value, 1)} Mt CO₂e`
    }
  })
)

/** Drawn last and separately so neighbouring fills cannot overdraw its edge. */
const selectedShape = computed(
  () => painted.value.find((s) => s.code === props.selected) ?? null
)

const label = computed(() => {
  const n = props.rows.filter((r) => Number(r.transport_mt_co2e) > 0).length
  return (
    `World map shaded by transport-sector emissions${props.year ? ` in ${props.year}` : ''}, ` +
    `${n} countries. Antarctica is not shown. The same figures are in the ranked ` +
    'table below, and the country selector beside this map does the same job without a mouse.'
  )
})
</script>

<template>
  <div class="map-wrap">
    <div v-if="status === 'error'" class="notice error">
      The country boundary file is missing. Download
      <code>countries.geo.json</code> into <code>public/geo/</code> — see §6.4b of the
      setup guide.
    </div>

    <!--
      `meet` rather than the default stretch: the map keeps its proportions and
      centres in whatever box the layout gives it. The sea colour is on the
      element rather than only on the <rect>, so the letterboxed margin reads as
      more sea instead of as a gap.
    -->
    <svg
      v-else
      class="map"
      :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      :aria-label="label"
    >
      <rect x="0" y="0" :width="WIDTH" :height="HEIGHT" class="sea" />

      <path
        v-for="s in painted"
        :key="s.code"
        :d="s.d"
        class="country"
        :class="{ clickable: s.interactive }"
        :style="{ fill: s.fill, opacity: s.opacity }"
        @click="s.interactive && emit('select', s.code)"
      >
        <title>{{ s.title }}</title>
      </path>

      <path v-if="selectedShape" :d="selectedShape.d" class="selected" />
    </svg>
  </div>
</template>

<style scoped>
.map-wrap { display: flex; width: 100%; min-height: 100%; }

/*
 * A flat pale wash for sea. It encodes nothing and carries no detail, so it
 * cannot compete with the fill, which is the only thing on this map that means
 * something.
 *
 * The element fills its pane in both directions and the viewBox centres inside
 * it, so the map grows with the column beside it instead of leaving a ragged
 * strip of card below.
 */
.map {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 260px;
  background: #eaf1f5;
  border-radius: var(--radius-lg);
}

.sea { fill: #eaf1f5; }

.country {
  stroke: #ffffff;
  stroke-width: 0.6;
  vector-effect: non-scaling-stroke;
  transition: fill 0.5s ease, opacity 0.25s ease;
}
.country.clickable { cursor: pointer; }
.country.clickable:hover { filter: brightness(0.88); }

/* A heavy dark outline rather than a different fill: a shape cue survives both
   colour-blindness and the dimming that the legend's filter applies. */
.selected {
  fill: none;
  stroke: var(--text-primary);
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
  pointer-events: none;
}
</style>
