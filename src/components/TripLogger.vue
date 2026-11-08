<script setup>
import { computed } from 'vue'
import { iconFor } from '@/lib/modeIcons'
import { formatCo2 } from '@/lib/format'

/**
 * E3 — "which did you actually take?", as a row of icon buttons.
 *
 * Icon-only buttons, so each carries both `aria-label` and `title`: the first
 * for assistive tech, the second so a sighted reader who does not recognise a
 * glyph can hover it. The selected mode is also named in text beside the
 * button, which is what makes the row usable without either.
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
  props.modes.map((m) => ({ ...m, icon: iconFor(m.modeKey) }))
)

const buttonLabel = computed(() => {
  if (props.logging) return 'Logging…'
  return chosen.value ? `Log ${chosen.value.label.toLowerCase()} trip` : 'Log this trip'
})
</script>

<template>
  <section class="card logger" aria-labelledby="log-heading">
    <div class="head">
      <h2 id="log-heading">How did you travel today?</h2>
      <p class="hint">
        {{ chosen ? `${chosen.label} selected` : 'Choose the way you travelled.' }}
      </p>
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
        :aria-label="m.label"
        :title="m.label"
        :aria-pressed="String(m.modeKey === modelValue)"
        @click="emit('update:modelValue', m.modeKey)"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path :d="m.icon" />
        </svg>
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

.grid { display: flex; flex-wrap: wrap; gap: 0.375rem; }

.glyph {
  width: 44px;
  height: 44px;
  min-height: 44px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-1);
  color: var(--text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
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
