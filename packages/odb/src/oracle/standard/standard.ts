import {
  plsqlExpr,
  PlsqlExpression,
  renderPlsql,
  type PlsqlBooleanExpression,
  type PlsqlRenderable,
  type PlsqlType,
} from '../../schema/attribute.js'

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

export type RegexpSubstrOptions = {
  position?: PlsqlRenderable | number
  occurrence?: PlsqlRenderable | number
  matchParameter?: PlsqlRenderable
  subexpression?: PlsqlRenderable | number
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

  /** `STANDARD_HASH(<value>, <algorithm>)` -> VARCHAR2 */
  standardHash(value: PlsqlRenderable, algorithm: PlsqlRenderable): PlsqlExpression<'VARCHAR2'> {
    return call('VARCHAR2', 'STANDARD_HASH', [value, algorithm])
  },

  /** `TRIM(<value>)` -> VARCHAR2 */
  trim(value: PlsqlRenderable): PlsqlExpression<'VARCHAR2'> {
    return call('VARCHAR2', 'TRIM', [value])
  },

  /** `NVL(<value>, <fallback>)` retains the first argument's type. */
  nvl<T extends PlsqlType | string>(
    value: import('../../schema/attribute.js').PlsqlValue<T>,
    fallback: PlsqlRenderable,
  ): PlsqlExpression<T> {
    return call(value.type, 'NVL', [value, fallback])
  },

  interval: {
    days(value: PlsqlRenderable | number): PlsqlExpression<'INTERVAL DAY TO SECOND'> {
      return plsqlExpr.interval(value, 'DAY')
    },
    seconds(value: PlsqlRenderable | number): PlsqlExpression<'INTERVAL DAY TO SECOND'> {
      return plsqlExpr.interval(value, 'SECOND')
    },
  },

  plus<T extends PlsqlType | string>(
    left: import('../../schema/attribute.js').PlsqlValue<T>,
    right: PlsqlRenderable | number,
  ): PlsqlExpression<T> {
    return plsqlExpr.add(left, right)
  },

  minus(
    left: PlsqlRenderable | number,
    right: PlsqlRenderable | number,
  ): PlsqlExpression<'NUMBER'> {
    return plsqlExpr.subtract(left, right)
  },

  caseWhen<T extends PlsqlType | string>(
    condition: PlsqlBooleanExpression,
    whenTrue: PlsqlRenderable,
    whenFalse: PlsqlRenderable,
    type: T,
  ): PlsqlExpression<T> {
    return new PlsqlExpression(
      type,
      `CASE WHEN ${condition.toSQL()} THEN ${renderPlsql(whenTrue)} ELSE ${renderPlsql(whenFalse)} END`,
    )
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

  /** `REGEXP_SUBSTR(<source>, <pattern>[, options])` -> VARCHAR2 */
  regexpSubstr(
    source: PlsqlRenderable,
    pattern: PlsqlRenderable,
    options: RegexpSubstrOptions = {},
  ): PlsqlExpression<'VARCHAR2'> {
    const args: (PlsqlRenderable | number)[] = [source, pattern]
    if (options.position !== undefined) args.push(options.position)
    if (options.occurrence !== undefined) args.push(options.occurrence)
    if (options.matchParameter !== undefined) args.push(options.matchParameter)
    if (options.subexpression !== undefined) args.push(options.subexpression)
    return call('VARCHAR2', 'REGEXP_SUBSTR', args)
  },

  /** `NULL`, for optional Oracle function arguments. */
  null(): PlsqlExpression<'VARCHAR2'> {
    return new PlsqlExpression('VARCHAR2', 'NULL')
  },
}
