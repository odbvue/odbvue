import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import VOvMap from '../../src/capabilities/ui/components/VOvMap.vue'
import { globalPlugins } from './setup'
import type { OvMapOptions, OvGeoJson } from '../index'

const { mockFitBounds, mockInvalidateSize, mockGetBounds, mockGetLayers, mockMarker, mockIcon } =
  vi.hoisted(() => ({
    mockFitBounds: vi.fn<() => void>(),
    mockInvalidateSize: vi.fn<() => void>(),
    mockGetBounds: vi.fn<
      () => {
        isValid: () => boolean
        getSouthWest: () => { lat: number; lng: number }
        getNorthEast: () => { lat: number; lng: number }
      }
    >(() => ({
      isValid: (): boolean => true,
      getSouthWest: () => ({ lat: 56.9496, lng: 24.1052 }),
      getNorthEast: () => ({ lat: 57.0, lng: 24.25 }),
    })),
    mockGetLayers: vi.fn<() => object[]>(() => [{}]),
    mockMarker: vi.fn<(latlng: unknown, options: unknown) => object>(
      (latlng: unknown, options: unknown) => ({
        latlng,
        options,
        on: vi.fn<() => void>(),
        getLatLng: vi.fn<() => { lat: number; lng: number }>(() => ({
          lat: 56.95,
          lng: 24.11,
        })),
      }),
    ),
    mockIcon: vi.fn<(options: unknown) => unknown>((options: unknown) => options),
  }))

vi.mock('leaflet', async () => {
  const mockLayerGroup: {
    addTo: () => object
    addLayer: () => void
    clearLayers: () => void
  } = {
    addTo: vi.fn<() => object>(() => mockLayerGroup),
    addLayer: vi.fn<() => void>(),
    clearLayers: vi.fn<() => void>(),
  }

  const leafletStub = {
    __v_isShallow: false,
    __v_isReactive: false,
    __v_isReadonly: false,
    __v_skip: true,
    geoJSON: vi.fn<(data: unknown) => object>((_data: unknown) => ({
      getBounds: mockGetBounds,
      getLayers: mockGetLayers,
    })),
    layerGroup: vi.fn<() => object>(() => mockLayerGroup),
    marker: mockMarker,
    icon: mockIcon,
    divIcon: vi.fn<(options: unknown) => unknown>((options: unknown) => options),
    polyline: vi.fn<() => { addTo: () => void }>(() => ({
      addTo: vi.fn<() => void>(),
    })),
    polygon: vi.fn<() => { addTo: () => void }>(() => ({
      addTo: vi.fn<() => void>(),
    })),
  }

  return {
    ...leafletStub,
    default: leafletStub,
  }
})

// Mock vue-leaflet components as stubs
vi.mock('@vue-leaflet/vue-leaflet', () => ({
  LMap: {
    name: 'LMap',
    template: '<div class="leaflet-map"><slot /></div>',
    props: ['zoom', 'center', 'useGlobalLeaflet'],
    setup(_props: unknown, { emit }: { emit: (e: string) => void }) {
      const eventListeners: Record<string, Function[]> = {}

      const mockMap = {
        setView: vi.fn<() => void>(),
        setZoom: vi.fn<() => void>(),
        fitBounds: mockFitBounds,
        invalidateSize: mockInvalidateSize,
        once: vi.fn<(event: string, callback: Function) => void>(
          (event: string, callback: Function) => {
            if (!eventListeners[event]) eventListeners[event] = []
            eventListeners[event].push(callback)
            // Auto-trigger 'moveend' immediately for testing
            if (event === 'moveend') {
              setTimeout(() => callback(), 0)
            }
          },
        ),
        off: vi.fn<(event: string, callback: Function) => void>(
          (event: string, callback: Function) => {
            if (eventListeners[event]) {
              eventListeners[event] = eventListeners[event].filter((cb) => cb !== callback)
            }
          },
        ),
        getCenter: vi.fn<() => { lat: number; lng: number }>(() => ({
          lat: 56.95,
          lng: 24.11,
        })),
        getZoom: vi.fn<() => number>(() => 10),
      }

      setTimeout(() => emit('ready'), 0)
      return { leafletObject: mockMap }
    },
  },
  LTileLayer: {
    name: 'LTileLayer',
    template: '<div class="leaflet-tile-layer" />',
    props: ['url', 'attribution'],
  },
  LGeoJson: {
    name: 'LGeoJson',
    template: '<div class="leaflet-geojson" />',
    props: ['geojson', 'options'],
  },
}))

const sampleGeojson: OvGeoJson = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [24.1052, 56.9496] },
      properties: { name: 'Rīga', description: 'Main station' },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [24.1052, 56.9496],
          [25.8595, 56.5205],
        ],
      },
      properties: { name: 'Rīga–Krustpils', color: '#e53935', weight: 4 },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [24.0, 57.0],
            [24.25, 57.0],
            [24.25, 56.88],
            [24.0, 56.88],
            [24.0, 57.0],
          ],
        ],
      },
      properties: {
        name: 'Depot zone',
        color: '#ff9800',
        fillOpacity: 0.25,
      },
    },
  ],
}

function mountMap(geojson: OvGeoJson | null = null, options: OvMapOptions = {}) {
  return mount(VOvMap, {
    props: { geojson, options },
    global: { plugins: globalPlugins },
  })
}

describe('VOvMap', () => {
  beforeEach(() => {
    mockFitBounds.mockClear()
    mockInvalidateSize.mockClear()
    mockGetBounds.mockClear()
    mockGetLayers.mockClear()
    mockMarker.mockClear()
    mockIcon.mockClear()
    mockGetBounds.mockImplementation(() => ({
      isValid: () => true,
      getSouthWest: () => ({ lat: 56.9496, lng: 24.1052 }),
      getNorthEast: () => ({ lat: 57.0, lng: 24.25 }),
    }))
    mockGetLayers.mockImplementation(() => [{}])
  })

  it('renders map container with default height', () => {
    const wrapper = mountMap()
    const container = wrapper.find('[style]')
    expect(container.attributes('style')).toContain('height: 500px')
  })

  it('renders map container with custom height', () => {
    const wrapper = mountMap(null, { height: '300px' })
    const container = wrapper.find('[style]')
    expect(container.attributes('style')).toContain('height: 300px')
  })

  it('renders tile layer', () => {
    const wrapper = mountMap()
    expect(wrapper.find('.leaflet-tile-layer').exists()).toBe(true)
  })

  it('invalidates the Leaflet size after the map becomes ready', async () => {
    mountMap()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await flushPromises()
    await nextTick()
    expect(mockInvalidateSize).toHaveBeenCalledWith({ pan: false })
  })

  it('does not render geojson layer when no data', () => {
    const wrapper = mountMap(null)
    expect(wrapper.find('.leaflet-geojson').exists()).toBe(false)
  })

  it('renders geojson layer when data provided', async () => {
    const wrapper = mountMap(sampleGeojson)
    await flushPromises()
    await nextTick()
    expect(wrapper.find('.leaflet-geojson').exists()).toBe(true)
  })

  it('passes geojson data to LGeoJson component', async () => {
    const wrapper = mountMap(sampleGeojson)
    await flushPromises()
    await nextTick()
    const geoJsonComp = wrapper.findComponent({ name: 'LGeoJson' })
    expect(geoJsonComp.props('geojson')).toEqual(sampleGeojson)
  })

  it('supports Point geometry in geojson', async () => {
    const pointOnly: OvGeoJson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [24.1, 56.9] },
          properties: { name: 'Station' },
        },
      ],
    }
    const wrapper = mountMap(pointOnly)
    await flushPromises()
    await nextTick()
    expect(wrapper.find('.leaflet-geojson').exists()).toBe(true)
  })

  it('supports LineString geometry in geojson', async () => {
    const lineOnly: OvGeoJson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [24.1, 56.9],
              [25.8, 56.5],
            ],
          },
          properties: { name: 'Rail line' },
        },
      ],
    }
    const wrapper = mountMap(lineOnly)
    await flushPromises()
    await nextTick()
    expect(wrapper.find('.leaflet-geojson').exists()).toBe(true)
  })

  it('supports Polygon geometry in geojson', async () => {
    const polyOnly: OvGeoJson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [24.0, 57.0],
                [24.25, 57.0],
                [24.25, 56.88],
                [24.0, 56.88],
                [24.0, 57.0],
              ],
            ],
          },
          properties: { name: 'Zone' },
        },
      ],
    }
    const wrapper = mountMap(polyOnly)
    await flushPromises()
    await nextTick()
    expect(wrapper.find('.leaflet-geojson').exists()).toBe(true)
  })

  it('supports mixed geometry types', async () => {
    const wrapper = mountMap(sampleGeojson)
    await flushPromises()
    await nextTick()
    const geoJsonComp = wrapper.findComponent({ name: 'LGeoJson' })
    const data = geoJsonComp.props('geojson') as OvGeoJson
    const types = data.features.map((f) => f.geometry.type)
    expect(types).toContain('Point')
    expect(types).toContain('LineString')
    expect(types).toContain('Polygon')
  })

  it('uses Latvia center as default', () => {
    const wrapper = mountMap()
    const mapComp = wrapper.findComponent({ name: 'LMap' })
    expect(mapComp.props('center')).toEqual([56.95, 24.11])
  })

  it('uses custom center when provided', () => {
    const wrapper = mountMap(null, { center: [57.0, 25.0] })
    const mapComp = wrapper.findComponent({ name: 'LMap' })
    expect(mapComp.props('center')).toEqual([57.0, 25.0])
  })

  it('uses default zoom of 7', () => {
    const wrapper = mountMap()
    const mapComp = wrapper.findComponent({ name: 'LMap' })
    expect(mapComp.props('zoom')).toBe(7)
  })

  it('uses custom zoom when provided', () => {
    const wrapper = mountMap(null, { zoom: 10 })
    const mapComp = wrapper.findComponent({ name: 'LMap' })
    expect(mapComp.props('zoom')).toBe(10)
  })

  it('shows loading overlay when loading is true', () => {
    const wrapper = mount(VOvMap, {
      props: { loading: true },
      global: { plugins: globalPlugins },
    })
    expect(wrapper.find('.v-overlay').exists()).toBe(true)
  })

  it('provides geojson options with style callback', async () => {
    const wrapper = mountMap(sampleGeojson)
    await flushPromises()
    await nextTick()
    const geoJsonComp = wrapper.findComponent({ name: 'LGeoJson' })
    const opts = geoJsonComp.props('options')
    const style = (opts as { style: (f: unknown) => unknown }).style({
      properties: { color: '#ff0000', weight: 5 },
    })
    expect(style).toMatchObject({ color: '#ff0000', weight: 5 })
  })

  it('style callback uses defaults when properties are missing', async () => {
    const wrapper = mountMap(sampleGeojson)
    await flushPromises()
    await nextTick()
    const geoJsonComp = wrapper.findComponent({ name: 'LGeoJson' })
    const opts = geoJsonComp.props('options')
    const style = (opts as { style: (f: unknown) => unknown }).style({
      properties: {},
    })
    expect(style).toMatchObject({
      color: '#3388ff',
      weight: 3,
      opacity: 1,
      fillOpacity: 0.2,
    })
  })

  it('does not fit bounds when geojson bounds are invalid', async () => {
    mockGetBounds.mockImplementation(() => ({
      isValid: () => false,
      getSouthWest: () => ({ lat: NaN, lng: 24.1052 }),
      getNorthEast: () => ({ lat: 57.0, lng: 24.25 }),
    }))

    mountMap(sampleGeojson)
    await flushPromises()
    await nextTick()

    expect(mockFitBounds).not.toHaveBeenCalled()
  })

  it('fits bounds using coordinate tuples instead of a Leaflet bounds instance', async () => {
    mountMap(sampleGeojson)
    await flushPromises()
    await nextTick()

    expect(mockFitBounds).toHaveBeenCalledWith(
      [
        [56.9496, 24.1052],
        [57.0, 24.25],
      ],
      {
        padding: [50, 50],
        maxZoom: 15,
      },
    )
  })
})
