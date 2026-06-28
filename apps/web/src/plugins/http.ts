import type { Plugin } from 'vue'

import { configureHttp, type HttpConfiguration } from '../composables/http'

export interface HttpPluginOptions extends HttpConfiguration {}

const DEFAULT_SLOW_REQUEST_THRESHOLD_MS = 3000

export function createHttpPlugin(options: HttpPluginOptions = {}): Plugin {
  const {
    onSlowRequest,
    slowRequestThresholdMs = DEFAULT_SLOW_REQUEST_THRESHOLD_MS,
    ...configuration
  } = options

  return {
    install() {
      configureHttp({
        ...configuration,
        slowRequestThresholdMs,
        onSlowRequest:
          onSlowRequest ??
          (({ request, duration }) => {
            console.warn(`Slow API call: ${request} (${Math.round(duration)}ms)`)
          }),
      })
    },
  }
}
