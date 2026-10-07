import type { ErrorReporter } from './index'

export function createConsoleErrorReporter(): ErrorReporter {
  return (event) => {
    console.error(event)
  }
}

export interface LocalStorageErrorReporterOptions {
  key?: string
  maxEntries?: number
}

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
