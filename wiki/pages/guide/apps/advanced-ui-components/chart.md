# Chart

## Overview

`VOvChart` is a thin wrapper around `vue-chartjs` and Chart.js. It selects one chart type from a set of boolean flags, merges in default hover behavior, and resizes itself when the container changes size. When `clickable` is enabled, clicks resolve the active dataset item and emit the clicked value.

## Dependencies

- `vue-chartjs`
- `chart.js`
- `chartjs-plugin-autocolors`

## Usage

```vue
<template>
  <v-ov-chart
    bar
    clickable
    :chart-data="chartData"
    :chart-options="chartOptions"
    @elementClick="onElementClick"
  />
</template>

<script setup lang="ts">
import type { ChartData } from 'chart.js'

const chartData = ref<ChartData<'bar'>>({
  labels: ['Jan', 'Feb', 'Mar'],
  datasets: [{ label: 'Sales', data: [10, 20, 15] }],
})

const chartOptions = ref({ responsive: true })

function onElementClick(datasetIndex: number, index: number, value: unknown) {
  console.log(datasetIndex, index, value)
}
</script>
```

## API

### Props

| Prop           | Type                                                                                       | Default  | Description                                             |
| -------------- | ------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------- |
| `bar`          | `boolean`                                                                                  | `false`  | Render a Bar chart when selected.                       |
| `line`         | `boolean`                                                                                  | `false`  | Render a Line chart when selected.                      |
| `pie`          | `boolean`                                                                                  | `false`  | Render a Pie chart when selected.                       |
| `doughnut`     | `boolean`                                                                                  | `false`  | Render a Doughnut chart when selected.                  |
| `radar`        | `boolean`                                                                                  | `false`  | Render a Radar chart when selected.                     |
| `polarArea`    | `boolean`                                                                                  | `false`  | Render a Polar Area chart when selected.                |
| `scatter`      | `boolean`                                                                                  | `false`  | Render a Scatter chart when selected.                   |
| `clickable`    | `boolean`                                                                                  | `false`  | Enables click handling and pointer cursor feedback.     |
| `chartData`    | `ChartData<'bar' \| 'line' \| 'pie' \| 'doughnut' \| 'radar' \| 'polarArea' \| 'scatter'>` | required | Data for the active chart type.                         |
| `chartOptions` | `object`                                                                                   | `{}`     | Chart.js options merged with the default hover handler. |
| `chartPlugins` | `Plugin[]`                                                                                 | `[]`     | Additional Chart.js plugins.                            |

### Emits

| Event          | Payload                                                 | Description                                                         |
| -------------- | ------------------------------------------------------- | ------------------------------------------------------------------- |
| `elementClick` | `(datasetIndex: number, index: number, value: unknown)` | Emitted when `clickable` is enabled and a chart element is clicked. |

### Exposed

None.

### Slots

None.

### Notes

- Only the first enabled chart flag is rendered.
- `chartData` should match the selected chart type.
- Hovering a clickable chart changes the cursor to a pointer when a point is hit.
- The chart resizes automatically via `ResizeObserver`.
