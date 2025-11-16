<template>
  <div class="container">
    <video
      v-if="props.video"
      :src
      :autoplay
      :loop
      ref="videoElement"
      :controls="!!props.src"
    ></video>
    <audio
      v-if="props.audio"
      :src
      :autoplay
      :loop
      ref="audioElement"
      :controls="!!props.src && !props.compact"
    ></audio>
    <v-btn
      v-if="props.video && props.snap"
      :variant
      :density
      :class="'controls ma-2 controls-' + props.snapPosition"
      @click="captureSnapshot"
      :icon="props.snapIcon"
    />
    <v-btn
      v-if="!props.src && !props.compact"
      :variant
      :density
      :class="props.video ? 'controls ma-2 controls-' + props.recorderPosition : ''"
      @click="videoRecording"
      :prepend-icon="isRecording ? '$mdiStop' : '$mdiRecord'"
      color="red"
      >{{ recordingTimeHMS }}</v-btn
    >
    <v-btn
      v-if="!props.src && props.compact"
      :variant
      :density
      :class="props.video ? 'controls ma-2 controls-' + props.recorderPosition : ''"
      @click="videoRecording"
      :icon="isRecording ? '$mdiStop' : '$mdiRecord'"
      color="red"
    />
    <v-btn
      v-if="props.audio && props.src && props.compact"
      :variant
      :density
      @click="audioPlayback"
      :icon="isPlaying ? '$mdiStop' : '$mdiPlay'"
    ></v-btn>
    <div class="slot">
      <slot></slot>
    </div>
    <canvas ref="canvasElement" style="display: none"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, defineProps, defineEmits } from 'vue'

const props = defineProps({
  src: {
    type: String,
    default: null,
  },
  autoplay: {
    type: Boolean,
    default: true,
  },
  loop: {
    type: Boolean,
    default: false,
  },
  video: {
    type: Boolean,
    default: false,
  },
  audio: {
    type: Boolean,
    default: false,
  },
  recorderPosition: {
    type: String as () => 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
    default: 'bottom-left',
  },
  snap: {
    type: Boolean,
    default: false,
  },
  snapPosition: {
    type: String as () => 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
    default: 'top-right',
  },
  snapIcon: {
    type: String,
    default: '$mdiCamera',
  },
  format: {
    type: String as () => 'base64' | 'blob',
    default: 'base64',
  },
  videoConstraints: {
    type: Object as () => MediaTrackConstraints,
    default: {} as MediaTrackConstraints,
  },
  audioConstraints: {
    type: Object as () => MediaTrackConstraints,
    default: {} as MediaTrackConstraints,
  },
  compact: {
    type: Boolean,
    default: false,
  },
  variant: {
    type: String as () => 'outlined' | 'flat' | 'text' | 'elevated' | 'tonal' | 'plain' | undefined,
    default: 'flat',
  },
  density: {
    type: String as () => 'default' | 'comfortable' | 'compact' | undefined,
    default: 'default',
  },
})

const emits = defineEmits([
  'loading',
  'device',
  'started',
  'paused',
  'resumed',
  'stopped',
  'snapped',
  'recorded',
  'error',
])

const videoElement = ref<HTMLVideoElement | null>(null)
const audioElement = ref<HTMLAudioElement | null>(null)
const canvasElement = ref<HTMLCanvasElement | null>(null)

const audioPlayback = async () => {
  const audio = audioElement.value
  if (!audio) {
    emits('error', new Error('Audio element is not available'))
    return
  }
  audio.onpause = () => {
    isPlaying.value = false
  }
  if (isPlaying.value) {
    isPlaying.value = false
    await audio.pause()
    audio.currentTime = 0
  } else {
    isPlaying.value = true
    await audio.play()
  }
}

const videoRecording = async () => {
  if (props.video && !stream.value) {
    emits('error', new Error('Camera is not started'))
    return
  }
  if (isRecording.value) {
    stopRecording()
  } else {
    startRecording()
  }
}

const devices = ref<MediaDeviceInfo[]>([])
const videoDeviceId = ref('')
const audioDeviceId = ref('')
const stream = ref<MediaStream | null>(null)

const isPlaying = ref(false)

const mediaRecorder = ref<MediaRecorder | null>(null)
const recordedChunks = ref<Blob[]>([])
const isRecording = ref(false)
let recordingTimer: ReturnType<typeof setInterval> | undefined = undefined
const recordingTime = ref(0)
const recordingTimeHMS = computed(() =>
  recordingTime.value >= 3600
    ? [
        parseInt((recordingTime.value / 60 / 60).toString()),
        parseInt(((recordingTime.value / 60) % 60).toString()),
        parseInt((recordingTime.value % 60).toString()),
      ]
    : [
        parseInt(((recordingTime.value / 60) % 60).toString()),
        parseInt((recordingTime.value % 60).toString()),
      ]
        .join(':')
        .replace(/\b(\d)\b/g, '0$1'),
)

defineExpose({
  listDevices,
  setDevice,
  audioPlayback,
  videoRecording,
  isPlaying,
})

onMounted(async () => {
  if (props.src) return
  if (!props.video && !props.audio) {
    emits('error', new Error('At least one of video or audio props must be true'))
    return
  }
  try {
    emits('loading', true)
    await startCamera()
  } catch (error) {
    emits('error', error)
  } finally {
    emits('loading', false)
  }
})

onBeforeUnmount(() => {
  stopRecording()
  stopCamera()
  if (recordingTimer) clearInterval(recordingTimer)
})

function listDevices() {
  return devices.value.filter(
    (device: MediaDeviceInfo) =>
      (device.kind === 'videoinput' && props.video) ||
      (device.kind === 'audioinput' && props.audio),
  )
}

function setDevice(newDeviceId: string) {
  const device = devices.value.find((device: MediaDeviceInfo) => device.deviceId === newDeviceId)
  if (device?.kind == 'videoinput') {
    videoDeviceId.value = newDeviceId
  } else if (device?.kind == 'audioinput') {
    audioDeviceId.value = newDeviceId
  }
}

const startCamera = async () => {
  try {
    if (stream.value) {
      stopCamera()
    }

    devices.value = await navigator.mediaDevices.enumerateDevices()
    if (!videoDeviceId.value && props.video) {
      videoDeviceId.value =
        devices.value.find((device: MediaDeviceInfo) => device.kind === 'videoinput')?.deviceId ||
        ''
      emits('device', { devices: devices.value, device: videoDeviceId.value })
    }
    if (!audioDeviceId.value) {
      audioDeviceId.value =
        devices.value.find((device: MediaDeviceInfo) => device.kind === 'audioinput')?.deviceId ||
        ''
      emits('device', { devices: devices.value, device: audioDeviceId.value })
    }

    const videoConstraints = {
      ...props.videoConstraints,
      deviceId: videoDeviceId.value ? { exact: videoDeviceId.value } : undefined,
    }

    stream.value = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: false,
    })
    devices.value = await navigator.mediaDevices.enumerateDevices()

    if (videoElement.value) {
      videoElement.value.srcObject = stream.value
    }
    emits('started', videoDeviceId.value)
  } catch {
    emits('error', new Error('Camera is not started'))
  }
}

const stopCamera = () => {
  if (stream.value) {
    stream.value.getTracks().forEach((track: MediaStreamTrack) => track.stop())
    stream.value = null
    emits('stopped')
  }
}

const captureSnapshot = () => {
  if (!stream.value && !props.src) {
    emits('error', new Error('Camera is not started'))
    return
  }
  const canvas = canvasElement.value
  if (!canvas) {
    emits('error', new Error('Canvas element is not available'))
    return
  }

  const video = videoElement.value
  if (!video) {
    emits('error', new Error('Video element is not available'))
    return
  }

  try {
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    if (props.src) {
      video.crossOrigin = 'Anonymous'
    }

    const context = canvas.getContext('2d')
    if (!context) {
      emits('error', new Error('Failed to get canvas context'))
      return
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    if (props.format == 'base64') {
      try {
        const image = canvas.toDataURL('image/png')
        emits('snapped', image)
      } catch {
        emits('error', new Error('Failed to capture snapshot as base64: canvas may be tainted'))
      }
    } else {
      try {
        canvas.toBlob((blob: Blob | null) => {
          if (blob) {
            emits('snapped', blob)
          } else {
            emits('error', new Error('Failed to capture snapshot as blob'))
          }
        }, 'image/png')
      } catch {
        emits('error', new Error('Failed to capture snapshot as blob: canvas may be tainted'))
      }
    }
  } catch (error) {
    emits(
      'error',
      new Error(
        `Failed to capture snapshot: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ),
    )
  }
}

const startRecording = async () => {
  if (!stream.value) {
    emits('error', new Error('Camera is not started'))
    return
  }
  recordedChunks.value = []
  recordingTime.value = 0
  const recordStream = await navigator.mediaDevices.getUserMedia({
    audio: props.audioConstraints,
    video: props.videoConstraints,
  })
  mediaRecorder.value = new MediaRecorder(recordStream)
  mediaRecorder.value.ondataavailable = (event: BlobEvent) => {
    if (event.data.size > 0) {
      recordedChunks.value.push(event.data)
    }
  }
  mediaRecorder.value.onstop = saveRecording
  mediaRecorder.value.start()
  isRecording.value = true
  emits('started', { video: videoDeviceId.value, audio: audioDeviceId.value })
  recordingTimer = setInterval(() => {
    recordingTime.value += 1
  }, 1000)
}

const stopRecording = () => {
  if (mediaRecorder.value && isRecording.value) {
    mediaRecorder.value.stop()
    isRecording.value = false
    clearInterval(recordingTimer)
    emits('stopped')
  }
}

const saveRecording = () => {
  const blob = new Blob(recordedChunks.value, { type: 'video/webm' })
  const reader = new FileReader()
  reader.onloadend = () => {
    if (props.format == 'blob') {
      emits('recorded', blob)
    } else {
      const base64Video = typeof reader.result === 'string' ? reader.result.split(',')[1] : ''
      emits('recorded', base64Video)
    }
  }
  reader.readAsDataURL(blob)
}
</script>

<style scoped>
.container {
  position: relative;
  width: 100%;
  height: 100%;
}

.controls,
.slot {
  position: absolute;
  z-index: 1;
}

.controls-top-left {
  top: 0;
  left: 0;
}

.controls-top-right {
  top: 0;
  right: 0;
}

.controls-bottom-right {
  bottom: 0;
  right: 0;
}

.controls-bottom-left {
  bottom: 0;
  left: 0;
}

video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
