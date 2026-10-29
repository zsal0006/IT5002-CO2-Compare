<script setup>
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <a href="#main" class="skip">Skip to content</a>

  <header class="site-header">
    <div class="container bar">
      <RouterLink to="/" class="brand">CarbonRoute</RouterLink>
      <nav aria-label="Main">
        <RouterLink to="/">Compare</RouterLink>
        <RouterLink to="/dashboard">Dashboard</RouterLink>
        <RouterLink to="/learn">How it works</RouterLink>
      </nav>
    </div>
  </header>

  <main id="main">
    <RouterView />
  </main>

  <footer class="site-footer">
    <div class="container">
      <p class="muted">
        CarbonRoute — IT5002 coursework project. Emission factors and national emissions
        data are credited on the <RouterLink to="/learn">How it works</RouterLink> page.
        Geocoding and routing © OpenStreetMap contributors.
      </p>
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
  z-index: 10;
}
.skip:focus { left: 0.5rem; top: 0.5rem; }

.site-header { border-bottom: 1px solid var(--border); background: var(--surface-1); }
.bar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.75rem 0; flex-wrap: wrap; }

.brand { font-weight: 700; font-size: 1.1rem; text-decoration: none; color: var(--text-primary); }

nav { display: flex; gap: 0.35rem; }
nav a {
  padding: 0.35rem 0.7rem;
  border-radius: var(--radius-sm);
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-secondary);
}
nav a.router-link-active { background: color-mix(in srgb, var(--series-1) 12%, transparent); color: var(--series-1); }

.site-footer { border-top: 1px solid var(--border); margin-top: 3rem; padding: 1.5rem 0; }
.site-footer p { margin: 0; max-width: 70ch; }
</style>
