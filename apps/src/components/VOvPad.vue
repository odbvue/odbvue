<template>
  <div id="container" ref="container" @touchmove.prevent>
    <canvas
      ref="canvas"
      style="touch-action: none"
      :id="canvasId"
      :width="canvasWidth"
      :height="canvasHeight"
      :data-eraser="eraser"
      @mousedown="startDraw"
      @mousemove="draw"
      @mouseup="stopDraw"
      @mouseleave="stopDraw"
      @touchstart="startDraw"
      @touchmove="draw"
      @touchend="stopDraw"
      @touchleave="stopDraw"
      @touchcancel="stopDraw"
      @pointerdown="startDraw"
      @pointermove="draw"
      @pointerup="stopDraw"
      @pointerleave="stopDraw"
      @pointercancel="stopDraw"
    ></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed, onBeforeUnmount, nextTick } from 'vue'

interface Coordinate {
  x: number
  y: number
}

interface Stroke {
  type: string
  from: Coordinate
  coordinates: Coordinate[]
  color: string
  width: number
  fill: boolean
  lineCap: CanvasLineCap
  lineJoin: CanvasLineJoin
}

interface Scale {
  x: number
  y: number
}

interface DataInit {
  loadedImage: HTMLImageElement | null
  drawing: boolean
  images: Stroke[]
  strokes: Stroke
  guides: Coordinate[]
  trash: Stroke[]
  scale: Scale
}

const props = defineProps({
  strokeType: {
    type: String,
    validator: (value: string): boolean =>
      ['dash', 'line', 'square', 'circle', 'triangle', 'half_triangle'].includes(value),
    default: 'dash',
  },
  fillShape: {
    type: Boolean,
    default: false,
  },
  image: {
    type: String,
    default: '',
  },
  eraser: {
    type: Boolean,
    default: false,
  },
  color: {
    type: String,
    default: '#000000',
  },
  lineWidth: {
    type: Number,
    default: 5,
  },
  lineCap: {
    type: String,
    validator: (value: string): boolean => ['round', 'square', 'butt'].includes(value),
    default: 'round',
  },
  lineJoin: {
    type: String,
    validator: (value: string): boolean => ['miter', 'round', 'bevel'].includes(value),
    default: 'miter',
  },
  lock: {
    type: Boolean,
    default: false,
  },
  backgroundColor: {
    type: String,
    default: '#FFFFFF',
  },
  backgroundImage: {
    type: String,
    default: null,
  },
  saveAs: {
    type: String,
    validator: (value: string) => ['jpeg', 'png'].includes(value),
    default: 'png',
  },
  canvasId: {
    type: String,
    default: 'canvas-' + Math.random().toString(36).substr(2, 9),
  },
  initialImage: {
    type: Array,
    default: () => [],
  },
  additionalImages: {
    type: Array,
    default: () => [],
  },
  outputWidth: {
    type: Number,
  },
  outputHeight: {
    type: Number,
  },
  width: {
    type: [String, Number],
    default: '100%',
  },
  height: {
    type: [String, Number],
    default: '100%',
  },
})

const emits = defineEmits(['update:image'])

const container = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const context = ref<CanvasRenderingContext2D | null>(null)
const canvasWidth = ref(0)
const canvasHeight = ref(0)

const containerWidth = computed(() => {
  const w = props.width
  return typeof w === 'number' ? `${w}px` : w
})

const containerHeight = computed(() => {
  const h = props.height
  return typeof h === 'number' ? `${h}px` : h
})

const data = ref<DataInit>({
  loadedImage: null,
  drawing: false,
  images: [],
  strokes: {
    type: '',
    from: { x: 0, y: 0 },
    coordinates: [],
    color: '#000000',
    width: 0,
    fill: false,
    lineCap: 'round' as CanvasLineCap,
    lineJoin: 'miter' as CanvasLineJoin,
  },
  guides: [],
  trash: [],
  scale: {
    x: 1,
    y: 1,
  },
})

const redrawStrokes = () => {
  data.value.images.forEach((stroke: Stroke) => {
    if (context.value) {
      drawShape(
        context.value,
        stroke,
        stroke.type !== 'eraser' && stroke.type !== 'dash' && stroke.type !== 'line',
      )
    }
  })
}

const handleResize = async () => {
  if (!container.value) return
  const canvas = document.querySelector(`#${props.canvasId}`) as HTMLCanvasElement
  if (canvas) {
    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')

    if (tempCtx) {
      tempCanvas.width = canvasWidth.value
      tempCanvas.height = canvasHeight.value
      tempCtx.drawImage(canvas, 0, 0)

      const newWidth = container.value?.clientWidth || canvasWidth.value
      const newHeight = container.value?.clientHeight || canvasHeight.value

      canvasWidth.value = newWidth
      canvasHeight.value = newHeight

      await nextTick()

      const scaleX = newWidth / tempCanvas.width
      const scaleY = newHeight / tempCanvas.height
      data.value.scale = { x: scaleX, y: scaleY }

      clear()
      if (context.value) {
        context.value.setTransform(1, 0, 0, 1, 0, 0)
        context.value.drawImage(tempCanvas, 0, 0, newWidth, newHeight)
        redrawStrokes()
      }
    }
  }
}

watch(
  () => props.backgroundColor,
  () => {
    redraw(true)
  },
)

watch(
  () => props.backgroundImage,
  () => {
    data.value.loadedImage = null
    redraw(true)
  },
)

onMounted(async () => {
  canvasWidth.value = container.value?.clientWidth || canvasWidth.value
  canvasHeight.value = container.value?.clientHeight || canvasHeight.value
  if (canvas.value) context.value = canvas.value.getContext('2d')
  await setBackground()
  drawInitialImage()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})

const setBackground = async () => {
  clear()
  if (context.value) {
    context.value.fillStyle = props.backgroundColor
    context.value.fillRect(0, 0, Number(canvasWidth.value), Number(canvasHeight.value))
    await drawBackgroundImage()
    save()
  }
}

const drawInitialImage = () => {
  if (props.initialImage.length > 0) {
    data.value.images = data.value.images.concat(props.initialImage as Stroke[])
    redraw(true)
  }
}

const drawBackgroundImage = async () => {
  if (!data.value.loadedImage && props.backgroundImage) {
    return new Promise<void>((resolve) => {
      const image = new Image()
      image.src = props.backgroundImage as string
      if (context.value) {
        context.value.drawImage(image, 0, 0, Number(canvasWidth.value), Number(canvasHeight.value))
        data.value.loadedImage = image
        resolve()
      }
    })
  } else if (data.value.loadedImage) {
    if (context.value) {
      context.value.drawImage(
        data.value.loadedImage,
        0,
        0,
        Number(canvasWidth.value),
        Number(canvasHeight.value),
      )
    }
  }
}

const clear = () => {
  if (context.value) {
    context.value.clearRect(0, 0, Number(canvasWidth.value), Number(canvasHeight.value))
  }
}

const reset = () => {
  if (!props.lock) {
    data.value.images = []
    data.value.strokes = {
      type: '',
      from: { x: 0, y: 0 },
      coordinates: [],
      color: '',
      width: 0,
      fill: false,
      lineCap: 'round' as CanvasLineCap,
      lineJoin: 'miter' as CanvasLineJoin,
    }
    data.value.guides = []
    data.value.trash = []
    redraw(true)
  }
}

const undo = () => {
  if (!props.lock) {
    const strokes = data.value.images.pop()
    if (strokes) {
      data.value.trash.push(strokes)
      redraw(true)
    }
  }
}

const redo = () => {
  if (!props.lock) {
    const strokes = data.value.trash.pop()
    if (strokes) {
      data.value.images.push(strokes)
      redraw(true)
    }
  }
}

const getCoordinates = (event: MouseEvent | TouchEvent) => {
  let x = 0,
    y = 0
  const canvas = document.querySelector(`#${props.canvasId}`) as HTMLCanvasElement
  const rect = canvas?.getBoundingClientRect()
  const touch = (event as TouchEvent).touches?.[0]

  if (touch && rect) {
    x = (touch.clientX - rect.left) / data.value.scale.x
    y = (touch.clientY - rect.top) / data.value.scale.y
  } else {
    x = (event as MouseEvent).offsetX / data.value.scale.x
    y = (event as MouseEvent).offsetY / data.value.scale.y
  }
  return { x, y }
}

const startDraw = (event: MouseEvent | TouchEvent) => {
  if (!props.lock) {
    data.value.drawing = true
    const coordinate = getCoordinates(event)
    data.value.strokes = {
      type: props.eraser ? 'eraser' : props.strokeType,
      from: coordinate,
      coordinates: [],
      color: props.eraser ? props.backgroundColor : props.color,
      width: props.lineWidth,
      fill:
        props.eraser || props.strokeType === 'dash' || props.strokeType === 'line'
          ? false
          : props.fillShape,
      lineCap: props.lineCap as CanvasLineCap,
      lineJoin: props.lineJoin as CanvasLineJoin,
    }
    data.value.guides = []
  }
}

const throttle = (fn: (event: MouseEvent | TouchEvent) => void, limit: number) => {
  let inThrottle: boolean
  return function (this: void, ...args: [MouseEvent | TouchEvent]) {
    if (!inThrottle) {
      fn.apply(this, args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

const draw = throttle((event: MouseEvent | TouchEvent) => {
  if (data.value.drawing) {
    const coordinate = getCoordinates(event)
    if (props.eraser || props.strokeType === 'dash') {
      data.value.strokes.coordinates.push(coordinate)
      if (context.value) {
        drawShape(context.value, data.value.strokes, false)
      }
    } else {
      switch (props.strokeType) {
        case 'line':
          data.value.guides = [{ x: coordinate.x, y: coordinate.y }]
          break
        case 'square':
          data.value.guides = [
            { x: coordinate.x, y: data.value.strokes.from.y },
            { x: coordinate.x, y: coordinate.y },
            { x: data.value.strokes.from.x, y: coordinate.y },
            { x: data.value.strokes.from.x, y: data.value.strokes.from.y },
          ]
          break
        case 'triangle': {
          const center = Math.abs(Math.floor((coordinate.x - data.value.strokes.from.x) / 2))
          const width =
            data.value.strokes.from.x < coordinate.x
              ? data.value.strokes.from.x + center
              : data.value.strokes.from.x - center
          data.value.guides = [
            { x: coordinate.x, y: data.value.strokes.from.y },
            { x: width, y: coordinate.y },
            { x: data.value.strokes.from.x, y: data.value.strokes.from.y },
          ]
          break
        }
        case 'half_triangle':
          data.value.guides = [
            { x: coordinate.x, y: data.value.strokes.from.y },
            { x: data.value.strokes.from.x, y: coordinate.y },
            { x: data.value.strokes.from.x, y: data.value.strokes.from.y },
          ]
          break
        case 'circle': {
          const radiusX = Math.abs(data.value.strokes.from.x - coordinate.x)
          data.value.guides = [
            {
              x:
                data.value.strokes.from.x > coordinate.x
                  ? data.value.strokes.from.x - radiusX
                  : data.value.strokes.from.x + radiusX,
              y: data.value.strokes.from.y,
            },
            { x: radiusX, y: radiusX },
          ]
          break
        }
      }
      drawGuide(true)
    }
  }
}, 16)

const stopDraw = () => {
  if (data.value.drawing) {
    data.value.strokes.coordinates =
      data.value.guides.length > 0 ? data.value.guides : data.value.strokes.coordinates
    data.value.images.push(data.value.strokes)
    redraw(true)
    data.value.drawing = false
    data.value.trash = []
  }
}

const drawGuide = (closingPath: boolean) => {
  redraw(true)
  if (context.value && data.value.guides.length > 1) {
    context.value.strokeStyle = props.color
    context.value.lineWidth = 1
    context.value.lineJoin = props.lineJoin as CanvasLineJoin
    context.value.lineCap = props.lineCap as CanvasLineCap

    context.value.beginPath()
    context.value.setLineDash([15, 15])
    if (data.value.strokes.type === 'circle' && data.value.guides[0] && data.value.guides[1]) {
      context.value.ellipse(
        data.value.guides[0].x,
        data.value.guides[0].y,
        data.value.guides[1].x,
        data.value.guides[1].y,
        0,
        0,
        Math.PI * 2,
      )
    } else {
      context.value.moveTo(data.value.strokes.from.x, data.value.strokes.from.y)
      data.value.guides.forEach((coordinate: Coordinate) => {
        if (context.value) {
          context.value.lineTo(coordinate.x, coordinate.y)
        }
      })
      if (closingPath) {
        context.value.closePath()
      }
    }
    context.value.stroke()
  }
}

const drawShape = (context: CanvasRenderingContext2D, strokes: Stroke, closingPath: boolean) => {
  context.strokeStyle = strokes.color
  context.fillStyle = strokes.color
  context.lineWidth = strokes.width
  context.lineJoin = strokes.lineJoin || props.lineJoin
  context.lineCap = strokes.lineCap || props.lineCap
  context.beginPath()
  context.setLineDash([])

  if (
    strokes.type === 'circle' &&
    strokes.coordinates.length > 1 &&
    strokes.coordinates[0] &&
    strokes.coordinates[1]
  ) {
    context.ellipse(
      strokes.coordinates[0].x,
      strokes.coordinates[0].y,
      strokes.coordinates[1].x,
      strokes.coordinates[1].y,
      0,
      0,
      Math.PI * 2,
    )
  } else {
    context.moveTo(strokes.from.x, strokes.from.y)
    strokes.coordinates.forEach((stroke: Coordinate) => {
      context.lineTo(stroke.x, stroke.y)
    })
    if (closingPath) {
      context.closePath()
    }
  }

  if (strokes.fill) {
    context.fill()
  } else {
    context.stroke()
  }
}

const redraw = async (output: boolean) => {
  await setBackground()
  const baseCanvas = document.createElement('canvas')
  const baseCanvasContext = baseCanvas.getContext('2d')
  baseCanvas.width = Number(canvasWidth.value)
  baseCanvas.height = Number(canvasHeight.value)

  if (baseCanvasContext) {
    data.value.images.forEach((stroke: Stroke) => {
      baseCanvasContext.globalCompositeOperation =
        stroke.type === 'eraser' ? 'destination-out' : 'source-over'
      if (stroke.type !== 'circle' || (stroke.type === 'circle' && stroke.coordinates.length > 0)) {
        drawShape(
          baseCanvasContext,
          stroke,
          stroke.type !== 'eraser' && stroke.type !== 'dash' && stroke.type !== 'line',
        )
      }
    })
    if (context.value) {
      context.value.drawImage(
        baseCanvas,
        0,
        0,
        Number(canvasWidth.value),
        Number(canvasHeight.value),
      )
    }
  }

  if (output) {
    save()
  }
}

const save = () => {
  {
    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')
    const tempWidth = props.outputWidth || canvasWidth.value
    const tempHeight = props.outputHeight || canvasHeight.value

    if (tempCtx) {
      tempCanvas.width = Number(tempWidth)
      tempCanvas.height = Number(tempHeight)
      if (canvas.value) {
        tempCtx.drawImage(canvas.value, 0, 0, Number(tempWidth), Number(tempHeight))
      }
      emits('update:image', tempCanvas.toDataURL(`image/${props.saveAs}`, 1))
      return tempCanvas.toDataURL(`image/${props.saveAs}`, 1)
    }
  }
}

defineExpose({
  clear,
  reset,
  undo,
  redo,
  save,
  startDraw,
  draw,
  stopDraw,
  handleResize,
})
</script>

<style scoped>
#container {
  width: v-bind(containerWidth);
  height: v-bind(containerHeight);
}

canvas {
  width: 100%;
  height: 100%;
}

canvas:not([data-eraser='true']) {
  cursor: crosshair;
}

canvas[data-eraser='true'] {
  cursor: grab;
}

canvas[data-eraser='true']:active {
  cursor: grabbing;
}
</style>
