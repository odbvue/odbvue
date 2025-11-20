import { $fetch } from 'ofetch'

const baseURL = import.meta.env.DEV ? '/api/' : import.meta.env.VITE_API_URI

export function useHttp() {
  return $fetch.create({
    baseURL,
  })
}
