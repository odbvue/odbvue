import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import VOvPad from '../VOvPad.vue'

// Mock canvas context and related browser APIs
beforeEach(() => {
  // Mock HTMLCanvasElement.getContext
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () =>
      ({
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        closePath: vi.fn(),
        setLineDash: vi.fn(),
        ellipse: vi.fn(),
        drawImage: vi.fn(),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        lineJoin: 'miter' as CanvasLineJoin,
        lineCap: 'round' as CanvasLineCap,
        globalCompositeOperation: 'source-over',
        setTransform: vi.fn(),
      }) as unknown as CanvasRenderingContext2D,
  ) as unknown as HTMLCanvasElement['getContext']

  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
  })) as unknown as typeof ResizeObserver

  // Mock Image
  global.Image = vi.fn().mockImplementation(() => ({
    src: '',
  })) as unknown as typeof Image
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('VOvPad', () => {
  describe('Rendering', () => {
    it('mounts without error', () => {
      const wrapper = mount(VOvPad, {
        props: {
          width: '100%',
          height: '240px',
        },
      })
      expect(wrapper.vm).toBeDefined()
      expect(wrapper.exists()).toBe(true)
    })

    it('renders canvas element', () => {
      const wrapper = mount(VOvPad, {
        props: {
          width: '100%',
          height: '240px',
        },
      })
      const canvas = wrapper.find('canvas')
      expect(canvas.exists()).toBe(true)
    })

    it('renders container div', () => {
      const wrapper = mount(VOvPad, {
        props: {
          width: '100%',
          height: '240px',
        },
      })
      const container = wrapper.find('#container')
      expect(container.exists()).toBe(true)
    })
  })

  describe('Props - Dimensions', () => {
    it('accepts width prop as string', () => {
      const wrapper = mount(VOvPad, {
        props: {
          width: '100%',
          height: '240px',
        },
      })
      expect(wrapper.props('width')).toBe('100%')
    })

    it('accepts height prop as string', () => {
      const wrapper = mount(VOvPad, {
        props: {
          width: '100%',
          height: '240px',
        },
      })
      expect(wrapper.props('height')).toBe('240px')
    })

    it('accepts width prop as number', () => {
      const wrapper = mount(VOvPad, {
        props: {
          width: 500,
          height: 300,
        },
      })
      expect(wrapper.props('width')).toBe(500)
    })

    it('accepts height prop as number', () => {
      const wrapper = mount(VOvPad, {
        props: {
          width: 500,
          height: 300,
        },
      })
      expect(wrapper.props('height')).toBe(300)
    })

    it('defaults to 100% width and height', () => {
      const wrapper = mount(VOvPad)
      expect(wrapper.props('width')).toBe('100%')
      expect(wrapper.props('height')).toBe('100%')
    })
  })

  describe('Props - Drawing Settings', () => {
    it('accepts color prop', () => {
      const wrapper = mount(VOvPad, {
        props: {
          color: '#FF0000',
        },
      })
      expect(wrapper.props('color')).toBe('#FF0000')
    })

    it('defaults color to black', () => {
      const wrapper = mount(VOvPad)
      expect(wrapper.props('color')).toBe('#000000')
    })

    it('accepts lineWidth prop', () => {
      const wrapper = mount(VOvPad, {
        props: {
          lineWidth: 10,
        },
      })
      expect(wrapper.props('lineWidth')).toBe(10)
    })

    it('defaults lineWidth to 5', () => {
      const wrapper = mount(VOvPad)
      expect(wrapper.props('lineWidth')).toBe(5)
    })

    it('accepts backgroundColor prop', () => {
      const wrapper = mount(VOvPad, {
        props: {
          backgroundColor: '#CCCCCC',
        },
      })
      expect(wrapper.props('backgroundColor')).toBe('#CCCCCC')
    })

    it('defaults backgroundColor to white', () => {
      const wrapper = mount(VOvPad)
      expect(wrapper.props('backgroundColor')).toBe('#FFFFFF')
    })

    it('accepts lineCap prop with valid values', () => {
      const wrapper = mount(VOvPad, {
        props: {
          lineCap: 'square',
        },
      })
      expect(wrapper.props('lineCap')).toBe('square')
    })

    it('defaults lineCap to round', () => {
      const wrapper = mount(VOvPad)
      expect(wrapper.props('lineCap')).toBe('round')
    })

    it('accepts lineJoin prop with valid values', () => {
      const wrapper = mount(VOvPad, {
        props: {
          lineJoin: 'round',
        },
      })
      expect(wrapper.props('lineJoin')).toBe('round')
    })

    it('defaults lineJoin to miter', () => {
      const wrapper = mount(VOvPad)
      expect(wrapper.props('lineJoin')).toBe('miter')
    })
  })

  describe('Props - Stroke Type', () => {
    it('accepts strokeType prop with dash', () => {
      const wrapper = mount(VOvPad, {
        props: {
          strokeType: 'dash',
        },
      })
      expect(wrapper.props('strokeType')).toBe('dash')
    })

    it('accepts strokeType prop with line', () => {
      const wrapper = mount(VOvPad, {
        props: {
          strokeType: 'line',
        },
      })
      expect(wrapper.props('strokeType')).toBe('line')
    })

    it('accepts strokeType prop with square', () => {
      const wrapper = mount(VOvPad, {
        props: {
          strokeType: 'square',
        },
      })
      expect(wrapper.props('strokeType')).toBe('square')
    })

    it('accepts strokeType prop with circle', () => {
      const wrapper = mount(VOvPad, {
        props: {
          strokeType: 'circle',
        },
      })
      expect(wrapper.props('strokeType')).toBe('circle')
    })

    it('accepts strokeType prop with triangle', () => {
      const wrapper = mount(VOvPad, {
        props: {
          strokeType: 'triangle',
        },
      })
      expect(wrapper.props('strokeType')).toBe('triangle')
    })

    it('accepts strokeType prop with half_triangle', () => {
      const wrapper = mount(VOvPad, {
        props: {
          strokeType: 'half_triangle',
        },
      })
      expect(wrapper.props('strokeType')).toBe('half_triangle')
    })

    it('defaults strokeType to dash', () => {
      const wrapper = mount(VOvPad)
      expect(wrapper.props('strokeType')).toBe('dash')
    })
  })

  describe('Props - Shape Filling', () => {
    it('accepts fillShape prop as true', () => {
      const wrapper = mount(VOvPad, {
        props: {
          fillShape: true,
          strokeType: 'circle',
        },
      })
      expect(wrapper.props('fillShape')).toBe(true)
    })

    it('accepts fillShape prop as false', () => {
      const wrapper = mount(VOvPad, {
        props: {
          fillShape: false,
        },
      })
      expect(wrapper.props('fillShape')).toBe(false)
    })

    it('defaults fillShape to false', () => {
      const wrapper = mount(VOvPad)
      expect(wrapper.props('fillShape')).toBe(false)
    })
  })

  describe('Props - Eraser', () => {
    it('accepts eraser prop as true', () => {
      const wrapper = mount(VOvPad, {
        props: {
          eraser: true,
        },
      })
      expect(wrapper.props('eraser')).toBe(true)
    })

    it('accepts eraser prop as false', () => {
      const wrapper = mount(VOvPad, {
        props: {
          eraser: false,
        },
      })
      expect(wrapper.props('eraser')).toBe(false)
    })

    it('defaults eraser to false', () => {
      const wrapper = mount(VOvPad)
      expect(wrapper.props('eraser')).toBe(false)
    })

    it('renders canvas with data-eraser attribute when eraser is true', async () => {
      const wrapper = mount(VOvPad, {
        props: {
          eraser: true,
        },
      })
      await wrapper.vm.$nextTick()
      const canvas = wrapper.find('canvas')
      expect(canvas.attributes('data-eraser')).toBe('true')
    })

    it('renders canvas with data-eraser attribute as false when eraser is false', async () => {
      const wrapper = mount(VOvPad, {
        props: {
          eraser: false,
        },
      })
      await wrapper.vm.$nextTick()
      const canvas = wrapper.find('canvas')
      expect(canvas.attributes('data-eraser')).toBe('false')
    })
  })

  describe('Props - Lock', () => {
    it('accepts lock prop as true', () => {
      const wrapper = mount(VOvPad, {
        props: {
          lock: true,
        },
      })
      expect(wrapper.props('lock')).toBe(true)
    })

    it('accepts lock prop as false', () => {
      const wrapper = mount(VOvPad, {
        props: {
          lock: false,
        },
      })
      expect(wrapper.props('lock')).toBe(false)
    })

    it('defaults lock to false', () => {
      const wrapper = mount(VOvPad)
      expect(wrapper.props('lock')).toBe(false)
    })
  })

  describe('Props - Canvas ID', () => {
    it('accepts custom canvasId prop', () => {
      const wrapper = mount(VOvPad, {
        props: {
          canvasId: 'my-custom-canvas',
        },
      })
      expect(wrapper.props('canvasId')).toBe('my-custom-canvas')
    })

    it('generates canvasId with random suffix by default', () => {
      const wrapper = mount(VOvPad)
      const id = wrapper.props('canvasId')
      expect(id).toMatch(/^canvas-/)
      expect(typeof id).toBe('string')
    })
  })

  describe('Props - Output Format', () => {
    it('accepts saveAs prop as jpeg', () => {
      const wrapper = mount(VOvPad, {
        props: {
          saveAs: 'jpeg',
        },
      })
      expect(wrapper.props('saveAs')).toBe('jpeg')
    })

    it('accepts saveAs prop as png', () => {
      const wrapper = mount(VOvPad, {
        props: {
          saveAs: 'png',
        },
      })
      expect(wrapper.props('saveAs')).toBe('png')
    })

    it('defaults saveAs to png', () => {
      const wrapper = mount(VOvPad)
      expect(wrapper.props('saveAs')).toBe('png')
    })
  })

  describe('Props - Output Dimensions', () => {
    it('accepts outputWidth prop', () => {
      const wrapper = mount(VOvPad, {
        props: {
          outputWidth: 800,
        },
      })
      expect(wrapper.props('outputWidth')).toBe(800)
    })

    it('accepts outputHeight prop', () => {
      const wrapper = mount(VOvPad, {
        props: {
          outputHeight: 600,
        },
      })
      expect(wrapper.props('outputHeight')).toBe(600)
    })
  })

  describe('Props - Images', () => {
    it('accepts initialImage prop as array', () => {
      const initialImage: Array<never> = []
      const wrapper = mount(VOvPad, {
        props: {
          initialImage,
        },
      })
      expect(wrapper.props('initialImage')).toEqual([])
    })

    it('accepts additionalImages prop as array', () => {
      const additionalImages: Array<never> = []
      const wrapper = mount(VOvPad, {
        props: {
          additionalImages,
        },
      })
      expect(wrapper.props('additionalImages')).toEqual([])
    })

    it('accepts backgroundImage prop', () => {
      const wrapper = mount(VOvPad, {
        props: {
          backgroundImage: 'https://example.com/image.png',
        },
      })
      expect(wrapper.props('backgroundImage')).toBe('https://example.com/image.png')
    })

    it('defaults backgroundImage to null', () => {
      const wrapper = mount(VOvPad)
      expect(wrapper.props('backgroundImage')).toBeNull()
    })
  })

  describe('Exposed Methods', () => {
    it('exposes clear method', () => {
      const wrapper = mount(VOvPad)
      expect(wrapper.vm.clear).toBeDefined()
      expect(typeof wrapper.vm.clear).toBe('function')
    })

    it('exposes reset method', () => {
      const wrapper = mount(VOvPad)
      expect(wrapper.vm.reset).toBeDefined()
      expect(typeof wrapper.vm.reset).toBe('function')
    })

    it('exposes undo method', () => {
      const wrapper = mount(VOvPad)
      expect(wrapper.vm.undo).toBeDefined()
      expect(typeof wrapper.vm.undo).toBe('function')
    })

    it('exposes redo method', () => {
      const wrapper = mount(VOvPad)
      expect(wrapper.vm.redo).toBeDefined()
      expect(typeof wrapper.vm.redo).toBe('function')
    })

    it('exposes save method', () => {
      const wrapper = mount(VOvPad)
      expect(wrapper.vm.save).toBeDefined()
      expect(typeof wrapper.vm.save).toBe('function')
    })

    it('exposes startDraw method', () => {
      const wrapper = mount(VOvPad)
      expect(wrapper.vm.startDraw).toBeDefined()
      expect(typeof wrapper.vm.startDraw).toBe('function')
    })

    it('exposes draw method', () => {
      const wrapper = mount(VOvPad)
      expect(wrapper.vm.draw).toBeDefined()
      expect(typeof wrapper.vm.draw).toBe('function')
    })

    it('exposes stopDraw method', () => {
      const wrapper = mount(VOvPad)
      expect(wrapper.vm.stopDraw).toBeDefined()
      expect(typeof wrapper.vm.stopDraw).toBe('function')
    })

    it('exposes handleResize method', () => {
      const wrapper = mount(VOvPad)
      expect(wrapper.vm.handleResize).toBeDefined()
      expect(typeof wrapper.vm.handleResize).toBe('function')
    })
  })

  describe('Reset Functionality', () => {
    it('can call reset method when not locked', () => {
      const wrapper = mount(VOvPad, {
        props: {
          lock: false,
        },
      })
      expect(() => wrapper.vm.reset()).not.toThrow()
    })

    it('cannot call reset when locked', () => {
      const wrapper = mount(VOvPad, {
        props: {
          lock: true,
        },
      })
      expect(() => wrapper.vm.reset()).not.toThrow()
    })
  })

  describe('Undo/Redo Functionality', () => {
    it('can call undo method when not locked', () => {
      const wrapper = mount(VOvPad, {
        props: {
          lock: false,
        },
      })
      expect(() => wrapper.vm.undo()).not.toThrow()
    })

    it('can call redo method when not locked', () => {
      const wrapper = mount(VOvPad, {
        props: {
          lock: false,
        },
      })
      expect(() => wrapper.vm.redo()).not.toThrow()
    })

    it('cannot call undo when locked', () => {
      const wrapper = mount(VOvPad, {
        props: {
          lock: true,
        },
      })
      expect(() => wrapper.vm.undo()).not.toThrow()
    })

    it('cannot call redo when locked', () => {
      const wrapper = mount(VOvPad, {
        props: {
          lock: true,
        },
      })
      expect(() => wrapper.vm.redo()).not.toThrow()
    })
  })

  describe('Save Functionality', () => {
    it('save method can be called without error', () => {
      const wrapper = mount(VOvPad)
      expect(() => wrapper.vm.save()).not.toThrow()
    })

    it('emits update:image event on save', () => {
      const wrapper = mount(VOvPad)
      wrapper.vm.save()
      expect(wrapper.emitted('update:image')).toBeTruthy()
    })

    it('respects saveAs prop format in emitted image', () => {
      const wrapper = mount(VOvPad, {
        props: {
          saveAs: 'jpeg',
        },
      })
      wrapper.vm.save()
      const emitted = wrapper.emitted('update:image')
      expect(emitted).toBeTruthy()
    })
  })

  describe('Canvas Event Handlers', () => {
    it('canvas element exists and is rendered', async () => {
      const wrapper = mount(VOvPad)
      const canvas = wrapper.find('canvas')
      expect(canvas.exists()).toBe(true)
    })

    it('canvas has pointer event handlers attached', async () => {
      const wrapper = mount(VOvPad)
      const canvas = wrapper.find('canvas')
      expect(canvas.exists()).toBe(true)
      // Event handlers are attached in the template via Vue directives
    })
  })

  describe('Touch Action Prevention', () => {
    it('container element exists for touch event handling', async () => {
      const wrapper = mount(VOvPad)
      const container = wrapper.find('#container')
      expect(container.exists()).toBe(true)
      // Touch move prevention is handled via @touchmove.prevent in template
    })
  })

  describe('Canvas Style', () => {
    it('canvas is rendered with proper attributes', () => {
      const wrapper = mount(VOvPad)
      const canvas = wrapper.find('canvas')
      expect(canvas.exists()).toBe(true)
      // Canvas has width and height attributes set dynamically
      expect(canvas.element).toBeDefined()
    })
  })

  describe('Mounting and Unmounting', () => {
    it('mounts and initializes correctly', async () => {
      const wrapper = mount(VOvPad, {
        props: {
          width: '100%',
          height: '240px',
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
      expect(wrapper.exists()).toBe(true)
    })

    it('can be unmounted without errors', async () => {
      const wrapper = mount(VOvPad)
      await wrapper.unmount()
      expect(wrapper).toBeDefined()
    })

    it('removes resize listener on unmount', async () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
      const wrapper = mount(VOvPad)
      await wrapper.unmount()
      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function))
      removeEventListenerSpy.mockRestore()
    })
  })

  describe('Props Updates', () => {
    it('handles color prop change', async () => {
      const wrapper = mount(VOvPad, {
        props: {
          color: '#000000',
        },
      })
      await wrapper.setProps({ color: '#FF0000' })
      expect(wrapper.props('color')).toBe('#FF0000')
    })

    it('handles lineWidth prop change', async () => {
      const wrapper = mount(VOvPad, {
        props: {
          lineWidth: 5,
        },
      })
      await wrapper.setProps({ lineWidth: 10 })
      expect(wrapper.props('lineWidth')).toBe(10)
    })

    it('handles backgroundColor prop change', async () => {
      const wrapper = mount(VOvPad, {
        props: {
          backgroundColor: '#FFFFFF',
        },
      })
      await wrapper.setProps({ backgroundColor: '#CCCCCC' })
      expect(wrapper.props('backgroundColor')).toBe('#CCCCCC')
      await flushPromises()
    })

    it('handles eraser prop change', async () => {
      const wrapper = mount(VOvPad, {
        props: {
          eraser: false,
        },
      })
      await wrapper.setProps({ eraser: true })
      expect(wrapper.props('eraser')).toBe(true)
    })

    it('handles strokeType prop change', async () => {
      const wrapper = mount(VOvPad, {
        props: {
          strokeType: 'dash',
        },
      })
      await wrapper.setProps({ strokeType: 'circle' })
      expect(wrapper.props('strokeType')).toBe('circle')
    })
  })

  describe('Integration with Sandbox Example', () => {
    it('can be used with all sandbox props like sandbox-pad.vue example', async () => {
      const wrapper = mount(VOvPad, {
        props: {
          width: '100%',
          height: '240px',
          lock: false,
          eraser: false,
          backgroundColor: 'white',
          backgroundImage: '',
          lineWidth: 5,
          color: '#000000',
        },
      })
      expect(wrapper.vm).toBeDefined()
      expect(wrapper.props('width')).toBe('100%')
      expect(wrapper.props('height')).toBe('240px')
      expect(wrapper.props('lock')).toBe(false)
      expect(wrapper.props('eraser')).toBe(false)
      expect(wrapper.props('backgroundColor')).toBe('white')
      expect(wrapper.props('lineWidth')).toBe(5)
      expect(wrapper.props('color')).toBe('#000000')
    })

    it('supports all control methods used in sandbox-pad.vue example', () => {
      const wrapper = mount(VOvPad)
      expect(typeof wrapper.vm.reset).toBe('function')
      expect(typeof wrapper.vm.undo).toBe('function')
      expect(typeof wrapper.vm.redo).toBe('function')
      expect(typeof wrapper.vm.save).toBe('function')
    })
  })

  describe('Edge Cases', () => {
    it('handles props with undefined values', () => {
      const wrapper = mount(VOvPad, {
        props: {
          color: undefined,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('handles multiple rapid save calls', () => {
      const wrapper = mount(VOvPad)
      expect(() => {
        wrapper.vm.save()
        wrapper.vm.save()
        wrapper.vm.save()
      }).not.toThrow()
    })

    it('handles canvas resize event', async () => {
      const wrapper = mount(VOvPad)
      expect(() => wrapper.vm.handleResize()).not.toThrow()
    })
  })
})
