// Pre-installed API: LOB / Base64 helpers (pck_api_lob).
//
// This module exposes two things:
//
// 1. `odbLob.toSQLUp()` / `odbLob.toSQLDown()` \u2014 SQL to install / drop the
//    `pck_api_lob` package in the target schema. Call these from a migration's
//    `.up()` / `.down()`.
//
// 2. `odbLob.<fn>(expr)` \u2014 pure functions returning PL/SQL expression strings
//    that call into `pck_api_lob.*`. Use them anywhere a PL/SQL expression is
//    accepted (e.g. `body.assign('v_out', odbLob.clobToBase64('v_in'))`).
//
// Typed-var counterparts (`ClobVar.toBase64()`, etc.) are defined next to
// `LocalVar` in `../../schema/attribute.ts` to keep the schema layer free of
// api\u2192schema import cycles. The tiny `pck_api_lob.*` call strings are
// duplicated across the two locations intentionally.
//
// The PL/SQL sources below are the source-of-truth for `pck_api_lob`.
// Credit: https://github.com/paulzip-dev/Base64

import { readFileSync } from 'node:fs'

const spec = readFileSync(new URL('./lob.pks', import.meta.url), 'utf8')
const body = readFileSync(new URL('./lob.pkb', import.meta.url), 'utf8')

const LOB_PKG_NAME = 'pck_api_lob'

function qualify(name: string, schema?: string): string {
  return schema ? `${schema}.${name}` : name
}

/**
 * Pre-installed LOB / Base64 API (`pck_api_lob`).
 *
 * Call `odbLob.toSQLUp()` from a migration `.up()` to install the package,
 * and `odbLob.toSQLDown()` from `.down()` to drop it.
 *
 * The `<fn>(expr)` helpers return PL/SQL expression strings suitable for
 * `body.assign(target, expr)`. `expr` should be a valid PL/SQL expression
 * (bare variable name, literal, or nested call).
 */
export const odbLob = {
  /** Install `pck_api_lob` (spec + body). Optional schema qualifies the name. */
  toSQLUp(options: { schema?: string } = {}): string {
    if (!options.schema) return `${spec}\n${body}`
    // Re-qualify the package name so it is created in the target schema.
    const specHeader = `CREATE OR REPLACE PACKAGE ${qualify(LOB_PKG_NAME, options.schema)} AS`
    const bodyHeader = `CREATE OR REPLACE PACKAGE BODY ${qualify(LOB_PKG_NAME, options.schema)} AS`
    return [
      spec.replace(/^CREATE OR REPLACE PACKAGE pck_api_lob AS/, specHeader),
      body.replace(/^CREATE OR REPLACE PACKAGE BODY pck_api_lob AS/, bodyHeader),
    ].join('\n')
  },

  /** Drop `pck_api_lob`. Optional schema qualifies the name. */
  toSQLDown(options: { schema?: string } = {}): string {
    const name = qualify(LOB_PKG_NAME, options.schema)
    return [
      `BEGIN`,
      `  EXECUTE IMMEDIATE 'DROP PACKAGE ${name}';`,
      `EXCEPTION WHEN OTHERS THEN`,
      `  IF SQLCODE != -4043 THEN RAISE; END IF;`,
      `END;`,
      `/`,
    ].join('\n')
  },

  /** `pck_api_lob.clob_to_blob(<clob>)` \u2192 BLOB */
  clobToBlob(clob: string): string {
    return `pck_api_lob.clob_to_blob(${clob})`
  },

  /** `pck_api_lob.blob_to_clob(<blob>)` \u2192 CLOB */
  blobToClob(blob: string): string {
    return `pck_api_lob.blob_to_clob(${blob})`
  },

  /** `pck_api_lob.blob_to_base64(<blob>)` \u2192 CLOB */
  blobToBase64(blob: string): string {
    return `pck_api_lob.blob_to_base64(${blob})`
  },

  /** `pck_api_lob.clob_to_base64(<clob>)` \u2192 CLOB */
  clobToBase64(clob: string): string {
    return `pck_api_lob.clob_to_base64(${clob})`
  },

  /** `pck_api_lob.varchar2_to_base64(<varchar2>)` \u2192 CLOB */
  varchar2ToBase64(v: string): string {
    return `pck_api_lob.varchar2_to_base64(${v})`
  },

  /** `pck_api_lob.base64_to_blob(<b64>)` \u2192 BLOB */
  base64ToBlob(b64: string): string {
    return `pck_api_lob.base64_to_blob(${b64})`
  },

  /** `pck_api_lob.base64_to_clob(<b64>)` \u2192 CLOB */
  base64ToClob(b64: string): string {
    return `pck_api_lob.base64_to_clob(${b64})`
  },

  /** `pck_api_lob.base64_to_varchar2(<b64>)` \u2192 VARCHAR2 */
  base64ToVarchar2(b64: string): string {
    return `pck_api_lob.base64_to_varchar2(${b64})`
  },
}
