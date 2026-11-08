<script setup>
import { computed } from 'vue'
import { iconFor, shortName } from '@/lib/modeIcons'

/**
 * Two vehicles crossing the same journey, trailing the CO₂ they emit.
 *
 * The exhaust puffs are a COUNT, not a texture: one puff per KG_PER_PUFF
 * kilograms, so a car trailing fourteen against a train's three is the ratio
 * drawn rather than asserted. The caption states the rate, and both figures are
 * printed in kilograms at the end of each strip, so nothing here is the only
 * copy of a number.
 *
 * All motion is decorative and is switched off by prefers-reduced-motion in
 * theme.css; the figures and labels remain.
 */
const props = defineProps({
  /** The baseline ModeResult — what the reader does today. */
  baseline: { type: Object, required: true },
  /** The ModeResult being considered instead. */
  mode: { type: Object, required: true }
})

const KG_PER_PUFF = 0.35
/** Above this, puffs stop being countable and start being a cloud. */
const MAX_PUFFS = 26

function puffsFor(kg, seed) {
  const wanted = Math.round((Number(kg) || 0) / KG_PER_PUFF)
  const n = Math.min(wanted, MAX_PUFFS)
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    left: `${(6 + (i * 86) / Math.max(n, 1)).toFixed(1)}%`,
    delay: `${((i * 0.37 + seed) % 2.8).toFixed(2)}s`
  }))
}

const LEAVES = [
  { id: 0, left: '18%', delay: '0s' },
  { id: 1, left: '40%', delay: '.5s' },
  { id: 2, left: '62%', delay: '1s' },
  { id: 3, left: '82%', delay: '.25s' }
]

const rows = computed(() => [
  {
    key: 'baseline',
    tone: 'car',
    name: shortName(props.baseline.modeKey, props.baseline.label),
    label: props.baseline.label,
    kg: props.baseline.kg,
    icon: iconFor(props.baseline.modeKey),
    puffs: puffsFor(props.baseline.kg, 0),
    zero: false
  },
  {
    key: 'mode',
    tone: 'alt',
    name: shortName(props.mode.modeKey, props.mode.label),
    label: props.mode.label,
    kg: props.mode.kg,
    icon: iconFor(props.mode.modeKey),
    puffs: puffsFor(props.mode.kg, 1.1),
    zero: Number(props.mode.kg) === 0
  }
])

const capped = computed(() =>
  rows.value.some((r) => Math.round(r.kg / KG_PER_PUFF) > MAX_PUFFS)
)

const fmt = (kg) => (Number(kg) || 0).toFixed(2)
</script>

<template>
  <div class="strips">
    <div v-for="row in rows" :key="row.key" class="strip" :class="row.tone">
      <span class="name">{{ row.name }}</span>

      <span class="track">
        <span
          v-for="p in row.puffs"
          :key="p.id"
          class="puff"
          :style="{ left: p.left, animationDelay: p.delay }"
          aria-hidden="true"
        />

        <template v-if="row.zero">
          <svg
            v-for="l in LEAVES"
            :key="l.id"
            class="leaf"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            :style="{ left: l.left, animationDelay: l.delay }"
            aria-hidden="true"
          >
            <path d="M4 20c0-9 6-15 16-16 0 10-6 16-14 16z" fill="currentColor" />
          </svg>
        </template>

        <span class="vehicle" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path :d="row.icon" />
          </svg>
        </span>
      </span>

      <span class="kg">{{ fmt(row.kg) }} kg</span>
    </div>

    <p class="caption">
      Per journey. Each puff is about {{ KG_PER_PUFF }} kg of CO₂e<span v-if="capped">, counted
      up to {{ MAX_PUFFS }}</span>.
    </p>
  </div>
</template>

<style scoped>
.strips { display: flex; flex-direction: column; gap: 0.625rem; }

.strip {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) 72px;
  gap: 0.625rem;
  align-items: center;
}

.name { font-size: 0.75rem; font-weight: 600; }
.kg { font-size: 0.8125rem; font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; }

.car .name, .car .kg { color: var(--on-ink-series-1); }
.alt .name, .alt .kg { color: var(--on-ink-accent); }

.track {
  position: relative;
  height: 44px;
  border-radius: 22px;
  background: var(--ink-3);
}

.vehicle {
  position: absolute;
  top: 0;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink);
  animation: co2-travel 5s cubic-bezier(0.45, 0, 0.55, 1) infinite alternate;
}
.car .vehicle { background: var(--on-ink-series-1); }
.alt .vehicle { background: var(--on-ink-accent); }

.puff {
  position: absolute;
  bottom: 12px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--on-ink-muted);
  animation: co2-puff 2.8s ease-out infinite;
}

.leaf {
  position: absolute;
  bottom: 10px;
  color: var(--on-ink-accent);
  animation: co2-leaf 1.4s ease-out infinite;
}

.caption { margin: 0; font-size: 0.75rem; color: var(--on-ink-3); }

@media (max-width: 480px) {
  .strip { grid-template-columns: 52px minmax(0, 1fr) 64px; gap: 0.5rem; }
}
</style>
