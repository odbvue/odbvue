import { useRoute, type RouteLocationNormalizedLoaded } from 'vue-router'
import { computed, type ComputedRef } from 'vue'
import type { OdbVueRouteParams } from './types.js'

const routeValueToString = (value: unknown): string => {
  if (Array.isArray(value)) return routeValueToString(value[0])
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return ''
}

export const computedRouteParam = (
  route: RouteLocationNormalizedLoaded,
  name: string,
): ComputedRef<string> => {
  return computed(() => routeValueToString((route.params as Record<string, unknown>)[name]))
}

export const computedRouteQuery = (
  route: RouteLocationNormalizedLoaded,
  name: string,
): ComputedRef<string> => {
  return computed(() => routeValueToString(route.query[name]))
}

export const computedRouteParams = (
  route: RouteLocationNormalizedLoaded,
): ComputedRef<Record<string, string>> => {
  return computed(() => {
    const merged: Record<string, string> = {}

    for (const [key, value] of Object.entries(route.params as Record<string, unknown>)) {
      const result = routeValueToString(value)
      if (result) merged[key] = result
    }

    for (const [key, value] of Object.entries(route.query)) {
      const result = routeValueToString(value)
      if (result) merged[key] = result
    }

    return merged
  })
}

export const useRouteParams = (): OdbVueRouteParams => {
  const route = useRoute()

  const pathParams = computed(() => {
    const result: Record<string, string> = {}
    for (const [key, value] of Object.entries(route.params as Record<string, unknown>)) {
      const parameter = routeValueToString(value)
      if (parameter) result[key] = parameter
    }
    return result
  })

  const queryParams = computed(() => {
    const result: Record<string, string> = {}
    for (const [key, value] of Object.entries(route.query)) {
      const parameter = routeValueToString(value)
      if (parameter) result[key] = parameter
    }
    return result
  })

  const routeParams = computed(() => ({ ...pathParams.value, ...queryParams.value }))
  const param = (name: string) => computedRouteParam(route, name)
  const query = (name: string) => computedRouteQuery(route, name)

  return { pathParams, queryParams, routeParams, param, query }
}
