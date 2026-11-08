<script setup>
import { RouterLink, RouterView } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useTripStore } from '@/stores/trip'
import { formatCo2 } from '@/lib/format'

/**
 * The tally in the header is this TAB's running total, not the community
 * figure — that one lives on the Impact page and comes from the database. The
 * chip says "this session" so the two are never mistaken for each other.
 */
const trip = useTripStore()
const { sessionSavedKg } = storeToRefs(trip)
</script>

<template>
  <a href="#main" class="skip">Skip to content</a>

  <header class="site-header">
    <div class="container bar">
      <RouterLink to="/" class="brand">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <circle cx="14" cy="14" r="13" fill="var(--accent)" />
          <path d="M9 17c0-5 4-8 10-8 0 6-3 10-8 10-1 0-2-.4-2-2z" fill="none"
                stroke="#fff" stroke-width="1.8" stroke-linejoin="round" />
          <path d="M9 19l6-6" stroke="#fff" stroke-width="1.8" stroke-linecap="round" />
        </svg>
        <span>CO₂ Compare</span>
      </RouterLink>

      <nav aria-label="Main">
        <RouterLink to="/">Compare</RouterLink>
        <RouterLink to="/impact">Impact</RouterLink>
        <RouterLink to="/dashboard">Dashboard</RouterLink>

        <span v-if="sessionSavedKg > 0" class="tally pop">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M5 19c0-8 6-13 15-14 0 9-5 15-12 15-2 0-3-1-3-1zM5 19l7-7" />
          </svg>
          <span class="visually-hidden">Saved this session:</span>
          {{ formatCo2(sessionSavedKg) }} saved
        </span>
      </nav>
    </div>
  </header>

  <main id="main">
    <RouterView />
  </main>

  <footer class="site-footer">
    <div class="container foot">
      <span>CO₂ Compare · IT5002 coursework project</span>
      <span>
        Emission factors credited on
        <RouterLink to="/learn">how we calculate this</RouterLink>. Geocoding and routing
        © OpenStreetMap contributors; boundaries from Natural Earth.
      </span>
    </div>
  </footer>
</template>

<style scoped>
.skip {
  position: absolute;
  left: -9999px;
  top: 0;
  background: var(--surface-1);
  padding: 0.6rem 1rem;
  border-radius: var(--radius-sm);
  z-index: 10;
}
.skip:focus { left: 0.5rem; top: 0.5rem; }

.site-header { background: var(--surface-1); border-bottom: 1px solid var(--border); }
.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.875rem 0;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  text-decoration: none;
  color: var(--text-primary);
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.125rem;
  letter-spacing: -0.01em;
}

nav { display: flex; gap: 0.25rem; align-items: center; }
nav a {
  padding: 0.625rem 0.875rem;
  border-radius: var(--radius-sm);
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
}
nav a:hover { color: var(--text-primary); }
nav a.router-link-active {
  background: var(--accent-soft);
  color: var(--accent-soft-text);
  font-weight: 600;
}

.tally {
  margin-left: 0.5rem;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-pill);
  background: var(--ink);
  color: var(--on-ink);
  font-size: 0.8125rem;
  font-weight: 600;
}
.tally svg { color: var(--on-ink-accent); }

.site-footer { border-top: 1px solid var(--border); background: var(--surface-1); margin-top: 3rem; }
.foot {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1.5rem 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}
</style>
