<script setup>
// A headline number with its label and a line of context. No plot, so no
// tooltip layer — the figure and its caption carry everything.
defineProps({
  label: { type: String, required: true },
  value: { type: String, required: true },
  context: { type: String, default: '' },
  tone: { type: String, default: 'neutral' } // neutral | good
})
</script>

<template>
  <div class="tile card" :class="tone">
    <p class="label">{{ label }}</p>
    <p class="value">{{ value }}</p>
    <p v-if="context" class="context">{{ context }}</p>
  </div>
</template>

<style scoped>
.tile { padding: 1rem 1.1rem; }

.label {
  margin: 0 0 0.25rem;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--text-muted);
}

/* The hero figure stays in the system sans and in text ink, not a series colour. */
.value {
  margin: 0;
  font-size: clamp(1.6rem, 4vw, 2.1rem);
  font-weight: 650;
  line-height: 1.1;
  color: var(--text-primary);
}
.good .value { color: var(--success-text); }

.context { margin: 0.35rem 0 0; font-size: 0.82rem; color: var(--text-secondary); }
</style>
