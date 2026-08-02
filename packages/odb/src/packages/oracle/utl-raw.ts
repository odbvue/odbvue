// Oracle built-in package: UTL_RAW.
//
// UTL_RAW is a SQL/PLSQL package that ships with every Oracle database, so
// unlike the odb framework packages (see ../framework) there is no install or
// drop step — the functions are always callable.
//
// Each helper returns a typed `PlsqlExpression<T>` whose `.toSQL()` renders the
// corresponding `UTL_RAW.*` call. Arguments accept any `PlsqlRenderable`
// (a bare variable name, an `odbLiteral(...)`, another expression, etc.); the
// correct return type flows through so results compose with `body.set(...)`.
//
// Reference: https://docs.oracle.com/en/database/oracle/oracle-database/21/arpls/UTL_RAW.html
//
// @example
// body.set(pOut, odbUtlRaw.castToVarchar2(pRaw))
// body.assign('v_len', odbUtlRaw.length('v_raw'))

import { PlsqlExpression, renderPlsql, type PlsqlRenderable } from '../../schema/attribute.js'

/** Render a numeric argument as a literal or delegate to `renderPlsql`. */
function arg(value: PlsqlRenderable | number): string {
  return typeof value === 'number' ? String(value) : renderPlsql(value)
}

function call<T extends string>(type: T, fn: string, args: string[]): PlsqlExpression<T> {
  return new PlsqlExpression(type, `UTL_RAW.${fn}(${args.join(', ')})`)
}

/**
 * Typed wrappers for Oracle's built-in `UTL_RAW` package.
 *
 * These are pure expression builders — they never touch the database and never
 * need installing. Compose them anywhere a PL/SQL expression is accepted.
 */
export const odbUtlRaw = {
  // ── Casts ────────────────────────────────────────────────────────────────

  /** `UTL_RAW.CAST_TO_RAW(<varchar2>)` → RAW */
  castToRaw(v: PlsqlRenderable): PlsqlExpression<'RAW'> {
    return call('RAW', 'CAST_TO_RAW', [renderPlsql(v)])
  },

  /** `UTL_RAW.CAST_TO_VARCHAR2(<raw>)` → VARCHAR2 */
  castToVarchar2(r: PlsqlRenderable): PlsqlExpression<'VARCHAR2'> {
    return call('VARCHAR2', 'CAST_TO_VARCHAR2', [renderPlsql(r)])
  },

  /** `UTL_RAW.CAST_TO_NVARCHAR2(<raw>)` → NVARCHAR2 */
  castToNvarchar2(r: PlsqlRenderable): PlsqlExpression<'NVARCHAR2'> {
    return call('NVARCHAR2', 'CAST_TO_NVARCHAR2', [renderPlsql(r)])
  },

  /** `UTL_RAW.CAST_FROM_NUMBER(<number>)` → RAW */
  castFromNumber(n: PlsqlRenderable | number): PlsqlExpression<'RAW'> {
    return call('RAW', 'CAST_FROM_NUMBER', [arg(n)])
  },

  /** `UTL_RAW.CAST_TO_NUMBER(<raw>)` → NUMBER */
  castToNumber(r: PlsqlRenderable): PlsqlExpression<'NUMBER'> {
    return call('NUMBER', 'CAST_TO_NUMBER', [renderPlsql(r)])
  },

  /** `UTL_RAW.CAST_FROM_BINARY_INTEGER(<int>[, <endianess>])` → RAW */
  castFromBinaryInteger(
    n: PlsqlRenderable | number,
    endianess?: PlsqlRenderable | number,
  ): PlsqlExpression<'RAW'> {
    const args = [arg(n)]
    if (endianess !== undefined) args.push(arg(endianess))
    return call('RAW', 'CAST_FROM_BINARY_INTEGER', args)
  },

  /** `UTL_RAW.CAST_TO_BINARY_INTEGER(<raw>[, <endianess>])` → BINARY_INTEGER */
  castToBinaryInteger(
    r: PlsqlRenderable,
    endianess?: PlsqlRenderable | number,
  ): PlsqlExpression<'BINARY_INTEGER'> {
    const args = [renderPlsql(r)]
    if (endianess !== undefined) args.push(arg(endianess))
    return call('BINARY_INTEGER', 'CAST_TO_BINARY_INTEGER', args)
  },

  /** `UTL_RAW.CAST_FROM_BINARY_DOUBLE(<double>[, <endianess>])` → RAW */
  castFromBinaryDouble(
    n: PlsqlRenderable | number,
    endianess?: PlsqlRenderable | number,
  ): PlsqlExpression<'RAW'> {
    const args = [arg(n)]
    if (endianess !== undefined) args.push(arg(endianess))
    return call('RAW', 'CAST_FROM_BINARY_DOUBLE', args)
  },

  /** `UTL_RAW.CAST_TO_BINARY_DOUBLE(<raw>[, <endianess>])` → BINARY_DOUBLE */
  castToBinaryDouble(
    r: PlsqlRenderable,
    endianess?: PlsqlRenderable | number,
  ): PlsqlExpression<'BINARY_DOUBLE'> {
    const args = [renderPlsql(r)]
    if (endianess !== undefined) args.push(arg(endianess))
    return call('BINARY_DOUBLE', 'CAST_TO_BINARY_DOUBLE', args)
  },

  /** `UTL_RAW.CAST_FROM_BINARY_FLOAT(<float>[, <endianess>])` → RAW */
  castFromBinaryFloat(
    n: PlsqlRenderable | number,
    endianess?: PlsqlRenderable | number,
  ): PlsqlExpression<'RAW'> {
    const args = [arg(n)]
    if (endianess !== undefined) args.push(arg(endianess))
    return call('RAW', 'CAST_FROM_BINARY_FLOAT', args)
  },

  /** `UTL_RAW.CAST_TO_BINARY_FLOAT(<raw>[, <endianess>])` → BINARY_FLOAT */
  castToBinaryFloat(
    r: PlsqlRenderable,
    endianess?: PlsqlRenderable | number,
  ): PlsqlExpression<'BINARY_FLOAT'> {
    const args = [renderPlsql(r)]
    if (endianess !== undefined) args.push(arg(endianess))
    return call('BINARY_FLOAT', 'CAST_TO_BINARY_FLOAT', args)
  },

  // ── Length / substring / concat ──────────────────────────────────────────

  /** `UTL_RAW.LENGTH(<raw>)` → NUMBER */
  length(r: PlsqlRenderable): PlsqlExpression<'NUMBER'> {
    return call('NUMBER', 'LENGTH', [renderPlsql(r)])
  },

  /** `UTL_RAW.SUBSTR(<raw>, <pos>[, <len>])` → RAW */
  substr(
    r: PlsqlRenderable,
    pos: PlsqlRenderable | number,
    len?: PlsqlRenderable | number,
  ): PlsqlExpression<'RAW'> {
    const args = [renderPlsql(r), arg(pos)]
    if (len !== undefined) args.push(arg(len))
    return call('RAW', 'SUBSTR', args)
  },

  /** `UTL_RAW.CONCAT(<raw>, ...)` → RAW (Oracle allows up to 12 operands) */
  concat(...parts: PlsqlRenderable[]): PlsqlExpression<'RAW'> {
    return call('RAW', 'CONCAT', parts.map(renderPlsql))
  },

  /** `UTL_RAW.COPIES(<raw>, <n>)` → RAW */
  copies(r: PlsqlRenderable, n: PlsqlRenderable | number): PlsqlExpression<'RAW'> {
    return call('RAW', 'COPIES', [renderPlsql(r), arg(n)])
  },

  /** `UTL_RAW.REVERSE(<raw>)` → RAW */
  reverse(r: PlsqlRenderable): PlsqlExpression<'RAW'> {
    return call('RAW', 'REVERSE', [renderPlsql(r)])
  },

  // ── Comparison ───────────────────────────────────────────────────────────

  /** `UTL_RAW.COMPARE(<raw1>, <raw2>[, <pad>])` → NUMBER (0 = equal) */
  compare(
    r1: PlsqlRenderable,
    r2: PlsqlRenderable,
    pad?: PlsqlRenderable,
  ): PlsqlExpression<'NUMBER'> {
    const args = [renderPlsql(r1), renderPlsql(r2)]
    if (pad !== undefined) args.push(renderPlsql(pad))
    return call('NUMBER', 'COMPARE', args)
  },

  // ── Bitwise ──────────────────────────────────────────────────────────────

  /** `UTL_RAW.BIT_AND(<raw1>, <raw2>)` → RAW */
  bitAnd(r1: PlsqlRenderable, r2: PlsqlRenderable): PlsqlExpression<'RAW'> {
    return call('RAW', 'BIT_AND', [renderPlsql(r1), renderPlsql(r2)])
  },

  /** `UTL_RAW.BIT_OR(<raw1>, <raw2>)` → RAW */
  bitOr(r1: PlsqlRenderable, r2: PlsqlRenderable): PlsqlExpression<'RAW'> {
    return call('RAW', 'BIT_OR', [renderPlsql(r1), renderPlsql(r2)])
  },

  /** `UTL_RAW.BIT_XOR(<raw1>, <raw2>)` → RAW */
  bitXor(r1: PlsqlRenderable, r2: PlsqlRenderable): PlsqlExpression<'RAW'> {
    return call('RAW', 'BIT_XOR', [renderPlsql(r1), renderPlsql(r2)])
  },

  /** `UTL_RAW.BIT_COMPLEMENT(<raw>)` → RAW */
  bitComplement(r: PlsqlRenderable): PlsqlExpression<'RAW'> {
    return call('RAW', 'BIT_COMPLEMENT', [renderPlsql(r)])
  },

  // ── Charset conversion / ranges ──────────────────────────────────────────

  /** `UTL_RAW.CONVERT(<raw>, <to_charset>, <from_charset>)` → RAW */
  convert(
    r: PlsqlRenderable,
    toCharset: PlsqlRenderable,
    fromCharset: PlsqlRenderable,
  ): PlsqlExpression<'RAW'> {
    return call('RAW', 'CONVERT', [
      renderPlsql(r),
      renderPlsql(toCharset),
      renderPlsql(fromCharset),
    ])
  },

  /** `UTL_RAW.XRANGE(<start_byte>, <end_byte>)` → RAW */
  xrange(startByte: PlsqlRenderable, endByte: PlsqlRenderable): PlsqlExpression<'RAW'> {
    return call('RAW', 'XRANGE', [renderPlsql(startByte), renderPlsql(endByte)])
  },

  /** `UTL_RAW.TRANSLATE(<raw>, <from_set>, <to_set>)` → RAW */
  translate(
    r: PlsqlRenderable,
    fromSet: PlsqlRenderable,
    toSet: PlsqlRenderable,
  ): PlsqlExpression<'RAW'> {
    return call('RAW', 'TRANSLATE', [renderPlsql(r), renderPlsql(fromSet), renderPlsql(toSet)])
  },

  /** `UTL_RAW.TRANSLITERATE(<raw>[, <to_set>][, <from_set>][, <pad>])` → RAW */
  transliterate(
    r: PlsqlRenderable,
    toSet?: PlsqlRenderable,
    fromSet?: PlsqlRenderable,
    pad?: PlsqlRenderable | number,
  ): PlsqlExpression<'RAW'> {
    const args = [renderPlsql(r)]
    if (toSet !== undefined) args.push(renderPlsql(toSet))
    if (fromSet !== undefined) args.push(renderPlsql(fromSet))
    if (pad !== undefined) args.push(arg(pad))
    return call('RAW', 'TRANSLITERATE', args)
  },

  /** `UTL_RAW.OVERLAY(<overlay>, <target>[, <pos>][, <len>][, <pad>])` → RAW */
  overlay(
    overlayStr: PlsqlRenderable,
    target: PlsqlRenderable,
    pos?: PlsqlRenderable | number,
    len?: PlsqlRenderable | number,
    pad?: PlsqlRenderable | number,
  ): PlsqlExpression<'RAW'> {
    const args = [renderPlsql(overlayStr), renderPlsql(target)]
    if (pos !== undefined) args.push(arg(pos))
    if (len !== undefined) args.push(arg(len))
    if (pad !== undefined) args.push(arg(pad))
    return call('RAW', 'OVERLAY', args)
  },

  // ── Endianess constants ──────────────────────────────────────────────────

  /** `UTL_RAW.BIG_ENDIAN` (1) */
  BIG_ENDIAN: new PlsqlExpression('PLS_INTEGER', 'UTL_RAW.BIG_ENDIAN'),
  /** `UTL_RAW.LITTLE_ENDIAN` (2) */
  LITTLE_ENDIAN: new PlsqlExpression('PLS_INTEGER', 'UTL_RAW.LITTLE_ENDIAN'),
  /** `UTL_RAW.MACHINE_ENDIAN` (3) */
  MACHINE_ENDIAN: new PlsqlExpression('PLS_INTEGER', 'UTL_RAW.MACHINE_ENDIAN'),
}
