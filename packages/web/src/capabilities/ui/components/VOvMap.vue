<template>
  <v-defaults-provider :defaults>
    <v-container :class="{ 'pa-0': !padding }">
      <div ref="mapContainer" :style="containerStyle">
        <l-map
          ref="leafletMap"
          :zoom="mapInitZoom"
          :center="mapInitCenter"
          :use-global-leaflet="false"
          @ready="onMapReady"
        >
          <l-tile-layer :url="tileUrl" :attribution="tileAttribution" />
          <l-geo-json
            v-if="geojson && leafletRef"
            :key="geojsonKey"
            :geojson="geojson"
            :options="geojsonOptions"
          />
        </l-map>
      </div>

      <v-overlay :model-value="loading" persistent contained class="align-center justify-center">
        <v-progress-circular indeterminate />
      </v-overlay>
    </v-container>
  </v-defaults-provider>
</template>

<script setup lang="ts">
import { ref, shallowRef, computed, watch, onBeforeUnmount, onMounted, nextTick } from 'vue'
import { useDefaults } from 'vuetify'
import { VContainer, VDefaultsProvider, VOverlay, VProgressCircular } from 'vuetify/components'
import 'leaflet/dist/leaflet.css'
import markerIconUrl from 'leaflet/dist/images/marker-icon.png'
import markerIconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png'
import { LMap, LTileLayer, LGeoJson } from '@vue-leaflet/vue-leaflet'
import type {
  LeafletMouseEvent,
  LayerGroup,
  Map as LeafletMap,
  Marker,
  PointExpression,
} from 'leaflet'
import type { OvMapOptions, OvGeoJson, OvGeoJsonGeometry } from '.'

type MapFeatureLike = {
  properties?: Record<string, unknown>
}

const { defaults } = useDefaults({
  name: 'VOvMap',
  defaults: {
    VContainer: {
      class: 'position-relative',
    },
    VOverlay: {
      class: 'rounded',
    },
  },
})

const {
  options = {} as OvMapOptions,
  geojson = null,
  loading = false,
  padding = true,
  editable = false,
  editableGeometryType = null,
  editableGeometry = null,
} = defineProps<{
  options?: OvMapOptions
  geojson?: OvGeoJson | null
  loading?: boolean
  padding?: boolean
  editable?: boolean
  editableGeometryType?: 'Point' | 'LineString' | 'Polygon' | null
  editableGeometry?: OvGeoJsonGeometry | null
}>()

const emit = defineEmits<{
  (e: 'feature-click', feature: MapFeatureLike): void
}>()

const mapContainer = ref<HTMLElement>() // used as template ref
void mapContainer
let resizeObserver: ResizeObserver | undefined
const leafletMap = ref<InstanceType<typeof LMap>>()
const mapInstance = shallowRef<LeafletMap | null>(null)
const editLayerGroup = shallowRef<LayerGroup | null>(null)
const editableVertices = ref<[number, number][]>([])
const initialEditableGeometry = ref<string>('null')

const LATVIA_CENTER: [number, number] = [56.95, 24.11]
const LATVIA_ZOOM = 7

// Stable non-reactive values for l-map props G�� never change after mount
// so vue-leaflet's propsBinder won't re-trigger setZoom/setCenter
const mapInitCenter = options.center ?? LATVIA_CENTER
const mapInitZoom = options.zoom ?? LATVIA_ZOOM

// Stored bounds from the last fitBounds call, used by resetCenter
const fittedBounds = ref<[[number, number], [number, number]] | null>(null)

const tileUrl = options.tileUrl ?? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const tileAttribution =
  options.tileAttribution ??
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

const fitPadding = options.fitPadding ?? 50

const containerStyle = computed(() => ({
  width: options.width ?? '100%',
  height: options.height ?? '500px',
}))

const geojsonKey = ref(0)

const geojsonOptions = computed(() => {
  const L = leafletRef.value
  if (!L) return {}

  return {
    pointToLayer: (_feature: unknown, latlng: [number, number]) => {
      const iconSize = (options.iconSize ?? [25, 41]) as PointExpression
      const iconAnchor = (options.iconAnchor ?? [12, 41]) as PointExpression
      const popupAnchor = (options.popupAnchor ?? [1, -34]) as PointExpression

      return L.marker(latlng, {
        icon: L.icon({
          iconUrl: options.iconUrl ?? markerIconUrl,
          iconRetinaUrl: markerIconRetinaUrl,
          shadowUrl: markerShadowUrl,
          iconSize,
          iconAnchor,
          popupAnchor,
        }),
      })
    },
    style: (feature: MapFeatureLike) => {
      const props = feature.properties ?? {}
      return {
        color: props.color ?? '#3388ff',
        weight: props.weight ?? 3,
        opacity: props.opacity ?? 1,
        fillColor: props.fillColor ?? props.color ?? '#3388ff',
        fillOpacity: props.fillOpacity ?? 0.2,
      }
    },
    onEachFeature: (
      feature: MapFeatureLike,
      layer: {
        bindPopup: (content: string) => void
        on: (event: string, handler: () => void) => void
      },
    ) => {
      const props = feature.properties ?? {}
      const popupParts: string[] = []
      for (const [key, val] of Object.entries(props)) {
        if (val != null && val !== '') {
          popupParts.push(`<strong>${sanitizeText(key)}:</strong> ${sanitizeText(String(val))}`)
        }
      }
      if (popupParts.length > 0) {
        layer.bindPopup(popupParts.join('<br/>'))
      }

      layer.on('click', () => {
        emit('feature-click', feature)
      })
    },
  }
})

const leafletRef = shallowRef<typeof import('leaflet') | null>(null)

function syncMapView() {
  const map = mapInstance.value
  if (!map) return

  if (options.center) {
    map.setView(options.center, options.zoom ?? map.getZoom())
  } else if (options.zoom != null) {
    map.setZoom(options.zoom)
  }
}

onMounted(async () => {
  leafletRef.value = await import('leaflet')
  ensureEditLayer()
  syncEditableState()
  syncMapView()

  if (typeof ResizeObserver !== 'undefined' && mapContainer.value) {
    resizeObserver = new ResizeObserver(() => {
      mapInstance.value?.invalidateSize({ pan: false })
    })
    resizeObserver.observe(mapContainer.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})

watch(
  () => [options.center, options.zoom],
  () => {
    syncMapView()
  },
  { flush: 'post' },
)

function cloneGeometry(geometry: OvGeoJsonGeometry | null): OvGeoJsonGeometry | null {
  if (!geometry) return null
  return JSON.parse(JSON.stringify(geometry)) as OvGeoJsonGeometry
}

function geometryToVertices(
  geometry: OvGeoJsonGeometry | null,
  geometryType: 'Point' | 'LineString' | 'Polygon' | null,
): [number, number][] {
  if (!geometry || !geometryType || geometry.type !== geometryType) return []

  if (geometry.type === 'Point') {
    return [geometry.coordinates as [number, number]]
  }

  if (geometry.type === 'LineString') {
    return (geometry.coordinates as [number, number][]).map(([lng, lat]) => [lng, lat])
  }

  const ring = ((geometry.coordinates as [number, number][][])[0] ?? []).map(
    ([lng, lat]) => [lng, lat] as [number, number],
  )

  if (ring.length >= 2) {
    const firstPoint = ring[0]
    const lastPoint = ring[ring.length - 1]
    if (firstPoint && lastPoint) {
      const [firstLng, firstLat] = firstPoint
      const [lastLng, lastLat] = lastPoint
      if (firstLng === lastLng && firstLat === lastLat) {
        ring.pop()
      }
    }
  }

  return ring
}

function buildEditableGeometry(): OvGeoJsonGeometry | null {
  if (editableGeometryType !== 'Point') return null

  const point = editableVertices.value[0]
  return point
    ? {
        type: 'Point',
        coordinates: point,
      }
    : null
}

function getEditState() {
  const geometry = buildEditableGeometry()

  return {
    geometry: cloneGeometry(geometry),
    valid: geometry !== null,
    dirty: JSON.stringify(geometry) !== initialEditableGeometry.value,
    points: editableVertices.value.length,
  }
}

function clearEditedGeometry() {
  editableVertices.value = []
  renderEditableGeometry()
}

function ensureEditLayer() {
  const L = leafletRef.value
  const map = mapInstance.value
  if (!L || !map || editLayerGroup.value) return

  editLayerGroup.value = L.layerGroup().addTo(map)
}

function syncEditableState() {
  if (!editable || editableGeometryType !== 'Point') {
    editableVertices.value = []
    renderEditableGeometry()
    detachEditableListeners()
    return
  }

  editableVertices.value = geometryToVertices(editableGeometry, editableGeometryType)
  initialEditableGeometry.value = JSON.stringify(buildEditableGeometry())
  attachEditableListeners()
  renderEditableGeometry()
}

function detachEditableListeners() {
  const map = mapInstance.value
  if (!map) return

  map.off('click', onEditableMapClick)
}

function attachEditableListeners() {
  const map = mapInstance.value
  if (!map) return

  map.off('click', onEditableMapClick)
  map.on('click', onEditableMapClick)
}

function updateVertex(index: number, point: [number, number]) {
  const nextVertices = editableVertices.value.map((vertex, vertexIndex) =>
    vertexIndex === index ? point : vertex,
  )
  editableVertices.value = nextVertices
  renderEditableGeometry()
}

function removeVertex(index: number) {
  editableVertices.value = editableVertices.value.filter(
    (_vertex, vertexIndex) => vertexIndex !== index,
  )
  renderEditableGeometry()
}

function addVertex(point: [number, number]) {
  editableVertices.value = [point]
  renderEditableGeometry()
}

function isFiniteVertex(value: unknown): value is [number, number] {
  if (!Array.isArray(value) || value.length < 2) return false

  const [lng, lat] = value
  return Number.isFinite(lng) && Number.isFinite(lat)
}

function getRenderableVertices(): [number, number][] {
  return editableVertices.value.filter(isFiniteVertex)
}

function createVertexMarker(index: number, lat: number, lng: number): Marker | null {
  const L = leafletRef.value
  if (!L) return null

  const marker = L.marker([lat, lng], {
    draggable: true,
    icon: L.divIcon({
      className: 'Ov-map__vertex-wrapper',
      html: '<span class="Ov-map__vertex"></span>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    }),
  })

  marker.on('drag', (event: { target: Marker }) => {
    const target = event.target
    const nextLatLng = target.getLatLng()
    updateVertex(index, [nextLatLng.lng, nextLatLng.lat])
  })

  marker.on('contextmenu', () => {
    removeVertex(index)
  })

  return marker
}

function renderEditableGeometry() {
  const L = leafletRef.value
  const group = editLayerGroup.value
  if (!L || !group) return

  group.clearLayers()

  if (!editable) return

  const renderableVertices = getRenderableVertices()
  const point = editableGeometryType === 'Point' ? renderableVertices[0] : null
  if (!point) return

  const marker = createVertexMarker(0, point[1], point[0])
  if (marker) group.addLayer(marker)
}

function onEditableMapClick(event: LeafletMouseEvent) {
  addVertex([event.latlng.lng, event.latlng.lat])
}

function sanitizeText(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function onMapReady() {
  mapInstance.value = (leafletMap.value as unknown as { leafletObject: LeafletMap }).leafletObject
  ensureEditLayer()
  syncEditableState()
  syncMapView()

  nextTick(() => {
    mapInstance.value?.invalidateSize({ pan: false })
    if (geojson && options.autoFit !== false) {
      fitBounds()
    }
  })
}

function fitBounds() {
  const L = leafletRef.value
  if (!L || !leafletMap.value || !geojson) return

  const map = (leafletMap.value as unknown as { leafletObject: LeafletMap }).leafletObject
  if (!map) return

  const geoJsonLayer = L.geoJSON(geojson as GeoJSON.GeoJsonObject)
  if (geoJsonLayer.getLayers().length === 0) return

  const bounds = geoJsonLayer.getBounds()
  if (!bounds?.isValid?.()) return

  const southWest = bounds.getSouthWest?.()
  const northEast = bounds.getNorthEast?.()
  const coordinates = [southWest?.lat, southWest?.lng, northEast?.lat, northEast?.lng]

  if (coordinates.some((value) => !Number.isFinite(value))) return

  const fitBoundsCoordinates: [[number, number], [number, number]] = [
    [southWest.lat, southWest.lng],
    [northEast.lat, northEast.lng],
  ]

  fittedBounds.value = fitBoundsCoordinates

  map.fitBounds(fitBoundsCoordinates, {
    padding: [fitPadding, fitPadding],
    maxZoom: options.maxFitZoom ?? 15,
  })
}

watch(
  () => geojson,
  () => {
    geojsonKey.value++
    if (geojson && options.autoFit !== false && !editable) {
      nextTick(() => fitBounds())
    }
  },
  { deep: true },
)

watch(
  () => editable,
  () => {
    syncEditableState()
  },
)

function resetCenter() {
  const map = (leafletMap.value as unknown as { leafletObject: LeafletMap })?.leafletObject
  if (!map) return

  if (fittedBounds.value) {
    map.fitBounds(fittedBounds.value, {
      padding: [fitPadding, fitPadding],
      maxZoom: options.maxFitZoom ?? 15,
    })
  } else {
    map.setView(mapInitCenter, mapInitZoom)
  }
}

defineExpose({
  resetCenter,
  getEditState,
  clearEditedGeometry,
})
</script>

<style scoped>
:global(.Ov-map__vertex-wrapper) {
  background: transparent;
  border: 0;
}

:global(.Ov-map__vertex) {
  display: block;
  width: 12px;
  height: 12px;
  border: 2px solid #92400e;
  border-radius: 999px;
  background: #f59e0b;
  box-shadow: 0 0 0 2px rgb(255 255 255 / 0.9);
}
</style>
