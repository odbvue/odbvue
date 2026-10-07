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
