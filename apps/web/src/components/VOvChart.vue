<template>
  <!-- prettier-ignore -->
  <component
    v-if="activeChart"
    :is="activeChart.component"
    ref="chartRef"
    :data="(activeChart.data as any)"
    :options="chartOptions"
    :plugins="chartPlugins"
    @click="onChartClick"
  />
</template>

<script setup lang="ts">
import { Bar, Line, Pie, Doughnut, Radar, PolarArea, Scatter } from 'vue-chartjs'
import type { ChartData, ChartEvent } from 'chart.js'
import type { PropType } from 'vue'
import { computed, ref, onMounted, onUnmounted } from 'vue'
import type { Plugin } from 'chart.js'
import {
  Chart,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  ArcElement,
  RadialLinearScale,
  Filler,
  type ActiveElement,
} from 'chart.js'
import autocolors from 'chartjs-plugin-autocolors'

Chart.register(
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  ArcElement,
  RadialLinearScale,
  Filler,
  autocolors,
)

const props = defineProps({
  bar: { type: Boolean, default: false },
  line: { type: Boolean, default: false },
  pie: { type: Boolean, default: false },
  doughnut: { type: Boolean, default: false },
  radar: { type: Boolean, default: false },
  polarArea: { type: Boolean, default: false },
  scatter: { type: Boolean, default: false },
  clickable: { type: Boolean, default: false },
  chartData: {
    type: Object as PropType<
      ChartData<'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'polarArea' | 'scatter'>
    >,
    required: true,
    validator: (
      value: ChartData<'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'polarArea' | 'scatter'>,
    ) => Array.isArray(value.datasets),
  },
  chartOptions: { type: Object, default: () => ({}) },
  chartPlugins: { type: Array as PropType<Plugin[]>, default: () => [] },
})

const defaultChartOptions = {
  onHover: (event: ChartEvent, chartElement: ActiveElement[], chart: Chart) => {
    if (props.clickable) {
      chart.canvas.style.cursor = chartElement.length > 0 ? 'pointer' : 'default'
    }
    if (event.native) {
      event.native.preventDefault?.()
    }
  },
}

function mergeOptions(defaults: object, options: object): object {
  return { ...defaults, ...options }
}

const chartOptions = computed(() => {
  return mergeOptions(defaultChartOptions, props.chartOptions)
})

const emit = defineEmits(['elementClick'])

const chartRef = ref<InstanceType<
  | typeof Bar
  | typeof Line
  | typeof Pie
  | typeof Doughnut
  | typeof Radar
  | typeof PolarArea
  | typeof Scatter
> | null>(null)

type ChartType = 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'polarArea' | 'scatter'

const chartDataMap: Record<string, () => ChartData<ChartType>> = {
  bar: () => (props.bar ? (props.chartData as ChartData<'bar'>) : { datasets: [] }),
  line: () => (props.line ? (props.chartData as ChartData<'line'>) : { datasets: [] }),
  pie: () => (props.pie ? (props.chartData as ChartData<'pie'>) : { datasets: [] }),
  doughnut: () => (props.doughnut ? (props.chartData as ChartData<'doughnut'>) : { datasets: [] }),
  radar: () => (props.radar ? (props.chartData as ChartData<'radar'>) : { datasets: [] }),
  polarArea: () =>
    props.polarArea ? (props.chartData as ChartData<'polarArea'>) : { datasets: [] },
  scatter: () => (props.scatter ? (props.chartData as ChartData<'scatter'>) : { datasets: [] }),
}

const activeChart = computed(() => {
  const chartTypeMap = {
    bar: Bar,
    line: Line,
    pie: Pie,
    doughnut: Doughnut,
    radar: Radar,
    polarArea: PolarArea,
    scatter: Scatter,
  }

  const types = Object.keys(chartTypeMap) as Array<keyof typeof chartTypeMap>
  const activeType = types.find((type) => props[type as keyof typeof props])

  if (!activeType) return null

  const getData = chartDataMap[activeType]
  if (!getData) return null

  return {
    component: chartTypeMap[activeType],
    data: getData(),
  }
})

function onChartClick(event: MouseEvent) {
  if (!props.clickable) return

  const chartInstance = chartRef.value?.chart as unknown as Chart
  if (!chartInstance) return

  const elements = chartInstance.getElementsAtEventForMode(
    event,
    'nearest',
    { intersect: true },
    false,
  )

  if (elements.length) {
    const firstElement = elements[0] as ActiveElement
    const datasetIndex = firstElement.datasetIndex
    const dataIndex = firstElement.index

    const dataset = chartInstance.data.datasets[datasetIndex]
    if (!dataset) return

    const clickedData = dataset.data[dataIndex]

    const order = datasetIndex
    const index = dataIndex
    const value = clickedData

    emit('elementClick', order, index, value)
  }
}

onMounted(() => {
  if (!chartRef.value) return

  const resizeObserver = new ResizeObserver(() => {
    const chartInstance = chartRef.value?.chart as unknown as Chart
    if (chartInstance) {
      chartInstance.resize()
    }
  })

  const container = chartRef.value?.$el?.parentElement
  if (container) {
    resizeObserver.observe(container)
  }

  onUnmounted(() => {
    resizeObserver.disconnect()
  })
})
</script>
