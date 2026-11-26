import type { HttpError } from '../http/core'
import { i18n } from '../i18n'
import type { OvActionResult } from '@/components/api'

const hasTranslation = (key: string) =>
  i18n.global.availableLocales.some((locale) => i18n.global.te(key, locale))

export function errorMessage(error: unknown): string {
  const http = error instanceof Error && 'status' in error ? (error as HttpError) : undefined
  const codeKey = http?.problem?.code ? `errors.${http.problem.code}` : ''
  if (http?.status && http.status < 500 && codeKey && hasTranslation(codeKey)) return codeKey
  if (http?.problem?.traceId)
    return i18n.global.t('errors.requestFailedReference', { traceId: http.problem.traceId })
  if (!http && error instanceof Error && error.message) return error.message
  if (http) return i18n.global.t('errors.requestFailed')
  return i18n.global.t('errors.requestFailed')
}

/** Present form-ready field errors or one safe global notification. */
export function mutationError(error: unknown, notify: (message: string) => void): OvActionResult {
  const http = error instanceof Error && 'status' in error ? (error as HttpError) : undefined
  const fieldErrors =
    http?.status === 422
      ? http.problem?.errors ??
        (http as HttpError & { fields?: Array<{ name?: string; field?: string; message?: string; code?: string; params?: Record<string, string | number | boolean | null> }> }).fields
      : undefined
  if (fieldErrors?.length) {
    if (
      fieldErrors.every(
        (item) =>
          item.name &&
          item.message &&
          hasTranslation(item.message),
      )
    ) {
      return {
        status: 'invalid',
        errors: fieldErrors as unknown as Array<{
          name: string
          message: string
          params?: Record<string, string | number | boolean | null>
        }>,
      }
    }
    const errors = fieldErrors.map((item) => {
      const field = item.field ?? item.name
      if (!field) return undefined
      const codeMessage = item.code ? `errors.${item.code}` : ''
      const message =
        codeMessage && hasTranslation(codeMessage)
          ? codeMessage
          : item.message && hasTranslation(item.message)
            ? item.message
            : 'errors.validationFailed'
      return { name: field, message, params: item.params }
    }).filter((item): item is NonNullable<typeof item> => item !== undefined)
    if (errors.length === fieldErrors.length) return { status: 'invalid', errors }
  }
  notify(http ? errorMessage(error) : i18n.global.t('errors.requestFailed'))
  return { status: 'error' }
}
