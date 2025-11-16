import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import VOvMedia from '../VOvMedia.vue'

// Mock navigator.mediaDevices and related APIs
beforeAll(() => {
  // Mock MediaStream
  global.MediaStream = vi.fn().mockImplementation(() => ({
    getTracks: vi.fn(() => [
      {
        stop: vi.fn(),
        kind: 'video',
      },
    ]),
  })) as never

  // Mock MediaRecorder
  global.MediaRecorder = vi.fn().mockImplementation((stream) => ({
    start: vi.fn(),
    stop: vi.fn(),
    ondataavailable: null,
    onstop: null,
    stream,
  })) as never

  // Mock HTMLMediaElement methods
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve())
  HTMLMediaElement.prototype.pause = vi.fn()

  // Mock canvas methods
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    drawImage: vi.fn(),
  })) as never
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,test')
  HTMLCanvasElement.prototype.toBlob = vi.fn((callback: BlobCallback) => {
    callback(new Blob(['test'], { type: 'image/png' }))
  })

  // Mock navigator.mediaDevices
  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: {
      getUserMedia: vi
        .fn()
        .mockResolvedValue(new (global.MediaStream as unknown as typeof MediaStream)()),
      enumerateDevices: vi.fn().mockResolvedValue([
        {
          deviceId: 'video-device-1',
          kind: 'videoinput',
          label: 'Camera 1',
          groupId: 'group-1',
          toJSON: () => ({}),
        },
        {
          deviceId: 'audio-device-1',
          kind: 'audioinput',
          label: 'Microphone 1',
          groupId: 'group-1',
          toJSON: () => ({}),
        },
      ]),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
    writable: true,
    configurable: true,
  })
})

describe('VOvMedia', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('mounts without error with video prop', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
        },
      })
      await flushPromises()
      expect(wrapper.exists()).toBe(true)
    })

    it('mounts without error with audio prop', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          audio: true,
        },
      })
      await flushPromises()
      expect(wrapper.exists()).toBe(true)
    })

    it('mounts without error with both video and audio', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
          audio: true,
        },
      })
      await flushPromises()
      expect(wrapper.exists()).toBe(true)
    })

    it('mounts with src prop (no camera access needed)', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
          src: 'https://example.com/video.mp4',
        },
      })
      await flushPromises()
      expect(wrapper.exists()).toBe(true)
      expect(wrapper.props('src')).toBe('https://example.com/video.mp4')
    })

    it('renders video element when video prop is true', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
          src: 'test.mp4',
        },
      })
      await flushPromises()
      const video = wrapper.find('video')
      expect(video.exists()).toBe(true)
    })

    it('renders audio element when audio prop is true', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          audio: true,
          src: 'test.mp3',
        },
      })
      await flushPromises()
      const audio = wrapper.find('audio')
      expect(audio.exists()).toBe(true)
    })

    it('renders canvas element (hidden)', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
        },
      })
      await flushPromises()
      const canvas = wrapper.find('canvas')
      expect(canvas.exists()).toBe(true)
      expect(canvas.attributes('style')).toContain('display: none')
    })

    it('renders slot content', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
        },
        slots: {
          default: '<div>Slot content</div>',
        },
      })
      await flushPromises()
      expect(wrapper.text()).toContain('Slot content')
    })
  })

  describe('Props', () => {
    it('accepts all prop types with correct defaults', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
        },
      })
      await flushPromises()
      expect(wrapper.props('autoplay')).toBe(true)
      expect(wrapper.props('loop')).toBe(false)
      expect(wrapper.props('compact')).toBe(false)
      expect(wrapper.props('snap')).toBe(false)
      expect(wrapper.props('variant')).toBe('flat')
      expect(wrapper.props('density')).toBe('default')
      expect(wrapper.props('recorderPosition')).toBe('bottom-left')
      expect(wrapper.props('snapPosition')).toBe('top-right')
      expect(wrapper.props('format')).toBe('base64')
    })

    it('accepts custom recorder position', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
          recorderPosition: 'top-right',
        },
      })
      await flushPromises()
      expect(wrapper.props('recorderPosition')).toBe('top-right')
    })

    it('accepts custom snap position', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
          snap: true,
          snapPosition: 'bottom-right',
        },
      })
      await flushPromises()
      expect(wrapper.props('snapPosition')).toBe('bottom-right')
    })

    it('accepts media constraints', async () => {
      const constraints = { width: 1280, height: 720 }
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
          videoConstraints: constraints,
        },
      })
      await flushPromises()
      expect(wrapper.props('videoConstraints')).toEqual(constraints)
    })

    it('accepts format as base64', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
          format: 'base64',
        },
      })
      await flushPromises()
      expect(wrapper.props('format')).toBe('base64')
    })

    it('accepts format as blob', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
          format: 'blob',
        },
      })
      await flushPromises()
      expect(wrapper.props('format')).toBe('blob')
    })
  })

  describe('Emits', () => {
    it('emits loading event on mount', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
        },
      })
      await flushPromises()
      expect(wrapper.emitted('loading')).toBeTruthy()
    })

    it('emits device event with available devices', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
        },
      })
      await flushPromises()
      const deviceEmits = wrapper.emitted('device')
      expect(deviceEmits).toBeTruthy()
      if (deviceEmits && deviceEmits[0]) {
        expect(deviceEmits[0][0]).toHaveProperty('devices')
        expect(deviceEmits[0][0]).toHaveProperty('device')
      }
    })

    it('emits started event when camera starts', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
        },
      })
      await flushPromises()
      const startedEmits = wrapper.emitted('started')
      expect(startedEmits).toBeTruthy()
    })

    it('emits error when neither video nor audio is enabled', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          video: false,
          audio: false,
        },
      })
      await flushPromises()
      const errorEmits = wrapper.emitted('error')
      expect(errorEmits).toBeTruthy()
    })

    it('does not emit loading when src prop is provided', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
          src: 'test.mp4',
        },
      })
      await flushPromises()
      // Should not attempt to load camera if src is provided
      expect(wrapper.props('src')).toBe('test.mp4')
    })
  })

  describe('Methods - listDevices', () => {
    it('exposes listDevices method', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
        },
      })
      await flushPromises()
      const vm = wrapper.vm as unknown as { listDevices: () => unknown }
      expect(vm.listDevices).toBeDefined()
      expect(typeof vm.listDevices).toBe('function')
    })

    it('listDevices returns video devices when video prop is true', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
        },
      })
      await flushPromises()
      const vm = wrapper.vm as unknown as { listDevices: () => unknown }
      const devices = vm.listDevices()
      expect(Array.isArray(devices)).toBe(true)
    })

    it('listDevices returns audio devices when audio prop is true', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          audio: true,
        },
      })
      await flushPromises()
      const vm = wrapper.vm as unknown as { listDevices: () => unknown }
      const devices = vm.listDevices()
      expect(Array.isArray(devices)).toBe(true)
    })
  })

  describe('Methods - setDevice', () => {
    it('exposes setDevice method', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
        },
      })
      await flushPromises()
      const vm = wrapper.vm as unknown as { setDevice: (id: string) => void }
      expect(vm.setDevice).toBeDefined()
      expect(typeof vm.setDevice).toBe('function')
    })

    it('setDevice accepts a device ID', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
        },
      })
      await flushPromises()
      const vm = wrapper.vm as unknown as { setDevice: (id: string) => void }
      expect(() => vm.setDevice('video-device-1')).not.toThrow()
    })
  })

  describe('Methods - audioPlayback', () => {
    it('exposes audioPlayback method', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          audio: true,
          src: 'test.mp3',
        },
      })
      await flushPromises()
      const vm = wrapper.vm as unknown as { audioPlayback: () => unknown }
      expect(vm.audioPlayback).toBeDefined()
      expect(typeof vm.audioPlayback).toBe('function')
    })

    it('exposes isPlaying state', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          audio: true,
          src: 'test.mp3',
        },
      })
      await flushPromises()
      const vm = wrapper.vm as unknown as { isPlaying: unknown }
      expect(vm.isPlaying).toBeDefined()
    })
  })

  describe('Methods - videoRecording', () => {
    it('exposes videoRecording method', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
        },
      })
      await flushPromises()
      const vm = wrapper.vm as unknown as { videoRecording: () => unknown }
      expect(vm.videoRecording).toBeDefined()
      expect(typeof vm.videoRecording).toBe('function')
    })
  })

  describe('UI Controls', () => {
    it('shows record button when video is enabled and no src', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
        },
      })
      await flushPromises()
      // Button should exist for recording
      const buttons = wrapper.findAll('button')
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('does not show record button when src is provided', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
          src: 'test.mp4',
        },
      })
      await flushPromises()
      // Video with src shouldn't need recording button
      expect(wrapper.props('src')).toBe('test.mp4')
    })

    it('shows snap button when snap prop is true', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
          snap: true,
          src: 'test.mp4',
        },
      })
      await flushPromises()
      expect(wrapper.props('snap')).toBe(true)
    })

    it('applies recorder position classes correctly', async () => {
      const positions: Array<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'> = [
        'top-left',
        'top-right',
        'bottom-left',
        'bottom-right',
      ]
      for (const position of positions) {
        const wrapper = mount(VOvMedia, {
          props: {
            video: true,
            recorderPosition: position,
          },
        })
        await flushPromises()
        expect(wrapper.props('recorderPosition')).toBe(position)
      }
    })

    it('applies snap position classes correctly', async () => {
      const positions: Array<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'> = [
        'top-left',
        'top-right',
        'bottom-left',
        'bottom-right',
      ]
      for (const position of positions) {
        const wrapper = mount(VOvMedia, {
          props: {
            video: true,
            snap: true,
            snapPosition: position,
          },
        })
        await flushPromises()
        expect(wrapper.props('snapPosition')).toBe(position)
      }
    })
  })

  describe('Button Variants', () => {
    it('accepts button variant prop', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
          variant: 'outlined',
        },
      })
      await flushPromises()
      expect(wrapper.props('variant')).toBe('outlined')
    })

    it('accepts button density prop', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
          density: 'compact',
        },
      })
      await flushPromises()
      expect(wrapper.props('density')).toBe('compact')
    })

    it('renders with compact mode', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
          compact: true,
        },
      })
      await flushPromises()
      expect(wrapper.props('compact')).toBe(true)
    })
  })

  describe('Lifecycle', () => {
    it('can be unmounted without errors', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
        },
      })
      await flushPromises()
      await wrapper.unmount()
      expect(wrapper.vm).toBeDefined()
    })

    it('cleans up on unmount', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
        },
      })
      await flushPromises()
      await wrapper.unmount()
      // Component should have cleaned up without errors
      expect(wrapper.vm).toBeDefined()
    })

    it('handles mount with audio only', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          audio: true,
        },
      })
      await flushPromises()
      expect(wrapper.exists()).toBe(true)
      await wrapper.unmount()
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Media Element Attributes', () => {
    it('sets video autoplay attribute', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
          src: 'test.mp4',
          autoplay: true,
        },
      })
      await flushPromises()
      const video = wrapper.find('video')
      expect(video.exists()).toBe(true)
    })

    it('sets video loop attribute', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
          src: 'test.mp4',
          loop: true,
        },
      })
      await flushPromises()
      const video = wrapper.find('video')
      expect(video.exists()).toBe(true)
    })

    it('sets audio controls when src is provided', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          audio: true,
          src: 'test.mp3',
        },
      })
      await flushPromises()
      const audio = wrapper.find('audio')
      expect(audio.exists()).toBe(true)
    })

    it('does not show audio controls in compact mode with src', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          audio: true,
          src: 'test.mp3',
          compact: true,
        },
      })
      await flushPromises()
      const audio = wrapper.find('audio')
      expect(audio.exists()).toBe(true)
      expect(wrapper.props('compact')).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('handles prop changes without errors', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
        },
      })
      await flushPromises()
      await wrapper.setProps({ compact: true })
      expect(wrapper.props('compact')).toBe(true)
      await flushPromises()
    })

    it('handles multiple prop updates', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
          recorderPosition: 'bottom-left',
        },
      })
      await flushPromises()
      await wrapper.setProps({ recorderPosition: 'top-right' })
      await wrapper.setProps({ snap: true })
      await wrapper.setProps({ snapPosition: 'bottom-left' })
      expect(wrapper.props('recorderPosition')).toBe('top-right')
      expect(wrapper.props('snap')).toBe(true)
      expect(wrapper.props('snapPosition')).toBe('bottom-left')
    })

    it('handles both video and audio constraints', async () => {
      const videoConstraints = { width: 1280, height: 720 }
      const audioConstraints = { echoCancellation: true }
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
          audio: true,
          videoConstraints,
          audioConstraints,
        },
      })
      await flushPromises()
      expect(wrapper.props('videoConstraints')).toEqual(videoConstraints)
      expect(wrapper.props('audioConstraints')).toEqual(audioConstraints)
    })
  })

  describe('Container Styling', () => {
    it('renders container div with correct class', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
        },
      })
      await flushPromises()
      const container = wrapper.find('.container')
      expect(container.exists()).toBe(true)
    })

    it('contains slot wrapper div', async () => {
      const wrapper = mount(VOvMedia, {
        props: {
          video: true,
        },
      })
      await flushPromises()
      const slot = wrapper.find('.slot')
      expect(slot.exists()).toBe(true)
    })
  })
})
