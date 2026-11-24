import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { VOverlay, VSnackbarQueue } from 'vuetify/components'
import { createState } from '@/capabilities/state'
import { useNotificationQueue, useUi } from '@/capabilities/ui'

afterEach(() => {
  vi.useRealTimers()
})

describe('notification queue', () => {
  it('removes completed snackbars while preserving the alert and waiting messages', async () => {
    vi.useFakeTimers()
    const ui = useUi(createState())
    const surface = defineComponent({
      components: { VSnackbarQueue },
      setup: () => useNotificationQueue(ui),
      template:
        '<VSnackbarQueue ref="snackbarQueue" v-model="messages" closable close-text="Close" />',
    })
    const wrapper = mount(surface, { attachTo: document.body })
    try {
      ui.alert('Page alert')
      ui.success('First', { timeout: 1000 })
      ui.warning('Second', { timeout: 0 })
      await nextTick()
      await nextTick()
      expect(ui.notifications.value.map((item) => item.message)).toEqual([
        'Page alert',
        'First',
        'Second',
      ])
      expect(ui.notificationQueue.value.map((item) => item.text)).toEqual(['Second'])

      await vi.advanceTimersByTimeAsync(1000)
      await nextTick()
      expect(ui.notifications.value.map((item) => item.message)).toEqual(['Page alert', 'Second'])

      // The test environment does not run the overlay's leave transition.
      wrapper.findComponent(VOverlay).vm.$emit('afterLeave')
      await nextTick()
      expect(document.body.textContent).toContain('Second')
      const close = [...document.body.querySelectorAll('button')].find((button) =>
        button.textContent?.includes('Close'),
      )
      expect(close).toBeDefined()
      close!.click()
      await nextTick()
      expect(ui.notifications.value.map((item) => item.message)).toEqual(['Page alert'])
      expect(ui.notificationQueue.value).toEqual([])
    } finally {
      wrapper.unmount()
    }

    const remounted = mount(surface)
    try {
      await nextTick()
      expect(ui.notifications.value.map((item) => item.message)).toEqual(['Page alert'])
      expect(ui.notificationQueue.value).toEqual([])
    } finally {
      remounted.unmount()
    }
  })
})
