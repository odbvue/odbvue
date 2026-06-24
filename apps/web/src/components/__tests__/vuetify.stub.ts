import { defineComponent, ref } from 'vue'

const stubComponent = (name: string) =>
  defineComponent({
    name,
    inheritAttrs: false,
    props: {},
    template: '<div><slot /></div>',
  })

export const createVuetify = () => ({
  install: () => undefined,
})

export const md3 = {}
export const aliases = {}
export const mdi = {}

export const useDisplay = () => ({
  mobile: false,
  name: ref('md'),
  thresholds: ref({
    xs: 0,
    sm: 600,
    md: 960,
    lg: 1280,
    xl: 1920,
    xxl: 2560,
  }),
})

export const useDefaults = () => ({ defaults: {} })
export const useTheme = () => ({ global: { current: { value: 'light' } } })
export const useDate = () => ({})
export const useGoTo = () => ({})
export const useLayout = () => ({})
export const useLocale = () => ({})
export const useRtl = () => ({})

export const VTextField = stubComponent('VTextField')
export const VSelect = stubComponent('VSelect')
export const VCombobox = stubComponent('VCombobox')
export const VAutocomplete = stubComponent('VAutocomplete')
export const VFileInput = stubComponent('VFileInput')
export const VSwitch = stubComponent('VSwitch')
export const VCheckbox = stubComponent('VCheckbox')
export const VRating = stubComponent('VRating')
export const VTextarea = stubComponent('VTextarea')
export const VLabel = stubComponent('VLabel')
export const VIcon = stubComponent('VIcon')
export const VChip = stubComponent('VChip')
export const VBtn = stubComponent('VBtn')
export const VMenu = stubComponent('VMenu')
export const VList = stubComponent('VList')
export const VListItem = stubComponent('VListItem')
export const VDialog = stubComponent('VDialog')
export const VCard = stubComponent('VCard')
export const VCardTitle = stubComponent('VCardTitle')
export const VCardText = stubComponent('VCardText')
export const VCardActions = stubComponent('VCardActions')
export const VBanner = stubComponent('VBanner')
export const VBannerText = stubComponent('VBannerText')
export const VOverlay = stubComponent('VOverlay')
export const VProgressCircular = stubComponent('VProgressCircular')
export const VTable = stubComponent('VTable')
export const VContainer = stubComponent('VContainer')
export const VRow = stubComponent('VRow')
export const VCol = stubComponent('VCol')
export const VForm = stubComponent('VForm')
export const VDefaultsProvider = stubComponent('VDefaultsProvider')
export const VColorPicker = stubComponent('VColorPicker')
export const VMain = stubComponent('VMain')
export const VApp = stubComponent('VApp')
export const VAppBar = stubComponent('VAppBar')
export const VAppBarNavIcon = stubComponent('VAppBarNavIcon')
export const VNavigationDrawer = stubComponent('VNavigationDrawer')
export const VToolbar = stubComponent('VToolbar')
export const VSpacer = stubComponent('VSpacer')
export const VImg = stubComponent('VImg')
export const VAvatar = stubComponent('VAvatar')
export const VDivider = stubComponent('VDivider')
export const VSheet = stubComponent('VSheet')

export default {
  install: () => undefined,
}
