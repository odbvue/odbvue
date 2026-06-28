<template>
  <v-container>
    <v-row>
      <v-col cols="12"><h3>HTTP Request Testing</h3></v-col>
      <v-col cols="12" md="6">
        <v-card :prepend-icon="'$mdiAccountCowboyHat'" title="Chuck Norris Jokes API" :text="joke">
          <v-card-actions>
            <v-btn color="primary" @click="getJoke">Get New Joke</v-btn>
          </v-card-actions>
          <v-overlay v-model="loading" persistent contained />
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
const http = useHttp()

const joke = ref('')
const loading = ref(false)

const getJoke = async () => {
  loading.value = true
  const { data, error } = await http.get<{ value: string }>(
    'https://api.chucknorris.io/jokes/random',
  )
  loading.value = false
  if (error) {
    console.error('Error fetching joke:', error)
  } else if (data) {
    joke.value = data.value
  }
}

onMounted(() => {
  getJoke()
})
</script>
