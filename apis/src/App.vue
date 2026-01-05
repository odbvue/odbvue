<template>
  <div class="app">
    <h1>OdbVue APIs</h1>

    <h2>DDLs</h2>
    <pre v-for="(ddl, index) in schema.ddls" :key="'ddl-' + index">{{ ddl }}</pre>

    <h2>DMLs</h2>
    <pre v-for="(dml, index) in schema.dmls" :key="'dml-' + index">{{ dml }}</pre>
  </div>
</template>

<script setup lang="ts">
import { schema } from './surveys';
</script>

<style scoped>
.app {
  padding: 2rem;
}

pre {
  background: #f4f4f4;
  padding: 1rem;
  border-radius: 4px;
  overflow-x: auto;
  margin-bottom: 1rem;
}

h2 {
  margin-top: 2rem;
}
</style>
