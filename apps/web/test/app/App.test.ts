import { describe, it, expect, vi } from 'vitest'
import { defineComponent, onMounted, onUnmounted } from 'vue'
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
  it('remounts pages on path changes, not query or hash changes', async () => {
    const mounted = vi.fn<() => void>()
    const unmounted = vi.fn<() => void>()
    const page = defineComponent({
      setup() {
        onMounted(mounted)
        onUnmounted(unmounted)
        return () => 'Page'
      },
    })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/users/:id', component: page }],
    })
    await router.push('/users/a')
    const wrapper = mount(App, { global: { plugins: [router] } })
    try {
      expect(mounted).toHaveBeenCalledTimes(1)
      await router.push('/users/a?tab=details#section')
      expect(mounted).toHaveBeenCalledTimes(1)
      expect(unmounted).not.toHaveBeenCalled()
      await router.push('/users/b?tab=details')
      expect(mounted).toHaveBeenCalledTimes(2)
      expect(unmounted).toHaveBeenCalledTimes(1)
    } finally {
      wrapper.unmount()
    }
  })

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
