<template>
  <v-container>
    <v-row>
      <v-col v-for="column in columns" :key="column.key" cols="12" md="4">
        <v-card :title="column.title" :color="column.color" variant="outlined" class="h-100">
          <v-card-text>
            <div @dragover.prevent @drop="drop(column.key, column.cards.length)">
              <v-card
                v-for="(card, index) in column.cards"
                :key="card.id"
                class="mb-4 pa-2"
                draggable="true"
                @dragstart="start(card, column.key, index, $event)"
                @dragend="dnd.end()"
                @dragover.prevent
                @drop="drop(column.key, index)"
              >
                <div class="text-subtitle-2">{{ card.title }}</div>
                <div class="text-body-2 text-medium-emphasis">{{ card.text }}</div>
              </v-card>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useHtml5DragDrop } from '../../../composables/dnd'

type ColumnKey = 'todo' | 'doing' | 'done'
type Card = { id: string; title: string; text: string }
type DragState = { card: Card; from: ColumnKey; index: number }

definePage({
  meta: {
    title: 'Drag and drop sandbox',
    description: 'A compact card drag and drop demo',
    icon: '$mdiDrag',
    color: '#E8F0FE',
  },
})

const dnd = useHtml5DragDrop<Card>()
const dragState = ref<DragState | null>(null)

const columns = reactive<
  Record<ColumnKey, { key: ColumnKey; title: string; color: string; cards: Card[] }>
>({
  todo: {
    key: 'todo',
    title: 'Todo',
    color: 'grey-lighten-4',
    cards: [
      { id: '1', title: 'Plan sprint', text: 'Outline the next steps' },
      { id: '2', title: 'Review PR', text: 'Check the latest changes' },
      { id: '3', title: 'Write tests', text: 'Cover the new flow' },
    ],
  },
  doing: {
    key: 'doing',
    title: 'Doing',
    color: 'blue-lighten-4',
    cards: [
      { id: '4', title: 'Refine UI', text: 'Polish the interactions' },
      { id: '5', title: 'Fix typing', text: 'Resolve the remaining errors' },
      { id: '6', title: 'Prepare demo', text: 'Show the draft to the team' },
    ],
  },
  done: {
    key: 'done',
    title: 'Done',
    color: 'green-lighten-4',
    cards: [
      { id: '7', title: 'Ship release', text: 'Publish the new build' },
      { id: '8', title: 'Share notes', text: 'Send the summary around' },
      { id: '9', title: 'Celebrate', text: 'Take a well-earned break' },
    ],
  },
})

function start(card: Card, from: ColumnKey, index: number, event: DragEvent) {
  dragState.value = { card, from, index }
  dnd.start(card, event)
}

function drop(target: ColumnKey, index: number) {
  const state = dragState.value
  if (!state) return

  const source = columns[state.from].cards
  const targetCards = columns[target].cards
  const [card] = source.splice(state.index, 1)
  if (!card) return

  if (state.from === target) {
    const adjusted = state.index < index ? index - 1 : index
    targetCards.splice(adjusted, 0, card)
  } else {
    targetCards.splice(index, 0, card)
  }

  dragState.value = null
  dnd.end()
}
</script>
