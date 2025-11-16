import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import App from '../App.vue'

describe('App', () => {
  it('mounts renders properly', () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/',
          component: { template: '<div>Home</div>' },
          meta: { layout: 'default', title: 'Home' },
        },
      ],
    })

    const wrapper = mount(App, {
      global: {
        plugins: [router],
        stubs: {
          DefaultLayout: true,
          FullscreenLayout: true,
        },
      },
    })
    expect(wrapper.vm).toBeDefined()
  })
})
