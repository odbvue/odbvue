// Oracle built-in package: UTL_ENCODE.
//
// UTL_ENCODE ships with every Oracle database (no install/drop). It encodes
// RAW data into standard transport formats (Base64, quoted-printable, uuencode)
// and the character-set-aware TEXT_*/MIMEHEADER_* helpers.
//
// Each helper returns a typed `PlsqlExpression<T>` whose `.toSQL()` renders the
// corresponding `UTL_ENCODE.*` call. Arguments accept any `PlsqlRenderable`
// (a bare variable name, an `odbLiteral(...)`, another expression, etc.).
//
// Reference: https://docs.oracle.com/en/database/oracle/oracle-database/21/arpls/UTL_ENCODE.html
//
// @example
// body.set(pOut, odbUtlEncode.base64Encode(pRaw))

import { PlsqlExpression, renderPlsql, type PlsqlRenderable } from '../../schema/attribute.js'

function arg(value: PlsqlRenderable | number): string {
  return typeof value === 'number' ? String(value) : renderPlsql(value)
}

function call<T extends string>(type: T, fn: string, args: string[]): PlsqlExpression<T> {
  return new PlsqlExpression(type, `UTL_ENCODE.${fn}(${args.join(', ')})`)
}

/**
 * Typed wrappers for Oracle's built-in `UTL_ENCODE` package.
 *
 * Pure expression builders — no database round-trip, no install step.
 */
export const odbUtlEncode = {
  // ── Base64 (RAW → RAW) ─────────────────────────────────────────────────────

  /** `UTL_ENCODE.BASE64_ENCODE(<raw>)` → RAW */
  base64Encode(r: PlsqlRenderable): PlsqlExpression<'RAW'> {
    return call('RAW', 'BASE64_ENCODE', [renderPlsql(r)])
  },

  /** `UTL_ENCODE.BASE64_DECODE(<raw>)` → RAW */
  base64Decode(r: PlsqlRenderable): PlsqlExpression<'RAW'> {
    return call('RAW', 'BASE64_DECODE', [renderPlsql(r)])
  },

  // ── Quoted-printable (RAW → RAW) ───────────────────────────────────────────

  /** `UTL_ENCODE.QUOTED_PRINTABLE_ENCODE(<raw>)` → RAW */
  quotedPrintableEncode(r: PlsqlRenderable): PlsqlExpression<'RAW'> {
    return call('RAW', 'QUOTED_PRINTABLE_ENCODE', [renderPlsql(r)])
  },

  /** `UTL_ENCODE.QUOTED_PRINTABLE_DECODE(<raw>)` → RAW */
  quotedPrintableDecode(r: PlsqlRenderable): PlsqlExpression<'RAW'> {
    return call('RAW', 'QUOTED_PRINTABLE_DECODE', [renderPlsql(r)])
  },

  // ── uuencode (RAW → RAW) ───────────────────────────────────────────────────

  /** `UTL_ENCODE.UUENCODE(<raw>[, <type>][, <filename>][, <permission>])` → RAW */
  uuEncode(
    r: PlsqlRenderable,
    type?: PlsqlRenderable | number,
    filename?: PlsqlRenderable,
    permission?: PlsqlRenderable,
  ): PlsqlExpression<'RAW'> {
    const args = [renderPlsql(r)]
    if (type !== undefined) args.push(arg(type))
    if (filename !== undefined) args.push(renderPlsql(filename))
    if (permission !== undefined) args.push(renderPlsql(permission))
    return call('RAW', 'UUENCODE', args)
  },

  /** `UTL_ENCODE.UUDECODE(<raw>)` → RAW */
  uuDecode(r: PlsqlRenderable): PlsqlExpression<'RAW'> {
    return call('RAW', 'UUDECODE', [renderPlsql(r)])
  },

  // ── Charset-aware text (VARCHAR2 → VARCHAR2) ───────────────────────────────

  /** `UTL_ENCODE.TEXT_ENCODE(<buf>[, <encode_charset>][, <encoding>])` → VARCHAR2 */
  textEncode(
    buf: PlsqlRenderable,
    encodeCharset?: PlsqlRenderable,
    encoding?: PlsqlRenderable | number,
  ): PlsqlExpression<'VARCHAR2'> {
    const args = [renderPlsql(buf)]
    if (encodeCharset !== undefined) args.push(renderPlsql(encodeCharset))
    if (encoding !== undefined) args.push(arg(encoding))
    return call('VARCHAR2', 'TEXT_ENCODE', args)
  },

  /** `UTL_ENCODE.TEXT_DECODE(<buf>[, <encode_charset>][, <encoding>])` → VARCHAR2 */
  textDecode(
    buf: PlsqlRenderable,
    encodeCharset?: PlsqlRenderable,
    encoding?: PlsqlRenderable | number,
  ): PlsqlExpression<'VARCHAR2'> {
    const args = [renderPlsql(buf)]
    if (encodeCharset !== undefined) args.push(renderPlsql(encodeCharset))
    if (encoding !== undefined) args.push(arg(encoding))
    return call('VARCHAR2', 'TEXT_DECODE', args)
  },

  /** `UTL_ENCODE.MIMEHEADER_ENCODE(<buf>[, <encode_charset>][, <encoding>])` → VARCHAR2 */
  mimeheaderEncode(
    buf: PlsqlRenderable,
    encodeCharset?: PlsqlRenderable,
    encoding?: PlsqlRenderable | number,
  ): PlsqlExpression<'VARCHAR2'> {
    const args = [renderPlsql(buf)]
    if (encodeCharset !== undefined) args.push(renderPlsql(encodeCharset))
    if (encoding !== undefined) args.push(arg(encoding))
    return call('VARCHAR2', 'MIMEHEADER_ENCODE', args)
  },

  /** `UTL_ENCODE.MIMEHEADER_DECODE(<buf>)` → VARCHAR2 */
  mimeheaderDecode(buf: PlsqlRenderable): PlsqlExpression<'VARCHAR2'> {
    return call('VARCHAR2', 'MIMEHEADER_DECODE', [renderPlsql(buf)])
  },

  // ── Encoding-format constants (for TEXT_*/MIMEHEADER_* `encoding` arg) ──────

  /** `UTL_ENCODE.BASE64` */
  BASE64: new PlsqlExpression('PLS_INTEGER', 'UTL_ENCODE.BASE64'),
  /** `UTL_ENCODE.QUOTED_PRINTABLE` */
  QUOTED_PRINTABLE: new PlsqlExpression('PLS_INTEGER', 'UTL_ENCODE.QUOTED_PRINTABLE'),
}
