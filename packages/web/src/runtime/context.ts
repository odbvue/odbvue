import { inject, type InjectionKey } from 'vue'
import type { OdbVueRuntime } from './types.js'

export const odbVueRuntimeKey: InjectionKey<OdbVueRuntime> = Symbol('odbvue-runtime')

/** Returns the OdbVue runtime installed on the current Vue application. */
export function useOdbVue(): OdbVueRuntime {
  const runtime = inject(odbVueRuntimeKey)
  if (!runtime) {
    throw new Error('OdbVue runtime is not available. Has OdbVue been installed on this Vue app?')
  }
  return runtime
}
