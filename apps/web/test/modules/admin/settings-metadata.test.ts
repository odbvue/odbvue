import { describe, expect, it } from 'vitest'
import { OvRuleValidate } from '@/components/api'
import { settingField } from '@/modules/admin/pages/settings/metadata'

function validates(meta: unknown, value: unknown, secret = false) {
  const field = settingField(meta, secret)
  return (field.rules ?? []).every((rule) => OvRuleValidate(value, rule.type, rule.params) === true)
}

describe('settings metadata', () => {
  it('creates typed fields and rejects unsupported metadata', () => {
    expect(settingField({ type: 'number' }, false).type).toBe('number')
    expect(settingField({ type: 'select', items: ['Y', 'N'] }, false)).toMatchObject({
      type: 'select',
      items: ['Y', 'N'],
    })
    expect(settingField({ type: 'number' }, true)).toMatchObject({
      type: 'password',
      name: 'replacement',
      value: '',
    })
    expect(() => settingField({ type: 'file' }, false)).toThrow('admin.settingMetadataError')
    expect(() => settingField({ rules: [{ type: 'custom', params: 'unknown' }] }, false)).toThrow(
      'admin.settingMetadataError',
    )
  })

  it('enforces portable and named validation rules including switch values', () => {
    const meta = {
      type: 'number',
      rules: [{ type: 'required' }, { type: 'in-range', params: [1, 10] }],
    }
    expect(validates(meta, '5')).toBe(true)
    expect(validates(meta, '11')).toBe(false)
    expect(validates(meta, '1e1')).toBe(false)
    expect(validates(meta, '')).toBe(false)
    expect(
      validates(
        { rules: [{ type: 'greater-than', params: 999999999999999.1 }] },
        '999999999999999.11',
      ),
    ).toBe(true)
    expect(validates({ type: 'select', items: ['', 'one'] }, '')).toBe(true)
    expect(validates({ type: 'select', items: ['one'] }, 'other')).toBe(false)
    expect(validates({ type: 'switch' }, '')).toBe(false)
    expect(validates({ type: 'switch', rules: [{ type: 'set', params: ['Y'] }] }, true)).toBe(true)
    expect(validates({ type: 'switch', rules: [{ type: 'set', params: ['Y'] }] }, false)).toBe(
      false,
    )
    expect(
      validates({ rules: [{ type: 'custom', params: 'jwt-secret' }] }, 'a'.repeat(64), true),
    ).toBe(true)
    expect(validates({ rules: [{ type: 'custom', params: 'jwt-secret' }] }, '********', true)).toBe(
      false,
    )
  })
})
