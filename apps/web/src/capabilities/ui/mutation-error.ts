import type { HttpError } from '../http/core'
import { i18n } from '../i18n'
import type { OvActionResult } from '@/components/api'

const hasTranslation = (key: string) =>
  i18n.global.availableLocales.some((locale) => i18n.global.te(key, locale))

/** Present form-ready field errors or one safe global notification. */
export function mutationError(error: unknown, notify: (message: string) => void): OvActionResult {
  const http = error instanceof Error && 'status' in error ? (error as HttpError) : undefined
  if (
    http?.status === 422 &&
    http.fields?.length &&
    http.fields.every((field) => hasTranslation(field.message))
  ) {
    return { status: 'invalid', errors: http.fields }
  }
  const codeKey = http?.problem?.code ? `errors.${http.problem.code}` : ''
  if (http?.status && http.status < 500 && codeKey && hasTranslation(codeKey)) {
    notify(codeKey)
  } else if (http?.problem?.traceId) {
    notify(i18n.global.t('errors.requestFailedReference', { traceId: http.problem.traceId }))
  } else {
    notify('errors.requestFailed')
  }
  return { status: 'error' }
}
