import { describe, expect, it } from 'vitest'
import { odbUtlI18n } from '../../../src/packages/oracle/utl-i18n.js'
import { odbLiteral } from '../../../src/schema/attribute.js'

describe('odbUtlI18n', () => {
  it('stringToRaw renders a typed RAW expression', () => {
    const expression = odbUtlI18n.stringToRaw('p_password', odbLiteral('AL32UTF8'))
    expect(expression.toSQL()).toBe("UTL_I18N.STRING_TO_RAW(p_password, 'AL32UTF8')")
    expect(expression.type).toBe('RAW')
  })
})
