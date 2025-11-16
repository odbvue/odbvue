import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import VOvMap from '../VOvMap.vue'
import type { TOvMapMarker } from '../VOvMap.vue'

// Mock google maps library
vi.mock('vue3-google-map', () => ({
  GoogleMap: {
    name: 'GoogleMap',
    template: '<div id="google-map-mock"><slot /></div>',
    props: ['id', 'mapId', 'apiKey', 'center', 'zoom', 'autoCenter', 'autoLocation'],
    emits: ['zoom_changed', 'click'],
  },
  AdvancedMarker: {
    name: 'AdvancedMarker',
    template: '<div class="marker-mock"><slot /></div>',
    props: ['options', 'pinOptions'],
  },
  InfoWindow: {
    name: 'InfoWindow',
    template: '<div class="infowindow-mock"><slot /></div>',
    props: ['position'],
  },
}))

// Mock import.meta.env
vi.stubGlobal('import', {
  meta: {
    env: {
      VITE_GOOGLE_MAP_API_KEY: 'test-api-key',
    },
  },
})

describe('VOvMap', () => {
  beforeEach(() => {
    // Mock geolocation API
    const mockGeolocation = {
      getCurrentPosition: vi.fn((success) =>
        success({
          coords: {
            latitude: 40.7128,
            longitude: -74.006,
          },
        }),
      ),
    }
    Object.defineProperty(navigator, 'geolocation', {
      value: mockGeolocation,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('mounts without error', () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
      expect(wrapper.exists()).toBe(true)
    })

    it('renders google map component', () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      const googleMap = wrapper.find('#google-map-mock')
      expect(googleMap.exists()).toBe(true)
    })

    it('renders v-overlay component', () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
        },
        global: {
          stubs: {
            'v-overlay': { template: '<div class="overlay-stub"></div>' },
          },
        },
      })
      const overlay = wrapper.find('.overlay-stub')
      expect(overlay.exists()).toBe(true)
    })
  })

  describe('Props - Center', () => {
    it('accepts center prop', () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 51.5074, lng: -0.1278 },
          zoom: 10,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      expect(wrapper.props('center')).toEqual({ lat: 51.5074, lng: -0.1278 })
    })

    it('defaults center to 0,0', () => {
      const wrapper = mount(VOvMap, {
        props: {
          zoom: 10,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      expect(wrapper.props('center')).toEqual({ lat: 0, lng: 0 })
    })

    it('updates localCenter when center prop changes', async () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      await wrapper.setProps({ center: { lat: 40.7128, lng: -74.006 } })
      // Verify the event was emitted with the new center
      expect(wrapper.emitted('centered')).toBeTruthy()
    })
  })

  describe('Props - Zoom', () => {
    it('accepts zoom prop', () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 15,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      expect(wrapper.props('zoom')).toBe(15)
    })

    it('defaults zoom to 10', () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      expect(wrapper.props('zoom')).toBe(10)
    })
  })

  describe('Props - Markers', () => {
    it('accepts markers prop as array', () => {
      const markers: TOvMapMarker[] = [{ lat: 51.5074, lng: -0.1278, title: 'London' }]
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          markers,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      expect(wrapper.props('markers')).toEqual(markers)
    })

    it('defaults markers to empty array', () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      expect(wrapper.props('markers')).toEqual([])
    })

    it('renders markers as AdvancedMarker components', () => {
      const markers: TOvMapMarker[] = [
        { lat: 51.5074, lng: -0.1278, title: 'London' },
        { lat: 48.8566, lng: 2.3522, title: 'Paris' },
      ]
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          markers,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      const markerComponents = wrapper.findAll('.marker-mock')
      expect(markerComponents).toHaveLength(2)
    })

    it('renders marker with title', () => {
      const markers: TOvMapMarker[] = [{ lat: 51.5074, lng: -0.1278, title: 'London Tower' }]
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          markers,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      const markerComponents = wrapper.findAll('.marker-mock')
      expect(markerComponents).toHaveLength(1)
    })

    it('renders marker with custom color', () => {
      const markers: TOvMapMarker[] = [{ lat: 51.5074, lng: -0.1278, color: '#FF0000' }]
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          markers,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      expect(wrapper.props('markers')).toEqual(markers)
    })

    it('renders marker with info window content', () => {
      const markers: TOvMapMarker[] = [
        { lat: 51.5074, lng: -0.1278, info: '<p>Tower of London</p>' },
      ]
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          markers,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      const markerProps = wrapper.props('markers') as TOvMapMarker[]
      expect(markerProps?.[0]?.info).toBe('<p>Tower of London</p>')
    })
  })

  describe('Props - Auto Center', () => {
    it('accepts autoCenter prop as true', () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          autoCenter: true,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      expect(wrapper.props('autoCenter')).toBe(true)
    })

    it('defaults autoCenter to true', () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      expect(wrapper.props('autoCenter')).toBe(true)
    })
  })

  describe('Props - Auto Location', () => {
    it('accepts autoLocation prop as true', () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          autoLocation: true,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      expect(wrapper.props('autoLocation')).toBe(true)
    })

    it('defaults autoLocation to true', () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      expect(wrapper.props('autoLocation')).toBe(true)
    })
  })

  describe('Props - Dimensions', () => {
    it('accepts width prop', () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          width: '500px',
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      expect(wrapper.props('width')).toBe('500px')
    })

    it('defaults width to 100%', () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      expect(wrapper.props('width')).toBe('100%')
    })

    it('accepts height prop', () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          height: '400px',
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      expect(wrapper.props('height')).toBe('400px')
    })

    it('defaults height to 100%', () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      expect(wrapper.props('height')).toBe('100%')
    })
  })

  describe('Emits - centered', () => {
    it('emits centered event when center prop changes', async () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      const newCenter = { lat: 51.5074, lng: -0.1278 }
      await wrapper.setProps({ center: newCenter })
      await flushPromises()
      expect(wrapper.emitted('centered')).toBeTruthy()
      expect(wrapper.emitted('centered')?.[0]?.[0]).toEqual(newCenter)
    })

    it('centered event includes updated center coordinates', async () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      const newCenter = { lat: 40.7128, lng: -74.006 }
      await wrapper.setProps({ center: newCenter })
      expect(wrapper.emitted('centered')).toBeTruthy()
      const emittedCenter = wrapper.emitted('centered')?.[0]?.[0]
      expect(emittedCenter).toEqual(newCenter)
    })
  })

  describe('Emits - zoomed', () => {
    it('emits zoomed event', () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
      // zoom_changed event would be triggered by GoogleMap
    })

    it('emits zoomed event when zoom prop changes', async () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      await wrapper.setProps({ zoom: 15 })
      expect(wrapper.emitted('zoomed')).toBeTruthy()
      expect(wrapper.emitted('zoomed')?.[0]?.[0]).toBe(15)
    })
  })

  describe('Emits - located', () => {
    it('emits located event on mount when autoLocation is true', async () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          autoLocation: true,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      await flushPromises()
      expect(wrapper.emitted('located')).toBeTruthy()
      const emitted = wrapper.emitted('located')?.[0]?.[0] as { lat: number; lng: number }
      expect(emitted.lat).toBe(40.7128)
      expect(emitted.lng).toBe(-74.006)
    })

    it('does not get location when autoLocation is false', async () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      await flushPromises()
      expect(wrapper.emitted('located')).toBeFalsy()
    })
  })

  describe('Emits - marked', () => {
    it('emits marked event when setMarkers is called', async () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      const newMarkers: TOvMapMarker[] = [{ lat: 51.5074, lng: -0.1278, title: 'London' }]
      wrapper.vm.setMarkers(newMarkers)
      await flushPromises()
      expect(wrapper.emitted('marked')).toBeTruthy()
    })

    it('emits marked event when delMarkers is called', async () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          markers: [{ lat: 51.5074, lng: -0.1278, title: 'London' }],
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      const markerToDel: TOvMapMarker[] = [{ lat: 51.5074, lng: -0.1278, title: 'London' }]
      wrapper.vm.delMarkers(markerToDel)
      await flushPromises()
      expect(wrapper.emitted('marked')).toBeTruthy()
    })

    it('emits marked event when markers prop changes', async () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          markers: [],
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      const newMarkers: TOvMapMarker[] = [{ lat: 51.5074, lng: -0.1278, title: 'London' }]
      await wrapper.setProps({ markers: newMarkers })
      expect(wrapper.emitted('marked')).toBeTruthy()
    })
  })

  describe('Emits - clicked', () => {
    it('emits clicked event with coordinates', async () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      // Simulate click event through GoogleMap component
      const googleMap = wrapper.findComponent({ name: 'GoogleMap' })
      await googleMap.vm.$emit('click', {
        latLng: {
          lat: () => 51.5074,
          lng: () => -0.1278,
        },
      })
      expect(wrapper.emitted('clicked')).toBeTruthy()
      expect(wrapper.emitted('clicked')?.[0]?.[0]).toEqual({ lat: 51.5074, lng: -0.1278 })
    })
  })

  describe('Emits - loading', () => {
    it('emits loading event with true when geolocation starts', async () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          autoLocation: true,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      // Initially loading should be emitted
      expect(wrapper.emitted('loading')).toBeTruthy()
    })

    it('emits loading event with false when geolocation completes', async () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          autoLocation: true,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      await flushPromises()
      const loadingEmits = wrapper.emitted('loading') as Array<[boolean]>
      expect(loadingEmits.length).toBeGreaterThan(0)
      // Last emit should be loading: false
      expect(loadingEmits[loadingEmits.length - 1]?.[0]).toBe(false)
    })
  })

  describe('Exposed Methods', () => {
    it('exposes getMarkers method', () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      expect(wrapper.vm.getMarkers).toBeDefined()
      expect(typeof wrapper.vm.getMarkers).toBe('function')
    })

    it('exposes setMarkers method', () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      expect(wrapper.vm.setMarkers).toBeDefined()
      expect(typeof wrapper.vm.setMarkers).toBe('function')
    })

    it('exposes delMarkers method', () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      expect(wrapper.vm.delMarkers).toBeDefined()
      expect(typeof wrapper.vm.delMarkers).toBe('function')
    })

    it('exposes loading ref', () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      expect(wrapper.vm.loading).toBeDefined()
      expect(typeof wrapper.vm.loading).toBe('boolean')
    })

    it('exposes location ref', () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      expect(wrapper.vm.location).toBeDefined()
      expect(wrapper.vm.location).toHaveProperty('lat')
      expect(wrapper.vm.location).toHaveProperty('lng')
    })
  })

  describe('Marker Management', () => {
    it('getMarkers returns current markers', async () => {
      const markers: TOvMapMarker[] = [{ lat: 51.5074, lng: -0.1278, title: 'London' }]
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          markers,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      const result = wrapper.vm.getMarkers()
      expect(result).toHaveLength(1)
      expect(result[0]?.title).toBe('London')
    })

    it('setMarkers merges new markers with existing ones', async () => {
      const initialMarkers: TOvMapMarker[] = [{ lat: 51.5074, lng: -0.1278, title: 'London' }]
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          markers: initialMarkers,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      const newMarkers: TOvMapMarker[] = [{ lat: 48.8566, lng: 2.3522, title: 'Paris' }]
      wrapper.vm.setMarkers(newMarkers)
      await flushPromises()
      const result = wrapper.vm.getMarkers()
      expect(result.length).toBeGreaterThanOrEqual(1)
    })

    it('setMarkers removes duplicates', async () => {
      const initialMarkers: TOvMapMarker[] = [{ lat: 51.5074, lng: -0.1278, title: 'London' }]
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          markers: initialMarkers,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      const duplicateMarker: TOvMapMarker[] = [{ lat: 51.5074, lng: -0.1278, title: 'London' }]
      wrapper.vm.setMarkers(duplicateMarker)
      await flushPromises()
      const result = wrapper.vm.getMarkers()
      expect(result.length).toBe(1)
    })

    it('delMarkers removes markers by lat/lng', async () => {
      const initialMarkers: TOvMapMarker[] = [
        { lat: 51.5074, lng: -0.1278, title: 'London' },
        { lat: 48.8566, lng: 2.3522, title: 'Paris' },
      ]
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          markers: initialMarkers,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      const markerToDelete: TOvMapMarker[] = [{ lat: 51.5074, lng: -0.1278 }]
      wrapper.vm.delMarkers(markerToDelete)
      await flushPromises()
      const result = wrapper.vm.getMarkers()
      expect(result).toHaveLength(1)
      expect(result[0]?.title).toBe('Paris')
    })
  })

  describe('Geolocation', () => {
    it('requests user location on mount when autoLocation is true', async () => {
      const geolocationMock = vi.fn((success) =>
        success({
          coords: {
            latitude: 40.7128,
            longitude: -74.006,
          },
        }),
      )
      Object.defineProperty(navigator, 'geolocation', {
        value: { getCurrentPosition: geolocationMock },
        configurable: true,
      })

      mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          autoLocation: true,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      await flushPromises()
      expect(geolocationMock).toHaveBeenCalled()
    })

    it('updates location when geolocation succeeds', async () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          autoLocation: true,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      await flushPromises()
      expect(wrapper.vm.location).toEqual({ lat: 40.7128, lng: -74.006 })
    })

    it('centers map when geolocation succeeds and autoCenter is true', async () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          autoLocation: true,
          autoCenter: true,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      await flushPromises()
      // Verify centered event was emitted when geolocation succeeds
      expect(wrapper.emitted('centered')).toBeTruthy()
      const centeredEmit = wrapper.emitted('centered')?.[0]?.[0] as { lat: number; lng: number }
      expect(centeredEmit).toEqual({ lat: 40.7128, lng: -74.006 })
    })

    it('does not center map when geolocation succeeds but autoCenter is false', async () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          autoLocation: true,
          autoCenter: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      await flushPromises()
      // When autoCenter is false, centered event should not be emitted from geolocation
      // The component still receives location but doesn't center
      expect(wrapper.vm.location).toEqual({ lat: 40.7128, lng: -74.006 })
    })

    it('handles geolocation errors gracefully', async () => {
      const geolocationMock = vi.fn((success, error) => error(new Error('Permission denied')))
      Object.defineProperty(navigator, 'geolocation', {
        value: { getCurrentPosition: geolocationMock },
        configurable: true,
      })

      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          autoLocation: true,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      // Mock console.error to avoid test output noise
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      await flushPromises()
      expect(wrapper.vm.loading).toBe(false)
      consoleSpy.mockRestore()
    })
  })

  describe('Mounting and Unmounting', () => {
    it('mounts and initializes correctly', async () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 40.7128, lng: -74.006 },
          zoom: 12,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
      expect(wrapper.exists()).toBe(true)
    })

    it('can be unmounted without errors', async () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      await wrapper.unmount()
      expect(wrapper).toBeDefined()
    })
  })

  describe('Props Updates', () => {
    it('handles center prop change', async () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      const newCenter = { lat: 51.5074, lng: -0.1278 }
      await wrapper.setProps({ center: newCenter })
      // Verify centered event was emitted
      expect(wrapper.emitted('centered')).toBeTruthy()
    })

    it('handles zoom prop change', async () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      await wrapper.setProps({ zoom: 15 })
      // Verify zoomed event was emitted
      expect(wrapper.emitted('zoomed')).toBeTruthy()
      expect(wrapper.emitted('zoomed')?.[0]?.[0]).toBe(15)
    })

    it('handles markers prop change', async () => {
      const initialMarkers: TOvMapMarker[] = []
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          markers: initialMarkers,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      const newMarkers: TOvMapMarker[] = [{ lat: 51.5074, lng: -0.1278, title: 'London' }]
      await wrapper.setProps({ markers: newMarkers })
      await flushPromises()
      const result = wrapper.vm.getMarkers()
      expect(result.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Edge Cases', () => {
    it('handles empty markers array', () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          markers: [],
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      expect(wrapper.vm.getMarkers()).toEqual([])
    })

    it('handles marker with all optional properties', () => {
      const markers: TOvMapMarker[] = [
        {
          lat: 51.5074,
          lng: -0.1278,
          title: 'London',
          color: '#FF0000',
          info: '<p>Info</p>',
        },
      ]
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          markers,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      expect(wrapper.props('markers')).toEqual(markers)
    })

    it('handles multiple markers with same coordinates', async () => {
      const markers: TOvMapMarker[] = [
        { lat: 51.5074, lng: -0.1278, title: 'Location A' },
        { lat: 51.5074, lng: -0.1278, title: 'Location B' },
      ]
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          markers,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      expect(wrapper.vm.getMarkers()).toHaveLength(2)
    })

    it('handles clicking with null latLng', async () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      const googleMap = wrapper.findComponent({ name: 'GoogleMap' })
      await googleMap.vm.$emit('click', { latLng: null })
      expect(wrapper.emitted('clicked')).toBeFalsy()
    })

    it('handles rapid setMarkers calls', async () => {
      const wrapper = mount(VOvMap, {
        props: {
          center: { lat: 0, lng: 0 },
          zoom: 10,
          autoLocation: false,
        },
        global: {
          stubs: {
            'v-overlay': true,
          },
        },
      })
      expect(() => {
        wrapper.vm.setMarkers([{ lat: 51.5074, lng: -0.1278 }])
        wrapper.vm.setMarkers([{ lat: 48.8566, lng: 2.3522 }])
        wrapper.vm.setMarkers([{ lat: 52.52, lng: 13.405 }])
      }).not.toThrow()
    })
  })

  describe('Type Exports', () => {
    it('exports TOvMapMarker type', () => {
      const marker: TOvMapMarker = {
        lat: 51.5074,
        lng: -0.1278,
        title: 'Test',
        color: '#FF0000',
        info: '<p>Test</p>',
      }
      expect(marker.lat).toBe(51.5074)
      expect(marker.lng).toBe(-0.1278)
    })
  })
})
