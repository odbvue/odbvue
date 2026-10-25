import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createAuth, type Auth } from '@/capabilities/auth/core'
import { createHttpClient, type HttpResponse } from '@/capabilities/http/core'
import { createState } from '@/capabilities/state'
import { useUi } from '@/capabilities/ui/store'
import { authState } from '../../auth-state'
import DefaultLayout from '@/app/layouts/DefaultLayout.vue'

const runtime = vi.hoisted((): { auth?: Auth; ui?: ReturnType<typeof useUi> } => ({}))

vi.mock('@/capabilities', () => ({ useApp: () => runtime }))
vi.mock('@/capabilities/ui', () => ({
  usePreferencesStore: () => ({
    fontSizes: [100],
    locales: ['en'],
    locale: 'en',
    themeIcon: '$mdiWeatherSunny',
  }),
  useNotificationMessage: () => ref(''),
}))
vi.mock('@/capabilities/routing', () => ({
  useRouting: () => ({ pages: ref([]), breadcrumbs: ref([]) }),
}))
vi.mock('vuetify', () => ({ useDisplay: () => ({ mobile: ref(false) }) }))

const container = { template: '<div><slot /></div>' }
const listItem = defineComponent({
  props: ['to', 'title', 'disabled', 'prependIcon'],
  template:
    '<button :disabled="disabled" :data-to="to"><slot name="prepend" />{{ title }}<slot /></button>',
})
const avatar = defineComponent({
  props: ['size', 'color'],
  template: '<div data-avatar><slot /></div>',
})
const image = defineComponent({
  props: ['src', 'alt', 'referrerpolicy'],
  template: '<div><slot name="error" /></div>',
})
const overlay = defineComponent({
  props: { modelValue: Boolean, contained: Boolean },
  template: '<div />',
})

function response<T>(data: T | null, status = 200): HttpResponse<T> {
  return { data, error: null, status, headers: null }
}

async function setup(authenticated = true, avatarUrl: string | null = null, ready = true) {
  const ui = useUi(createState())
  const http = createHttpClient()
  const post = vi
    .spyOn(http, 'post')
    .mockResolvedValue(authenticated ? response({ accessToken: 'token' }) : response(null, 401))
  vi.spyOn(http, 'get').mockResolvedValue(
    response(
      authState(
        authenticated
          ? { userId: 7, username: 'ada', displayName: 'Ada Lovelace', avatarUrl }
          : null,
      ),
    ),
  )
  const auth = createAuth({ http, onOperation: (operation) => ui.loading.start(operation) })
  if (ready) await auth.restore()
  post.mockResolvedValue(response(null, 204))
  runtime.auth = auth
  runtime.ui = ui
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: {} },
      { path: '/settings/account', component: {} },
    ],
  })
  await router.push('/settings/account')
  const wrapper = mount(DefaultLayout, {
    global: {
      plugins: [
        router,
        createI18n({
          legacy: false,
          locale: 'en',
          messages: {
            en: {
              'settings.title': 'Settings',
              'auth.logout': 'Logout',
              'auth.login': 'Login',
              'auth.profile.menu': 'Account menu for {name}',
            },
          },
        }),
      ],
      stubs: {
        VApp: container,
        VNavigationDrawer: {
          props: ['modelValue'],
          template: '<aside :data-open="modelValue"><slot /></aside>',
        },
        VList: container,
        VListItem: listItem,
        VListItemTitle: container,
        VDivider: true,
        VAppBar: container,
        VAppBarNavIcon: { template: '<button data-drawer-toggle />' },
        VToolbarTitle: container,
        VBtn: { template: '<button><slot /></button>' },
        VMenu: { template: '<div><slot name="activator" :props="{}" /><slot /></div>' },
        VAvatar: avatar,
        VImg: image,
        VIcon: true,
        VProgressLinear: true,
        VBreadcrumbs: true,
        VAlert: true,
        VMain: container,
        VSnackbar: true,
        VOverlay: overlay,
        VFooter: container,
        VRow: container,
        VCol: container,
      },
    },
  })
  return { wrapper, router, auth, ui, post }
}

afterEach(() => vi.restoreAllMocks())

describe('default layout account navigation', () => {
  it.each(['auth.refresh', 'auth.profile', 'sandbox.demo', 'overlay.auth.login'])(
    'shows the contained overlay for %s until all activity finishes',
    async (key) => {
      const { wrapper, ui } = await setup()
      const loadingOverlay = wrapper.findComponent(overlay)
      expect(loadingOverlay.props('modelValue')).toBe(false)
      expect(loadingOverlay.props('contained')).toBe(true)
      const first = ui.loading.start(key)
      const second = ui.loading.start(key)
      await nextTick()
      expect(loadingOverlay.props('modelValue')).toBe(true)
      first()
      await nextTick()
      expect(loadingOverlay.props('modelValue')).toBe(true)
      second()
      await nextTick()
      expect(loadingOverlay.props('modelValue')).toBe(false)
      wrapper.unmount()
    },
  )

  it('shows a static avatar and full name above separate Settings and Logout drawer entries', async () => {
    const { wrapper } = await setup()
    const entries = wrapper
      .findAllComponents(listItem)
      .filter((entry) => entry.element.closest('aside'))
    expect(entries.map((entry) => entry.props('title'))).toEqual(['Settings', 'Logout'])
    expect(entries[0]!.props('to')).toBe('/settings')
    expect(entries[0]!.props('prependIcon')).toBe('$mdiCog')
    expect(entries[0]!.findComponent(avatar).exists()).toBe(false)
    const drawerAvatar = wrapper
      .findAllComponents(avatar)
      .find((entry) => entry.element.closest('aside'))!
    expect(drawerAvatar.text()).toBe('AL')
    expect(drawerAvatar.element.closest('button, a')).toBeNull()
    expect(wrapper.get('aside .text-subtitle-1').text()).toBe('Ada Lovelace')
    expect(entries[1]!.props('prependIcon')).toBe('$mdiLogout')
    expect(
      wrapper
        .findAllComponents(listItem)
        .map((entry) => entry.props('title'))
        .filter(Boolean),
    ).toEqual(['Settings', 'Logout', 'Settings', 'Logout'])
    const settingsEntries = wrapper
      .findAllComponents(listItem)
      .filter((entry) => entry.props('to') === '/settings')
    expect(settingsEntries).toHaveLength(2)
    for (const entry of settingsEntries) {
      expect(entry.props('prependIcon')).toBe('$mdiCog')
      expect(entry.findComponent(avatar).exists()).toBe(false)
    }
    expect(wrapper.findAllComponents(avatar)).toHaveLength(2)
    wrapper.unmount()
  })

  it('supplies avatar images without referrers and retains an initials error slot', async () => {
    const url = 'https://example.test/avatar.jpg'
    const { wrapper } = await setup(true, url)
    const images = wrapper.findAllComponents(image)
    expect(images).toHaveLength(2)
    for (const img of images) {
      expect(img.props()).toMatchObject({ src: url, alt: '', referrerpolicy: 'no-referrer' })
      expect(img.text()).toBe('AL')
    }
    wrapper.unmount()
  })

  it.each([false, true])(
    'shows Login only after anonymous restoration (ready: %s)',
    async (ready) => {
      const { wrapper } = await setup(false, null, ready)
      expect(
        wrapper
          .findAllComponents(listItem)
          .filter((entry) => entry.element.closest('aside'))
          .map((entry) => entry.props('title')),
      ).toEqual(ready ? ['Login'] : [])
      expect(wrapper.findAllComponents(avatar)).toHaveLength(0)
      wrapper.unmount()
    },
  )

  it('closes the drawer, disables both Logout entries while pending, and navigates home', async () => {
    const { wrapper, router, post, ui } = await setup()
    await wrapper.get('[data-drawer-toggle]').trigger('click')
    expect(wrapper.get('aside').attributes('data-open')).toBe('true')
    const pending = Promise.withResolvers<HttpResponse>()
    post.mockReturnValueOnce(pending.promise)
    const entries = wrapper
      .findAllComponents(listItem)
      .filter((entry) => entry.props('title') === 'Logout')
    await entries[0]!.trigger('click')
    expect(wrapper.get('aside').attributes('data-open')).toBe('false')
    expect(ui.loading.has('auth.logout')).toBe(true)
    expect(entries.every((entry) => entry.props('disabled') === true)).toBe(true)
    pending.resolve(response(null, 204))
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/')
    expect(ui.loading.active.value).toBe(false)
    expect(wrapper.get('aside').text()).toBe('Login')
    wrapper.unmount()
  })

  it('reports logout failures through UI feedback and still returns home', async () => {
    const { wrapper, router, post, ui } = await setup()
    post.mockRejectedValueOnce(new Error('Logout failed'))
    await wrapper
      .findAllComponents(listItem)
      .find((entry) => entry.props('title') === 'Logout')!
      .trigger('click')
    await flushPromises()
    expect(ui.notification.value).toMatchObject({ type: 'error', message: 'Logout failed' })
    expect(router.currentRoute.value.path).toBe('/')
    wrapper.unmount()
  })
})
