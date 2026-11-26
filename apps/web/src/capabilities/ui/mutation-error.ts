import type { HttpError } from '../http/core'
import { i18n } from '../i18n'
import type { OvActionResult } from '@/components/api'

// Vue I18n 11.4 resolves the fallback chain when no locale is passed to te.
const hasTranslation = (key: string) => i18n.global.te(key)

const httpError = (error: unknown): HttpError | undefined =>
  error instanceof Error && 'status' in error ? (error as HttpError) : undefined

export function errorMessage(error: unknown): string {
  const http = httpError(error)
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
  const http = httpError(error)
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
