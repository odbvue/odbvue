import { useAuth } from './auth'
import { useHttp } from './http'
import { useUi } from './ui/store'

/** Application runtime facade. Business modules retain ownership of their own stores. */
export const app = {
  auth: useAuth(),
  ui: useUi(),
  http: useHttp(),
}

export function useApp() {
  return app
}
