import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref, type Component, type PropType } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createAuth, type Auth } from '@/capabilities/auth/core'
import { createHttpClient, type HttpResponse } from '@/capabilities/http/core'
import { createState } from '@/capabilities/state'
import { useUi } from '@/capabilities/ui/store'
import { authConfig } from '../../auth-state'
import DefaultLayout from '@/app/layouts/DefaultLayout.vue'
import type { Breadcrumb } from '@/capabilities/routing'
import { useLoadingOverlay } from '@/components/overlays/loading'

const breadcrumbItems = ref<Breadcrumb[]>([])

const runtime = vi.hoisted((): { auth?: Auth; ui?: ReturnType<typeof useUi> } => ({}))

vi.mock('@/capabilities', () => ({ useApp: () => runtime }))
vi.mock('@/capabilities/ui', async () => ({
  usePreferencesStore: () => ({
    fontSizes: [100],
    locales: ['en'],
    locale: 'en',
    themeIcon: '$mdiWeatherSunny',
  }),
  useNotificationTranslator: () => (message?: string) => message ?? '',
  useNotificationMessage: (await import('@/capabilities/ui/composables')).useNotificationMessage,
  useNotificationQueue: (await import('@/capabilities/ui/composables')).useNotificationQueue,
}))
vi.mock('@/capabilities/routing', () => ({
  useRouting: () => ({ pages: ref([]), breadcrumbs: breadcrumbItems }),
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
const progress = defineComponent({
  props: { active: Boolean },
  template: '<div />',
})
const alert = defineComponent({
  name: 'VAlert',
  props: { type: String, text: String, closable: Boolean },
  emits: ['click:close'],
  template: '<div role="alert">{{ text }}</div>',
})
type QueuedMessage = { text: string; color: string; timeout: number; onDismiss: () => void }
const snackbar = defineComponent({
  props: {
    modelValue: { type: Array as PropType<QueuedMessage[]>, required: true },
    closable: Boolean,
    closeText: String,
  },
  emits: ['update:modelValue'],
  methods: {
    clear() {
      this.$emit('update:modelValue', [])
    },
  },
  template: '<div><slot v-for="item in modelValue" name="text" :item="item" /></div>',
})
const breadcrumbs = defineComponent({
  props: ['items'],
  template:
    '<nav><a v-for="item in items" :key="item.href" :href="item.href">{{ item.title }}</a></nav>',
})

function response<T>(data: T | null, status = 200): HttpResponse<T> {
  return { data, error: null, status, headers: null }
}

async function setup(
  authenticated = true,
  avatarUrl: string | null = null,
  ready = true,
  content?: Component,
) {
  const ui = useUi(createState())
  const http = createHttpClient()
  const post = vi
    .spyOn(http, 'post')
    .mockResolvedValue(authenticated ? response({ accessToken: 'token' }) : response(null, 401))
  vi.spyOn(http, 'get').mockImplementation(async (url) =>
    response(
      String(url).endsWith('/auth/config')
        ? authConfig()
        : { userId: 7, username: 'ada', displayName: 'Ada Lovelace', avatarUrl },
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
      { path: '/login', component: {} },
      { path: '/settings/account', component: {} },
    ],
  })
  await router.push('/settings/account')
  const wrapper = mount(DefaultLayout, {
    slots: { default: () => (content ? h(content) : null) },
    global: {
      plugins: [
        router,
        createI18n({
          legacy: false,
          locale: 'en',
          messages: {
            en: {
              close: 'Close',
              'settings.title': 'Settings',
              'auth.logout': 'Logout',
              'auth.login': 'Login',
              'auth.profile.menu': 'Account menu for {name}',
              'admin.title': 'Admin',
              'admin.users': 'Users',
            },
            de: {
              close: 'Schließen',
              'settings.title': 'Einstellungen',
              'auth.logout': 'Abmelden',
              'auth.login': 'Anmelden',
              'auth.profile.menu': 'Kontomenü für {name}',
              'admin.title': 'Administration',
              'admin.users': 'Benutzer',
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
        VProgressLinear: progress,
        VBreadcrumbs: breadcrumbs,
        VAlert: alert,
        VMain: container,
        VSnackbarQueue: snackbar,
        VOverlay: overlay,
        VFooter: container,
        VRow: container,
        VCol: container,
      },
    },
  })
  return { wrapper, router, auth, ui, post }
}

afterEach(() => {
  vi.restoreAllMocks()
  breadcrumbItems.value = []
})

describe('default layout account navigation', () => {
  it('localizes breadcrumb titles reactively while preserving links and literal titles', async () => {
    breadcrumbItems.value = [
      { title: 'admin.title', href: '/admin', disabled: false },
      { title: 'admin.users', href: '/admin/users', disabled: false },
      { title: 'Ada @ team', href: '', disabled: true },
    ]
    const { wrapper } = await setup()
    try {
      expect(wrapper.findAll('nav a').map((link) => link.text())).toEqual([
        'Admin',
        'Users',
        'Ada @ team',
      ])
      expect(wrapper.findAll('nav a').map((link) => link.attributes('href'))).toEqual([
        '/admin',
        '/admin/users',
        '',
      ])
      wrapper.vm.$i18n.locale = 'de'
      await nextTick()
      expect(wrapper.findAll('nav a').map((link) => link.text())).toEqual([
        'Administration',
        'Benutzer',
        'Ada @ team',
      ])
    } finally {
      wrapper.unmount()
    }
  })

  it.each(['overlay.auth.login', 'admin.settings.update', 'auth.refresh', 'sandbox.demo'])(
    'shows the fallback overlay for %s without requiring a special prefix',
    async (key) => {
      const { wrapper, ui } = await setup()
      const loadingOverlay = wrapper.findComponent(overlay)
      expect(loadingOverlay.props('modelValue')).toBe(false)
      expect(wrapper.getComponent(progress).props('active')).toBe(false)
      expect(loadingOverlay.props('contained')).toBe(true)
      const first = ui.loading.start(key)
      const second = ui.loading.start(key)
      await nextTick()
      expect(loadingOverlay.props('modelValue')).toBe(true)
      expect(wrapper.getComponent(progress).props('active')).toBe(true)
      first()
      await nextTick()
      expect(loadingOverlay.props('modelValue')).toBe(true)
      second()
      await nextTick()
      expect(loadingOverlay.props('modelValue')).toBe(false)
      expect(wrapper.getComponent(progress).props('active')).toBe(false)
      wrapper.unmount()
    },
  )

  it('suppresses the fallback while local surfaces own loading and releases ownership on unmount', async () => {
    const firstBusy = ref(true)
    const secondBusy = ref(true)
    const show = ref(true)
    const first = defineComponent({
      setup() {
        useLoadingOverlay(firstBusy)
        return () => null
      },
    })
    const second = defineComponent({
      setup() {
        useLoadingOverlay(secondBusy)
        return () => null
      },
    })
    const content = defineComponent({
      components: { First: first, Second: second },
      setup: () => ({ show }),
      template: '<First /><Second v-if="show" />',
    })
    const { wrapper, ui } = await setup(true, null, true, content)
    const finish = ui.loading.start('admin.settings.update')
    try {
      await nextTick()
      expect(wrapper.findComponent(overlay).props('modelValue')).toBe(false)
      expect(wrapper.getComponent(progress).props('active')).toBe(false)
      firstBusy.value = false
      await nextTick()
      expect(wrapper.findComponent(overlay).props('modelValue')).toBe(false)
      show.value = false
      await nextTick()
      expect(ui.loading.active.value).toBe(true)
      expect(wrapper.findComponent(overlay).props('modelValue')).toBe(true)
      expect(wrapper.getComponent(progress).props('active')).toBe(true)
      firstBusy.value = true
      await nextTick()
      expect(wrapper.findComponent(overlay).props('modelValue')).toBe(false)
    } finally {
      finish()
      wrapper.unmount()
    }
  })

  it('renders a translated page alert alongside snackbars and closes only the alert', async () => {
    const { wrapper, ui } = await setup()
    try {
      ui.alert('admin.title', { type: 'warning' })
      ui.success('Saved')
      await nextTick()
      const pageAlert = wrapper.getComponent(alert)
      expect(pageAlert.props('type')).toBe('warning')
      expect(pageAlert.props('text')).toBe('Admin')
      expect(pageAlert.props('closable')).toBe(true)
      expect(
        wrapper
          .getComponent(snackbar)
          .props('modelValue')
          .map((item) => item.text),
      ).toEqual(['Saved'])
      wrapper.vm.$i18n.locale = 'de'
      await nextTick()
      expect(pageAlert.props('text')).toBe('Administration')
      pageAlert.vm.$emit('click:close')
      await nextTick()
      expect(wrapper.findComponent(alert).exists()).toBe(false)
      expect(
        wrapper
          .getComponent(snackbar)
          .props('modelValue')
          .map((item) => item.text),
      ).toEqual(['Saved'])
    } finally {
      wrapper.unmount()
    }
  })

  it('queues messages by severity and clears both pending and displayed snackbars', async () => {
    const { wrapper, ui } = await setup()
    ui.success('Saved')
    ui.error('Failed', { timeout: 0 })
    await nextTick()
    const queue = wrapper.getComponent(snackbar)
    const clear = vi.spyOn(queue.vm, 'clear')
    const messages = queue.props('modelValue')
    expect(messages.map(({ text, color, timeout }) => ({ text, color, timeout }))).toEqual([
      { text: 'Saved', color: 'success', timeout: 5000 },
      { text: 'Failed', color: 'error', timeout: -1 },
    ])
    expect(queue.props('closable')).toBe(true)
    expect(wrapper.findComponent({ name: 'VAlert' }).exists()).toBe(false)
    queue.vm.$emit('update:modelValue', messages.slice(1))
    messages[0]!.onDismiss()
    await nextTick()
    expect(ui.notification.value?.message).toBe('Failed')
    expect(queue.props('modelValue').map((item) => item.text)).toEqual(['Failed'])
    ui.clear()
    await nextTick()
    expect(ui.notification.value).toBeUndefined()
    expect(queue.props('modelValue')).toEqual([])
    expect(clear).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

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

  it('closes the drawer, disables both Logout entries while pending, and navigates to login', async () => {
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
    expect(router.currentRoute.value.path).toBe('/login')
    expect(ui.loading.active.value).toBe(false)
    expect(wrapper.get('aside').text()).toBe('Login')
    wrapper.unmount()
  })

  it('reports logout failures through UI feedback and still navigates to login', async () => {
    const { wrapper, router, post, ui } = await setup()
    post.mockRejectedValueOnce(new Error('Logout failed'))
    await wrapper
      .findAllComponents(listItem)
      .find((entry) => entry.props('title') === 'Logout')!
      .trigger('click')
    await flushPromises()
    expect(ui.notification.value).toMatchObject({ type: 'error', message: 'Logout failed' })
    expect(router.currentRoute.value.path).toBe('/login')
    wrapper.unmount()
  })

  it('reports failed logout navigation through UI feedback', async () => {
    const { wrapper, router, ui } = await setup()
    vi.spyOn(router, 'replace').mockRejectedValueOnce(new Error('Navigation failed'))
    await wrapper
      .findAllComponents(listItem)
      .find((entry) => entry.props('title') === 'Logout')!
      .trigger('click')
    await flushPromises()
    expect(ui.notification.value).toMatchObject({ type: 'error', message: 'Navigation failed' })
    wrapper.unmount()
  })
})
