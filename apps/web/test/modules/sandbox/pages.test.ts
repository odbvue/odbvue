import { describe, expect, it } from 'vitest'
import { odbVueCapabilities } from '@/modules/sandbox/catalog'

const pages = import.meta.glob<string>('@/modules/sandbox/pages/**/*.vue', {
  eager: true,
  query: '?raw',
  import: 'default',
})

describe('sandbox page metadata', () => {
  it('discovers sandbox pages', () => {
    expect(Object.keys(pages).length).toBeGreaterThan(0)
  })

  it('registers Network ACL in the catalog with its dedicated page', () => {
    expect(odbVueCapabilities.find((capability) => capability.name === 'acl')).toMatchObject({
      kind: 'infrastructure',
      title: 'Network ACL',
      icon: '$mdiShieldLock',
    })
    expect(Object.keys(pages).some((path) => path.endsWith('/capabilities/acl.vue'))).toBe(true)
  })

  it.each(Object.entries(pages))('restricts %s to administrators', (_path, source) => {
    const metadata = source.match(/definePage\(\{\s*meta:\s*\{([\s\S]*?)\n\s*\},?\s*\}\)/)?.[1]
    expect(metadata).toBeDefined()
    expect(metadata).not.toMatch(/\b(?:roles|visibility|hidden):/)
    expect(metadata).toMatch(/\baccess:\s*\[\s*'admin'\s*\]/)
    expect(metadata).toMatch(/\bnavigation:\s*true/)
  })
})
