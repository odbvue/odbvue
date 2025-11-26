<template>
  <v-defaults-provider :defaults="{ VBtn: { class: 'ma-1' } }">
    <v-container fluid>
      <v-row>
        <v-col cols="12" lg="6" class="map-column">
          <v-ov-map
            ref="map"
            width="100%"
            height="400px"
            :zoom
            :center
            :markers
            @marked="markersChanged"
            @centered="centerChanged"
            @zoomed="zoomChanged"
            @located="locationChanged"
            @loading="loadingChanged"
            @clicked="clickChanged"
          />
        </v-col>
        <v-col cols="12" lg="6">
          Zoom: {{ zoom }}
          <br />
          <v-btn @click="zoom++">Zoom in</v-btn>
          <v-btn @click="zoom--">Zoom out</v-btn>
          <hr class="mt-4 mb-4" />
          Location: {{ location }}
          <br />
          <v-btn @click="center = { lat: 0, lng: 0 }">Center</v-btn>
          <v-btn
            @click="
              center = {
                lat: map?.location.lat ?? center.lat,
                lng: map?.location.lng ?? center.lng,
              }
            "
            >Current</v-btn
          >
          <v-btn @click="center = { lat: 40.7128, lng: -74.006 }">New York</v-btn>
          <v-btn @click="center = { lat: 34.0522, lng: -118.2437 }">Los Angeles</v-btn>
          <hr class="mt-4 mb-4" />
          In LA:
          <br />
          <v-btn @click="markerAtLA(true)">Add marker</v-btn>
          <v-btn @click="markerAtLA(false)">Remove marker</v-btn>
        </v-col>
      </v-row>
    </v-container>
  </v-defaults-provider>
</template>

<script setup lang="ts">
definePage({
  meta: {
    visibility: 'always',
    access: 'when-authenticated',
  },
})

const map = ref<VOvMapInstance | null>(null)

const center = ref({ lat: 34.0522, lng: -118.2437 })

const location = computed(() => `lat: ${center.value.lat}, lng: ${center.value.lng}`)

const zoom = ref(10)

const markers = ref<TOvMapMarker[]>([
  {
    lat: 40.689253,
    lng: -74.046689,
    title: 'Statue of Liberty',
    color: 'blue',
    info: 'The <strong>Statue of Liberty</strong> is a colossal neoclassical sculpture on Liberty Island in New York Harbor in New York City, in the United States.',
  },
  { lat: 40.748817, lng: -73.985428, title: 'Empire State Building', color: 'red' },
  { lat: 40.712776, lng: -74.005974, title: 'One World Trade Center', color: 'green' },
])

function centerChanged(newCenter: { lat: number; lng: number }) {
  console.log('centerChanged', newCenter)
}

function zoomChanged(newZoom: number) {
  console.log('zoomChanged', newZoom)
  zoom.value = newZoom
}

function locationChanged(newLocation: { lat: number; lng: number }) {
  console.log('locationChanged', newLocation)
}

function markersChanged(newMarkers: TOvMapMarker[]) {
  console.log('markersChanged', newMarkers)
}

function loadingChanged(newLoading: boolean) {
  console.log('loadingChanged', newLoading)
}

function clickChanged(newLocation: { lat: number; lng: number }) {
  console.log('clickChanged', newLocation)
}

function markerAtLA(isSet: boolean) {
  if (!map.value) return
  center.value = { lat: 34.0522, lng: -118.2437 }

  const laMarker: TOvMapMarker = {
    lat: 34.0522,
    lng: -118.2437,
    title: 'Los Angeles',
    color: 'orange',
  }

  if (isSet) {
    map.value.setMarkers([laMarker])
  } else {
    map.value.delMarkers([laMarker])
  }
}
</script>
