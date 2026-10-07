import { appConfig } from '../config'

export { createConsoleErrorReporter, createLocalStorageErrorReporter } from './reporters'
export type { LocalStorageErrorReporterOptions } from './reporters'

export type ErrorSeverity = 'error' | 'warning'

export interface CapturedError {
  id: string
  message: string
  name?: string
  stack?: string
  severity: ErrorSeverity
  source?: string
  operation?: string
  cause?: unknown
  timestamp: string
  context?: Record<string, unknown>
}

export interface CaptureErrorOptions {
  severity?: ErrorSeverity
  source?: string
  operation?: string
  context?: Record<string, unknown>
}

export type ErrorReporter = (event: CapturedError) => void | Promise<void>

export interface ErrorsConfig {
  bufferSize?: number
  reporters?: readonly ErrorReporter[]
}

export interface Errors {
  capture(error: unknown, options?: CaptureErrorOptions): CapturedError
  addReporter(reporter: ErrorReporter): () => void
  getEvents(): readonly CapturedError[]
  clear(): void
}

export function useErrors(): Errors {
  return errors
}

function createErrorId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function normalizeError(error: unknown, options: CaptureErrorOptions = {}): CapturedError {
  const isError = error instanceof Error
  const message = isError ? error.message : typeof error === 'string' ? error : String(error)

  return {
    id: createErrorId(),
    message,
    name: isError ? error.name : undefined,
    stack: isError ? error.stack : undefined,
    severity: options.severity ?? 'error',
    source: options.source,
    operation: options.operation,
    cause: isError ? error.cause : error,
    timestamp: new Date().toISOString(),
    context: options.context,
  }
}

/** Creates an application-scoped error capture and reporting service. */
export function createErrors(config: ErrorsConfig = {}): Errors {
  const reporters = new Set(config.reporters)
  const maxEntries = config.bufferSize ?? 50
  const events: CapturedError[] = []

  function report(event: CapturedError): void {
    for (const reporter of reporters) {
      Promise.resolve()
        .then(() => reporter(event))
        .catch((error: unknown) => {
          console.error('OdbVue error reporter failed', error)
        })
    }
  }

  return {
    capture(error, options) {
      const event = normalizeError(error, options)
      events.push(event)
      if (events.length > maxEntries) events.splice(0, events.length - maxEntries)
      report(event)
      return event
    },
    addReporter(reporter) {
      reporters.add(reporter)
      return () => reporters.delete(reporter)
    },
    getEvents() {
      return [...events]
    },
    clear() {
      events.length = 0
    },
  }
}

export const errors = createErrors(appConfig.errors)
export const captureError = errors.capture
