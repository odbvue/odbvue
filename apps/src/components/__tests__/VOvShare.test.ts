import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import VOvShare, { type Share } from '../VOvShare.vue'

// Mock vue-socials components
vi.mock('vue-socials', () => ({
  STwitter: {
    name: 'STwitter',
    template: '<div><slot /></div>',
  },
  SFacebook: {
    name: 'SFacebook',
    template: '<div><slot /></div>',
  },
  SLinkedIn: {
    name: 'SLinkedIn',
    template: '<div><slot /></div>',
  },
  SWhatsApp: {
    name: 'SWhatsApp',
    template: '<div><slot /></div>',
  },
}))

describe('VOvShare', () => {
  beforeEach(() => {
    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(() => Promise.resolve()),
      },
    })
    // Mock document.execCommand - it doesn't exist in jsdom by default
    if (!document.execCommand) {
      document.execCommand = vi.fn(() => true)
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('mounts without error', () => {
      const wrapper = mount(VOvShare)
      expect(wrapper.vm).toBeDefined()
      expect(wrapper.exists()).toBe(true)
    })

    it('renders v-defaults-provider wrapper', () => {
      const wrapper = mount(VOvShare)
      expect(wrapper.findComponent({ name: 'VDefaultsProvider' }).exists()).toBe(true)
    })
  })

  describe('Props - Share', () => {
    it('defaults to all share options', () => {
      const wrapper = mount(VOvShare)
      expect(wrapper.props('share')).toEqual([
        'twitter',
        'facebook',
        'linkedin',
        'whatsapp',
        'copy',
      ])
    })

    it('accepts custom share array', () => {
      const customShare: Share[] = ['twitter', 'facebook']
      const wrapper = mount(VOvShare, {
        props: {
          share: customShare,
        },
      })
      expect(wrapper.props('share')).toEqual(customShare)
    })

    it('accepts empty share array', () => {
      const wrapper = mount(VOvShare, {
        props: {
          share: [],
        },
      })
      expect(wrapper.props('share')).toEqual([])
    })

    it('accepts individual share options', () => {
      const validOptions: Share[] = ['twitter', 'facebook', 'linkedin', 'whatsapp', 'copy']
      validOptions.forEach((option) => {
        const wrapper = mount(VOvShare, {
          props: {
            share: [option],
          },
        })
        expect(wrapper.props('share')).toContain(option)
      })
    })
  })

  describe('Props - Window Features', () => {
    it('accepts windowFeatures prop', () => {
      const windowFeatures = { width: 600, height: 400, top: 100, left: 100 }
      const wrapper = mount(VOvShare, {
        props: {
          windowFeatures,
        },
      })
      expect(wrapper.props('windowFeatures')).toEqual(windowFeatures)
    })

    it('defaults windowFeatures to empty object', () => {
      const wrapper = mount(VOvShare)
      expect(wrapper.props('windowFeatures')).toEqual({ url: '' })
    })

    it('accepts windowFeatures with all properties', () => {
      const windowFeatures = { width: 800, height: 600, top: 50, left: 50 }
      const wrapper = mount(VOvShare, {
        props: {
          windowFeatures,
        },
      })
      const features = wrapper.props('windowFeatures') as typeof windowFeatures
      expect(features.width).toBe(800)
      expect(features.height).toBe(600)
      expect(features.top).toBe(50)
      expect(features.left).toBe(50)
    })
  })

  describe('Props - Share Options', () => {
    it('accepts shareOptions prop', () => {
      const shareOptions = {
        text: 'Check this out!',
        url: 'https://example.com',
        via: 'username',
        hashtags: ['tag1', 'tag2'],
        number: '1234567890',
      }
      const wrapper = mount(VOvShare, {
        props: {
          shareOptions,
        },
      })
      expect(wrapper.props('shareOptions')).toEqual(shareOptions)
    })

    it('defaults shareOptions to empty object', () => {
      const wrapper = mount(VOvShare)
      expect(wrapper.props('shareOptions')).toEqual({ number: '' })
    })

    it('accepts shareOptions with all optional properties', () => {
      const shareOptions = {
        text: 'Share text',
        url: 'https://example.com',
        via: 'twitter_handle',
        hashtags: ['tag1'],
        quote: 'Quote text',
        number: '123456',
      }
      const wrapper = mount(VOvShare, {
        props: {
          shareOptions,
        },
      })
      const options = wrapper.props('shareOptions') as typeof shareOptions
      expect(options.text).toBe('Share text')
      expect(options.url).toBe('https://example.com')
      expect(options.via).toBe('twitter_handle')
      expect(options.hashtags).toContain('tag1')
      expect(options.quote).toBe('Quote text')
      expect(options.number).toBe('123456')
    })
  })

  describe('Props - Behavior', () => {
    it('accepts useNativeBehavior prop as true', () => {
      const wrapper = mount(VOvShare, {
        props: {
          useNativeBehavior: true,
        },
      })
      expect(wrapper.props('useNativeBehavior')).toBe(true)
    })

    it('accepts useNativeBehavior prop as false', () => {
      const wrapper = mount(VOvShare, {
        props: {
          useNativeBehavior: false,
        },
      })
      expect(wrapper.props('useNativeBehavior')).toBe(false)
    })

    it('defaults useNativeBehavior to false', () => {
      const wrapper = mount(VOvShare)
      expect(wrapper.props('useNativeBehavior')).toBe(false)
    })
  })

  describe('Props - Button Styling', () => {
    it('accepts variant prop', () => {
      const variants: Array<'flat' | 'text' | 'elevated' | 'tonal' | 'outlined' | 'plain'> = [
        'flat',
        'text',
        'elevated',
        'tonal',
        'outlined',
        'plain',
      ]
      variants.forEach((variant) => {
        const wrapper = mount(VOvShare, {
          props: {
            variant,
          },
        })
        expect(wrapper.props('variant')).toBe(variant)
      })
    })

    it('defaults variant to undefined', () => {
      const wrapper = mount(VOvShare)
      expect(wrapper.props('variant')).toBeUndefined()
    })

    it('accepts density prop', () => {
      const densities: Array<'default' | 'comfortable' | 'compact'> = [
        'default',
        'comfortable',
        'compact',
      ]
      densities.forEach((density) => {
        const wrapper = mount(VOvShare, {
          props: {
            density,
          },
        })
        expect(wrapper.props('density')).toBe(density)
      })
    })

    it('defaults density to undefined', () => {
      const wrapper = mount(VOvShare)
      expect(wrapper.props('density')).toBeUndefined()
    })

    it('accepts color prop', () => {
      const wrapper = mount(VOvShare, {
        props: {
          color: 'primary',
        },
      })
      expect(wrapper.props('color')).toBe('primary')
    })

    it('defaults color to undefined', () => {
      const wrapper = mount(VOvShare)
      expect(wrapper.props('color')).toBeUndefined()
    })
  })

  describe('Social Media Components Rendering', () => {
    it('renders Twitter button when twitter is in share array', () => {
      const wrapper = mount(VOvShare, {
        props: {
          share: ['twitter'],
        },
      })
      expect(wrapper.findComponent({ name: 'STwitter' }).exists()).toBe(true)
    })

    it('does not render Twitter button when twitter is not in share array', () => {
      const wrapper = mount(VOvShare, {
        props: {
          share: ['facebook'],
        },
      })
      expect(wrapper.findComponent({ name: 'STwitter' }).exists()).toBe(false)
    })

    it('renders Facebook button when facebook is in share array', () => {
      const wrapper = mount(VOvShare, {
        props: {
          share: ['facebook'],
        },
      })
      expect(wrapper.findComponent({ name: 'SFacebook' }).exists()).toBe(true)
    })

    it('does not render Facebook button when facebook is not in share array', () => {
      const wrapper = mount(VOvShare, {
        props: {
          share: ['twitter'],
        },
      })
      expect(wrapper.findComponent({ name: 'SFacebook' }).exists()).toBe(false)
    })

    it('renders LinkedIn button when linkedin is in share array', () => {
      const wrapper = mount(VOvShare, {
        props: {
          share: ['linkedin'],
        },
      })
      expect(wrapper.findComponent({ name: 'SLinkedIn' }).exists()).toBe(true)
    })

    it('does not render LinkedIn button when linkedin is not in share array', () => {
      const wrapper = mount(VOvShare, {
        props: {
          share: ['twitter'],
        },
      })
      expect(wrapper.findComponent({ name: 'SLinkedIn' }).exists()).toBe(false)
    })

    it('renders WhatsApp button when whatsapp is in share array', () => {
      const wrapper = mount(VOvShare, {
        props: {
          share: ['whatsapp'],
        },
      })
      expect(wrapper.findComponent({ name: 'SWhatsApp' }).exists()).toBe(true)
    })

    it('does not render WhatsApp button when whatsapp is not in share array', () => {
      const wrapper = mount(VOvShare, {
        props: {
          share: ['twitter'],
        },
      })
      expect(wrapper.findComponent({ name: 'SWhatsApp' }).exists()).toBe(false)
    })

    it('renders all social media buttons when all are in share array', () => {
      const wrapper = mount(VOvShare, {
        props: {
          share: ['twitter', 'facebook', 'linkedin', 'whatsapp'],
        },
      })
      expect(wrapper.findComponent({ name: 'STwitter' }).exists()).toBe(true)
      expect(wrapper.findComponent({ name: 'SFacebook' }).exists()).toBe(true)
      expect(wrapper.findComponent({ name: 'SLinkedIn' }).exists()).toBe(true)
      expect(wrapper.findComponent({ name: 'SWhatsApp' }).exists()).toBe(true)
    })

    it('renders no social media buttons when share array is empty', () => {
      const wrapper = mount(VOvShare, {
        props: {
          share: [],
        },
      })
      expect(wrapper.findComponent({ name: 'STwitter' }).exists()).toBe(false)
      expect(wrapper.findComponent({ name: 'SFacebook' }).exists()).toBe(false)
      expect(wrapper.findComponent({ name: 'SLinkedIn' }).exists()).toBe(false)
      expect(wrapper.findComponent({ name: 'SWhatsApp' }).exists()).toBe(false)
    })
  })

  describe('Copy Button', () => {
    it('renders copy button when copy is in share array', () => {
      const wrapper = mount(VOvShare, {
        props: {
          share: ['copy'],
        },
      })
      const copyBtn = wrapper.find('[data-cy="v-bsb-share-copy"]')
      expect(copyBtn.exists()).toBe(true)
    })

    it('does not render copy button when copy is not in share array', () => {
      const wrapper = mount(VOvShare, {
        props: {
          share: ['twitter'],
        },
      })
      const copyBtn = wrapper.find('[data-cy="v-bsb-share-copy"]')
      expect(copyBtn.exists()).toBe(false)
    })

    it('copy button has data-cy attribute when rendered', () => {
      const wrapper = mount(VOvShare, {
        props: {
          share: ['copy'],
        },
      })
      const copyBtn = wrapper.find('[data-cy="v-bsb-share-copy"]')
      expect(copyBtn.exists()).toBe(true)
      expect(copyBtn.attributes('data-cy')).toBe('v-bsb-share-copy')
    })

    it('copy button is clickable', () => {
      const wrapper = mount(VOvShare, {
        props: {
          share: ['copy'],
        },
      })
      const copyBtn = wrapper.find('[data-cy="v-bsb-share-copy"]')
      expect(copyBtn.exists()).toBe(true)
    })
  })

  describe('Copy to Clipboard Functionality', () => {
    it('copies text to clipboard when copy button is clicked', async () => {
      const wrapper = mount(VOvShare, {
        props: {
          share: ['copy'],
          shareOptions: {
            text: 'Text to copy',
            url: 'https://example.com',
            number: '123',
          },
        },
      })
      const copyBtn = wrapper.find('[data-cy="v-bsb-share-copy"]')
      await copyBtn.trigger('click')
      await flushPromises()
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Text to copy')
    })

    it('copies empty string when shareOptions.text is not provided', async () => {
      const wrapper = mount(VOvShare, {
        props: {
          share: ['copy'],
          shareOptions: {
            url: 'https://example.com',
            number: '123',
          },
        },
      })
      const copyBtn = wrapper.find('[data-cy="v-bsb-share-copy"]')
      await copyBtn.trigger('click')
      await flushPromises()
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('')
    })

    it('uses fallback method when navigator.clipboard is not available', async () => {
      // Mock missing clipboard
      const originalClipboard = navigator.clipboard
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
      })

      const wrapper = mount(VOvShare, {
        props: {
          share: ['copy'],
          shareOptions: {
            text: 'Fallback copy test',
            url: 'https://example.com',
            number: '123',
          },
        },
      })
      const copyBtn = wrapper.find('[data-cy="v-bsb-share-copy"]')
      await copyBtn.trigger('click')
      await flushPromises()
      expect(document.execCommand).toHaveBeenCalledWith('copy')

      // Restore clipboard
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        writable: true,
      })
    })

    it('handles clipboard API errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn(() => Promise.reject(new Error('Clipboard error'))),
        },
      })

      const wrapper = mount(VOvShare, {
        props: {
          share: ['copy'],
          shareOptions: {
            text: 'Error test',
            url: 'https://example.com',
            number: '123',
          },
        },
      })
      const copyBtn = wrapper.find('[data-cy="v-bsb-share-copy"]')
      await copyBtn.trigger('click')
      await flushPromises()
      expect(consoleErrorSpy).toHaveBeenCalled()
      consoleErrorSpy.mockRestore()
    })
  })

  describe('Social Media Button Icons', () => {
    it('Twitter button element exists when twitter is in share array', async () => {
      const wrapper = mount(VOvShare, {
        props: {
          share: ['twitter'],
        },
      })
      await flushPromises()
      const twitterBtn = wrapper.find('[data-cy="v-bsb-share-twitter"]')
      expect(twitterBtn.exists()).toBe(true)
    })

    it('Facebook button element exists when facebook is in share array', async () => {
      const wrapper = mount(VOvShare, {
        props: {
          share: ['facebook'],
        },
      })
      await flushPromises()
      const facebookBtn = wrapper.find('[data-cy="v-bsb-share-facebook"]')
      expect(facebookBtn.exists()).toBe(true)
    })

    it('LinkedIn button element exists when linkedin is in share array', async () => {
      const wrapper = mount(VOvShare, {
        props: {
          share: ['linkedin'],
        },
      })
      await flushPromises()
      const linkedInBtn = wrapper.find('[data-cy="v-bsb-share-linkedin"]')
      expect(linkedInBtn.exists()).toBe(true)
    })

    it('WhatsApp button element exists when whatsapp is in share array', async () => {
      const wrapper = mount(VOvShare, {
        props: {
          share: ['whatsapp'],
        },
      })
      await flushPromises()
      const whatsappBtn = wrapper.find('[data-cy="v-bsb-share-whatsapp"]')
      expect(whatsappBtn.exists()).toBe(true)
    })
  })

  describe('V-Defaults-Provider Props', () => {
    it('passes variant to v-defaults-provider when defined', () => {
      const wrapper = mount(VOvShare, {
        props: {
          variant: 'flat',
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('passes density to v-defaults-provider when defined', () => {
      const wrapper = mount(VOvShare, {
        props: {
          density: 'compact',
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('passes color to v-defaults-provider when defined', () => {
      const wrapper = mount(VOvShare, {
        props: {
          color: 'error',
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('passes all styling props to v-defaults-provider', () => {
      const wrapper = mount(VOvShare, {
        props: {
          variant: 'outlined',
          density: 'comfortable',
          color: 'warning',
        },
      })
      expect(wrapper.props('variant')).toBe('outlined')
      expect(wrapper.props('density')).toBe('comfortable')
      expect(wrapper.props('color')).toBe('warning')
    })
  })

  describe('Props Passing to Social Components', () => {
    it('passes windowFeatures to social media components', () => {
      const windowFeatures = { width: 700, height: 500, top: 75, left: 75 }
      const wrapper = mount(VOvShare, {
        props: {
          share: ['twitter', 'facebook'],
          windowFeatures,
        },
      })
      expect(wrapper.props('windowFeatures')).toEqual(windowFeatures)
    })

    it('passes shareOptions to social media components', () => {
      const shareOptions = {
        text: 'Shared text',
        url: 'https://example.com',
        via: 'handle',
        hashtags: ['test'],
        number: '999',
      }
      const wrapper = mount(VOvShare, {
        props: {
          share: ['twitter'],
          shareOptions,
        },
      })
      expect(wrapper.props('shareOptions')).toEqual(shareOptions)
    })

    it('passes useNativeBehavior to social media components', () => {
      const wrapper = mount(VOvShare, {
        props: {
          share: ['facebook', 'linkedin'],
          useNativeBehavior: true,
        },
      })
      expect(wrapper.props('useNativeBehavior')).toBe(true)
    })
  })

  describe('Data Attributes for Testing', () => {
    it('Twitter button has data-cy attribute', () => {
      const wrapper = mount(VOvShare, {
        props: {
          share: ['twitter'],
        },
      })
      const twitterBtn = wrapper.find('[data-cy="v-bsb-share-twitter"]')
      expect(twitterBtn.attributes('data-cy')).toBe('v-bsb-share-twitter')
    })

    it('Facebook button has data-cy attribute', () => {
      const wrapper = mount(VOvShare, {
        props: {
          share: ['facebook'],
        },
      })
      const facebookBtn = wrapper.find('[data-cy="v-bsb-share-facebook"]')
      expect(facebookBtn.attributes('data-cy')).toBe('v-bsb-share-facebook')
    })

    it('LinkedIn button has data-cy attribute', () => {
      const wrapper = mount(VOvShare, {
        props: {
          share: ['linkedin'],
        },
      })
      const linkedInBtn = wrapper.find('[data-cy="v-bsb-share-linkedin"]')
      expect(linkedInBtn.attributes('data-cy')).toBe('v-bsb-share-linkedin')
    })

    it('WhatsApp button has data-cy attribute', () => {
      const wrapper = mount(VOvShare, {
        props: {
          share: ['whatsapp'],
        },
      })
      const whatsappBtn = wrapper.find('[data-cy="v-bsb-share-whatsapp"]')
      expect(whatsappBtn.attributes('data-cy')).toBe('v-bsb-share-whatsapp')
    })

    it('Copy button has data-cy attribute', () => {
      const wrapper = mount(VOvShare, {
        props: {
          share: ['copy'],
        },
      })
      const copyBtn = wrapper.find('[data-cy="v-bsb-share-copy"]')
      expect(copyBtn.attributes('data-cy')).toBe('v-bsb-share-copy')
    })
  })

  describe('Mounting and Unmounting', () => {
    it('mounts and initializes correctly', async () => {
      const wrapper = mount(VOvShare, {
        props: {
          share: ['twitter', 'facebook', 'linkedin', 'whatsapp', 'copy'],
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
      expect(wrapper.exists()).toBe(true)
    })

    it('can be unmounted without errors', async () => {
      const wrapper = mount(VOvShare)
      await wrapper.unmount()
      expect(wrapper).toBeDefined()
    })
  })

  describe('Props Updates', () => {
    it('updates share prop dynamically', async () => {
      const wrapper = mount(VOvShare, {
        props: {
          share: ['twitter'],
        },
      })
      expect(wrapper.findComponent({ name: 'STwitter' }).exists()).toBe(true)
      expect(wrapper.findComponent({ name: 'SFacebook' }).exists()).toBe(false)

      await wrapper.setProps({ share: ['facebook'] })
      expect(wrapper.findComponent({ name: 'STwitter' }).exists()).toBe(false)
      expect(wrapper.findComponent({ name: 'SFacebook' }).exists()).toBe(true)
    })

    it('updates variant prop dynamically', async () => {
      const wrapper = mount(VOvShare, {
        props: {
          variant: 'flat',
        },
      })
      expect(wrapper.props('variant')).toBe('flat')

      await wrapper.setProps({ variant: 'outlined' })
      expect(wrapper.props('variant')).toBe('outlined')
    })

    it('updates density prop dynamically', async () => {
      const wrapper = mount(VOvShare, {
        props: {
          density: 'default',
        },
      })
      expect(wrapper.props('density')).toBe('default')

      await wrapper.setProps({ density: 'compact' })
      expect(wrapper.props('density')).toBe('compact')
    })

    it('updates color prop dynamically', async () => {
      const wrapper = mount(VOvShare, {
        props: {
          color: 'primary',
        },
      })
      expect(wrapper.props('color')).toBe('primary')

      await wrapper.setProps({ color: 'secondary' })
      expect(wrapper.props('color')).toBe('secondary')
    })

    it('updates shareOptions prop dynamically', async () => {
      const initialOptions = {
        text: 'Initial text',
        url: 'https://initial.com',
        number: '111',
      }
      const wrapper = mount(VOvShare, {
        props: {
          shareOptions: initialOptions,
        },
      })
      expect(wrapper.props('shareOptions')).toEqual(initialOptions)

      const newOptions = {
        text: 'New text',
        url: 'https://new.com',
        number: '222',
      }
      await wrapper.setProps({ shareOptions: newOptions })
      expect(wrapper.props('shareOptions')).toEqual(newOptions)
    })

    it('updates windowFeatures prop dynamically', async () => {
      const initialFeatures = { width: 600, height: 400, top: 100, left: 100 }
      const wrapper = mount(VOvShare, {
        props: {
          windowFeatures: initialFeatures,
        },
      })
      expect(wrapper.props('windowFeatures')).toEqual(initialFeatures)

      const newFeatures = { width: 800, height: 600, top: 50, left: 50 }
      await wrapper.setProps({ windowFeatures: newFeatures })
      expect(wrapper.props('windowFeatures')).toEqual(newFeatures)
    })
  })

  describe('Edge Cases', () => {
    it('handles props with undefined values gracefully', () => {
      const wrapper = mount(VOvShare, {
        props: {
          variant: undefined,
          density: undefined,
          color: undefined,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('handles empty text in shareOptions when copying', async () => {
      const wrapper = mount(VOvShare, {
        props: {
          share: ['copy'],
          shareOptions: {
            url: 'https://example.com',
            number: '123',
          },
        },
      })
      const copyBtn = wrapper.find('[data-cy="v-bsb-share-copy"]')
      await copyBtn.trigger('click')
      await flushPromises()
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('')
    })

    it('handles multiple rapid copy clicks', async () => {
      const wrapper = mount(VOvShare, {
        props: {
          share: ['copy'],
          shareOptions: {
            text: 'Test',
            url: 'https://example.com',
            number: '123',
          },
        },
      })
      const copyBtn = wrapper.find('[data-cy="v-bsb-share-copy"]')
      await copyBtn.trigger('click')
      await copyBtn.trigger('click')
      await copyBtn.trigger('click')
      await flushPromises()
      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(3)
    })

    it('handles share array with duplicate values', () => {
      const wrapper = mount(VOvShare, {
        props: {
          share: ['twitter', 'twitter', 'facebook'],
        },
      })
      const twitterCount = wrapper.findAllComponents({ name: 'STwitter' }).length
      expect(twitterCount).toBeGreaterThan(0)
    })
  })

  describe('Integration Tests', () => {
    it('renders complete share component with all default options', () => {
      const wrapper = mount(VOvShare)
      expect(wrapper.findComponent({ name: 'STwitter' }).exists()).toBe(true)
      expect(wrapper.findComponent({ name: 'SFacebook' }).exists()).toBe(true)
      expect(wrapper.findComponent({ name: 'SLinkedIn' }).exists()).toBe(true)
      expect(wrapper.findComponent({ name: 'SWhatsApp' }).exists()).toBe(true)
      expect(wrapper.find('[data-cy="v-bsb-share-copy"]').exists()).toBe(true)
    })

    it('renders custom configuration with specific social media and styling', () => {
      const wrapper = mount(VOvShare, {
        props: {
          share: ['twitter', 'facebook'],
          variant: 'outlined',
          density: 'compact',
          color: 'primary',
          shareOptions: {
            text: 'Check this out',
            url: 'https://example.com',
            number: '555',
          },
        },
      })
      expect(wrapper.findComponent({ name: 'STwitter' }).exists()).toBe(true)
      expect(wrapper.findComponent({ name: 'SFacebook' }).exists()).toBe(true)
      expect(wrapper.findComponent({ name: 'SLinkedIn' }).exists()).toBe(false)
      expect(wrapper.props('variant')).toBe('outlined')
      expect(wrapper.props('density')).toBe('compact')
      expect(wrapper.props('color')).toBe('primary')
    })

    it('supports minimal configuration', () => {
      const wrapper = mount(VOvShare, {
        props: {
          share: ['copy'],
        },
      })
      expect(wrapper.find('[data-cy="v-bsb-share-copy"]').exists()).toBe(true)
      expect(wrapper.findComponent({ name: 'STwitter' }).exists()).toBe(false)
    })
  })
})
