<template>
  <v-container fluid class="d-flex align-center justify-center" style="height: 100vh">
    <v-col cols="12" class="text-center">
      <img src="/logo.svg" alt="Not Found" />
      <h1>Page not found!</h1>
      <p>Ups! The page you are looking for does not exist.</p>
      <router-link to="/">Home</router-link>
    </v-col>
  </v-container>
</template>

<route lang="json">
{ "meta": { "layout": "fullscreen", "role": "public" } }
</route>
