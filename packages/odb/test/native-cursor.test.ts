import { describe, expect, it } from 'vitest'
import { OrdsEndpoint, type OrdsResultColumnNode } from '../src/ords.js'

const columns: OrdsResultColumnNode[] = [
  { name: 'severity_text', type: 'string', nullable: false },
  { name: 'event_timestamp', type: 'timestamp', nullable: true },
  { name: 'observed_date', type: 'date', nullable: true },
  { name: 'attempt_count', type: 'number', nullable: true },
  { name: 'attributes', type: 'json', nullable: true },
]

describe('native cursor JSON responses', () => {
  it('serializes numeric boolean columns as JSON booleans, preserving nulls', () => {
    const source = new OrdsEndpoint('probe', 'pck_probe', 'list')
      .param(
        'P_ITEMS',
        'OUT',
        'RESULTSET',
        undefined,
        [{ name: 'enabled', type: 'boolean', nullable: true }],
        'resultset',
        'items',
      )
      .toNode().source
    expect(source).toContain('v_output_0_column_0 NUMBER(1);')
    expect(source).toContain(
      "'enabled' VALUE CASE v_output_0_column_0 WHEN 1 THEN 'true' WHEN 0 THEN 'false' ELSE 'null' END FORMAT JSON",
    )
  })

  it('serializes cursor rows after the call and before headers, preserving nulls and value types', () => {
    const endpoint = new OrdsEndpoint('probe', 'pck_probe', 'list')
      .param('P_ITEMS', 'OUT', 'RESULTSET', undefined, columns, 'resultset', 'items')
      .param('P_TOTAL', 'OUT', 'INT', undefined, undefined, 'number', 'total')
      .param(
        'P_CACHE_CONTROL',
        'OUT',
        'STRING',
        undefined,
        undefined,
        'string',
        'Cache-Control',
        'HEADER',
      )
    const source = endpoint.toNode().source
    expect(source).toContain('v_output_0_array JSON_ARRAY_T := JSON_ARRAY_T();')
    expect(source).toContain('v_output_0_column_0 VARCHAR2(32767 CHAR);')
    expect(source).toContain('v_output_0_column_1 TIMESTAMP(6);')
    expect(source).toContain('v_output_0_column_2 DATE;')
    expect(source).toContain('v_output_0_column_3 NUMBER;')
    expect(source).toContain('v_output_0_column_4 CLOB;')
    expect(source).toContain("'severityText' VALUE v_output_0_column_0")
    expect(source).toContain("'eventTimestamp' VALUE TO_CHAR(v_output_0_column_1")
    expect(source).toContain("'observedDate' VALUE TO_CHAR(v_output_0_column_2")
    expect(source).toContain("'attemptCount' VALUE v_output_0_column_3")
    expect(source).toContain("'attributes' VALUE v_output_0_column_4 NULL ON NULL")
    expect(source).toContain("'items' VALUE v_output_0_json FORMAT JSON, 'total' VALUE v_output_1")
    expect(source).toContain("htp.p('Cache-Control: ' || v_output_2)")
    expect(source.indexOf('LOOP FETCH')).toBeGreaterThan(source.indexOf('BEGIN pck_probe.list('))
    expect(source.indexOf('CLOSE v_output_0;')).toBeLessThan(
      source.indexOf('owa_util.mime_header('),
    )
    expect(source).toContain(
      'EXCEPTION WHEN OTHERS THEN IF v_output_0%ISOPEN THEN CLOSE v_output_0; END IF;',
    )
    expect(endpoint.toSQLUp()).not.toContain("p_param_type         => 'RESULTSET'")
  })

  it('initializes and closes each cursor independently for multiple result arrays', () => {
    const source = new OrdsEndpoint('probe', 'pck_probe', 'list')
      .param('P_FIRST', 'OUT', 'RESULTSET', undefined, columns, 'resultset', 'first')
      .param('P_SECOND', 'OUT', 'RESULTSET', undefined, columns, 'resultset', 'second')
      .toNode().source
    for (const index of [0, 1]) {
      expect(source).toContain(`v_output_${index}_array JSON_ARRAY_T := JSON_ARRAY_T();`)
      expect(source).toContain(`EXIT WHEN v_output_${index}%NOTFOUND;`)
      expect(source).toContain(`CLOSE v_output_${index};`)
      expect(source).toContain(`IF v_output_${index}%ISOPEN THEN CLOSE v_output_${index}; END IF;`)
    }
    expect(source).toContain(
      "'first' VALUE v_output_0_json FORMAT JSON, 'second' VALUE v_output_1_json FORMAT JSON",
    )
  })

  it('leaves untyped and binary cursor transport unchanged', () => {
    const selections: Array<OrdsResultColumnNode[] | undefined> = [
      undefined,
      [{ name: 'payload', type: 'blob', nullable: true }],
    ]
    for (const resultColumns of selections) {
      const endpoint = new OrdsEndpoint('probe', 'pck_probe', 'list').param(
        'P_ITEMS',
        'OUT',
        'RESULTSET',
        undefined,
        resultColumns,
        'resultset',
        'items',
      )
      expect(endpoint.toNode().source).toContain('p_items => :items')
      expect(endpoint.toNode().source).not.toContain('JSON_ARRAY_T')
      expect(endpoint.toSQLUp()).toContain("p_param_type         => 'RESULTSET'")
    }
  })
})
