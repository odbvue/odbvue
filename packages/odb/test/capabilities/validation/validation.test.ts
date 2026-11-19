import { describe, expect, it } from 'vitest'
import { odbValidation, odbValidationPackage } from '../../../src/capabilities/validation/index.js'
import { cond, odbLiteral } from '../../../src/schema/attribute.js'
import { odbPackage, odbType } from '../../../src/schema/package.js'
import { odbJson } from '../../../src/oracle/index.js'

describe('shared validation capability', () => {
  const sql = odbValidation.toSQLUp({ schema: 'APP' })

  it('exposes typed calls and contains no raw PL/SQL statements', () => {
    expect(odbValidation.checkRule('p_value', 'l_rule').toSQL()).toBe(
      'odb_validation.check_rule(p_value, l_rule)',
    )
    expect(odbValidation.inSet('p_value', 'l_items').toSQL()).toBe(
      'odb_validation.in_set(p_value, l_items)',
    )
    expect(odbValidation.isNumber(odbLiteral('12.5')).toSQL()).toBe(
      "odb_validation.is_number('12.5')",
    )
    expect(odbValidation.isPort('p_port').toSQL()).toBe('odb_validation.is_port(p_port)')
    expect(JSON.stringify(odbValidationPackage.application())).not.toContain('"kind":"raw"')
    expect(odbValidation.toSQLDown({ schema: 'APP' })).toContain('DROP PACKAGE APP.odb_validation')
  })

  it('rejects malformed, unsupported and non-matching rules and validates the whole set', () => {
    for (const rule of [
      'required',
      'min-length',
      'max-length',
      'equals',
      'equals-not',
      'greater-than',
      'less-than',
      'in-range',
      'set',
    ]) {
      expect(sql).toContain(`'${rule}'`)
    }
    expect(sql).toMatch(/IF p_rule IS NULL THEN\s+RETURN FALSE;/)
    expect(sql).toMatch(/ELSE\s+RETURN FALSE;\s+END CASE;/)
    expect(sql).toContain('l_params.get_size() != 2')
    expect(sql).toContain('l_element.is_number() = FALSE')
    expect(sql).toContain('l_element.is_string() = FALSE')
    expect(sql).toContain('p_value IS NULL AND l_text IS NULL')
    expect(sql).toContain('NVL(LENGTH2(p_value), 0)')
    expect(sql).toContain(
      "TO_NUMBER(p_value, '999999999999999D9999999999', 'NLS_NUMERIC_CHARACTERS=''.,''')",
    )
    expect(sql).toContain('WHEN VALUE_ERROR THEN')
    expect(sql).toContain('WHEN INVALID_NUMBER THEN')
    expect(sql).toContain("REGEXP_LIKE(p_value, '^[0-9]{1,5}$', 'c')")
    expect(sql).toContain('l_port >= 1 AND l_port <= 65535')
  })

  it('lets another mutation map a failed portable rule to its own validation error', () => {
    const mutation = odbPackage('pck_example', (pkg) => {
      const update = pkg.proc(
        'update_name',
        { in: { name: odbType.string(200) } },
        ({ params, body }) => {
          const { rule } = body.variables({ rule: odbJson.object })
          body.set(rule, odbJson.parse(odbLiteral('{"type":"min-length","params":3}')))
          body.ifThen(cond.eq(odbValidation.checkRule(params.name, rule), false), (invalid) =>
            invalid.invalid('NAME_INVALID'),
          )
        },
      )
      return { update }
    })
    const generated = mutation.toSQLUp()
    expect(generated).toMatch(
      /odb_validation\.check_rule\(p_name, l_rule\) = FALSE THEN\s+raise_application_error\(-20998, 'ODB_ERROR\|VALIDATION_ERROR\|NAME_INVALID'\)/,
    )
    expect(generated).not.toContain('odb_settings')
  })
})
