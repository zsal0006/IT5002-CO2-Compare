<script setup>
import { ref, watch, computed, onBeforeUnmount } from 'vue'
import { geocode, shortLabel, currentLocation, SupersededError } from '@/lib/geocode'

const props = defineProps({
  label: { type: String, required: true },
  modelValue: { type: Object, default: null }, // Place | null
  placeholder: { type: String, default: 'Town, city or address' },
  /** E1.2 — offered on the start field only. */
  allowCurrentLocation: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])

const MIN_CHARS = 3
const DEBOUNCE_MS = 350

const query = ref('')
const candidates = ref([])
const searching = ref(false)
const message = ref('')
const active = ref(-1) // highlighted candidate, for arrow-key selection

let debounceTimer = null
let controller = null

const fieldId = computed(() => `loc-${props.label.replace(/\s+/g, '-').toLowerCase()}`)
const listId = computed(() => `${fieldId.value}-list`)
const tooShort = computed(() => query.value.trim().length > 0 && query.value.trim().length < MIN_CHARS)

watch(query, (value) => {
  clearTimeout(debounceTimer)
  message.value = ''
  active.value = -1
  if (props.modelValue) emit('update:modelValue', null)

  if (value.trim().length < MIN_CHARS) {
    cancelInFlight()
    candidates.value = []
    return
  }
  debounceTimer = setTimeout(() => search(value), DEBOUNCE_MS)
})

function cancelInFlight() {
  controller?.abort()
  controller = null
}

async function search(value) {
  // Supersede anything still queued. Without this, each pause while typing adds
  // a request that the rate limiter holds for another second, and the answer to
  // what you actually typed arrives several seconds late.
  cancelInFlight()
  controller = new AbortController()
  const signal = controller.signal

  searching.value = true
  try {
    const places = await geocode(value, { signal })
    if (signal.aborted) return // a newer query has taken over
    candidates.value = places
    active.value = places.length ? 0 : -1
    if (!places.length) {
      message.value = "We couldn't find that place. Try adding a city or country."
    }
  } catch (err) {
    if (err instanceof SupersededError || err.name === 'AbortError') return
    message.value = 'Location search is unavailable right now. Please try again.'
  } finally {
    if (!signal.aborted) searching.value = false
  }
}

/** Enter searches straight away rather than waiting out the debounce. */
function onEnter() {
  if (candidates.value.length && active.value >= 0) {
    choose(candidates.value[active.value])
    return
  }
  clearTimeout(debounceTimer)
  if (query.value.trim().length >= MIN_CHARS) search(query.value)
}

function move(delta) {
  if (!candidates.value.length) return
  const n = candidates.value.length
  active.value = (active.value + delta + n) % n
}

function choose(place) {
  cancelInFlight()
  clearTimeout(debounceTimer)
  emit('update:modelValue', place)
  candidates.value = []
  active.value = -1
  message.value = ''
  searching.value = false
}

function clear() {
  emit('update:modelValue', null)
  query.value = ''
}

const locating = ref(false)

/** E1.2: fill the field from the browser's geolocation, on an explicit click. */
async function useCurrentLocation() {
  locating.value = true
  message.value = ''
  try {
    choose(await currentLocation())
  } catch (err) {
    message.value = err.message
  } finally {
    locating.value = false
  }
}

onBeforeUnmount(() => {
  clearTimeout(debounceTimer)
  cancelInFlight()
})
</script>

<template>
  <div class="field location">
    <label :for="fieldId">{{ label }}</label>

    <div v-if="modelValue" class="confirmed">
      <span class="pin" aria-hidden="true">📍</span>
      <span class="name">{{ shortLabel(modelValue) }}</span>
      <button type="button" class="secondary clear" @click="clear">Change</button>
    </div>

    <template v-else>
      <input
        :id="fieldId"
        v-model="query"
        type="text"
        role="combobox"
        aria-autocomplete="list"
        autocomplete="off"
        :placeholder="placeholder"
        :aria-expanded="candidates.length > 0"
        :aria-controls="listId"
        :aria-activedescendant="active >= 0 ? `${listId}-${active}` : undefined"
        :aria-describedby="`${fieldId}-hint`"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.enter.prevent="onEnter"
        @keydown.esc="candidates = []"
      />

      <p :id="`${fieldId}-hint`" class="hint muted" aria-live="polite">
        <template v-if="searching">Searching…</template>
        <template v-else-if="message">{{ message }}</template>
        <template v-else-if="tooShort">Keep typing — at least {{ MIN_CHARS }} characters.</template>
        <template v-else-if="candidates.length">
          {{ candidates.length }} match{{ candidates.length === 1 ? '' : 'es' }} — pick one, or
          use ↑ ↓ and Enter.
        </template>
        <template v-else>Type a place, then press Enter to search.</template>
      </p>

      <!-- Always a list, even for a single match: silently adopting a result the
           user never saw is how the field ends up feeling like it grabbed their
           typing (FR-2). -->
      <ul v-if="candidates.length" :id="listId" class="candidates" role="listbox">
        <li
          v-for="(c, i) in candidates"
          :id="`${listId}-${i}`"
          :key="`${c.lat},${c.lon}`"
          role="option"
          :aria-selected="i === active"
        >
          <button
            type="button"
            class="secondary"
            :class="{ active: i === active }"
            @click="choose(c)"
            @mouseenter="active = i"
          >
            {{ c.label }}
          </button>
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

.hint { margin: 0.3rem 0 0; min-height: 1.2em; font-size: 0.8rem; }

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

.candidates { list-style: none; margin: 0.4rem 0 0; padding: 0; display: grid; gap: 0.25rem; }
.candidates button {
  width: 100%;
  text-align: left;
  font-weight: 400;
  font-size: 0.85rem;
  padding: 0.4rem 0.6rem;
  line-height: 1.35;
}
.candidates button.active {
  border-color: var(--series-1);
  background: color-mix(in srgb, var(--series-1) 10%, transparent);
}
</style>
