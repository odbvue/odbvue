import type {
  HttpError,
  HttpRefreshFailureContext,
  HttpSlowRequestContext,
} from '../capabilities/http/index.js'
import type { OdbVueErrorEvent } from '../capabilities/errors/index.js'

export interface OdbVueHookMap {
  'app:started': void
  'error:captured': OdbVueErrorEvent
  'http:error': { error: HttpError }
  'http:slow': HttpSlowRequestContext
  'http:refreshFailed': HttpRefreshFailureContext
}

type OdbVueHookHandler<Payload> = (payload: Payload) => void | Promise<void>

export interface OdbVueHooks {
  on<K extends keyof OdbVueHookMap>(
    name: K,
    handler: OdbVueHookHandler<OdbVueHookMap[K]>,
  ): () => void
  emit<K extends keyof OdbVueHookMap>(name: K, payload: OdbVueHookMap[K]): Promise<void>
}

export type OdbVueHookHandlers = {
  [K in keyof OdbVueHookMap]?:
    | OdbVueHookHandler<OdbVueHookMap[K]>
    | readonly OdbVueHookHandler<OdbVueHookMap[K]>[]
}

/** Creates an application-scoped asynchronous event dispatcher. */
export function createOdbVueHooks(initial: OdbVueHookHandlers = {}): OdbVueHooks {
  const handlers = new Map<keyof OdbVueHookMap, Set<OdbVueHookHandler<never>>>()

  for (const [name, configured] of Object.entries(initial) as [
    keyof OdbVueHookMap,
    OdbVueHookHandler<never> | readonly OdbVueHookHandler<never>[],
  ][]) {
    handlers.set(name, new Set(Array.isArray(configured) ? configured : [configured]))
  }

  return {
    on(name, handler) {
      const registered = handlers.get(name) ?? new Set<OdbVueHookHandler<never>>()
      handlers.set(name, registered)
      registered.add(handler as OdbVueHookHandler<never>)
      return () => registered.delete(handler as OdbVueHookHandler<never>)
    },
    async emit(name, payload) {
      await Promise.all([...(handlers.get(name) ?? [])].map((handler) => handler(payload as never)))
    },
  }
}
