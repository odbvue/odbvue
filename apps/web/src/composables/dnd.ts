import { computed, ref, type CSSProperties } from 'vue'

export type DragDropOptions<Payload> = {
  serialize?: (payload: Payload) => string
  deserialize?: (value: string) => Payload | null
}

export function useHtml5DragDrop<Payload>(options: DragDropOptions<Payload> = {}) {
  const dragging = ref<Payload | null>(null)
  const active = ref<string | null>(null)

  const isDragging = computed(() => dragging.value !== null)
  const cardStyle: CSSProperties = { cursor: 'grab' }
  const draggingStyle: CSSProperties = { opacity: 0.6 }
  const activeStyle: CSSProperties = {
    outline: '2px dashed rgb(var(--v-theme-primary))',
    outlineOffset: '4px',
  }

  const start = (payload: Payload, event: DragEvent) => {
    const transfer = event.dataTransfer
    if (!transfer) return

    dragging.value = payload
    transfer.effectAllowed = 'move'
    transfer.setData('text/plain', options.serialize?.(payload) ?? JSON.stringify(payload))
  }

  const getPayload = (event: DragEvent): Payload | null => {
    const raw = event.dataTransfer?.getData('text/plain')
    if (!raw) return null

    if (options.deserialize) return options.deserialize(raw)
    try {
      return JSON.parse(raw) as Payload
    } catch {
      return null
    }
  }

  const end = () => {
    dragging.value = null
    active.value = null
  }

  const setActive = (key: string | null) => {
    active.value = key
  }

  return {
    dragging,
    active,
    isDragging,
    cardStyle,
    draggingStyle,
    activeStyle,
    start,
    end,
    getPayload,
    setActive,
  }
}
