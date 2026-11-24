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
type OverlayBoundary = symbol
type AncestorOverlay = {
  active: MaybeRefOrGetter<boolean>
  boundary: ComputedRef<OverlayBoundary | undefined>
}
const ancestorOverlayKey: InjectionKey<AncestorOverlay[]> = Symbol('ov-loading-ancestors')
const overlayBoundaryKey: InjectionKey<OverlayBoundary> = Symbol('ov-loading-boundary')

export function provideLoadingOverlays(register: () => () => void) {
  provide(registerOverlayKey, register)
}

export function provideLoadingOverlayBoundary(boundary: OverlayBoundary | undefined) {
  if (boundary) provide(overlayBoundaryKey, boundary)
}

export function useLoadingOverlay(
  active: MaybeRefOrGetter<boolean>,
  targetBoundary?: MaybeRefOrGetter<OverlayBoundary | undefined>,
) {
  const register = inject(registerOverlayKey, undefined)
  const ancestors = inject(ancestorOverlayKey, [])
  const inheritedBoundary = inject(overlayBoundaryKey, undefined)
  const boundary = computed(() => toValue(targetBoundary) ?? inheritedBoundary)
  const visible = computed(
    () =>
      toValue(active) &&
      !ancestors.some(
        (ancestor) => toValue(ancestor.active) && ancestor.boundary.value === boundary.value,
      ),
  )
  provide(ancestorOverlayKey, [...ancestors, { active, boundary }])
  watch(
    visible,
    (show, _previous, onCleanup) => {
      if (show && register) onCleanup(register())
    },
    { immediate: true, flush: 'sync' },
  )
  return visible
}
