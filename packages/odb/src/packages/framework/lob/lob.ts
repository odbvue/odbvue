// Pre-installed API: LOB / Base64 helpers (odb_lob).
//
// This module exposes two things:
//
// 1. `odbLob.toSQLUp()` / `odbLob.toSQLDown()` \u2014 SQL to install / drop the
//    `odb_lob` package in the target schema. Call these from a migration's
//    `.up()` / `.down()`.
//
// 2. `odbLob.<fn>(expr)` \u2014 pure functions returning PL/SQL expression strings
//    that call into `odb_lob.*`. Use them anywhere a PL/SQL expression is
//    accepted by `body.set(...)` assignments.
//
// Typed-var counterparts (`ClobVar.toBase64()`, etc.) are defined next to
// `LocalVar` in `../../../schema/attribute.ts` to keep the schema layer free of
// schema→packages import cycles. The tiny `odb_lob.*` call strings are
// duplicated across the two locations intentionally.
//
// The PL/SQL sources below are the source-of-truth for `odb_lob`.
// Credit: https://github.com/paulzip-dev/Base64

import { readFileSync } from 'node:fs'
import { PlsqlExpression, renderPlsql, type PlsqlRenderable } from '../../../schema/attribute.js'
import { dropPackageIfExists, qualify } from '../../../schema/ddl.js'

const spec = readFileSync(new URL('./lob.pks', import.meta.url), 'utf8')
const body = readFileSync(new URL('./lob.pkb', import.meta.url), 'utf8')

const LOB_PKG_NAME = 'odb_lob'

function call<T extends string>(type: T, name: string, value: PlsqlRenderable): PlsqlExpression<T> {
  return new PlsqlExpression(type, `odb_lob.${name}(${renderPlsql(value)})`)
}

/**
 * Pre-installed LOB / Base64 API (`odb_lob`).
 *
 * Call `odbLob.toSQLUp()` from a migration `.up()` to install the package,
 * and `odbLob.toSQLDown()` from `.down()` to drop it.
 *
 * The `<fn>(expr)` helpers return PL/SQL expression strings suitable for
 * `body.set(...)` (bare variable name, literal, or nested call).
 */
export const odbLob = {
  /** Install `odb_lob` (spec + body). Optional schema qualifies the name. */
  toSQLUp(options: { schema?: string } = {}): string {
    if (!options.schema) return `${spec}\n${body}`
    // Re-qualify the package name so it is created in the target schema.
    const specHeader = `CREATE OR REPLACE PACKAGE ${qualify(LOB_PKG_NAME, options.schema)} AS`
    const bodyHeader = `CREATE OR REPLACE PACKAGE BODY ${qualify(LOB_PKG_NAME, options.schema)} AS`
    return [
      spec.replace(/^CREATE OR REPLACE PACKAGE odb_lob AS/, specHeader),
      body.replace(/^CREATE OR REPLACE PACKAGE BODY odb_lob AS/, bodyHeader),
    ].join('\n')
  },

  /** Drop `odb_lob`. Optional schema qualifies the name. */
  toSQLDown(options: { schema?: string } = {}): string {
    return dropPackageIfExists(LOB_PKG_NAME, options.schema)
  },

  /** `odb_lob.clob_to_blob(<clob>)` \u2192 BLOB */
  clobToBlob(clob: PlsqlRenderable): PlsqlExpression<'BLOB'> {
    return call('BLOB', 'clob_to_blob', clob)
  },

  /** `odb_lob.blob_to_clob(<blob>)` \u2192 CLOB */
  blobToClob(blob: PlsqlRenderable): PlsqlExpression<'CLOB'> {
    return call('CLOB', 'blob_to_clob', blob)
  },

  /** `odb_lob.blob_to_base64(<blob>)` \u2192 CLOB */
  blobToBase64(blob: PlsqlRenderable): PlsqlExpression<'CLOB'> {
    return call('CLOB', 'blob_to_base64', blob)
  },

  /** `odb_lob.clob_to_base64(<clob>)` \u2192 CLOB */
  clobToBase64(clob: PlsqlRenderable): PlsqlExpression<'CLOB'> {
    return call('CLOB', 'clob_to_base64', clob)
  },

  /** `odb_lob.varchar2_to_base64(<varchar2>)` \u2192 CLOB */
  varchar2ToBase64(value: PlsqlRenderable): PlsqlExpression<'CLOB'> {
    return call('CLOB', 'varchar2_to_base64', value)
  },

  /** `odb_lob.base64_to_blob(<b64>)` \u2192 BLOB */
  base64ToBlob(base64: PlsqlRenderable): PlsqlExpression<'BLOB'> {
    return call('BLOB', 'base64_to_blob', base64)
  },

  /** `odb_lob.base64_to_clob(<b64>)` \u2192 CLOB */
  base64ToClob(base64: PlsqlRenderable): PlsqlExpression<'CLOB'> {
    return call('CLOB', 'base64_to_clob', base64)
  },

  /** `odb_lob.base64_to_varchar2(<b64>)` \u2192 VARCHAR2 */
  base64ToVarchar2(base64: PlsqlRenderable): PlsqlExpression<'VARCHAR2'> {
    return call('VARCHAR2', 'base64_to_varchar2', base64)
  },
}
