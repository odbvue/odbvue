// Application-service contract. The database capabilities (e.g. `odb_settings.list(after, limit, items)`)
// stay keyset-based and do not know about cursors; the application layer translates
// `{ limit, cursor }` into `after`/`limit` and the result set into `{ items, nextCursor }`.
export type OdbListInput = {
  limit?: number
  cursor?: string
}

export type OdbList<T> = {
  items: T[]
  nextCursor?: string
}

export type OdbFieldError = {
  rule?: string
  message: string
}

export class OdbError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'OdbError'
  }
}

export class OdbValidationError extends OdbError {
  constructor(public readonly errors: Record<string, OdbFieldError[]>) {
    super('VALIDATION_ERROR', 'Validation failed')
    this.name = 'OdbValidationError'
  }
}

export class OdbNotFoundError extends OdbError {
  constructor(message: string) {
    super('NOT_FOUND', message)
    this.name = 'OdbNotFoundError'
  }
}

export class OdbConflictError extends OdbError {
  constructor(message: string) {
    super('CONFLICT', message)
    this.name = 'OdbConflictError'
  }
}

export class OdbUnauthorizedError extends OdbError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message)
    this.name = 'OdbUnauthorizedError'
  }
}

export class OdbForbiddenError extends OdbError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', message)
    this.name = 'OdbForbiddenError'
  }
}
