import { PlsqlExpression, renderPlsql, type PlsqlRenderable } from '../../schema/attribute.js'

function arg(value: PlsqlRenderable | number): string {
  return typeof value === 'number' ? String(value) : renderPlsql(value)
}

function call<T extends string>(
  type: T,
  fn: string,
  args: (PlsqlRenderable | number)[],
): PlsqlExpression<T> {
  return new PlsqlExpression(type, `${fn}(${args.map(arg).join(', ')})`)
}

/** Typed expressions for Oracle SQL built-in functions and pseudocolumns. */
export const odbOracle = {
  /** `RAWTOHEX(<raw>)` -> VARCHAR2 */
  rawToHex(value: PlsqlRenderable): PlsqlExpression<'VARCHAR2'> {
    return call('VARCHAR2', 'RAWTOHEX', [value])
  },

  /** `HEXTORAW(<hex>)` -> RAW */
  hexToRaw(value: PlsqlRenderable): PlsqlExpression<'RAW'> {
    return call('RAW', 'HEXTORAW', [value])
  },

  /** `SYS_GUID()` -> RAW */
  sysGuid(): PlsqlExpression<'RAW'> {
    return new PlsqlExpression('RAW', 'SYS_GUID()')
  },

  /** `SYSTIMESTAMP` -> TIMESTAMP */
  sysTimestamp(): PlsqlExpression<'TIMESTAMP'> {
    return new PlsqlExpression('TIMESTAMP', 'SYSTIMESTAMP')
  },

  /** `LOWER(<value>)` -> VARCHAR2 */
  lower(value: PlsqlRenderable): PlsqlExpression<'VARCHAR2'> {
    return call('VARCHAR2', 'LOWER', [value])
  },

  /** `TRIM(<value>)` -> VARCHAR2 */
  trim(value: PlsqlRenderable): PlsqlExpression<'VARCHAR2'> {
    return call('VARCHAR2', 'TRIM', [value])
  },

  /** `NVL(<value>, <fallback>)` -> VARCHAR2 */
  nvl(value: PlsqlRenderable, fallback: PlsqlRenderable): PlsqlExpression<'VARCHAR2'> {
    return call('VARCHAR2', 'NVL', [value, fallback])
  },

  /** `TO_NUMBER(<value>)` -> NUMBER */
  toNumber(value: PlsqlRenderable): PlsqlExpression<'NUMBER'> {
    return call('NUMBER', 'TO_NUMBER', [value])
  },

  /** `REGEXP_REPLACE(<source>, <pattern>[, <replace>[, <position>[, <occurrence>[, <match_parameter>]]]])` -> VARCHAR2 */
  regexpReplace(
    source: PlsqlRenderable,
    pattern: PlsqlRenderable,
    replace?: PlsqlRenderable,
    position?: PlsqlRenderable | number,
    occurrence?: PlsqlRenderable | number,
    matchParameter?: PlsqlRenderable,
  ): PlsqlExpression<'VARCHAR2'> {
    const args: (PlsqlRenderable | number)[] = [source, pattern]
    if (replace !== undefined) args.push(replace)
    if (position !== undefined) args.push(position)
    if (occurrence !== undefined) args.push(occurrence)
    if (matchParameter !== undefined) args.push(matchParameter)
    return call('VARCHAR2', 'REGEXP_REPLACE', args)
  },

  /** `REGEXP_SUBSTR(<source>, <pattern>[, <position>[, <occurrence>[, <match_parameter>[, <subexpression>]]]])` -> VARCHAR2 */
  regexpSubstr(
    source: PlsqlRenderable,
    pattern: PlsqlRenderable,
    position?: PlsqlRenderable | number,
    occurrence?: PlsqlRenderable | number,
    matchParameter?: PlsqlRenderable,
    subexpression?: PlsqlRenderable | number,
  ): PlsqlExpression<'VARCHAR2'> {
    const args: (PlsqlRenderable | number)[] = [source, pattern]
    if (position !== undefined) args.push(position)
    if (occurrence !== undefined) args.push(occurrence)
    if (matchParameter !== undefined) args.push(matchParameter)
    if (subexpression !== undefined) args.push(subexpression)
    return call('VARCHAR2', 'REGEXP_SUBSTR', args)
  },

  /** `NULL`, for optional Oracle function arguments. */
  null(): PlsqlExpression<'VARCHAR2'> {
    return new PlsqlExpression('VARCHAR2', 'NULL')
  },
}
