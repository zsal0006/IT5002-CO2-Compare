<script setup>
import { computed } from 'vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import { milestoneFor, plural } from '@/lib/community'
import { treeDaysFor, litresFor } from '@/lib/benefits'
import { formatCo2, formatNumber, countryName } from '@/lib/format'

/**
 * The community total, global or for one region.
 *
 * The equivalences underneath come from kilometres actually logged, not from
 * scaling the kilogram figure — `v_savings_by_mode` carries distance, so
 * "petrol left in the ground" is the fuel a car would have burned over the
 * car-free kilometres people really travelled. Scaling litres out of a saving
 * would be a number about a number.
 */
const props = defineProps({
  scope: { type: String, required: true }, // 'global' | 'region'
  regionKey: { type: String, default: null },
  /** Rows from v_savings_by_region, already sorted. */
  regions: { type: Array, required: true },
  /** { trips, savedKg, carFreeTrips, carFreeKm } for the current scope. */
  summary: { type: Object, required: true },
  /** Distinct countries taking part, globally. */
  countries: { type: Number, default: 0 }
})
const emit = defineEmits(['update:scope', 'update:regionKey'])

const SCOPES = [
  { value: 'global', label: 'Global' },
  { value: 'region', label: 'Region' }
]

const keyOf = (r) => `${r.country_code}|${r.region_name}`

const regionOptions = computed(() =>
  props.regions.map((r) => ({
    value: keyOf(r),
    label: `${r.region_name}, ${countryName(r.country_code)}`
  }))
)

const current = computed(
  () => props.regions.find((r) => keyOf(r) === props.regionKey) ?? null
)

const placeName = computed(() =>
  props.scope === 'global' ? 'everyone' : current.value?.region_name ?? 'this region'
)

const savedKg = computed(() => props.summary.savedKg ?? 0)

const headline = computed(() => {
  if (savedKg.value <= 0) {
    return {
      pre: props.scope === 'global'
        ? 'No CO₂ avoided yet'
        : `No CO₂ avoided in ${placeName.value} yet`,
      figure: '',
      post: ''
    }
  }
  return {
    pre: props.scope === 'global'
      ? 'Together we have avoided '
      : `${placeName.value} has avoided `,
    figure: formatCo2(savedKg.value),
    post: ' of CO₂e'
  }
})

const chips = computed(() => {
  const out = [
    { key: 'trips', num: String(props.summary.trips ?? 0), label: props.summary.trips === 1 ? 'trip logged' : 'trips logged' },
    { key: 'carfree', num: String(props.summary.carFreeTrips ?? 0), label: 'car-free' }
  ]
  if (props.scope === 'global') {
    out.push({ key: 'countries', num: String(props.countries), label: props.countries === 1 ? 'country' : 'countries' })
  } else if (current.value) {
    out.push({ key: 'country', num: countryName(current.value.country_code), label: '' })
  }
  return out
})

const equivalents = computed(() => {
  const days = treeDaysFor(savedKg.value)
  const km = props.summary.carFreeKm ?? 0
  return [
    {
      key: 'tree',
      tone: 'accent',
      value: days >= 365 ? `${(days / 365).toFixed(1)} tree-years` : plural(days, 'tree-day'),
      label: "of a mature tree's work"
    },
    {
      key: 'fuel',
      tone: 'neutral',
      value: `${formatNumber(litresFor(km), km < 100 ? 1 : 0)} litres`,
      label: 'of petrol left in the ground'
    },
    {
      key: 'km',
      tone: 'series-1',
      value: `${formatNumber(km, km < 100 ? 1 : 0)} km`,
      label: 'travelled without a car'
    }
  ]
})

const milestone = computed(() => milestoneFor(savedKg.value))

/**
 * How far off the next milestone, in commutes. Uses the average saving per
 * logged trip rather than a made-up journey, so the sentence is calibrated to
 * what people here are actually doing.
 */
const milestoneText = computed(() => {
  const m = milestone.value
  if (savedKg.value <= 0) return 'One car-free commute would make a visible dent'
  const perTrip = props.summary.trips > 0 ? savedKg.value / props.summary.trips : 0
  const togo = perTrip > 0 ? Math.ceil(m.remaining / perTrip) : null
  const base = `${formatCo2(savedKg.value)} of ${m.next} kg`
  return togo ? `${base} · about ${plural(togo, 'more trip')} to go` : base
})
</script>

<template>
  <section class="hero" aria-labelledby="impact-heading">
    <div class="controls">
      <SegmentedControl
        :options="SCOPES"
        :model-value="scope"
        tone="ink"
        aria-label="Scope"
        @update:model-value="emit('update:scope', $event)"
      />

      <template v-if="scope === 'region'">
        <label for="region-pick" class="visually-hidden">Region</label>
        <select
          id="region-pick"
          class="region"
          :value="regionKey"
          :disabled="!regionOptions.length"
          @change="emit('update:regionKey', $event.target.value)"
        >
          <option v-for="o in regionOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </template>
    </div>

    <div aria-live="polite" class="pop">
      <p class="eyebrow">{{ scope === 'global' ? 'Global total' : 'Regional total' }}</p>
      <h1 id="impact-heading">
        {{ headline.pre }}<span v-if="headline.figure" class="figure">{{ headline.figure }}</span>{{ headline.post }}
      </h1>

      <div class="chips">
        <span v-for="c in chips" :key="c.key" class="chip">
          <strong>{{ c.num }}</strong><template v-if="c.label"> {{ c.label }}</template>
        </span>
      </div>
    </div>

    <div class="equivalents">
      <div v-for="e in equivalents" :key="e.key" class="eq" :class="e.tone">
        <span class="eq-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path v-if="e.key === 'tree'" d="M12 22v-6M12 16c4 0 7-2.5 7-6.5S16 2 12 2 5 5.5 5 9.5 8 16 12 16z" />
            <path v-else-if="e.key === 'fuel'" d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M6 9h6M14 8l3 3v6a1.5 1.5 0 0 0 3 0v-7l-3-3" />
            <path v-else d="M5 15l1.6-5.2A2 2 0 0 1 8.5 8.4h7a2 2 0 0 1 1.9 1.4L19 15M4 15h16v3H4zM7 18v2M17 18v2" />
          </svg>
        </span>
        <span>
          <span class="eq-value">{{ e.value }}</span>
          <span class="eq-label">{{ e.label }}</span>
        </span>
      </div>
    </div>

    <div class="milestone">
      <div class="milestone-head">
        <span>Next milestone: <strong>{{ milestone.next }} kg</strong></span>
        <span class="milestone-detail">{{ milestoneText }}</span>
      </div>
      <div
        class="track"
        role="progressbar"
        aria-label="Progress to next milestone"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="milestone.percent"
      >
        <div class="fill" :style="{ width: `${milestone.percent}%` }" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero {
  background: var(--ink);
  color: var(--on-ink);
  border-radius: var(--radius);
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.375rem;
}

.controls { display: flex; flex-wrap: wrap; align-items: center; gap: 0.625rem 0.875rem; }

.region {
  height: 46px;
  min-width: 240px;
  width: auto;
  border: 1px solid var(--ink-border);
  border-radius: var(--radius-sm);
  padding: 0 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  background: var(--ink-2);
  color: var(--on-ink);
}

.eyebrow {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--on-ink-3);
}

.hero h1 {
  margin: 0.375rem 0 0;
  font-size: clamp(1.875rem, 5vw, 2.75rem);
  line-height: 1.08;
  color: var(--on-ink);
}
.figure { color: var(--on-ink-accent); }

.chips { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.875rem; }
.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: var(--radius-pill);
  background: var(--ink-3);
  font-size: 0.8125rem;
  color: var(--on-ink-2);
}
.chip strong { color: var(--on-ink); font-weight: 700; }

.equivalents { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; }

.eq {
  background: var(--ink-2);
  border: 1px solid var(--ink-border);
  border-radius: var(--radius-lg);
  padding: 1rem;
  display: flex;
  gap: 0.75rem;
  align-items: center;
}
.eq-icon {
  width: 40px;
  height: 40px;
  flex: none;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
}
.accent .eq-icon { background: #13301f; color: var(--on-ink-accent); }
.neutral .eq-icon { background: var(--ink-border); color: var(--on-ink-2); }
.series-1 .eq-icon { background: #172554; color: var(--on-ink-series-1); }

.eq-value { display: block; font-family: var(--font-display); font-size: 1.375rem; font-weight: 600; }
.eq-label { font-size: 0.75rem; color: var(--on-ink-3); }

.milestone { display: flex; flex-direction: column; gap: 0.5rem; }
.milestone-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--on-ink-2);
}
.milestone-head strong { color: var(--on-ink); font-weight: 700; }
.milestone-detail { color: var(--on-ink-3); }

.track { height: 10px; border-radius: var(--radius-pill); background: var(--ink-border); overflow: hidden; }
.fill {
  height: 100%;
  background: var(--on-ink-accent);
  border-radius: var(--radius-pill);
  transition: width 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
}

@media (max-width: 560px) {
  .hero { padding: 1.25rem; border-radius: var(--radius-lg); }
  .region { min-width: 0; width: 100%; }
}
</style>
