<template>
  <GoogleMap
    id="google-map"
    ref="googleMap"
    map-id="google-map"
    :api-key
    :center="localCenter"
    :zoom="localZoom"
    @zoom_changed="zoomChanged"
    @click="clickChanged"
    :auto-center
    :auto-location
  >
    <AdvancedMarker
      v-for="(marker, index) in localMarkers"
      :key="marker.title || index"
      :options="{ position: { lat: marker.lat, lng: marker.lng }, title: marker.title }"
      :pin-options="{ background: marker.color }"
    >
      <InfoWindow v-if="marker.info"><div v-html="marker.info"></div></InfoWindow>
    </AdvancedMarker>
    <v-overlay contained persistent v-model="loading" />
  </GoogleMap>
</template>

<script setup lang="ts">
import { GoogleMap, AdvancedMarker, InfoWindow } from 'vue3-google-map'
import type { Ref, PropType } from 'vue'
import { ref, watch, onMounted } from 'vue'

interface MapMouseEvent {
  latLng: {
    lat(): number
    lng(): number
  }
}

const apiKey = import.meta.env.VITE_GOOGLE_MAP_API_KEY

const googleMap: Ref<typeof GoogleMap | null> = ref(null)

const props = defineProps({
  center: {
    type: Object as PropType<{ lat: number; lng: number }>,
    default: () => ({ lat: 0, lng: 0 }),
    required: true,
  },
  zoom: {
    type: Number,
    default: 10,
    required: true,
  },
  markers: {
    type: Array as PropType<TOvMapMarker[]>,
    default: () => [],
  },
  autoCenter: {
    type: Boolean,
    default: true,
  },
  autoLocation: {
    type: Boolean,
    default: true,
  },
  width: {
    type: String,
    default: '100%',
  },
  height: {
    type: String,
    default: '100%',
  },
})

const emits = defineEmits(['centered', 'zoomed', 'located', 'marked', 'clicked', 'loading'])

const localCenter = ref(props.center)
const setCenter = (newCenter: { lat: number; lng: number }) => {
  localCenter.value = newCenter
  emits('centered', localCenter.value)
}
watch(
  () => props.center,
  (newCenter: { lat: number; lng: number }) => {
    setCenter(newCenter)
  },
)

const localZoom = ref(props.zoom)
function zoomChanged() {
  const newZoom = googleMap.value?.map.getZoom() || 0
  const emit = localZoom.value !== newZoom
  localZoom.value = newZoom
  if (emit) emits('zoomed', localZoom.value)
}
watch(
  () => props.zoom,
  (newZoom: number) => {
    const emit = localZoom.value !== newZoom
    localZoom.value = newZoom
    if (emit) emits('zoomed', localZoom.value)
  },
)

const location = ref({ lat: 0, lng: 0 })

export type TOvMapMarker = {
  lat: number
  lng: number
  title?: string
  color?: string
  info?: string
}

export type VOvMapInstance = {
  location: { lat: number; lng: number }
  getMarkers: () => TOvMapMarker[]
  setMarkers: (markers: TOvMapMarker[]) => void
  delMarkers: (markers: TOvMapMarker[]) => void
  loading: boolean
}

const localMarkers = ref<TOvMapMarker[]>(props.markers)
const getMarkers = () => localMarkers.value
const setMarkers = (newMarkers: TOvMapMarker[]) => {
  localMarkers.value = [
    ...new Map(
      [...localMarkers.value, ...newMarkers].map((marker) => [JSON.stringify(marker), marker]),
    ).values(),
  ]
  emits('marked', localMarkers.value)
}
const delMarkers = (newMarkers: TOvMapMarker[]) => {
  localMarkers.value = localMarkers.value.filter(
    (marker) =>
      !newMarkers.some((newMarker) => marker.lat === newMarker.lat && marker.lng === newMarker.lng),
  )
  emits('marked', localMarkers.value)
}
watch(
  () => props.markers,
  (newMarkers: TOvMapMarker[]) => {
    setMarkers(newMarkers)
  },
)
const clickChanged = (event: MapMouseEvent): void => {
  if (event.latLng) emits('clicked', { lat: event.latLng.lat(), lng: event.latLng.lng() })
}

const loading = ref(false)

defineExpose({
  loading,
  location,
  getMarkers,
  setMarkers,
  delMarkers,
})

onMounted(() => {
  if (!props.autoLocation) return
  loading.value = true
  emits('loading', loading.value)
  navigator.geolocation.getCurrentPosition(
    (position) => {
      location.value = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      }
      emits('located', location.value)
      if (props.autoCenter) setCenter(location.value)
      loading.value = false
      emits('loading', loading.value)
    },
    (error) => {
      console.error(error)
      loading.value = false
      emits('loading', loading.value)
    },
    { timeout: 10000 },
  )
})
</script>

<style scoped>
#google-map {
  position: relative;
  width: v-bind(width);
  height: v-bind(height);
}
</style>
