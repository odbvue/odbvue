import { describe, it, expect } from 'vitest'
import {
  OvRuleValidate,
  OvFieldFormat,
  OvActionFormat,
  OvTextAlign,
  minutesToDuration,
  durationToMinutes,
  isValidDuration,
  camelToKebabCase,
  transformKeysToKebabCase,
} from '../index'

const customRule = (value: unknown) => value === 'ok'

describe('OvRuleValidate', () => {
  it('required - passes for non-empty value', () => {
    expect(OvRuleValidate('hello', 'required', true)).toBe(true)
  })

  it('required - fails for empty string', () => {
    expect(OvRuleValidate('', 'required', true, 'required')).toBe('required')
  })

  it('required - fails for null/undefined', () => {
    expect(OvRuleValidate(null, 'required', true, 'required')).toBe('required')
    expect(OvRuleValidate(undefined, 'required', true, 'required')).toBe('required')
  })

  it('min-length - validates string length', () => {
    expect(OvRuleValidate('abc', 'min-length', 3)).toBe(true)
    expect(OvRuleValidate('ab', 'min-length', 3, 'too short')).toBe('too short')
  })

  it('max-length - validates string length', () => {
    expect(OvRuleValidate('ab', 'max-length', 3)).toBe(true)
    expect(OvRuleValidate('abcd', 'max-length', 3, 'too long')).toBe('too long')
  })

  it('equals - checks exact match', () => {
    expect(OvRuleValidate('abc', 'equals', 'abc')).toBe(true)
    expect(OvRuleValidate('abc', 'equals', 'xyz', 'not equal')).toBe('not equal')
  })

  it('equals-not - checks inequality', () => {
    expect(OvRuleValidate('abc', 'equals-not', 'xyz')).toBe(true)
    expect(OvRuleValidate('abc', 'equals-not', 'abc', 'same')).toBe('same')
  })

  it('starts-with', () => {
    expect(OvRuleValidate('hello world', 'starts-with', 'hello')).toBe(true)
    expect(OvRuleValidate('hello', 'starts-with', 'world', 'nope')).toBe('nope')
  })

  it('ends-with', () => {
    expect(OvRuleValidate('hello world', 'ends-with', 'world')).toBe(true)
    expect(OvRuleValidate('hello', 'ends-with', 'world', 'nope')).toBe('nope')
  })

  it('contains', () => {
    expect(OvRuleValidate('hello world', 'contains', 'lo wo')).toBe(true)
    expect(OvRuleValidate('hello', 'contains', 'xyz', 'missing')).toBe('missing')
  })

  it('greater-than', () => {
    expect(OvRuleValidate(10, 'greater-than', 5)).toBe(true)
    expect(OvRuleValidate(3, 'greater-than', 5, 'too small')).toBe('too small')
  })

  it('less-than', () => {
    expect(OvRuleValidate(3, 'less-than', 5)).toBe(true)
    expect(OvRuleValidate(10, 'less-than', 5, 'too big')).toBe('too big')
  })

  it('in-range', () => {
    expect(OvRuleValidate(5, 'in-range', [1, 10])).toBe(true)
    expect(OvRuleValidate(15, 'in-range', [1, 10], 'out')).toBe('out')
  })

  it('includes', () => {
    expect(OvRuleValidate('b', 'includes', ['a', 'b', 'c'])).toBe(true)
    expect(OvRuleValidate('z', 'includes', ['a', 'b'], 'not in')).toBe('not in')
  })

  it('email', () => {
    expect(OvRuleValidate('user@example.com', 'email', true)).toBe(true)
    expect(OvRuleValidate('not-email', 'email', true, 'invalid')).toBe('invalid')
  })

  it('url', () => {
    expect(OvRuleValidate('https://example.com', 'url', true)).toBe(true)
    expect(OvRuleValidate('not a url!!!', 'url', true, 'invalid')).toBe('invalid')
  })

  it('ip', () => {
    expect(OvRuleValidate('192.168.1.1', 'ip', true)).toBe(true)
    expect(OvRuleValidate('999.999.999.999', 'ip', true, 'invalid')).toBe('invalid')
  })

  it('regexp', () => {
    expect(OvRuleValidate('abc123', 'regexp', '^[a-z]+\\d+$')).toBe(true)
    expect(OvRuleValidate('ABC', 'regexp', '^\\d+$', 'no match')).toBe('no match')
  })

  it('is-json', () => {
    expect(OvRuleValidate('{"a":1}', 'is-json', true)).toBe(true)
    expect(OvRuleValidate('not json', 'is-json', true, 'bad json')).toBe('bad json')
  })

  it('password - 8+ chars with letter and digit', () => {
    expect(OvRuleValidate('Password1', 'password', true)).toBe(true)
    expect(OvRuleValidate('short', 'password', true, 'weak')).toBe('weak')
  })

  it('custom - calls provided function', () => {
    expect(OvRuleValidate('ok', 'custom', customRule)).toBe(true)
    expect(OvRuleValidate('bad', 'custom', customRule, 'fail')).toBe('fail')
  })

  it('returns message when rule is empty', () => {
    expect(OvRuleValidate('x', '', undefined, 'fallback')).toBe('fallback')
  })
})

describe('OvFieldFormat', () => {
  it('returns empty object for undefined format', () => {
    expect(OvFieldFormat('test')).toEqual({})
  })

  it('extracts defined props from format', () => {
    const result = OvFieldFormat('test', { color: 'red', icon: '$mdiStar' })
    expect(result.color).toBe('red')
    expect(result.icon).toBe('$mdiStar')
  })

  it('omits undefined props', () => {
    const result = OvFieldFormat('test', { color: 'blue' })
    expect(result).toEqual({ color: 'blue' })
    expect(result.icon).toBeUndefined()
  })

  it('evaluates format with rules - matching', () => {
    const format = [
      { rules: { type: 'equals' as const, params: 'active' }, color: 'green' },
      { color: 'red' },
    ]
    expect(OvFieldFormat('active', format).color).toBe('green')
  })

  it('evaluates format with rules - fallback', () => {
    const format = [
      { rules: { type: 'equals' as const, params: 'active' }, color: 'green' },
      { color: 'red' },
    ]
    expect(OvFieldFormat('blocked', format).color).toBe('red')
  })
})

describe('OvActionFormat', () => {
  it('handles string action', () => {
    const result = OvActionFormat(undefined, 'submit')
    expect(result).toEqual({ name: 'submit', text: 'submit' })
  })

  it('handles object action with format', () => {
    const result = OvActionFormat(undefined, {
      name: 'edit',
      format: { icon: '$mdiPencil', color: 'primary' },
    }) as Record<string, unknown>
    expect(result.name).toBe('edit')
    expect(result.icon).toBe('$mdiPencil')
    expect(result.color).toBe('primary')
  })

  it('uses action name as text when no icon', () => {
    const result = OvActionFormat(undefined, { name: 'save' })
    expect(result.text).toBe('save')
  })

  it('hides text when icon is present', () => {
    const result = OvActionFormat(undefined, {
      name: 'edit',
      format: { icon: '$mdiPencil' },
    })
    expect(result.text).toBeUndefined()
  })
})

describe('OvTextAlign', () => {
  it('returns text-left for left', () => {
    expect(OvTextAlign('left')).toBe('text-left')
  })

  it('returns text-center for center', () => {
    expect(OvTextAlign('center')).toBe('text-center')
  })

  it('returns empty string for undefined', () => {
    expect(OvTextAlign(undefined)).toBe('')
  })
})

describe('minutesToDuration', () => {
  it('returns empty string for 0/null/undefined', () => {
    expect(minutesToDuration(0)).toBe('')
    expect(minutesToDuration(null)).toBe('')
    expect(minutesToDuration(undefined)).toBe('')
  })

  it('converts minutes to m', () => {
    expect(minutesToDuration(30)).toBe('30m')
  })

  it('converts to hours and minutes', () => {
    expect(minutesToDuration(90)).toBe('1h 30m')
  })

  it('converts to days (8h = 1d)', () => {
    expect(minutesToDuration(480)).toBe('1d')
  })

  it('converts to weeks (40h = 1w)', () => {
    expect(minutesToDuration(2400)).toBe('1w')
  })

  it('handles complex durations', () => {
    // 1w + 2d + 3h + 15m = 2400 + 960 + 180 + 15 = 3555
    expect(minutesToDuration(3555)).toBe('1w 2d 3h 15m')
  })

  it('handles negative values', () => {
    expect(minutesToDuration(-90)).toBe('-1h 30m')
  })
})

describe('durationToMinutes', () => {
  it('returns null for empty/null/undefined', () => {
    expect(durationToMinutes(null)).toBeNull()
    expect(durationToMinutes(undefined)).toBeNull()
    expect(durationToMinutes('')).toBeNull()
  })

  it('parses minutes', () => {
    expect(durationToMinutes('30m')).toBe(30)
  })

  it('parses hours', () => {
    expect(durationToMinutes('2h')).toBe(120)
  })

  it('parses days (1d = 8h = 480m)', () => {
    expect(durationToMinutes('1d')).toBe(480)
  })

  it('parses weeks (1w = 40h = 2400m)', () => {
    expect(durationToMinutes('1w')).toBe(2400)
  })

  it('parses combined duration', () => {
    expect(durationToMinutes('1w 2d 3h 15m')).toBe(3555)
  })

  it('handles negative durations', () => {
    expect(durationToMinutes('-1h 30m')).toBe(-90)
  })

  it('returns null for invalid input', () => {
    expect(durationToMinutes('invalid')).toBeNull()
  })
})

describe('isValidDuration', () => {
  it('returns true for valid durations', () => {
    expect(isValidDuration('1h 30m')).toBe(true)
    expect(isValidDuration('2w 3d')).toBe(true)
  })

  it('returns true for null/undefined/empty (optional field)', () => {
    expect(isValidDuration(null)).toBe(true)
    expect(isValidDuration(undefined)).toBe(true)
    expect(isValidDuration('')).toBe(true)
  })

  it('returns false for invalid input', () => {
    expect(isValidDuration('not a duration')).toBe(false)
  })
})

describe('camelToKebabCase', () => {
  it('converts camelCase to kebab-case', () => {
    expect(camelToKebabCase('myFieldName')).toBe('my-field-name')
  })

  it('handles single word', () => {
    expect(camelToKebabCase('name')).toBe('name')
  })

  it('handles already kebab-case', () => {
    expect(camelToKebabCase('already-kebab')).toBe('already-kebab')
  })
})

describe('transformKeysToKebabCase', () => {
  it('transforms all keys to kebab-case', () => {
    const input = { firstName: 'John', lastName: 'Doe' }
    const result = transformKeysToKebabCase(input)
    expect(result).toEqual({ 'first-name': 'John', 'last-name': 'Doe' })
  })

  it('preserves values', () => {
    const input = { myKey: 42 }
    expect(transformKeysToKebabCase(input)).toEqual({ 'my-key': 42 })
  })
})
