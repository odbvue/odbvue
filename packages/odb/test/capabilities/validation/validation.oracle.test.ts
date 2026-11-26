import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { defineSettingsValidation } from '../../../src/capabilities/settings/validation.js'
import { odbValidationPackage } from '../../../src/capabilities/validation/index.js'
import { connect } from '../../../src/execution/oracle.js'
import { splitSqlStatements } from '../../../src/execution/sql.js'
import { odbLiteral } from '../../../src/schema/attribute.js'
import { odbPackage } from '../../../src/schema/package.js'
import { odbOrdsEndpoint } from '../../../src/ords.js'

const connectString = process.env.ODB_TEST_CONNECT_STRING
const wallet = process.env.ODB_TEST_WALLET_DIR
const literal = (text: string | null) => (text === null ? 'NULL' : odbLiteral(text).toSQL())

// Run generated routines in an anonymous block so no installed packages or tables are changed.
function declarations(pkg: { toSQLUp(): string }) {
  const [, body] = splitSqlStatements(pkg.toSQLUp())
  return body.replace(/^CREATE OR REPLACE PACKAGE BODY \w+ AS\s*/i, '').replace(/\nEND \w+;$/, '')
}

const settings = odbPackage('test_settings_validation', (pkg) => {
  defineSettingsValidation(pkg)
  return {}
})

describe.skipIf(!connectString)('validation on Oracle', () => {
  let connection: Awaited<ReturnType<typeof connect>>
  const portableRules = declarations(odbValidationPackage)
  const settingsValidator = declarations(settings)
    .replaceAll('odb_settings_store.meta%TYPE', 'CLOB')
    .replaceAll('odb_validation.', '')

  it('transports a bounded validation envelope through the generated ORDS exception boundary', async () => {
    const handler = odbOrdsEndpoint('test', 'api', 'limited')
      .toNode()
      .source.replace(
        'api.limited();',
        `raise_application_error(-20998, 'ODB_ERROR|VALIDATION_ERROR|VALUE_INVALID|{"errors":[{"name":"value","message":"validation.min","params":{"min":60}}]}');`,
      )
      .replaceAll(':status_code', 'l_status')
    await connection.execute(`DECLARE
  l_status NUMBER;
  l_names owa.vc_arr;
  l_values owa.vc_arr;
  l_lines owa.vc_arr;
  l_count PLS_INTEGER := 100;
  l_json JSON_OBJECT_T;
  l_errors JSON_ARRAY_T;
  l_field JSON_OBJECT_T;
BEGIN
  owa.init_cgi_env(0, l_names, l_values);
  ${handler}
  owa.get_page(l_lines, l_count);
  FOR i IN 1..l_count LOOP
    IF SUBSTR(l_lines(i), 1, 1) = '{' THEN l_json := JSON_OBJECT_T.parse(l_lines(i)); END IF;
  END LOOP;
  IF l_status != 422 OR l_json IS NULL OR l_json.get_string('code') != 'VALUE_INVALID' THEN
    raise_application_error(-20000, 'Incorrect problem response');
  END IF;
  l_errors := l_json.get_array('errors');
  l_field := TREAT(l_errors.get(0) AS JSON_OBJECT_T);
  IF l_field.get_string('name') != 'value' OR l_field.get_string('message') != 'validation.min'
     OR l_field.get_object('params').get_number('min') != 60 THEN
    raise_application_error(-20000, 'Incorrect field details');
  END IF;
END;`)
  })

  beforeAll(async () => {
    connection = await connect({
      connectString,
      user: process.env.ODB_TEST_USER,
      password: process.env.ODB_TEST_PASSWORD,
      configDir: wallet,
      walletLocation: wallet,
      walletPassword: process.env.ODB_TEST_WALLET_PASSWORD,
    })
  }, 30_000)

  afterAll(async () => {
    await connection?.close()
  })

  const assertResults = (checks: [test: string, call: string, expected: boolean][]) =>
    connection.execute(`DECLARE
${portableRules}
  PROCEDURE assert_result(p_test VARCHAR2, p_actual BOOLEAN, p_expected BOOLEAN) IS
  BEGIN
    IF p_actual IS NULL OR p_actual != p_expected THEN
      raise_application_error(-20000, p_test);
    END IF;
  END;
BEGIN
${checks.map(([test, call, expected]) => `  assert_result(${literal(test)}, ${call}, ${expected ? 'TRUE' : 'FALSE'});`).join('\n')}
END;`)

  it('returns a definite result for every portable rule on empty and NULL input', async () => {
    const rules: [rule: Record<string, unknown>, expected: boolean][] = [
      [{ type: 'required' }, false],
      [{ type: 'min-length', params: 0 }, true],
      [{ type: 'min-length', params: 1 }, false],
      [{ type: 'max-length', params: 0 }, true],
      [{ type: 'equals', params: '' }, true],
      [{ type: 'equals', params: 'x' }, false],
      [{ type: 'equals-not', params: '' }, false],
      [{ type: 'equals-not', params: 'x' }, true],
      [{ type: 'greater-than', params: -1 }, false],
      [{ type: 'less-than', params: 1 }, false],
      [{ type: 'in-range', params: [-1, 1] }, false],
      [{ type: 'set', params: [''] }, true],
      [{ type: 'set', params: ['x'] }, false],
    ]
    await assertResults(
      [null, ''].flatMap((value) =>
        rules.map(([rule, expected]) => {
          const json = JSON.stringify(rule)
          return [
            `${JSON.stringify(value)} with ${json}`,
            `check_rule(${literal(value)}, json_object_t.parse(${literal(json)}))`,
            expected,
          ]
        }),
      ),
    )
  })

  it('rejects missing and malformed rule metadata, even after a value matches', async () => {
    const rules = [
      '{}',
      '{"type":null}',
      '{"type":""}',
      '{"type":"unknown"}',
      '{"type":"required","message":null}',
      '{"type":"required","params":null}',
      '{"type":"min-length"}',
      '{"type":"min-length","params":-1}',
      '{"type":"min-length","params":1e126}',
      '{"type":"max-length","params":0.5}',
      '{"type":"equals","params":null}',
      '{"type":"equals-not"}',
      '{"type":"greater-than","params":"0"}',
      '{"type":"greater-than","params":1e126}',
      '{"type":"less-than","params":null}',
      '{"type":"in-range","params":[0]}',
      '{"type":"in-range","params":[null,2]}',
      '{"type":"in-range","params":[0,1e126]}',
      '{"type":"in-range","params":[2,0]}',
      '{"type":"set","params":["1",null]}',
    ]
    await assertResults([
      ['absent rule', "check_rule('1', NULL)", false],
      ...rules.map((rule): [string, string, boolean] => [
        rule,
        `check_rule('1', json_object_t.parse(${literal(rule)}))`,
        false,
      ]),
    ])
  })

  it('checks decimal syntax and port limits without treating blanks as zero', async () => {
    await assertResults([
      ['NULL number', 'is_number(NULL)', false],
      ['empty number', "is_number('')", false],
      ['space', "is_number(' ')", false],
      ['decimal', "is_number('-12.5')", true],
      [
        'inclusive range',
        `check_rule('1', json_object_t.parse('{"type":"in-range","params":[0,1]}'))`,
        true,
      ],
      ['NULL port', 'is_port(NULL)', false],
      ['empty port', "is_port('')", false],
      ['max port', "is_port('65535')", true],
      ['overflow port', "is_port('65536')", false],
      ['absent items', "in_set('', NULL)", false],
    ])
  })

  it.each([
    [null, null, false],
    [null, '{}', true],
    [null, '[]', false],
    ['', '{"type":"number"}', true],
    [null, '{"type":"number","rules":[{"type":"required"}]}', false],
    ['', '{"type":"number","rules":[{"type":"less-than","params":1}]}', false],
    ['1', '{"type":"number","rules":[{"type":"in-range","params":[0,1e126]}]}', false],
    ['abc', '{"type":"number"}', false],
    [null, '{"type":"checkbox"}', false],
    [null, '{"type":"select","items":[""]}', true],
    [null, '{"type":"select"}', false],
    [null, '{"type":"select","items":null}', false],
    ['1', '{"type":null}', false],
    ['1', '{"rules":null}', false],
    ['1', '{"rules":[null]}', false],
    ['1', '{"rules":[{}]}', false],
    ['1', '{"rules":[{"type":"required","message":null}]}', false],
    ['1', '{"rules":[{"type":"custom"}]}', false],
    [null, '{"rules":[{"type":"custom","params":"jwt-secret"}]}', false],
    ['', '{"rules":[{"type":"custom","params":"jwt-issuer"}]}', false],
    ['', '{"rules":[{"type":"custom","params":"port"}]}', false],
    [null, '{"rules":[{"type":"custom","params":"jwt-expiration"}]}', false],
  ])('validates settings value %j against %s (accepted: %s)', async (value, meta, accepted) => {
    const result = connection.execute(`DECLARE
${portableRules}
${settingsValidator}
BEGIN
  validate_setting(${literal(value)}, ${literal(meta)});
END;`)
    if (accepted) await expect(result).resolves.toBeDefined()
    else
      await expect(result).rejects.toThrow('ODB_ERROR|VALIDATION_ERROR|SETTINGS_VALIDATION_INVALID')
  })
})
