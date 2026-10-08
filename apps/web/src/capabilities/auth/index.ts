import type { Auth } from './core.js'
import { auth } from '../client.js'

export * from './core.js'
export { auth }

export function useAuth(): Auth {
  return auth
}
