<script setup>
import { onMounted } from 'vue'
import { useFactorsStore } from '@/stores/factors'
import { formatNumber } from '@/lib/format'
import { OSM_ATTRIBUTION } from '@/lib/geocode'

// FR-20: methodology, sources and limitations, stated plainly.
const factorsStore = useFactorsStore()
onMounted(() => factorsStore.load())

const limitations = [
  'One distance is used for every mode. A real cycle route and a motorway route between the same two points are not the same length.',
  'Emission factors are national or regional averages, not the specific vehicle or service you used.',
  'Electric vehicle figures depend on how the local grid generates electricity, which varies by country and by hour. We use a single average.',
  'Public transport factors assume average occupancy. An empty late-night bus is far worse per passenger; a full one far better.',
  'The savings baseline is a convention, not a measured counterfactual — it does not claim you would otherwise have driven.',
  'Walking and cycling are zero on an operational basis, not a lifecycle basis. Making a bicycle has a carbon cost; so does the extra food you eat.',
  'Logged trips are unverified and unauthenticated. The community total shows engagement with this tool, not audited emissions reductions.'
]
</script>

<template>
  <section class="container prose">
    <h1>How this works</h1>

    <h2>The calculation</h2>
    <p>
      We geocode your two locations, ask a routing service for the road distance
      between them, and multiply that distance by a published emission factor for
      each transport mode:
    </p>
    <pre><code>emissions (kg CO₂e) = distance (km) × factor (g per passenger-km) ÷ 1000</code></pre>
    <p>
      Factors are expressed per <strong>passenger</strong>-kilometre, not per
      vehicle-kilometre. A car carrying four people emits roughly the same as a car
      carrying one, but each passenger's share is a quarter of it.
    </p>

    <h2>What "CO₂ saved" means</h2>
    <p>
      When you log a trip, we record the difference between what an average car would
      have emitted over that distance and what your chosen mode emitted. The number is
      labelled <em>saved versus driving</em> throughout, because that is exactly what it
      is. It is not a claim that you would otherwise have driven, and choosing a mode
      worse than the baseline records zero rather than a negative.
    </p>

    <h2>Emission factors in use</h2>
    <table class="data">
      <caption class="visually-hidden">Emission factors by transport mode</caption>
      <thead>
        <tr>
          <th scope="col">Mode</th>
          <th scope="col" class="num">g CO₂e / passenger-km</th>
          <th scope="col">Notes</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="f in factorsStore.factors" :key="f.mode_key">
          <th scope="row">{{ f.mode_label }}</th>
          <td class="num">{{ formatNumber(f.factor_g_per_pkm, 0) }}</td>
          <td class="note">{{ f.notes }}</td>
        </tr>
      </tbody>
    </table>

    <h2>Where the data comes from</h2>
    <ul class="sources">
      <li v-for="s in factorsStore.sources" :key="s.source_id">
        <a :href="s.url" target="_blank" rel="noopener noreferrer">{{ s.title }}</a>
        — {{ s.publisher }}. Licence: {{ s.licence }}. Retrieved {{ s.retrieved_on }}.
      </li>
      <li v-if="!factorsStore.sources.length" class="muted">
        Source details load from the database; they are unavailable right now.
      </li>
    </ul>
    <p class="muted">
      Geocoding and routing: Nominatim and OSRM. {{ OSM_ATTRIBUTION }}.
    </p>

    <h2>Limitations you should know about</h2>
    <ul class="limits">
      <li v-for="(l, i) in limitations" :key="i">{{ l }}</li>
    </ul>

    <h2>Your privacy</h2>
    <p>
      We store nothing that identifies you. A logged trip records only its distance, the
      transport mode, and a two-letter country code. Start and end coordinates are never
      sent to our database — a home-to-work pair is close to unique, so keeping it would
      undermine the anonymity the rest of the design relies on. There are no accounts, no
      cookies, and no tracking.
    </p>
  </section>
</template>

<style scoped>
.prose { max-width: 70ch; margin-block: 1.5rem 4rem; }
.prose h2 { margin-top: 2rem; }
pre {
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 0.75rem 1rem;
  overflow-x: auto;
  font-size: 0.85rem;
}
table { margin-bottom: 1rem; }
.note { color: var(--text-secondary); font-size: 0.85rem; }
.sources, .limits { padding-left: 1.2rem; color: var(--text-secondary); }
.sources li, .limits li { margin-bottom: 0.5rem; }
</style>
