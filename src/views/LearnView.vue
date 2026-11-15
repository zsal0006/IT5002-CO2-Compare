<script setup>
import { onMounted } from 'vue'
import { useFactorsStore } from '@/stores/factors'
import { formatNumber } from '@/lib/format'

// FR-20: methodology, sources and limitations, stated plainly.
const factorsStore = useFactorsStore()
onMounted(() => factorsStore.load())

const limitations = [
  'One distance is used for every mode. A real cycle route and a motorway route between the same two points are not the same length.',
  'Emission factors are national or regional averages, not the specific vehicle or service you used.',
  'Car emissions vary by vehicle and occupancy. This comparison uses one fleet-average car factor, so an individual vehicle may differ.',
  'Public transport factors assume average occupancy. An empty late-night bus is far worse per passenger; a full one far better.',
  'The savings baseline is a convention, not a measured counterfactual — it does not claim you would otherwise have driven.',
  'Walking and cycling are zero on an operational basis, not a lifecycle basis. Making a bicycle has a carbon cost; so does the extra food you eat.',
  'Logged trips are unverified and unauthenticated. The community total shows engagement with this tool, not audited emissions reductions.'
]
</script>

<template>
  <section class="container prose">
    <h1>How this works</h1>

    <h2>Comparing a trip</h2>
    <p>
      We geocode your two locations, ask a routing service for the road distance
      between them, and multiply that distance by each mode's published emissions
      intensity. Factors are grams of CO₂-equivalent per passenger-kilometre:
    </p>
    <pre><code>trip emissions (g CO₂e) = distance (km) × factor (g CO₂e / passenger-km)</code></pre>
    <p>
      CO₂e expresses different greenhouse gases as the amount of CO₂ with an
      equivalent warming impact. The common 100-year warming horizon is a
      comparison convention, not the duration of a trip. The comparison also shows
      the distance an average car would travel to produce the same estimated emissions.
    </p>
    <p>
      Factors are expressed per <strong>passenger</strong>-kilometre, not per
      vehicle-kilometre. A car carrying four people emits roughly the same as a car
      carrying one, but each passenger's share is a quarter of it.
    </p>

    <h2>Activity and tree equivalents</h2>
    <p>
      Walking and cycling show an estimated calorie burn using a 70 kg adult profile
      and typical speeds (4.8 km/h walking and 15 km/h cycling). Actual energy use
      varies with body mass, pace, terrain and other factors, so these are illustrative
      estimates rather than personal measurements.
    </p>
    <p>
      The tree-days figure is a rough CO₂e analogy based on an average absorption
      rate of 21.8 kg of CO₂ per tree per year. CO₂e includes gases other than CO₂,
      so this is not a precise biological equivalence. It does not mean a tree was
      planted or saved, and it is not a carbon offset.
    </p>

    <h2>What avoided emissions mean</h2>
    <p>
      When you log a trip, we record the difference between what an average car would
      have emitted over that distance and what your chosen mode emitted. The number is
      labelled <em>avoided versus driving</em> throughout, because that is exactly what it
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
      Address search uses Geoapify in Australia. Routes use OpenRouteService;
      the attribution returned for each route is shown with the comparison.
    </p>

    <h2>Limitations you should know about</h2>
    <ul class="limits">
      <li v-for="(l, i) in limitations" :key="i">{{ l }}</li>
    </ul>

    <h2>Your privacy</h2>
    <p>
      A logged trip records its distance, transport mode, country and state or region,
      along with a timestamp and calculated emissions. The app does not send start and
      end addresses or coordinates to the trip database. Those other trip details can
      still be sensitive when combined with other information.
    </p>
    <p>
      Address searches and selected coordinates are sent to Geoapify and
      OpenRouteService to find places and routes. This app does not save them; those
      providers process requests under their own privacy policies.
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
