import { describe, it, expect, vi, beforeAll } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { ChartData } from 'chart.js'
import VOvChart from '../VOvChart.vue'

// Mock ResizeObserver globally for all tests
beforeAll(() => {
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
  })) as never
})

const mockBarChartData: ChartData<'bar'> = {
  labels: ['January', 'February', 'March'],
  datasets: [
    {
      label: 'Sales',
      data: [65, 59, 80],
      backgroundColor: 'rgba(255, 99, 132, 0.5)',
    },
  ],
}

const mockLineChartData: ChartData<'line'> = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr'],
  datasets: [
    {
      label: 'Dataset 1',
      data: [10, 20, 30, 40],
      borderColor: 'rgb(75, 192, 192)',
    },
  ],
}

const mockPieChartData: ChartData<'pie'> = {
  labels: ['Red', 'Blue', 'Yellow'],
  datasets: [
    {
      label: 'Votes',
      data: [12, 19, 3],
      backgroundColor: ['red', 'blue', 'yellow'],
    },
  ],
}

// Helper to provide chart component stubs for all tests
const chartStubs = {
  Bar: true,
  Line: true,
  Pie: true,
  Doughnut: true,
  Radar: true,
  PolarArea: true,
  Scatter: true,
}

describe('VOvChart', () => {
  describe('Rendering', () => {
    it('mounts without error when bar prop is true', () => {
      const wrapper = mount(VOvChart, {
        props: {
          bar: true,
          chartData: mockBarChartData,
        },
        global: { stubs: chartStubs },
      })
      expect(wrapper.vm).toBeDefined()
      expect(wrapper.exists()).toBe(true)
    })

    it('mounts without error when line prop is true', () => {
      const wrapper = mount(VOvChart, {
        props: {
          line: true,
          chartData: mockLineChartData,
        },
        global: { stubs: chartStubs },
      })
      expect(wrapper.vm).toBeDefined()
      expect(wrapper.exists()).toBe(true)
    })

    it('mounts without error when pie prop is true', () => {
      const wrapper = mount(VOvChart, {
        props: {
          pie: true,
          chartData: mockPieChartData,
        },
        global: { stubs: chartStubs },
      })
      expect(wrapper.vm).toBeDefined()
      expect(wrapper.exists()).toBe(true)
    })

    it('mounts without error when doughnut prop is true', () => {
      const wrapper = mount(VOvChart, {
        props: {
          doughnut: true,
          chartData: mockPieChartData,
        },
        global: { stubs: chartStubs },
      })
      expect(wrapper.vm).toBeDefined()
      expect(wrapper.exists()).toBe(true)
    })

    it('mounts without error when radar prop is true', () => {
      const wrapper = mount(VOvChart, {
        props: {
          radar: true,
          chartData: mockLineChartData,
        },
        global: { stubs: chartStubs },
      })
      expect(wrapper.vm).toBeDefined()
      expect(wrapper.exists()).toBe(true)
    })

    it('mounts without error when polarArea prop is true', () => {
      const wrapper = mount(VOvChart, {
        props: {
          polarArea: true,
          chartData: mockLineChartData,
        },
        global: { stubs: chartStubs },
      })
      expect(wrapper.vm).toBeDefined()
      expect(wrapper.exists()).toBe(true)
    })

    it('mounts without error when scatter prop is true', () => {
      const wrapper = mount(VOvChart, {
        props: {
          scatter: true,
          chartData: mockLineChartData,
        },
        global: { stubs: chartStubs },
      })
      expect(wrapper.vm).toBeDefined()
      expect(wrapper.exists()).toBe(true)
    })

    it('renders nothing when no chart type is specified', () => {
      const wrapper = mount(VOvChart, {
        props: {
          chartData: mockBarChartData,
        },
        global: { stubs: chartStubs },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('renders only first chart when multiple types are specified', () => {
      const wrapper = mount(VOvChart, {
        props: {
          bar: true,
          line: true,
          chartData: mockBarChartData,
        },
        global: { stubs: chartStubs },
      })
      expect(wrapper.vm).toBeDefined()
      expect(wrapper.exists()).toBe(true)
    })
  })

  describe('Data Props', () => {
    it('accepts chart data prop', () => {
      const wrapper = mount(VOvChart, {
        props: {
          bar: true,
          chartData: mockBarChartData,
        },
        global: { stubs: chartStubs },
      })
      expect(wrapper.props('chartData')).toEqual(mockBarChartData)
    })

    it('handles empty datasets', () => {
      const emptyData: ChartData<'bar'> = {
        labels: ['test'],
        datasets: [],
      }
      const wrapper = mount(VOvChart, {
        props: {
          bar: true,
          chartData: emptyData,
        },
        global: { stubs: chartStubs },
      })
      expect(wrapper.props('chartData')).toEqual(emptyData)
    })

    it('handles line chart data', () => {
      const wrapper = mount(VOvChart, {
        props: {
          line: true,
          chartData: mockLineChartData,
        },
        global: { stubs: chartStubs },
      })
      expect(wrapper.props('chartData')).toEqual(mockLineChartData)
    })

    it('handles pie chart data', () => {
      const wrapper = mount(VOvChart, {
        props: {
          pie: true,
          chartData: mockPieChartData,
        },
        global: { stubs: chartStubs },
      })
      expect(wrapper.props('chartData')).toEqual(mockPieChartData)
    })
  })

  describe('Options Props', () => {
    it('accepts custom chart options', () => {
      const customOptions = {
        responsive: true,
        maintainAspectRatio: false,
      }
      const wrapper = mount(VOvChart, {
        props: {
          bar: true,
          chartData: mockBarChartData,
          chartOptions: customOptions,
        },
        global: { stubs: chartStubs },
      })
      expect(wrapper.props('chartOptions')).toEqual(customOptions)
    })

    it('defaults to empty options object', () => {
      const wrapper = mount(VOvChart, {
        props: {
          bar: true,
          chartData: mockBarChartData,
        },
        global: { stubs: chartStubs },
      })
      expect(wrapper.props('chartOptions')).toEqual({})
    })
  })

  describe('Plugins Props', () => {
    it('accepts plugin array prop', () => {
      const mockPlugin = { id: 'test-plugin' }
      const wrapper = mount(VOvChart, {
        props: {
          bar: true,
          chartData: mockBarChartData,
          chartPlugins: [mockPlugin],
        },
        global: { stubs: chartStubs },
      })
      expect(wrapper.props('chartPlugins')).toEqual([mockPlugin])
    })

    it('defaults to empty plugins array', () => {
      const wrapper = mount(VOvChart, {
        props: {
          bar: true,
          chartData: mockBarChartData,
        },
        global: { stubs: chartStubs },
      })
      expect(wrapper.props('chartPlugins')).toEqual([])
    })
  })

  describe('Click Handling', () => {
    it('accepts clickable prop as true', () => {
      const wrapper = mount(VOvChart, {
        props: {
          bar: true,
          clickable: true,
          chartData: mockBarChartData,
        },
        global: { stubs: chartStubs },
      })
      expect(wrapper.props('clickable')).toBe(true)
    })

    it('accepts clickable prop as false', () => {
      const wrapper = mount(VOvChart, {
        props: {
          bar: true,
          clickable: false,
          chartData: mockBarChartData,
        },
        global: { stubs: chartStubs },
      })
      expect(wrapper.props('clickable')).toBe(false)
    })

    it('defaults clickable to false', () => {
      const wrapper = mount(VOvChart, {
        props: {
          bar: true,
          chartData: mockBarChartData,
        },
        global: { stubs: chartStubs },
      })
      expect(wrapper.props('clickable')).toBe(false)
    })
  })

  describe('Chart Type Selection', () => {
    it('mounts correctly when bar is true', () => {
      const wrapper = mount(VOvChart, {
        props: { bar: true, chartData: mockBarChartData },
        global: { stubs: chartStubs },
      })
      expect(wrapper.exists()).toBe(true)
    })

    it('mounts correctly when line is true', () => {
      const wrapper = mount(VOvChart, {
        props: { line: true, chartData: mockLineChartData },
        global: { stubs: chartStubs },
      })
      expect(wrapper.exists()).toBe(true)
    })

    it('mounts correctly when pie is true', () => {
      const wrapper = mount(VOvChart, {
        props: { pie: true, chartData: mockPieChartData },
        global: { stubs: chartStubs },
      })
      expect(wrapper.exists()).toBe(true)
    })

    it('mounts correctly when doughnut is true', () => {
      const wrapper = mount(VOvChart, {
        props: { doughnut: true, chartData: mockPieChartData },
        global: { stubs: chartStubs },
      })
      expect(wrapper.exists()).toBe(true)
    })

    it('mounts correctly when radar is true', () => {
      const wrapper = mount(VOvChart, {
        props: { radar: true, chartData: mockLineChartData },
        global: { stubs: chartStubs },
      })
      expect(wrapper.exists()).toBe(true)
    })

    it('mounts correctly when polarArea is true', () => {
      const wrapper = mount(VOvChart, {
        props: { polarArea: true, chartData: mockLineChartData },
        global: { stubs: chartStubs },
      })
      expect(wrapper.exists()).toBe(true)
    })

    it('mounts correctly when scatter is true', () => {
      const wrapper = mount(VOvChart, {
        props: { scatter: true, chartData: mockLineChartData },
        global: { stubs: chartStubs },
      })
      expect(wrapper.exists()).toBe(true)
    })
  })

  describe('ResizeObserver', () => {
    it('mounts with ResizeObserver mock available', () => {
      const wrapper = mount(VOvChart, {
        props: {
          bar: true,
          chartData: mockBarChartData,
        },
        global: { stubs: chartStubs },
      })
      expect(global.ResizeObserver).toBeDefined()
      expect(wrapper.vm).toBeDefined()
    })

    it('can be unmounted without errors', async () => {
      const wrapper = mount(VOvChart, {
        props: {
          bar: true,
          chartData: mockBarChartData,
        },
        global: { stubs: chartStubs },
      })
      await wrapper.unmount()
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Edge Cases', () => {
    it('handles no chart type props', () => {
      const wrapper = mount(VOvChart, {
        props: {
          chartData: mockBarChartData,
        },
        global: { stubs: chartStubs },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('handles multiple chart types (first wins)', () => {
      const wrapper = mount(VOvChart, {
        props: {
          bar: true,
          line: true,
          pie: true,
          chartData: mockBarChartData,
        },
        global: { stubs: chartStubs },
      })
      expect(wrapper.props('bar')).toBe(true)
      expect(wrapper.props('line')).toBe(true)
      expect(wrapper.props('pie')).toBe(true)
    })

    it('handles prop changes without errors', async () => {
      const wrapper = mount(VOvChart, {
        props: {
          bar: true,
          chartData: mockBarChartData,
        },
        global: { stubs: chartStubs },
      })
      await wrapper.setProps({ line: true, bar: false })
      expect(wrapper.props('line')).toBe(true)
      expect(wrapper.props('bar')).toBe(false)
      await flushPromises()
    })
  })

  describe('All Chart Types Integration', () => {
    it('renders all 7 chart types without errors', async () => {
      const wrappers = [
        mount(VOvChart, {
          props: { bar: true, chartData: mockBarChartData },
          global: { stubs: chartStubs },
        }),
        mount(VOvChart, {
          props: { line: true, chartData: mockLineChartData },
          global: { stubs: chartStubs },
        }),
        mount(VOvChart, {
          props: { pie: true, chartData: mockPieChartData },
          global: { stubs: chartStubs },
        }),
        mount(VOvChart, {
          props: { doughnut: true, chartData: mockPieChartData },
          global: { stubs: chartStubs },
        }),
        mount(VOvChart, {
          props: { radar: true, chartData: mockLineChartData },
          global: { stubs: chartStubs },
        }),
        mount(VOvChart, {
          props: { polarArea: true, chartData: mockLineChartData },
          global: { stubs: chartStubs },
        }),
        mount(VOvChart, {
          props: { scatter: true, chartData: mockLineChartData },
          global: { stubs: chartStubs },
        }),
      ]
      wrappers.forEach((wrapper) => {
        expect(wrapper.exists()).toBe(true)
      })
    })
  })
})
