import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '@/app/App.vue'

vi.mock('@/app/layouts/DefaultLayout.vue', () => ({
  default: { template: '<main data-layout="default"><slot /></main>' },
}))
vi.mock('@/app/layouts/FullscreenLayout.vue', () => ({
  default: { template: '<main data-layout="fullscreen"><slot /></main>' },
}))

describe('App layouts', () => {
  it('renders the default layout and switches to the explicit fullscreen layout', async () => {
    const component = { template: '<div>Page content</div>' }
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component },
        { path: '/fullscreen', component, meta: { layout: 'fullscreen' } },
      ],
    })
    await router.push('/')
    const wrapper = mount(App, { global: { plugins: [router] } })
    try {
      expect(wrapper.get('[data-layout="default"]').text()).toBe('Page content')
      await router.push('/fullscreen')
      expect(wrapper.get('[data-layout="fullscreen"]').text()).toBe('Page content')
      expect(wrapper.find('[data-layout="default"]').exists()).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })
})
