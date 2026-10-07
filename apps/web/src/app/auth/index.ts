import type { Auth } from './core.js'
import { auth } from '../runtime.js'

export * from './core.js'
export { auth }

export function useAuth(): Auth {
  return auth
}
