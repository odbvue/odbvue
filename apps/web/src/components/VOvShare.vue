<template>
  <v-defaults-provider
    :defaults="{
      VBtn: {
        variant: props.variant,
        density: props.density,
        color: props.color,
        class: props.class,
      },
    }"
  >
    <STwitter
      v-if="props.share.includes('twitter')"
      :window-features="windowFeatures"
      :useNativeBehavior="useNativeBehavior"
      :share-options="shareOptions"
    >
      <v-btn data-cy="v-bsb-share-twitter" icon="$mdiTwitter" />
    </STwitter>

    <SFacebook
      v-if="props.share.includes('facebook')"
      :window-features="windowFeatures"
      :useNativeBehavior="useNativeBehavior"
      :share-options="shareOptions"
    >
      <v-btn data-cy="v-bsb-share-facebook" icon="$mdiFacebook" />
    </SFacebook>

    <SLinkedIn
      v-if="props.share.includes('linkedin')"
      :window-features="windowFeatures"
      :useNativeBehavior="useNativeBehavior"
      :share-options="shareOptions"
    >
      <v-btn data-cy="v-bsb-share-linkedin" icon="$mdiLinkedin" />
    </SLinkedIn>

    <SWhatsApp
      v-if="props.share.includes('whatsapp')"
      :window-features="windowFeatures"
      :useNativeBehavior="useNativeBehavior"
      :share-options="shareOptions"
    >
      <v-btn data-cy="v-bsb-share-whatsapp" icon="$mdiWhatsapp" />
    </SWhatsApp>

    <v-btn
      v-if="props.share.includes('copy')"
      data-cy="v-bsb-share-copy"
      icon="$mdiContentCopy"
      @click="copyToClipboard"
    />
  </v-defaults-provider>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { STwitter, SFacebook, SLinkedIn, SWhatsApp } from 'vue-socials'

export type Share = 'twitter' | 'facebook' | 'linkedin' | 'whatsapp' | 'copy'

export type WindowFeatures = {
  width: number
  height: number
  top: number
  left: number
}

export type ShareOptions = {
  text?: string
  url: string
  via?: string
  hashtags?: string[]
  number: string
  quote?: string
}

const props = defineProps({
  share: {
    type: Array as PropType<Share[]>,
    default: () => ['twitter', 'facebook', 'linkedin', 'whatsapp', 'copy'],
  },
  windowFeatures: {
    type: Object as PropType<WindowFeatures>,
    default: () => ({ url: '' }),
  },
  shareOptions: {
    type: Object as PropType<ShareOptions>,
    default: () => ({ number: '' }),
  },
  useNativeBehavior: {
    type: Boolean,
    default: false,
  },
  variant: {
    type: String as PropType<
      'flat' | 'text' | 'elevated' | 'tonal' | 'outlined' | 'plain' | undefined
    >,
    default: undefined,
  },
  density: {
    type: String as PropType<'default' | 'comfortable' | 'compact' | undefined>,
    default: undefined,
  },
  color: {
    type: String as PropType<string | undefined>,
    default: undefined,
  },
  class: {
    type: [String, Array, Object] as PropType<
      string | string[] | Record<string, boolean> | undefined
    >,
    default: undefined,
  },
})

const copyToClipboard = () => {
  if (navigator.clipboard) {
    navigator.clipboard
      .writeText(props.shareOptions.text || '')
      .then(() => console.log('Copied to clipboard'))
      .catch((err) => console.error('Error copying to clipboard', err))
  } else {
    const el = document.createElement('textarea')
    el.value = props.shareOptions.text || ''
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
  }
}
</script>
