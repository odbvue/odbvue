// Transport-independent ODB errors. PL/SQL raises `ODB_ERROR|<KIND>|<CODE>` with this
// application error number; the service layer (ORDS handler) translates the kind to HTTP.
// Explicit transport errors use an HTTP status in place of KIND.
export const ODB_ERROR_NUMBER = -20998

/** Standard error kinds and the HTTP status a service maps each one to. */
export const ODB_ERROR_STATUS = {
  VALIDATION_ERROR: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
} as const

export type OdbErrorKind = keyof typeof ODB_ERROR_STATUS

export const ODB_ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,99}$/

export function validateHttpError(
  status: number,
  code: string,
  caller: 'httpError' | 'odbHttp',
): void {
  if (!Number.isInteger(status) || status < 400 || status > 599) {
    throw new Error(`${caller}: status must be an integer from 400 through 599.`)
  }
  if (!ODB_ERROR_CODE_PATTERN.test(code)) {
    throw new Error(`${caller}: code must be uppercase alphanumeric with optional underscores.`)
  }
}

export interface OdbValidationErrorDetail {
  field: string
  code: string
  params?: Record<string, string | number | boolean | null>
}

/** SQLERRM can truncate longer application messages; keep the entire envelope bounded. */
export function odbErrorEnvelope(
  kind: OdbErrorKind,
  code: string,
  errors?: OdbValidationErrorDetail[],
): string {
  let envelope = `ODB_ERROR|${kind}|${code}`
  if (errors !== undefined) {
    if (kind !== 'VALIDATION_ERROR' || errors.length === 0) {
      throw new Error('Field errors require a nonempty validation error list.')
    }
    for (const error of errors) {
      const field = error.field
      const errorCode = error.code
      if (
        !field.trim() ||
        field.length > 128 ||
        [...field].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
      ) {
        throw new Error('Invalid field error name.')
      }
      if (!ODB_ERROR_CODE_PATTERN.test(errorCode)) {
        throw new Error('Invalid field error code.')
      }
      if (
        error.params &&
        Object.values(error.params).some(
          (value) =>
            value !== null &&
            typeof value !== 'string' &&
            typeof value !== 'boolean' &&
            (typeof value !== 'number' || !Number.isFinite(value)),
        )
      ) {
        throw new Error('Field error parameters must be finite JSON scalar values.')
      }
    }
    const json = JSON.stringify({ errors }).replace(
      /[^\x20-\x7e]/g,
      (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
    )
    envelope += `|${json}`
  }
  if (envelope.length > 400) throw new Error('ODB error envelope exceeds 400 bytes.')
  return envelope
}
