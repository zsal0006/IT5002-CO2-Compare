<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import ModePills from '@/components/ModePills.vue'
import TimeframeTabs from '@/components/TimeframeTabs.vue'
import RouteStrip from '@/components/RouteStrip.vue'
import BenefitTiles from '@/components/BenefitTiles.vue'
import PictogramPanel from '@/components/PictogramPanel.vue'
import { benefitMetrics } from '@/lib/benefits'
import { tripCount, timeframeCaption, capitalise, DEFAULT_TRIPS_PER_WEEK } from '@/lib/timeframe'
import { verbFor } from '@/lib/modeIcons'
import { formatKm } from '@/lib/format'

/**
 * The argument for switching, on one dark panel: pick a mode, pick a horizon,
 * see what it is worth.
 *
 * E2.2 (the headline saving) and the co-benefits live here together because
 * they are one argument. The kilogram is the claim; the money, the tree time
 * and the calories are what make it mean something.
 */
const props = defineProps({
  /** ModeResult[] for this journey, cleanest first. */
  modes: { type: Array, required: true },
  /** The baseline ModeResult — the car the saving is measured against. */
  baseline: { type: Object, default: null },
  /** mode_key currently being explored. */
  modelValue: { type: String, default: null },
  distanceKm: { type: Number, default: null },
  returnTrip: { type: Boolean, default: false },
  fuelPrice: { type: Object, default: null },
  originLabel: { type: String, default: '' },
  destinationLabel: { type: String, default: '' }
})
defineEmits(['update:modelValue'])

const timeframe = ref('trip')
const tripsPerWeek = ref(DEFAULT_TRIPS_PER_WEEK)
const openMetric = ref('tree')

const mode = computed(
  () => props.modes.find((m) => m.modeKey === props.modelValue) ?? null
)

const trips = computed(() => tripCount(timeframe.value, tripsPerWeek.value, props.returnTrip))
const caption = computed(() =>
  timeframeCaption(timeframe.value, tripsPerWeek.value, props.returnTrip)
)

const savedKg = computed(() => (mode.value?.savedVsBaselineKg ?? 0) * trips.value)

/** Share of the baseline avoided. Undefined if the baseline emits nothing. */
const percent = computed(() => {
  const base = props.baseline?.kg ?? 0
  if (!base || !mode.value) return null
  return Math.round(((base - mode.value.kg) / base) * 100)
})

const headline = computed(() => {
  if (!mode.value) return ''
  return verbFor(mode.value.modeKey, mode.value.label)
})

const savedLabel = computed(() => {
  const kg = savedKg.value
  if (kg < 100) return kg.toFixed(2)
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(kg)
})

const metrics = computed(() =>
  mode.value
    ? benefitMetrics(mode.value, props.distanceKm ?? 0, {
        trips: trips.value,
        price: props.fuelPrice,
        caption: caption.value
      })
    : []
)

/**
 * Keep the open pictogram valid. Switching from walking to the train removes
 * the steps metric, and a panel pointed at a metric that no longer exists would
 * simply vanish with no explanation.
 */
watch(metrics, (list) => {
  if (!list.length) return
  if (!list.some((m) => m.key === openMetric.value)) {
    openMetric.value = list.find((m) => m.key === 'tree')?.key ?? list[0].key
  }
})

const activeMetric = computed(
  () => metrics.value.find((m) => m.key === openMetric.value) ?? metrics.value[0] ?? null
)

const shortPlace = (label) => (label ? label.split(',')[0].trim() : '')
</script>

<template>
  <section class="hero" aria-labelledby="hero-heading">
    <!-- Where and how far, so the figures below are anchored to a journey. -->
    <p class="breadcrumb">
      <span>{{ shortPlace(originLabel) }}</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
      <span>{{ shortPlace(destinationLabel) }}</span>
      <span aria-hidden="true">·</span>
      <span>{{ formatKm(distanceKm) }} {{ returnTrip ? 'return' : 'one way' }}</span>
    </p>

    <ModePills
      :modes="modes"
      :model-value="modelValue"
      @update:model-value="$emit('update:modelValue', $event)"
    />

    <div class="claim">
      <TimeframeTabs
        v-model="timeframe"
        :trips-per-week="tripsPerWeek"
        @update:trips-per-week="tripsPerWeek = $event"
      />

      <div aria-live="polite">
        <h2 id="hero-heading">
          {{ headline }} and save <span class="figure">{{ savedLabel }} kg</span> CO₂e
        </h2>
        <p class="sub">
          {{ capitalise(caption) }}<span v-if="percent !== null">
            · {{ percent }}% less than {{ baseline?.label?.toLowerCase() }}</span>.
        </p>
      </div>
    </div>

    <RouteStrip v-if="baseline && mode" :baseline="baseline" :mode="mode" />

    <hr />

    <div class="benefits">
      <div class="benefits-head">
        <h3>What switching to {{ mode?.label?.toLowerCase() }} is worth</h3>
        <RouterLink to="/learn">How we calculate this</RouterLink>
      </div>

      <BenefitTiles :metrics="metrics" :selected="activeMetric?.key" @select="openMetric = $event" />

      <PictogramPanel :metric="activeMetric" />

      <p v-if="!metrics.length" class="muted-on-ink">
        No co-benefits to show for this mode on this journey.
      </p>
    </div>
  </section>
</template>

<style scoped>
/*
 * The ink panel. It does not follow the colour scheme — it is the inversion in
 * both — so every colour here comes from the fixed --ink-* / --on-ink-* family.
 */
.hero {
  background: var(--ink);
  color: var(--on-ink);
  border-radius: var(--radius);
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.375rem;
}

.breadcrumb {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--on-ink-3);
}

.claim { display: flex; flex-direction: column; gap: 0.875rem; }

.hero h2 {
  margin: 0;
  font-size: clamp(1.75rem, 4.5vw, 2.5rem);
  line-height: 1.1;
  color: var(--on-ink);
}
.figure { color: var(--on-ink-accent); }

.sub {
  margin: 0.625rem 0 0;
  color: var(--on-ink-2);
  font-size: 1rem;
  max-width: 600px;
}

hr { width: 100%; height: 1px; border: 0; background: var(--ink-border); margin: 0; }

.benefits { display: flex; flex-direction: column; gap: 1rem; }

.benefits-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
}
.benefits-head h3 { margin: 0; font-size: 1.25rem; color: var(--on-ink); }
.benefits-head a { font-size: 0.8125rem; font-weight: 600; color: var(--on-ink-accent); }

.muted-on-ink { margin: 0; font-size: 0.875rem; color: var(--on-ink-3); }

@media (max-width: 560px) {
  .hero { padding: 1.25rem; border-radius: var(--radius-lg); }
}
</style>
