import {
  computed,
  inject,
  provide,
  toValue,
  watch,
  type InjectionKey,
  type MaybeRefOrGetter,
  type ComputedRef,
} from 'vue'

const registerOverlayKey: InjectionKey<() => () => void> = Symbol('ov-loading-overlays')
const ancestorOverlayKey: InjectionKey<ComputedRef<boolean>> = Symbol('ov-loading-ancestor')

export function provideLoadingOverlays(register: () => () => void) {
  provide(registerOverlayKey, register)
}

export function useLoadingOverlay(active: MaybeRefOrGetter<boolean>) {
  const register = inject(registerOverlayKey, undefined)
  const ancestor = inject(
    ancestorOverlayKey,
    computed(() => false),
  )
  const covered = computed(() => ancestor.value || toValue(active))
  const visible = computed(() => toValue(active) && !ancestor.value)
  provide(ancestorOverlayKey, covered)
  watch(
    visible,
    (show, _previous, onCleanup) => {
      if (show && register) onCleanup(register())
    },
    { immediate: true, flush: 'sync' },
  )
  return visible
}
