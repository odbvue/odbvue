# Chart

Universal wrapper component for rendering Chart.js charts with responsive resizing and click handling.

## Overview

`VOvChart` wraps all 7 Chart.js chart types (Bar, Line, Pie, Doughnut, Radar, PolarArea, Scatter) in a single configurable component. Automatically resizes charts when container dimensions change and emits events for user interactions.

**Features:**
- 7 chart types with boolean flag selection
- Responsive ResizeObserver-based resizing
- Click event handling with dataset/value information
- Custom data, options, and plugin support
- Full TypeScript support

## Dependencies

```bash
pnpm add vue-chartjs chart.js chartjs-plugin-autocolors
```

- **vue-chartjs@5**: Vue 3 Chart.js wrapper components
- **chart.js@4**: Core charting library
- **chartjs-plugin-autocolors**: Automatic color generation for datasets

## Usage

::: details Examples
<<< ../../../../src/pages/sandbox/sandbox-chart.vue 
:::

## API

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `bar` | `boolean` | `false` | Use BarChart |
| `line` | `boolean` | `false` | Use LineChart |
| `pie` | `boolean` | `false` | Use PieChart |
| `doughnut` | `boolean` | `false` | Use DoughnutChart |
| `radar` | `boolean` | `false` | Use RadarChart |
| `polarArea` | `boolean` | `false` | Use PolarAreaChart |
| `scatter` | `boolean` | `false` | Use ScatterChart |
| `chartData` | `ChartData` | - | Chart.js data object with labels and datasets |
| `chartOptions` | `ChartOptions` | `{}` | Chart.js options (responsive, plugins, scales, etc.) |
| `chartPlugins` | `ChartPlugin[]` | `[]` | Array of Chart.js plugins |
| `clickable` | `boolean` | `false` | Enable click event emission |

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `element-click` | `{ datasetIndex: number; index: number; value: number }` | Emitted when chart element clicked (requires `clickable: true`) |

### Chart Data Format

Standard Chart.js data structure:

```typescript
interface ChartData {
  labels: string[]
  datasets: Array<{
    label: string
    data: number[]
    backgroundColor?: string | string[]
    borderColor?: string
    borderWidth?: number
    // ... other Chart.js dataset options
  }>
}
```

### Responsive Behavior

Charts automatically resize when container dimensions change via ResizeObserver. No specific configuration is needed.
