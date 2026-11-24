import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { VDialog, VOverlay } from 'vuetify/components'
import { createState } from '@/capabilities/state'
import { useUi } from '@/capabilities/ui'
import VOvTable from '@/components/data/VOvTable.vue'
import VOvView from '@/components/data/VOvView.vue'
import VOvForm from '@/components/forms/VOvForm.vue'
import { provideLoadingOverlays } from '@/components/overlays/loading'
import type { OvTableFetchRequest, OvTableOptions } from '@/components'
import { globalPlugins } from '../../support/components.setup'

const tableOptions: OvTableOptions = {
  key: 'name',
  columns: [{ name: 'name' }],
  actions: [
    {
      name: 'edit',
      form: {
        fields: [{ name: 'name', type: 'text' }],
        actions: ['save'],
        actionSubmit: 'save',
      },
    },
  ],
}

function fetch({ complete }: OvTableFetchRequest) {
  complete({ items: [{ name: 'Row' }] })
}

describe('nested loading overlays', () => {
  it('covers an open teleported table form during overlapping submission and loading', async () => {
    const ui = useUi(createState())
    const loading = ref(false)
    const host = defineComponent({
      components: { VOvTable, VOverlay },
      setup() {
        provideLoadingOverlays(ui.loading.registerOverlay)
        return { ui, loading, fetch, tableOptions }
      },
      template: `
        <div>
          <VOvTable :options="tableOptions" :loading="loading" @fetch="fetch" />
          <VOverlay ref="fallbackOverlay" :model-value="ui.loading.global.value" contained />
        </div>`,
    })
    const wrapper = mount(host, { attachTo: document.body, global: { plugins: globalPlugins } })
    try {
      await flushPromises()
      const table = wrapper.getComponent(VOvTable)
      await table.get('button[name="edit"]').trigger('click')
      await flushPromises()
      const form = table.getComponent(VOvForm)
      const dialog = table.findAllComponents(VDialog).find((item) => item.props('modelValue'))!
      expect(dialog.exists()).toBe(true)
      const card = form.element.closest('.v-card')
      expect(card).not.toBeNull()
      expect(table.element.contains(card)).toBe(false)

      const finish = ui.loading.start('table.save')
      await form.vm.handleAction('save')
      loading.value = true
      await flushPromises()
      expect(form.props('loading')).toBe(true)
      expect(form.getComponent(VOverlay).props('modelValue')).toBe(false)
      expect(card!.querySelector('.v-overlay--contained.v-overlay--active')).not.toBeNull()
      expect(table.element.querySelector('.v-overlay--contained.v-overlay--active')).toBeNull()
      expect(wrapper.getComponent({ ref: 'fallbackOverlay' }).props('modelValue')).toBe(false)

      const complete = table.emitted('action')![0]![3]
      if (typeof complete !== 'function') throw new Error('Missing action callback')
      complete({ status: 'error' })
      await flushPromises()
      expect(form.props('loading')).toBe(true)
      expect(card!.querySelector('.v-overlay--contained.v-overlay--active')).not.toBeNull()
      loading.value = false
      await flushPromises()
      expect(form.props('loading')).toBe(false)
      expect(wrapper.getComponent({ ref: 'fallbackOverlay' }).props('modelValue')).toBe(true)
      finish()
      await nextTick()
      expect(ui.loading.global.value).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })

  it('hands overlay ownership between nested tables and a view during concurrent loads', async () => {
    const originalWidth = window.innerWidth
    window.innerWidth = 1440
    window.dispatchEvent(new Event('resize'))
    const ui = useUi(createState())
    const outerBusy = ref(false)
    const innerBusy = ref(false)
    const viewBusy = ref(false)
    const host = defineComponent({
      components: { VOvTable, VOvView, VOverlay },
      setup() {
        provideLoadingOverlays(ui.loading.registerOverlay)
        return { ui, outerBusy, innerBusy, viewBusy, fetch, tableOptions }
      },
      template: `
        <div>
          <VOvTable :options="tableOptions" :loading="outerBusy" @fetch="fetch">
            <template #expand>
              <VOvTable :options="tableOptions" :loading="innerBusy" @fetch="fetch">
                <template #expand>
                  <VOvView :options="{ items: [{ name: 'name' }] }"
                    :data="{ name: 'Details' }" :loading="viewBusy" />
                </template>
              </VOvTable>
            </template>
          </VOvTable>
          <VOverlay ref="fallbackOverlay" :model-value="ui.loading.global.value" contained />
        </div>`,
    })
    const wrapper = mount(host, { attachTo: document.body, global: { plugins: globalPlugins } })
    try {
      await flushPromises()
      await wrapper.getComponent(VOvTable).get('tbody tr').trigger('click')
      await flushPromises()
      const tables = wrapper.findAllComponents(VOvTable)
      expect(tables).toHaveLength(2)
      await tables[1]!.get('tr.cursor-pointer').trigger('click')
      await flushPromises()
      const view = wrapper.getComponent(VOvView)
      const viewOverlay = view.findAllComponents(VOverlay).at(-1)!
      const fallback = wrapper.getComponent({ ref: 'fallbackOverlay' })
      const finishOuter = ui.loading.start('outer')
      const finishInner = ui.loading.start('inner')
      outerBusy.value = true
      innerBusy.value = true
      viewBusy.value = true
      await nextTick()
      expect(
        tables[0]!.element.querySelectorAll('.v-overlay--contained.v-overlay--active'),
      ).toHaveLength(1)
      expect(
        tables[1]!.element.querySelectorAll('.v-overlay--contained.v-overlay--active'),
      ).toHaveLength(0)
      expect(viewOverlay.props('modelValue')).toBe(false)
      expect(fallback.props('modelValue')).toBe(false)

      outerBusy.value = false
      finishOuter()
      await nextTick()
      expect(
        tables[1]!.element.querySelectorAll('.v-overlay--contained.v-overlay--active'),
      ).toHaveLength(1)
      expect(viewOverlay.props('modelValue')).toBe(false)
      expect(fallback.props('modelValue')).toBe(false)

      innerBusy.value = false
      await nextTick()
      expect(viewOverlay.props('modelValue')).toBe(true)
      expect(fallback.props('modelValue')).toBe(false)
      viewBusy.value = false
      await nextTick()
      expect(viewOverlay.props('modelValue')).toBe(false)
      expect(fallback.props('modelValue')).toBe(true)
      finishInner()
      await nextTick()
      expect(fallback.props('modelValue')).toBe(false)
    } finally {
      wrapper.unmount()
      window.innerWidth = originalWidth
      window.dispatchEvent(new Event('resize'))
    }
  })

  it('keeps overlays visible in separate teleported nested view dialogs', async () => {
    const ui = useUi(createState())
    const outerBusy = ref(false)
    const innerBusy = ref(false)
    const inner = defineComponent({
      inheritAttrs: false,
      setup: () => () =>
        h(VOvView, {
          loading: innerBusy.value,
          data: { name: 'Inner' },
          options: {
            items: [{ name: 'name' }],
            actions: [
              {
                name: 'edit-inner',
                form: {
                  fields: [{ name: 'name', type: 'text' }],
                  actions: ['save'],
                  actionSubmit: 'save',
                },
              },
            ],
          },
        }),
    })
    const host = defineComponent({
      components: { VOvView },
      setup() {
        provideLoadingOverlays(ui.loading.registerOverlay)
        const options = {
          items: [{ name: 'name' }],
          actions: [
            {
              name: 'edit-outer',
              form: { fields: [{ name: 'nested', type: 'custom' as const, component: inner }] },
            },
          ],
        }
        return { options, outerBusy }
      },
      template: '<VOvView :options="options" :data="{ name: \'Outer\' }" :loading="outerBusy" />',
    })
    const wrapper = mount(host, { attachTo: document.body, global: { plugins: globalPlugins } })
    try {
      await wrapper.get('button[name="edit-outer"]').trigger('click')
      await flushPromises()
      const views = wrapper.findAllComponents(VOvView)
      expect(views).toHaveLength(2)
      const outerForm = wrapper.getComponent(VOvForm)
      const outerCard = outerForm.element.closest('.v-card')
      expect(outerCard).not.toBeNull()
      const finish = ui.loading.start('nested')
      innerBusy.value = true
      await flushPromises()
      expect(views[1]!.findAllComponents(VOverlay).at(-1)!.props('modelValue')).toBe(true)
      outerBusy.value = true
      await flushPromises()
      expect(views[1]!.findAllComponents(VOverlay).at(-1)!.props('modelValue')).toBe(false)
      expect(outerCard!.querySelectorAll('.v-overlay--contained.v-overlay--active')).toHaveLength(1)
      outerBusy.value = false
      innerBusy.value = false
      await flushPromises()
      expect(ui.loading.global.value).toBe(true)
      await views[1]!.get('button[name="edit-inner"]').trigger('click')
      await flushPromises()
      const forms = wrapper.findAllComponents(VOvForm)
      expect(forms).toHaveLength(2)
      const innerCard = forms[1]!.element.closest('.v-card')
      expect(innerCard).not.toBeNull()
      expect(outerCard!.contains(innerCard)).toBe(false)

      innerBusy.value = true
      await flushPromises()
      expect(innerCard!.querySelector('.v-overlay--contained.v-overlay--active')).not.toBeNull()
      outerBusy.value = true
      await flushPromises()
      expect(outerCard!.querySelector('.v-overlay--contained.v-overlay--active')).not.toBeNull()
      expect(forms[1]!.props('loading')).toBe(true)
      expect(innerCard!.querySelector('.v-overlay--contained.v-overlay--active')).not.toBeNull()
      expect(innerCard!.querySelectorAll('.v-overlay--contained.v-overlay--active')).toHaveLength(1)
      expect(ui.loading.global.value).toBe(false)
      outerBusy.value = false
      await flushPromises()
      expect(innerCard!.querySelector('.v-overlay--contained.v-overlay--active')).not.toBeNull()
      outerBusy.value = true
      innerBusy.value = false
      await flushPromises()
      expect(outerCard!.querySelector('.v-overlay--contained.v-overlay--active')).not.toBeNull()
      expect(innerCard!.querySelector('.v-overlay--contained.v-overlay--active')).toBeNull()
      expect(ui.loading.global.value).toBe(false)
      outerBusy.value = false
      await flushPromises()
      expect(ui.loading.global.value).toBe(true)
      finish()
    } finally {
      wrapper.unmount()
    }
  })
})
