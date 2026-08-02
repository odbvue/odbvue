// Oracle built-in package: DBMS_LOB.
//
// DBMS_LOB ships with the database (installed in SYS). It reads and manipulates
// BLOB, CLOB, NCLOB and (read-only) BFILE values.
//
// This module splits the package by shape:
//
// - **Functions** (return a value) are exposed as typed `PlsqlExpression<T>`
//   builders — compose them with `body.set(...)` / `body.assign(...)`.
// - **Procedures** (with OUT / IN OUT parameters) are exposed as builders that
//   return the raw call *string*; pass the result to `body.raw(...)`, which
//   emits it as a statement.
//
// Constants (open modes, durations, LOBMAXSIZE, conversion defaults) are
// exposed as `PlsqlExpression` values.
//
// Reference: https://docs.oracle.com/en/database/oracle/oracle-database/21/arpls/DBMS_LOB.html
//
// @example
// body.assign('v_len', odbDbmsLob.getLength('v_clob'))
// body.raw(odbDbmsLob.createTemporary('v_tmp', true, odbDbmsLob.SESSION))
// body.raw(odbDbmsLob.append('v_dest', 'v_src'))

import { PlsqlExpression, renderPlsql, type PlsqlRenderable } from '../../schema/attribute.js'

function arg(value: PlsqlRenderable | number): string {
  return typeof value === 'number' ? String(value) : renderPlsql(value)
}

/** Render a BOOLEAN argument: `true`/`false` become `TRUE`/`FALSE`. */
function boolArg(value: PlsqlRenderable | boolean): string {
  return typeof value === 'boolean' ? (value ? 'TRUE' : 'FALSE') : renderPlsql(value)
}

function fn<T extends string>(type: T, name: string, args: string[]): PlsqlExpression<T> {
  return new PlsqlExpression(type, `DBMS_LOB.${name}(${args.join(', ')})`)
}

/** Build a `DBMS_LOB.<NAME>(...)` procedure-call string for `body.raw(...)`. */
function proc(name: string, args: string[]): string {
  return `DBMS_LOB.${name}(${args.join(', ')})`
}

function konst<T extends string>(type: T, name: string): PlsqlExpression<T> {
  return new PlsqlExpression(type, `DBMS_LOB.${name}`)
}

/**
 * Typed wrappers for Oracle's built-in `DBMS_LOB` package.
 */
export const odbDbmsLob = {
  // ── Functions (expressions) ────────────────────────────────────────────────

  /** `DBMS_LOB.GETLENGTH(<lob_loc>)` → INTEGER */
  getLength(lobLoc: PlsqlRenderable): PlsqlExpression<'INTEGER'> {
    return fn('INTEGER', 'GETLENGTH', [renderPlsql(lobLoc)])
  },

  /** `DBMS_LOB.GETCHUNKSIZE(<lob_loc>)` → INTEGER */
  getChunkSize(lobLoc: PlsqlRenderable): PlsqlExpression<'INTEGER'> {
    return fn('INTEGER', 'GETCHUNKSIZE', [renderPlsql(lobLoc)])
  },

  /** `DBMS_LOB.GET_STORAGE_LIMIT(<lob_loc>)` → INTEGER */
  getStorageLimit(lobLoc: PlsqlRenderable): PlsqlExpression<'INTEGER'> {
    return fn('INTEGER', 'GET_STORAGE_LIMIT', [renderPlsql(lobLoc)])
  },

  /** `DBMS_LOB.COMPARE(<lob_1>, <lob_2>[, <amount>][, <offset_1>][, <offset_2>])` → INTEGER */
  compare(
    lob1: PlsqlRenderable,
    lob2: PlsqlRenderable,
    amount?: PlsqlRenderable | number,
    offset1?: PlsqlRenderable | number,
    offset2?: PlsqlRenderable | number,
  ): PlsqlExpression<'INTEGER'> {
    const args = [renderPlsql(lob1), renderPlsql(lob2)]
    if (amount !== undefined) args.push(arg(amount))
    if (offset1 !== undefined) args.push(arg(offset1))
    if (offset2 !== undefined) args.push(arg(offset2))
    return fn('INTEGER', 'COMPARE', args)
  },

  /** `DBMS_LOB.INSTR(<lob_loc>, <pattern>[, <offset>][, <nth>])` → INTEGER */
  instr(
    lobLoc: PlsqlRenderable,
    pattern: PlsqlRenderable,
    offset?: PlsqlRenderable | number,
    nth?: PlsqlRenderable | number,
  ): PlsqlExpression<'INTEGER'> {
    const args = [renderPlsql(lobLoc), renderPlsql(pattern)]
    if (offset !== undefined) args.push(arg(offset))
    if (nth !== undefined) args.push(arg(nth))
    return fn('INTEGER', 'INSTR', args)
  },

  /**
   * `DBMS_LOB.SUBSTR(<lob_loc>[, <amount>][, <offset>])` → VARCHAR2
   *
   * This is the CLOB overload (returns VARCHAR2). For the BLOB overload, which
   * returns RAW, use {@link substrRaw}.
   */
  substr(
    lobLoc: PlsqlRenderable,
    amount?: PlsqlRenderable | number,
    offset?: PlsqlRenderable | number,
  ): PlsqlExpression<'VARCHAR2'> {
    const args = [renderPlsql(lobLoc)]
    if (amount !== undefined) args.push(arg(amount))
    if (offset !== undefined) args.push(arg(offset))
    return fn('VARCHAR2', 'SUBSTR', args)
  },

  /** `DBMS_LOB.SUBSTR(<lob_loc>[, <amount>][, <offset>])` → RAW (BLOB/BFILE overload) */
  substrRaw(
    lobLoc: PlsqlRenderable,
    amount?: PlsqlRenderable | number,
    offset?: PlsqlRenderable | number,
  ): PlsqlExpression<'RAW'> {
    const args = [renderPlsql(lobLoc)]
    if (amount !== undefined) args.push(arg(amount))
    if (offset !== undefined) args.push(arg(offset))
    return fn('RAW', 'SUBSTR', args)
  },

  /** `DBMS_LOB.GETCONTENTTYPE(<lob_loc>)` → VARCHAR2 */
  getContentType(lobLoc: PlsqlRenderable): PlsqlExpression<'VARCHAR2'> {
    return fn('VARCHAR2', 'GETCONTENTTYPE', [renderPlsql(lobLoc)])
  },

  /** `DBMS_LOB.ISOPEN(<lob_loc>)` → INTEGER (1 = open, 0 = closed) */
  isOpen(lobLoc: PlsqlRenderable): PlsqlExpression<'INTEGER'> {
    return fn('INTEGER', 'ISOPEN', [renderPlsql(lobLoc)])
  },

  /** `DBMS_LOB.ISTEMPORARY(<lob_loc>)` → INTEGER (1 = temporary) */
  isTemporary(lobLoc: PlsqlRenderable): PlsqlExpression<'INTEGER'> {
    return fn('INTEGER', 'ISTEMPORARY', [renderPlsql(lobLoc)])
  },

  /** `DBMS_LOB.FILEEXISTS(<file_loc>)` → INTEGER (1 = exists) */
  fileExists(fileLoc: PlsqlRenderable): PlsqlExpression<'INTEGER'> {
    return fn('INTEGER', 'FILEEXISTS', [renderPlsql(fileLoc)])
  },

  /** `DBMS_LOB.FILEISOPEN(<file_loc>)` → INTEGER (1 = open) */
  fileIsOpen(fileLoc: PlsqlRenderable): PlsqlExpression<'INTEGER'> {
    return fn('INTEGER', 'FILEISOPEN', [renderPlsql(fileLoc)])
  },

  // ── Procedures (statements — pass to body.raw) ─────────────────────────────

  /** `DBMS_LOB.APPEND(<dest_lob>, <src_lob>)` */
  append(destLob: PlsqlRenderable, srcLob: PlsqlRenderable): string {
    return proc('APPEND', [renderPlsql(destLob), renderPlsql(srcLob)])
  },

  /** `DBMS_LOB.COPY(<dest_lob>, <src_lob>, <amount>[, <dest_offset>][, <src_offset>])` */
  copy(
    destLob: PlsqlRenderable,
    srcLob: PlsqlRenderable,
    amount: PlsqlRenderable | number,
    destOffset?: PlsqlRenderable | number,
    srcOffset?: PlsqlRenderable | number,
  ): string {
    const args = [renderPlsql(destLob), renderPlsql(srcLob), arg(amount)]
    if (destOffset !== undefined) args.push(arg(destOffset))
    if (srcOffset !== undefined) args.push(arg(srcOffset))
    return proc('COPY', args)
  },

  /** `DBMS_LOB.CREATETEMPORARY(<lob_loc>, <cache>[, <dur>])` */
  createTemporary(
    lobLoc: PlsqlRenderable,
    cache: PlsqlRenderable | boolean,
    dur?: PlsqlRenderable,
  ): string {
    const args = [renderPlsql(lobLoc), boolArg(cache)]
    if (dur !== undefined) args.push(renderPlsql(dur))
    return proc('CREATETEMPORARY', args)
  },

  /** `DBMS_LOB.FREETEMPORARY(<lob_loc>)` */
  freeTemporary(lobLoc: PlsqlRenderable): string {
    return proc('FREETEMPORARY', [renderPlsql(lobLoc)])
  },

  /** `DBMS_LOB.OPEN(<lob_loc>, <open_mode>)` */
  open(lobLoc: PlsqlRenderable, openMode: PlsqlRenderable): string {
    return proc('OPEN', [renderPlsql(lobLoc), renderPlsql(openMode)])
  },

  /** `DBMS_LOB.CLOSE(<lob_loc>)` */
  close(lobLoc: PlsqlRenderable): string {
    return proc('CLOSE', [renderPlsql(lobLoc)])
  },

  /** `DBMS_LOB.TRIM(<lob_loc>, <newlen>)` */
  trim(lobLoc: PlsqlRenderable, newlen: PlsqlRenderable | number): string {
    return proc('TRIM', [renderPlsql(lobLoc), arg(newlen)])
  },

  /** `DBMS_LOB.ERASE(<lob_loc>, <amount>[, <offset>])` */
  erase(
    lobLoc: PlsqlRenderable,
    amount: PlsqlRenderable | number,
    offset?: PlsqlRenderable | number,
  ): string {
    const args = [renderPlsql(lobLoc), arg(amount)]
    if (offset !== undefined) args.push(arg(offset))
    return proc('ERASE', args)
  },

  /** `DBMS_LOB.WRITE(<lob_loc>, <amount>, <offset>, <buffer>)` */
  write(
    lobLoc: PlsqlRenderable,
    amount: PlsqlRenderable | number,
    offset: PlsqlRenderable | number,
    buffer: PlsqlRenderable,
  ): string {
    return proc('WRITE', [renderPlsql(lobLoc), arg(amount), arg(offset), renderPlsql(buffer)])
  },

  /** `DBMS_LOB.WRITEAPPEND(<lob_loc>, <amount>, <buffer>)` */
  writeAppend(
    lobLoc: PlsqlRenderable,
    amount: PlsqlRenderable | number,
    buffer: PlsqlRenderable,
  ): string {
    return proc('WRITEAPPEND', [renderPlsql(lobLoc), arg(amount), renderPlsql(buffer)])
  },

  /** `DBMS_LOB.READ(<lob_loc>, <amount>, <offset>, <buffer>)` (amount IN OUT, buffer OUT) */
  read(
    lobLoc: PlsqlRenderable,
    amount: PlsqlRenderable,
    offset: PlsqlRenderable | number,
    buffer: PlsqlRenderable,
  ): string {
    return proc('READ', [
      renderPlsql(lobLoc),
      renderPlsql(amount),
      arg(offset),
      renderPlsql(buffer),
    ])
  },

  /** `DBMS_LOB.FILEOPEN(<file_loc>[, <open_mode>])` */
  fileOpen(fileLoc: PlsqlRenderable, openMode?: PlsqlRenderable): string {
    const args = [renderPlsql(fileLoc)]
    if (openMode !== undefined) args.push(renderPlsql(openMode))
    return proc('FILEOPEN', args)
  },

  /** `DBMS_LOB.FILECLOSE(<file_loc>)` */
  fileClose(fileLoc: PlsqlRenderable): string {
    return proc('FILECLOSE', [renderPlsql(fileLoc)])
  },

  /** `DBMS_LOB.FILECLOSEALL` */
  fileCloseAll(): string {
    return 'DBMS_LOB.FILECLOSEALL'
  },

  // ── Constants ──────────────────────────────────────────────────────────────

  /** `DBMS_LOB.LOB_READONLY` (0) */
  LOB_READONLY: konst('INTEGER', 'LOB_READONLY'),
  /** `DBMS_LOB.LOB_READWRITE` (1) */
  LOB_READWRITE: konst('INTEGER', 'LOB_READWRITE'),
  /** `DBMS_LOB.FILE_READONLY` (0) */
  FILE_READONLY: konst('INTEGER', 'FILE_READONLY'),
  /** `DBMS_LOB.LOBMAXSIZE` */
  LOBMAXSIZE: konst('INTEGER', 'LOBMAXSIZE'),
  /** `DBMS_LOB.SESSION` (10) — temporary LOB session duration */
  SESSION: konst('INTEGER', 'SESSION'),
  /** `DBMS_LOB.CALL` (12) — temporary LOB call duration */
  CALL: konst('INTEGER', 'CALL'),
  /** `DBMS_LOB.DEFAULT_CSID` (0) */
  DEFAULT_CSID: konst('INTEGER', 'DEFAULT_CSID'),
  /** `DBMS_LOB.DEFAULT_LANG_CTX` (0) */
  DEFAULT_LANG_CTX: konst('INTEGER', 'DEFAULT_LANG_CTX'),
  /** `DBMS_LOB.NO_WARNING` (0) */
  NO_WARNING: konst('INTEGER', 'NO_WARNING'),
  /** `DBMS_LOB.WARN_INCONVERTIBLE_CHAR` (1) */
  WARN_INCONVERTIBLE_CHAR: konst('INTEGER', 'WARN_INCONVERTIBLE_CHAR'),
}
