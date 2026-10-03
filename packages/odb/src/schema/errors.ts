// Transport-independent ODB errors. PL/SQL raises `ODB_ERROR|<KIND>|<CODE>` with this
// application error number; the service layer (ORDS handler) translates the kind to HTTP.
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
