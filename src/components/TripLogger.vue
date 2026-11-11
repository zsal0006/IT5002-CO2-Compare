<script setup>
import { computed } from 'vue'
import { iconFor, shortName } from '@/lib/modeIcons'
import { formatCo2 } from '@/lib/format'

/**
 * E3 — "which did you actually take?", as a row of labeled mode buttons.
 *
 * Visible labels keep the choices clear without requiring the reader to
 * recognise the icons; the accessible name matches the displayed label.
 */
const props = defineProps({
  /** ModeResult[] for this journey. */
  modes: { type: Array, required: true },
  modelValue: { type: String, default: null },
  logging: { type: Boolean, default: false },
  /** The successful log, if one has just happened. */
  lastLog: { type: Object, default: null }
})
const emit = defineEmits(['update:modelValue', 'log'])

const chosen = computed(() => props.modes.find((m) => m.modeKey === props.modelValue) ?? null)

const items = computed(() =>
  props.modes.map((m) => ({ ...m, icon: iconFor(m.modeKey), short: shortName(m.modeKey, m.label) }))
)

const buttonLabel = computed(() => {
  if (props.logging) return 'Logging…'
  return chosen.value
    ? `Log ${shortName(chosen.value.modeKey, chosen.value.label).toLowerCase()} trip`
    : 'Log this trip'
})
</script>

<template>
  <section class="card logger" aria-labelledby="log-heading">
    <div class="head">
      <h2 id="log-heading">How did you travel today?</h2>
      <p class="hint">{{ chosen ? `${shortName(chosen.modeKey, chosen.label)} selected` : 'Choose how you travelled.' }}</p>
      <button
        type="button"
        class="primary"
        :disabled="!modelValue || logging"
        @click="emit('log')"
      >
        {{ buttonLabel }}
      </button>
    </div>

    <div class="grid" role="group" aria-label="Travel mode">
      <button
        v-for="m in items"
        :key="m.modeKey"
        type="button"
        class="glyph"
        :class="{ on: m.modeKey === modelValue }"
        :aria-label="m.short"
        :title="m.short"
        :aria-pressed="String(m.modeKey === modelValue)"
        @click="emit('update:modelValue', m.modeKey)"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path :d="m.icon" />
        </svg>
        <span>{{ m.short }}</span>
      </button>
    </div>

    <p v-if="lastLog" class="notice good" role="status">
      Logged. You avoided <strong>{{ formatCo2(lastLog.savedKg) }}</strong> of CO₂e compared
      with driving. See it counted on the
      <RouterLink to="/impact">Impact</RouterLink> page.
    </p>

    <p class="privacy">Only distance, mode, country and region are recorded — never addresses.</p>
  </section>
</template>

<style scoped>
.logger { display: flex; flex-direction: column; gap: 0.75rem; padding: 1.125rem 1.25rem; }

.head { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.75rem; }
.head h2 { margin: 0; font-size: 1rem; }
.hint { flex: 1 1 160px; margin: 0; font-size: 0.75rem; color: var(--text-secondary); }
.head button { min-height: 36px; font-size: 0.8125rem; }

.grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.5rem; }

.glyph {
  min-width: 0;
  min-height: 64px;
  padding: 0.5rem 0.375rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-1);
  color: var(--text-secondary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.glyph:hover { border-color: var(--axis); color: var(--text-primary); }

.glyph.on {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent-soft-text);
}

.privacy { margin: 0; font-size: 0.6875rem; color: var(--text-muted); }
</style>
