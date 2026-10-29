<script setup>
import { formatCo2 } from '@/lib/format'

defineProps({
  /** ModeResult[] — every available mode, with this journey's figures. */
  modes: { type: Array, required: true },
  modelValue: { type: String, default: null },
  disabled: { type: Boolean, default: false }
})
defineEmits(['update:modelValue'])
</script>

<template>
  <fieldset class="selector" :disabled="disabled">
    <legend>Which did you actually take?</legend>
    <p class="muted">
      Logging adds the CO₂ you avoided versus driving to your country's total. Nothing
      about you is recorded — only the distance, the mode, and the country.
    </p>

    <div class="options">
      <label v-for="m in modes" :key="m.modeKey" class="option" :class="{ on: modelValue === m.modeKey }">
        <input
          type="radio"
          name="actual-mode"
          :value="m.modeKey"
          :checked="modelValue === m.modeKey"
          @change="$emit('update:modelValue', m.modeKey)"
        />
        <span class="text">
          <span class="name">{{ m.label }}</span>
          <span class="saved">
            {{ m.savedVsBaselineKg > 0 ? `saves ${formatCo2(m.savedVsBaselineKg)}` : 'no saving' }}
          </span>
        </span>
      </label>
    </div>
  </fieldset>
</template>

<style scoped>
.selector { border: 0; padding: 0; margin: 0; }
legend { font-weight: 650; font-size: 1.05rem; padding: 0; }
.muted { margin: 0.25rem 0 0.9rem; }

.options { display: grid; grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr)); gap: 0.5rem; }

.option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--axis);
  border-radius: var(--radius-sm);
  cursor: pointer;
  background: var(--surface-1);
}
.option.on { border-color: var(--status-good); border-width: 2px; padding: calc(0.55rem - 1px) calc(0.7rem - 1px); }

.text { display: flex; flex-direction: column; }
.name { font-size: 0.9rem; font-weight: 600; }
.saved { font-size: 0.78rem; color: var(--text-secondary); }
.on .saved { color: var(--success-text); }
</style>
