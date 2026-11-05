<script setup>
import { computed, ref } from 'vue'
import { benefitsFor } from '@/lib/benefits'

/**
 * The co-benefits of a chosen mode — calories, fuel, tree-days.
 *
 * Each card carries its assumption behind a disclosure rather than in the
 * headline: an unqualified "312 kcal" reads as a measurement of the person
 * looking at it, which it is not.
 */
const props = defineProps({
  /** A single ModeResult from lib/emissions.compare(). */
  mode: { type: Object, default: null },
  distanceKm: { type: Number, default: null }
})

const benefits = computed(() => benefitsFor(props.mode, props.distanceKm))
const showBasis = ref(false)
</script>

<template>
  <section v-if="benefits.length" class="benefits" aria-labelledby="benefits-heading">
    <h3 id="benefits-heading">
      What {{ mode.label.toLowerCase() }} gets you
    </h3>

    <ul class="cards">
      <li v-for="b in benefits" :key="b.key">
        <p class="headline">{{ b.headline }}</p>
        <p class="detail">{{ b.detail }}</p>
      </li>
    </ul>

    <button class="basis-toggle" :aria-expanded="showBasis" @click="showBasis = !showBasis">
      {{ showBasis ? 'Hide' : 'What are these based on?' }}
    </button>

    <ul v-if="showBasis" class="basis">
      <li v-for="b in benefits" :key="b.key">
        <strong>{{ b.headline }}</strong> — {{ b.basis }}
      </li>
    </ul>
  </section>
</template>

<style scoped>
.benefits { margin-top: 1.25rem; }
.benefits h3 { font-size: 1rem; margin-bottom: 0.75rem; }

.cards {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: 0.6rem;
}

.cards li {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 0.75rem 0.85rem;
  background: var(--surface-1);
}

/* The figure stays in text ink — the card is not a series in a chart. */
.headline {
  margin: 0 0 0.2rem;
  font-size: 1.15rem;
  font-weight: 650;
  line-height: 1.15;
  color: var(--text-primary);
}
.detail { margin: 0; font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4; }

.basis-toggle {
  background: none;
  border: 0;
  padding: 0.5rem 0 0;
  color: var(--series-1);
  font-size: 0.8rem;
  text-decoration: underline;
  cursor: pointer;
}

.basis {
  margin: 0.5rem 0 0;
  padding-left: 1.1rem;
  font-size: 0.78rem;
  color: var(--text-muted);
  line-height: 1.5;
}
.basis li { margin-bottom: 0.3rem; }
</style>
