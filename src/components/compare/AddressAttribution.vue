<script setup>
import { computed } from 'vue'

const props = defineProps({
  places: { type: Array, required: true }
})

const sources = computed(() => {
  const bySource = new Map()
  for (const place of props.places) {
    const source = place?.attribution
    if (
      source?.text &&
      !(source.text === '© OpenStreetMap contributors' &&
        source.url === 'https://www.openstreetmap.org/copyright')
    ) bySource.set(`${source.text}|${source.url}`, source)
  }
  return [...bySource.values()]
})

const hasPlaces = computed(() => props.places.some((place) => place?.attribution))
</script>

<template>
  <span v-if="hasPlaces">
    Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Geoapify</a>
    · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>
    <template v-for="source in sources" :key="`${source.text}|${source.url}`">
      · <a v-if="source.url" :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.text }}</a>
      <template v-else>{{ source.text }}</template>
    </template>
  </span>
</template>
