<script setup>
import { ref, watch, computed, onBeforeUnmount } from 'vue'
import { geocode, shortLabel, currentLocation, SupersededError } from '@/lib/geocode'

/**
 * One row of the journey box (E1.1, E1.2).
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A ROW AND NOT A FIELD
 *
 * Start and destination are one journey, so they are drawn as one control: a
 * single bordered box with a hairline between the two rows, a dotted rail
 * joining the start dot to the destination square, and one swap button across
 * the seam. That framing only works if each row contributes no chrome of its
 * own — no label above, no hint below, no extra border. So the visible label is
 * gone (it survives for screen readers) and the per-row status moved into the
 * dropdown, which is the only place it can sit without pushing the other row
 * down the page every time someone pauses while typing.
 *
 * The dropdown is absolutely positioned for the same reason: a list that
 * reflows the box would move the destination row out from under the cursor at
 * the exact moment the user is reaching for it.
 * ---------------------------------------------------------------------------
 */
const props = defineProps({
  /** Read by assistive tech only; the design shows no visible label. */
  label: { type: String, required: true },
  modelValue: { type: Object, default: null }, // Place | null
  placeholder: { type: String, default: 'Town, city or address' },
  /** The rail's end-cap for this row: an outlined dot, or a filled square. */
  marker: { type: String, default: 'dot' }, // 'dot' | 'square'
  /** E1.2 — offered on the start field only. */
  allowCurrentLocation: { type: Boolean, default: false },
  /**
   * Prefer results near this place and in its country. Set on the end field
   * from the confirmed start location, so a commute's destination ranks above
   * a same-named place on another continent.
   */
  bias: { type: Object, default: null }
})
const emit = defineEmits(['update:modelValue'])

const MIN_CHARS = 3
const DEBOUNCE_MS = 350

const query = ref('')
const candidates = ref([])
const searching = ref(false)
const message = ref('')
const active = ref(-1) // highlighted candidate, for arrow-key selection
const focused = ref(false)

let debounceTimer = null
let controller = null

const fieldId = computed(() => `loc-${props.label.replace(/\s+/g, '-').toLowerCase()}`)
const listId = computed(() => `${fieldId.value}-list`)
const tooShort = computed(
  () => query.value.trim().length > 0 && query.value.trim().length < MIN_CHARS
)

/** What the live region announces, and what the dropdown prints when it has no list. */
const status = computed(() => {
  if (searching.value) return 'Searching…'
  if (message.value) return message.value
  if (tooShort.value) return `Keep typing — at least ${MIN_CHARS} characters.`
  if (candidates.value.length) {
    return `${candidates.value.length} match${candidates.value.length === 1 ? '' : 'es'} — pick one, or use the arrow keys and Enter.`
  }
  return ''
})

/** Only open over the page when there is something worth covering it for. */
const open = computed(
  () => focused.value && !props.modelValue && (candidates.value.length > 0 || status.value !== '')
)

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

// If the start location is confirmed after the end has already been typed, the
// candidates on screen were ranked without it. Re-rank rather than making the
// user retype.
watch(
  () => props.bias?.countryCode,
  (code) => {
    if (code && !props.modelValue && query.value.trim().length >= MIN_CHARS) {
      search(query.value)
    }
  }
)

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
    const places = await geocode(value, { signal, bias: props.bias })
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
    focused.value = true
  } finally {
    locating.value = false
  }
}

/**
 * Closing on blur would fire before the click on a candidate lands, so the
 * list would vanish from under the pointer. Only a blur that leaves the row
 * entirely closes it.
 */
function onBlur(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) focused.value = false
}

onBeforeUnmount(() => {
  clearTimeout(debounceTimer)
  cancelInFlight()
})
</script>

<template>
  <div class="row" :class="{ open }" @focusin="focused = true" @focusout="onBlur">
    <span class="marker" :class="marker" aria-hidden="true" />

    <label :for="fieldId" class="visually-hidden">{{ label }}</label>

    <!-- A confirmed place is shown as text, not as a value sitting in an input:
         it is a resolved coordinate now, and editing the words would not
         change it. Clearing starts a fresh search. -->
    <template v-if="modelValue">
      <span :id="fieldId" class="chosen" tabindex="-1">{{ shortLabel(modelValue) }}</span>
      <button
        type="button"
        class="icon-btn"
        :aria-label="`Clear ${label.toLowerCase()}`"
        @click="clear"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </template>

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
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.enter.prevent="onEnter"
        @keydown.esc="candidates = []"
      />

      <button
        v-if="allowCurrentLocation"
        type="button"
        class="icon-btn locate"
        :class="{ busy: locating }"
        :aria-label="locating ? 'Finding you…' : 'Use my current location'"
        :title="locating ? 'Finding you…' : 'Use my current location'"
        :disabled="locating"
        @click="useCurrentLocation"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3.5" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          <circle cx="12" cy="12" r="7.5" />
        </svg>
      </button>
    </template>

    <!-- Always a list, even for a single match: silently adopting a result the
         user never saw is how the field ends up feeling like it grabbed their
         typing (FR-2). -->
    <div v-if="open" class="panel">
      <p v-if="status" class="status">{{ status }}</p>
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
            :class="{ active: i === active }"
            @click="choose(c)"
            @mouseenter="active = i"
          >
            {{ c.label }}
          </button>
        </li>
      </ul>
    </div>

    <p class="visually-hidden" aria-live="polite">{{ status }}</p>
  </div>
</template>

<style scoped>
/*
 * The row owns no border of its own — the box around both rows draws that. It
 * does own the stacking context the dropdown hangs from.
 */
.row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  height: 56px;
  padding-left: 0.875rem;
  padding-right: 0.375rem;
}
.row.open { z-index: 2; }

.marker { flex: none; width: 10px; height: 10px; box-sizing: border-box; }
.marker.dot { border-radius: 50%; border: 2px solid var(--text-primary); }
.marker.square { border-radius: 2px; background: var(--accent); }

/*
 * A bare input. Every edge the field would normally draw belongs to the box,
 * and a focus ring inside a 56px row would trace a shape that is not the
 * control the user sees; the row lights up instead (below).
 */
.row input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  padding: 0;
  background: transparent;
  font: inherit;
  font-size: 0.9375rem;
  color: var(--text-primary);
}
.row input:focus { outline: none; }
.row:focus-within .marker.dot { border-color: var(--accent); }

.chosen {
  flex: 1;
  min-width: 0;
  font-size: 0.9375rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chosen:focus { outline: none; }

.icon-btn {
  flex: none;
  width: 44px;
  height: 44px;
  min-height: 44px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
}
.icon-btn:hover:not(:disabled) { background: var(--surface-2); }
.locate { color: var(--accent); }
.busy { opacity: 0.6; }

/* --- the dropdown -------------------------------------------------------- */
.panel {
  position: absolute;
  top: calc(100% - 4px);
  left: 0.5rem;
  right: 0.5rem;
  z-index: 3;
  padding: 0.5rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-1);
  box-shadow: var(--shadow-lift);
}

.status { margin: 0; padding: 0.125rem 0.375rem; font-size: 0.8125rem; color: var(--text-secondary); }
.status + .candidates { margin-top: 0.375rem; }

.candidates { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.125rem; }
.candidates button {
  width: 100%;
  min-height: 40px;
  text-align: left;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-primary);
  font-weight: 400;
  font-size: 0.875rem;
  padding: 0.5rem 0.625rem;
  line-height: 1.35;
}
.candidates button.active { background: var(--accent-soft); color: var(--accent-soft-text); }
</style>
