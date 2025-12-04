<template>
  <v-row>
    <v-col cols="12" md="6" lg="4">
      <v-ov-chart
        bar
        clickable
        :chart-data="chartDataBar"
        :chart-options="chartOptionsBar"
        @elementClick="chartClick"
      />
    </v-col>
    <v-col cols="12" md="6" lg="4">
      <v-ov-chart pie :chart-data="chartDataPie" :chart-options="chartOptionsPie" />
    </v-col>
    <v-col cols="12" md="6" lg="4">
      <v-ov-chart radar :chart-data="chartDataRadar" :chart-options="chartOptionsRadar" />
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
definePage({
  meta: {
    visibility: 'with-role',
    access: 'with-role',
    roles: ['developer'],
  },
})

// BAR

const chartDataBar = ref({
  datasets: [
    {
      label: 'Bar Dataset -1',
      data: [10, 20, 30, 40],
    },
    {
      label: 'Bar Dataset -2',
      data: [10, 15, 30, 35],
    },
    {
      label: 'Line Dataset',
      data: [10, 30, 10, 20],
      type: 'line',
    },
  ],
  labels: ['January', 'February', 'March', 'April'],
})
const chartOptionsBar = ref({
  scales: {
    x: {
      stacked: true,
    },
    y: {
      stacked: true,
    },
  },
})

function chartClick(order: number, index: number, value: number) {
  console.log('Clicked data: ', order, index, value)
  // Do something with the clicked data
}

// PIE

const chartDataPie = ref({
  labels: ['A', 'B', 'C', 'D'],
  datasets: [
    {
      label: 'Pie data',
      type: 'doughnut',
      data: [10, 20, 30, 40],
      backgroundColor: ['#0123456', '#234567', '#345678', '#456789'],
    },
  ],
})

const chartOptionsPie = ref({})

// RADAR

const chartDataRadar = ref({
  labels: ['A', 'B', 'C', 'D', 'E', 'F'],
  datasets: [
    {
      label: 'Radar Dataset 1',
      data: [20, 10, 30, 40, 50, 60],
      fill: true,
      backgroundColor: 'rgba(54, 162, 235, 0.2)',
      borderColor: 'rgb(54, 162, 235)',
      pointBackgroundColor: 'rgb(54, 162, 235)',
    },
    {
      label: 'Radar Dataset 2',
      data: [30, 40, 20, 10, 60, 50],
      fill: true,
      backgroundColor: 'rgba(255, 99, 132, 0.2)',
      borderColor: 'rgb(255, 99, 132)',
      pointBackgroundColor: 'rgb(255, 99, 132)',
    },
  ],
})

const chartOptionsRadar = ref({
  elements: {
    line: {
      borderWidth: 3,
    },
  },
})
</script>
