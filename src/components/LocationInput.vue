<script setup>
import { ref, watch } from 'vue'
import { geocode, shortLabel, currentLocation } from '@/lib/geocode'

const props = defineProps({
  label: { type: String, required: true },
  modelValue: { type: Object, default: null }, // Place | null
  placeholder: { type: String, default: 'Town, city or address' },
  /** E1.2 — offered on the start field only. */
  allowCurrentLocation: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])

const query = ref('')
const candidates = ref([])
const searching = ref(false)
const message = ref('')
let debounceTimer = null

watch(query, (value) => {
  clearTimeout(debounceTimer)
  candidates.value = []
  message.value = ''
  if (props.modelValue) emit('update:modelValue', null)
  if (value.trim().length < 3) return

  // Debounced so a typed word is one request, not one per keystroke (FR-2).
  debounceTimer = setTimeout(() => search(value), 500)
})

async function search(value) {
  searching.value = true
  try {
    const places = await geocode(value)
    candidates.value = places
    if (!places.length) {
      message.value = "We couldn't find that place. Try adding a city or country."
    } else if (places.length === 1) {
      choose(places[0])
    }
  } catch {
    message.value = 'Location search is unavailable right now. Please try again.'
  } finally {
    searching.value = false
  }
}

function choose(place) {
  emit('update:modelValue', place)
  candidates.value = []
  message.value = ''
}

const locating = ref(false)

/** E1.2: fill the field from the browser's geolocation, on an explicit click. */
async function useCurrentLocation() {
  locating.value = true
  message.value = ''
  try {
    const place = await currentLocation()
    choose(place)
  } catch (err) {
    message.value = err.message
  } finally {
    locating.value = false
  }
}

function clear() {
  emit('update:modelValue', null)
  query.value = ''
}
</script>

<template>
  <div class="field location">
    <label :for="`loc-${label}`">{{ label }}</label>

    <div v-if="modelValue" class="confirmed">
      <span class="pin" aria-hidden="true">📍</span>
      <span class="name">{{ shortLabel(modelValue) }}</span>
      <button class="secondary clear" @click="clear">Change</button>
    </div>

    <template v-else>
      <input
        :id="`loc-${label}`"
        v-model="query"
        type="text"
        :placeholder="placeholder"
        autocomplete="off"
        :aria-describedby="message ? `msg-${label}` : undefined"
      />
      <p v-if="searching" class="muted">Searching…</p>
      <p v-else-if="message" :id="`msg-${label}`" class="muted">{{ message }}</p>

      <!-- Several matches: let the user confirm which one they meant (FR-2). -->
      <ul v-if="candidates.length > 1" class="candidates">
        <li v-for="(c, i) in candidates" :key="i">
          <button class="secondary" @click="choose(c)">{{ c.label }}</button>
        </li>
      </ul>

      <button
        v-if="allowCurrentLocation"
        type="button"
        class="link locate"
        :disabled="locating"
        @click="useCurrentLocation"
      >
        {{ locating ? 'Finding you…' : 'Use my current location' }}
      </button>
    </template>
  </div>
</template>

<style scoped>
.location { margin-bottom: 1rem; }

.confirmed {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--axis);
  border-radius: var(--radius-sm);
  background: var(--surface-1);
}
.name { flex: 1; font-size: 0.92rem; }
.clear { padding: 0.25rem 0.6rem; font-size: 0.8rem; }

.candidates { list-style: none; margin: 0.4rem 0 0; padding: 0; display: grid; gap: 0.25rem; }
.link {
  background: none;
  border: 0;
  padding: 0.3rem 0;
  color: var(--series-1);
  font-size: 0.85rem;
  text-decoration: underline;
  cursor: pointer;
}
.locate { display: block; margin-left: auto; }

.candidates button {
  width: 100%;
  text-align: left;
  font-weight: 400;
  font-size: 0.85rem;
  padding: 0.4rem 0.6rem;
}
</style>
