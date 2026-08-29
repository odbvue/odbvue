import { defineStore } from 'pinia'
import { createApp } from 'vue'
import { describe, expect, it } from 'vitest'
import { createOdbVuePinia, getOdbVueStores } from '../src/index.js'

describe('OdbVue Pinia state', () => {
  it('lists stores registered through its public plugin hook', () => {
    const pinia = createOdbVuePinia()
    createApp({}).use(pinia)
    const useCounterStore = defineStore('counter', { state: () => ({ count: 0 }) })
    const counter = useCounterStore(pinia)

    expect(getOdbVueStores(pinia)).toEqual([counter])
  })

  it('does not read stores from Pinia runtimes it does not create', () => {
    const pinia = createOdbVuePinia()

    expect(getOdbVueStores(pinia)).toEqual([])
  })
})
