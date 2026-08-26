export type ErrorSeverity = 'error' | 'warning'

export interface OdbVueErrorEvent {
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

export type ErrorReporter = (event: OdbVueErrorEvent) => void | Promise<void>

export interface OdbVueErrorsConfig {
  bufferSize?: number
  reporters?: readonly ErrorReporter[]
}

export interface OdbVueErrors {
  capture(error: unknown, options?: CaptureErrorOptions): OdbVueErrorEvent
  addReporter(reporter: ErrorReporter): () => void
  getEvents(): readonly OdbVueErrorEvent[]
  clear(): void
}

function createErrorId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function normalizeError(error: unknown, options: CaptureErrorOptions = {}): OdbVueErrorEvent {
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
export function createOdbVueErrors(config: OdbVueErrorsConfig = {}): OdbVueErrors {
  const reporters = new Set(config.reporters)
  const maxEntries = config.bufferSize ?? 50
  const events: OdbVueErrorEvent[] = []

  function report(event: OdbVueErrorEvent): void {
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

/** Reports captured errors to the browser console. */
export function createConsoleErrorReporter(): ErrorReporter {
  return (event) => {
    console.error(event)
  }
}

export interface LocalStorageErrorReporterOptions {
  key?: string
  maxEntries?: number
}

/** Persists a bounded history of captured errors in local storage. */
export function createLocalStorageErrorReporter(
  options: LocalStorageErrorReporterOptions = {},
): ErrorReporter {
  const key = options.key ?? 'odbvue:errors'
  const maxEntries = options.maxEntries ?? 100

  return (event) => {
    const existing = JSON.parse(globalThis.localStorage.getItem(key) ?? '[]')
    const events = Array.isArray(existing) ? existing : []
    events.push(event)
    globalThis.localStorage.setItem(key, JSON.stringify(events.slice(-maxEntries)))
  }
}
