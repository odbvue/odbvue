import type { HttpError } from '../http/core'
import { i18n } from '../i18n'
import type { OvActionResult } from '@/components/api'

// Without an explicit locale, te follows the same locale fallback chain as t.
const hasTranslation = (key: string) => i18n.global.te(key)

export function errorMessage(error: unknown): string {
  const http = error instanceof Error && 'status' in error ? (error as HttpError) : undefined
  const codeKey = http?.problem?.code ? `errors.${http.problem.code}` : ''
  if (http?.status && http.status < 500 && codeKey && hasTranslation(codeKey))
    return i18n.global.t(codeKey)
  if (http?.problem?.traceId)
    return i18n.global.t('errors.requestFailedReference', { traceId: http.problem.traceId })
  if (!http && error instanceof Error && hasTranslation(error.message)) return error.message
  return i18n.global.t('errors.requestFailed')
}

/** Present form-ready field errors or one safe global notification. */
export function mutationError(error: unknown, notify: (message: string) => void): OvActionResult {
  const http = error instanceof Error && 'status' in error ? (error as HttpError) : undefined
  const fieldErrors = http?.status === 422 ? http.problem?.errors : undefined
  if (fieldErrors?.length) {
    const errors = fieldErrors.map((item) => {
      const codeMessage = `errors.${item.code}`
      return {
        name: item.field,
        message: hasTranslation(codeMessage) ? codeMessage : 'errors.validationFailed',
        params: item.params,
      }
    })
    return { status: 'invalid', errors }
  }
  notify(errorMessage(error))
  return { status: 'error' }
}
