import { computed, reactive, ref, type CSSProperties } from 'vue'

export type DragDropOptions<Payload> = {
  mime: string
  toJson?: (payload: Payload) => unknown
  fromJson?: (value: unknown) => Payload | null
  toText?: (payload: Payload) => string
  fromText?: (text: string) => Payload | null
}

export function useHtml5DragDrop<Payload, DropKey extends string = string>(
  options: DragDropOptions<Payload>,
) {
  const draggingPayload = ref<Payload | null>(null)
  const activeDropKey = ref<DropKey | null>(null)
  const dragEnterCounts = reactive<Record<string, number>>({})

  // Default styles (theme-aware via Vuetify CSS variables when present)
  const dndCardBaseStyle: CSSProperties = {
    cursor: 'grab',
  }

  const dndCardDraggingStyle: CSSProperties = {
    cursor: 'grabbing',
    opacity: 0.85,
  }

  const dndDropColumnActiveStyle: CSSProperties = {
    outline: '2px dashed rgb(var(--v-theme-primary))',
    outlineOffset: '6px',
    backgroundColor: 'rgba(var(--v-theme-primary), 0.06)',
  }

  const isDragging = computed(() => draggingPayload.value !== null)

  const clearDropTargets = () => {
    activeDropKey.value = null
    for (const k of Object.keys(dragEnterCounts)) delete dragEnterCounts[k]
  }

  const endDrag = () => {
    draggingPayload.value = null
    clearDropTargets()
  }

  const startDrag = (payload: Payload, event: DragEvent) => {
    draggingPayload.value = payload

    const dt = event.dataTransfer
    if (!dt) return

    dt.effectAllowed = 'move'

    const jsonValue = options.toJson ? options.toJson(payload) : payload
    dt.setData(options.mime, JSON.stringify(jsonValue))

    const textValue = options.toText ? options.toText(payload) : ''
    if (textValue) dt.setData('text/plain', textValue)
  }

  const extractPayload = (event: DragEvent): Payload | null => {
    const dt = event.dataTransfer
    if (!dt) return null

    const raw = dt.getData(options.mime) || ''
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown
        if (!options.fromJson) return null
        return options.fromJson(parsed)
      } catch {
        // ignore
      }
    }

    const text = dt.getData('text/plain') || ''
    if (text && options.fromText) return options.fromText(text)

    return null
  }

  const enterDropTarget = (key: DropKey) => {
    if (!draggingPayload.value) return

    const k = String(key)
    dragEnterCounts[k] = (dragEnterCounts[k] ?? 0) + 1
    activeDropKey.value = key
  }

  const leaveDropTarget = (key: DropKey) => {
    const k = String(key)
    const next = (dragEnterCounts[k] ?? 0) - 1

    if (next <= 0) {
      delete dragEnterCounts[k]
      if (activeDropKey.value === key) activeDropKey.value = null
      return
    }

    dragEnterCounts[k] = next
  }

  return {
    draggingPayload,
    isDragging,
    activeDropKey,

    dndCardBaseStyle,
    dndCardDraggingStyle,
    dndDropColumnActiveStyle,

    startDrag,
    endDrag,
    extractPayload,
    enterDropTarget,
    leaveDropTarget,
    clearDropTargets,
  }
}
