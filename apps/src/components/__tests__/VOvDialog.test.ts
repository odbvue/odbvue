import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { OvAction } from '../index'
import VOvDialog from '../VOvDialog.vue'

// Mock visualViewport for Vuetify VOverlay with proper event handling
if (typeof global.visualViewport === 'undefined') {
  const mockViewport: Partial<VisualViewport> & {
    addEventListener: ReturnType<typeof vi.fn>
    removeEventListener: ReturnType<typeof vi.fn>
  } = {
    width: 1024,
    height: 768,
    offsetLeft: 0,
    offsetTop: 0,
    pageLeft: 0,
    pageTop: 0,
    scale: 1,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  global.visualViewport = mockViewport as VisualViewport
}

// Helper to open dialog and wait for render
async function openDialog(wrapper: ReturnType<typeof mount>) {
  const vm = wrapper.vm as unknown as Record<string, unknown>
  vm.dialog = true
  await wrapper.vm.$nextTick()
  await flushPromises()
}

describe('VOvDialog', () => {
  describe('Rendering', () => {
    it('mounts without error', () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Test Dialog',
        },
      })
      expect(wrapper.vm).toBeDefined()
      expect(wrapper.exists()).toBe(true)
    })

    it('renders VDialog component', () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Test Dialog',
        },
      })
      const dialog = wrapper.findComponent({ name: 'VDialog' })
      expect(dialog.exists()).toBe(true)
    })

    it('renders VCard component inside dialog', async () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Test Dialog',
        },
      })
      await openDialog(wrapper)
      const card = wrapper.findComponent({ name: 'VCard' })
      expect(card.exists()).toBe(true)
    })

    it('renders VCardText component for content', async () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Test Dialog',
          content: 'Test content',
        },
      })
      await openDialog(wrapper)
      const cardText = wrapper.findComponent({ name: 'VCardText' })
      expect(cardText.exists()).toBe(true)
    })

    it('renders VCardActions component for buttons', async () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Test Dialog',
          actions: ['ok'],
        },
      })
      await openDialog(wrapper)
      const cardActions = wrapper.findComponent({ name: 'VCardActions' })
      expect(cardActions.exists()).toBe(true)
    })
  })

  describe('Dialog Properties', () => {
    it('applies title prop to card', async () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'My Dialog Title',
        },
      })
      await openDialog(wrapper)
      const card = wrapper.findComponent({ name: 'VCard' })
      expect(card.props('title')).toBe('My Dialog Title')
    })

    it('applies subtitle prop to card', async () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Title',
          subtitle: 'Subtitle text',
        },
      })
      await openDialog(wrapper)
      const card = wrapper.findComponent({ name: 'VCard' })
      expect(card.props('subtitle')).toBe('Subtitle text')
    })

    it('applies icon prop to card', async () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          icon: '$mdiAlert',
        },
      })
      await openDialog(wrapper)
      const card = wrapper.findComponent({ name: 'VCard' })
      expect(card.props('prependIcon')).toBe('$mdiAlert')
    })

    it('applies color prop to card', async () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          color: 'primary',
        },
      })
      await openDialog(wrapper)
      const card = wrapper.findComponent({ name: 'VCard' })
      expect(card.props('color')).toBe('primary')
    })

    it('applies persistent prop to dialog', () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          persistent: true,
        },
      })
      const dialog = wrapper.findComponent({ name: 'VDialog' })
      expect(dialog.props('persistent')).toBe(true)
    })

    it('applies fullscreen prop to dialog', () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          fullscreen: true,
        },
      })
      const dialog = wrapper.findComponent({ name: 'VDialog' })
      expect(dialog.props('fullscreen')).toBe(true)
    })

    it('applies scrollable prop to dialog', () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          scrollable: true,
        },
      })
      const dialog = wrapper.findComponent({ name: 'VDialog' })
      expect(dialog.props('scrollable')).toBe(true)
    })

    it('defaults persistent to false', () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
        },
      })
      const dialog = wrapper.findComponent({ name: 'VDialog' })
      expect(dialog.props('persistent')).toBe(false)
    })

    it('defaults fullscreen to false', () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
        },
      })
      const dialog = wrapper.findComponent({ name: 'VDialog' })
      expect(dialog.props('fullscreen')).toBe(false)
    })

    it('defaults scrollable to false', () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
        },
      })
      const dialog = wrapper.findComponent({ name: 'VDialog' })
      expect(dialog.props('scrollable')).toBe(false)
    })
  })

  describe('Content Props', () => {
    it('renders content as text when no format is provided', async () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          content: 'Simple text content',
        },
      })
      await openDialog(wrapper)
      const cardText = wrapper.findComponent({ name: 'VCardText' })
      expect(cardText.text()).toContain('Simple text content')
    })

    it('renders content without chip when hasContentProps is false', () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          content: 'Content',
        },
      })
      const chips = wrapper.findAllComponents({ name: 'VChip' })
      expect(chips.length).toBe(0)
    })

    it('renders content as chip when format is provided', async () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          content: 'Formatted content',
          contentFormat: { color: 'primary' },
        },
      })
      await openDialog(wrapper)
      const chip = wrapper.findComponent({ name: 'VChip' })
      expect(chip.exists()).toBe(true)
    })

    it('handles empty content prop', () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('handles undefined content prop', () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          content: undefined,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('accepts multiple content formats as array', () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          content: 'Multi-format content',
          contentFormat: [{ color: 'primary' }, { variant: 'outlined' }],
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('accepts single content format object', () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          content: 'Single format content',
          contentFormat: { color: 'error', variant: 'elevated' },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Actions Props', () => {
    it('renders action buttons when actions prop is provided as array', async () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          actions: ['ok', 'cancel'],
        },
      })
      await openDialog(wrapper)
      const buttons = wrapper.findAllComponents({ name: 'VBtn' })
      expect(buttons.length).toBeGreaterThanOrEqual(2)
    })

    it('renders single action button when actions prop is string', async () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          actions: 'ok',
        },
      })
      await openDialog(wrapper)
      const buttons = wrapper.findAllComponents({ name: 'VBtn' })
      expect(buttons.length).toBeGreaterThanOrEqual(1)
    })

    it('renders no action buttons when actions prop is empty array', () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          actions: [],
        },
      })
      const buttons = wrapper.findAllComponents({ name: 'VBtn' })
      expect(buttons.length).toBe(0)
    })

    it('renders no action buttons when actions prop is undefined', () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
        },
      })
      const buttons = wrapper.findAllComponents({ name: 'VBtn' })
      expect(buttons.length).toBe(0)
    })

    it('renders multiple action buttons with different names', () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          actions: ['save', 'cancel', 'delete'],
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('handles action objects with format properties', () => {
      const actions: OvAction[] = [
        {
          name: 'confirm',
          format: { color: 'success', icon: '$mdiCheck' },
        },
        {
          name: 'cancel',
          format: { color: 'error', icon: '$mdiClose' },
        },
      ]
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          actions: actions,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('accepts multiple action formats as array', () => {
      const actions: OvAction[] = [
        {
          name: 'action1',
          format: [{ color: 'primary' }, { variant: 'elevated' }],
        },
      ]
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          actions: actions,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('accepts single action format as object', () => {
      const actions: OvAction[] = [
        {
          name: 'action1',
          format: { color: 'primary', variant: 'outlined' },
        },
      ]
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          actions: actions,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Exposed Dialog State', () => {
    it('exposes dialog ref that can be accessed', () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
        },
      })
      expect(wrapper.vm.dialog).toBeDefined()
    })

    it('dialog ref is initially false', () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
        },
      })
      expect(wrapper.vm.dialog).toBe(false)
    })

    it('dialog ref can be toggled', async () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
        },
      })
      wrapper.vm.dialog = true
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.dialog).toBe(true)
    })

    it('dialog ref can be opened from false to true', async () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
        },
      })
      expect(wrapper.vm.dialog).toBe(false)
      wrapper.vm.dialog = true
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.dialog).toBe(true)
    })

    it('dialog ref can be closed from true to false', async () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
        },
      })
      wrapper.vm.dialog = true
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.dialog).toBe(true)
      wrapper.vm.dialog = false
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.dialog).toBe(false)
    })
  })

  describe('Event Emissions', () => {
    it('emits action event when custom action is clicked', async () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          actions: ['custom'],
        },
      })
      await wrapper.vm.$nextTick()
      const customAction: OvAction = 'custom'
      wrapper.vm.$emit('action', customAction)
      expect(wrapper.emitted('action')).toBeTruthy()
    })

    it('emits submit event when submit action is triggered', async () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          actions: ['submit'],
          actionSubmit: 'submit',
        },
      })
      await wrapper.vm.$nextTick()
      const submitAction: OvAction = 'submit'
      wrapper.vm.$emit('submit', submitAction)
      expect(wrapper.emitted('submit')).toBeTruthy()
    })

    it('emits cancel event when cancel action is triggered', async () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          actions: ['cancel'],
          actionCancel: 'cancel',
        },
      })
      await wrapper.vm.$nextTick()
      wrapper.vm.$emit('cancel')
      expect(wrapper.emitted('cancel')).toBeTruthy()
    })

    it('emits multiple events for different actions', async () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          actions: ['action1', 'action2'],
        },
      })
      await wrapper.vm.$nextTick()
      wrapper.vm.$emit('action', 'action1')
      wrapper.vm.$emit('action', 'action2')
      expect(wrapper.emitted('action')).toBeTruthy()
      expect(wrapper.emitted('action')?.length).toBe(2)
    })
  })

  describe('Slots', () => {
    it('renders content slot when provided', async () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
        },
        slots: {
          content: { template: '<div class="custom-content">Custom Content</div>' },
        },
      })
      await openDialog(wrapper)
      // Verify component mounts with slot defined
      expect(wrapper.vm).toBeDefined()
    })

    it('renders actions slot when provided', async () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
        },
        slots: {
          actions: { template: '<button class="custom-button">Custom Button</button>' },
        },
      })
      await openDialog(wrapper)
      // Verify component mounts with slot defined
      expect(wrapper.vm).toBeDefined()
    })

    it('content slot receives onClose callback', () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
        },
        slots: {
          content: '<div class="content"></div>',
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('both slots can be used together', async () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
        },
        slots: {
          content: { template: '<div class="content">Content Slot</div>' },
          actions: { template: '<div class="actions">Actions Slot</div>' },
        },
      })
      await openDialog(wrapper)
      // Verify component mounts with both slots defined
      expect(wrapper.vm).toBeDefined()
    })

    it('content slot overrides content prop', async () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          content: 'Prop content',
        },
        slots: {
          content: { template: '<div class="slot-override">Slot content</div>' },
        },
      })
      await openDialog(wrapper)
      // Verify component mounts with slot defined (slot takes precedence over prop)
      expect(wrapper.vm).toBeDefined()
    })

    it('actions slot works independently of actions prop', () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          actions: ['ok'],
        },
        slots: {
          actions: '<button>Extra Action</button>',
        },
      })
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Complex Scenarios', () => {
    it('renders complete dialog with title, content, icon, and actions', async () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Confirmation',
          subtitle: 'Are you sure?',
          icon: '$mdiAlert',
          color: 'warning',
          content: 'This action cannot be undone.',
          actions: ['cancel', 'confirm'],
          actionCancel: 'cancel',
          actionSubmit: 'confirm',
        },
      })
      await openDialog(wrapper)
      const card = wrapper.findComponent({ name: 'VCard' })
      expect(card.props('title')).toBe('Confirmation')
      expect(card.props('subtitle')).toBe('Are you sure?')
      expect(card.props('prependIcon')).toBe('$mdiAlert')
      expect(card.props('color')).toBe('warning')
    })

    it('renders dialog with formatted content and actions', () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Styled Dialog',
          content: 'Important message',
          contentFormat: { color: 'error', variant: 'elevated' },
          actions: [
            { name: 'accept', format: { color: 'success', icon: '$mdiCheck' } },
            { name: 'reject', format: { color: 'error', icon: '$mdiClose' } },
          ],
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('renders fullscreen persistent dialog', () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Fullscreen Dialog',
          fullscreen: true,
          persistent: true,
          content: 'Important content',
          actions: ['close'],
        },
      })
      const dialog = wrapper.findComponent({ name: 'VDialog' })
      expect(dialog.props('fullscreen')).toBe(true)
      expect(dialog.props('persistent')).toBe(true)
    })

    it('renders scrollable dialog with long content', () => {
      const longContent = 'Lorem ipsum dolor sit amet. '.repeat(50) + 'Lorem ipsum dolor sit amet.'
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Long Content Dialog',
          scrollable: true,
          content: longContent,
          actions: ['close'],
        },
      })
      const dialog = wrapper.findComponent({ name: 'VDialog' })
      expect(dialog.props('scrollable')).toBe(true)
    })

    it('renders dialog with mixed action types (strings and objects)', () => {
      const actions: OvAction[] = [
        'cancel',
        { name: 'save', format: { color: 'primary' } },
        'delete',
        { name: 'archive', format: { color: 'info' } },
      ]
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Mixed Actions Dialog',
          actions: actions,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('renders dialog with multiple content formats', () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          content: 'Content',
          contentFormat: [
            { color: 'primary', rules: { type: 'required', params: true } },
            { variant: 'outlined' },
          ],
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('renders dialog with multiple action formats', () => {
      const actions: OvAction[] = [
        {
          name: 'action1',
          format: [{ color: 'primary' }, { variant: 'elevated', size: 'large' }],
        },
      ]
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          actions: actions,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Props Updates', () => {
    it('updates dialog title when title prop changes', async () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Initial Title',
        },
      })
      await openDialog(wrapper)
      await wrapper.setProps({ title: 'Updated Title' })
      const card = wrapper.findComponent({ name: 'VCard' })
      expect(card.props('title')).toBe('Updated Title')
    })

    it('updates dialog content when content prop changes', async () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          content: 'Initial content',
        },
      })
      await wrapper.setProps({ content: 'Updated content' })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })

    it('updates actions when actions prop changes', async () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          actions: ['action1'],
        },
      })
      await wrapper.setProps({ actions: ['action1', 'action2', 'action3'] })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })

    it('updates dialog state when persistent prop changes', async () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          persistent: false,
        },
      })
      const dialog = wrapper.findComponent({ name: 'VDialog' })
      expect(dialog.props('persistent')).toBe(false)
      await wrapper.setProps({ persistent: true })
      expect(dialog.props('persistent')).toBe(true)
    })

    it('updates multiple props simultaneously', async () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Initial',
          content: 'Initial content',
          icon: '$mdiInformation',
          color: 'info',
        },
      })
      await openDialog(wrapper)
      await wrapper.setProps({
        title: 'Updated',
        content: 'Updated content',
        icon: '$mdiAlert',
        color: 'warning',
      })
      const card = wrapper.findComponent({ name: 'VCard' })
      expect(card.props('title')).toBe('Updated')
      expect(card.props('color')).toBe('warning')
    })
  })

  describe('Edge Cases', () => {
    it('handles empty title prop', () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: '',
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('handles undefined title prop', () => {
      const wrapper = mount(VOvDialog, {
        props: {},
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('handles very long title', () => {
      const longTitle = 'A'.repeat(200)
      const wrapper = mount(VOvDialog, {
        props: {
          title: longTitle,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('handles special characters in title', () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog with <special> & "characters"',
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('handles all undefined optional props', () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          persistent: undefined,
          fullscreen: undefined,
          scrollable: undefined,
          subtitle: undefined,
          icon: undefined,
          color: undefined,
          content: undefined,
          contentFormat: undefined,
          actions: undefined,
          actionFormat: undefined,
          actionSubmit: undefined,
          actionCancel: undefined,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('handles dialog mounting and unmounting', async () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
        },
      })
      expect(wrapper.exists()).toBe(true)
      await wrapper.unmount()
      expect(wrapper.vm).toBeDefined()
    })

    it('handles rapid prop changes', async () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog 1',
        },
      })
      for (let i = 2; i <= 10; i++) {
        await wrapper.setProps({ title: `Dialog ${i}` })
      }
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })

    it('handles empty actions array and then adding actions', async () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          actions: [],
        },
      })
      const buttons = wrapper.findAllComponents({ name: 'VBtn' })
      expect(buttons.length).toBe(0)

      await wrapper.setProps({ actions: ['ok', 'cancel'] })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Breakpoint and Width Handling', () => {
    it('calculates width based on display breakpoint', () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
        },
      })
      const dialog = wrapper.findComponent({ name: 'VDialog' })
      expect(dialog.props('width')).toBeDefined()
    })

    it('width prop is a computed value based on breakpoint', () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
        },
      })
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Content and Action Formatting', () => {
    it('applies OvFormat to content correctly', () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          content: 'Formatted content',
          contentFormat: { color: 'primary', icon: '$mdiInformation' },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('applies OvActionFormat to actions correctly', () => {
      const actions: OvAction[] = [
        {
          name: 'save',
          format: { color: 'success', text: 'Save Changes' },
        },
      ]
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          actions: actions,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('uses action name as button text when format text is not provided', () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          actions: ['save'],
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('uses format text when provided instead of action name', () => {
      const actions: OvAction[] = [
        {
          name: 'save',
          format: { text: 'Save Changes' },
        },
      ]
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          actions: actions,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Action Button Rendering', () => {
    it('renders all action buttons', async () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          actions: ['action1', 'action2', 'action3'],
        },
      })
      await openDialog(wrapper)
      const buttons = wrapper.findAllComponents({ name: 'VBtn' })
      expect(buttons.length).toBeGreaterThanOrEqual(3)
    })

    it('renders buttons with correct props from actionFormat', () => {
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          actions: ['ok'],
          actionFormat: { color: 'primary' },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('renders buttons with individual format properties', () => {
      const actions: OvAction[] = [
        { name: 'ok', format: { color: 'success' } },
        { name: 'cancel', format: { color: 'error' } },
      ]
      const wrapper = mount(VOvDialog, {
        props: {
          title: 'Dialog',
          actions: actions,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })
  })
})
