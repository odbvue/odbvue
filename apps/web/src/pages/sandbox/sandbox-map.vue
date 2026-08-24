<template>
  <v-defaults-provider :defaults="{ VBtn: { class: 'ma-1' } }">
    <v-container fluid>
      <v-row>
        <v-col cols="12" lg="7">
          <v-ov-map
            :options="mapOptions"
            :geojson="geojson"
            :loading="loading"
            @feature-click="onFeatureClick"
          />
        </v-col>
        <v-col cols="12" lg="5">
          <v-card class="h-100">
            <v-card-title>Leaflet map sandbox</v-card-title>
            <v-card-text>
              <p class="mb-3">This demo uses the current Leaflet-based map component.</p>
              <div class="mb-3"><strong>Zoom:</strong> {{ mapOptions.zoom }}</div>
              <div class="mb-3"><strong>Center:</strong> {{ mapOptions.center?.join(', ') }}</div>
              <div class="mb-3"><strong>Last clicked feature:</strong> {{ selectedFeature }}</div>
              <v-btn class="me-2" @click="setView('latvia')">Latvia</v-btn>
              <v-btn class="me-2" @click="setView('la')">Los Angeles</v-btn>
              <v-btn class="me-2" @click="toggleGeojson"
                >{{ geojson ? 'Hide' : 'Show' }} GeoJSON</v-btn
              >
              <v-btn class="mt-2" @click="zoomMap(1)">Zoom in</v-btn>
              <v-btn class="mt-2" @click="zoomMap(-1)">Zoom out</v-btn>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </v-defaults-provider>
</template>

<script setup lang="ts">
import type { OvGeoJson, OvMapOptions } from '@odbvue/web/components'

definePage({
  meta: {
    visibility: 'with-role',
    access: 'with-role',
    roles: ['developer'],
  },
})

type MapFeatureLike = {
  properties?: Record<string, unknown>
}

const loading = ref(false)
const selectedFeature = ref('None')

const sampleGeojson: OvGeoJson = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [24.11, 56.95],
      },
      properties: {
        name: 'Riga',
        description: 'Capital of Latvia',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [23.8, 56.7],
            [24.4, 56.7],
            [24.4, 57.1],
            [23.8, 57.1],
            [23.8, 56.7],
          ],
        ],
      },
      properties: {
        name: 'Sample area',
        color: '#16a34a',
      },
    },
  ],
}

const mapOptions = ref<OvMapOptions>({
  center: [56.95, 24.11],
  zoom: 7,
  height: '420px',
  width: '100%',
  autoFit: false,
})

const geojson = ref<OvGeoJson | null>(sampleGeojson)

function setView(preset: 'latvia' | 'la') {
  mapOptions.value = {
    ...mapOptions.value,
    center: preset === 'latvia' ? [56.95, 24.11] : [34.0522, -118.2437],
    zoom: preset === 'latvia' ? 7 : 10,
  }
}

function zoomMap(delta: number) {
  mapOptions.value = {
    ...mapOptions.value,
    zoom: Math.max(1, Math.min(18, (mapOptions.value.zoom ?? 7) + delta)),
  }
}

function toggleGeojson() {
  geojson.value = geojson.value ? null : sampleGeojson
}

function onFeatureClick(feature: MapFeatureLike) {
  const name = feature.properties?.name ?? feature.properties?.title ?? 'Unnamed feature'
  selectedFeature.value = String(name)
}
</script>
