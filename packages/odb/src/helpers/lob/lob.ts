// Pre-installed API: LOB / Base64 helpers (odb_lob).
//
// This module exposes two things:
//
// 1. `odbLob.toSQLUp()` / `odbLob.toSQLDown()` \u2014 SQL to install / drop the
//    `odb_lob` package in the target schema. Call these from a migration's
//    `.up()` / `.down()`.
//
// 2. `odbLob.<fn>(expr)` \u2014 pure functions returning typed PL/SQL expressions
//    that call into `odb_lob.*`. Use them anywhere a PL/SQL expression is
//    accepted by `body.set(...)` assignments.
//
// Typed-var counterparts (`ClobVar.toBase64()`, etc.) are defined next to
// `LocalVar` in `../../schema/attribute.ts` to keep the schema layer free of
// schema→packages import cycles. The tiny `odb_lob.*` call strings are
// duplicated across the two locations intentionally.
//
// The TypeScript package definition is the source-of-truth for `odb_lob`.
// Credit: https://github.com/paulzip-dev/Base64

import { type PlsqlRenderable } from '../../schema/attribute.js'
import { odbLobPackage } from './package.js'

export { odbLobPackage } from './package.js'

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
    return odbLobPackage.toSQLUp(options)
  },

  /** Drop `odb_lob`. Optional schema qualifies the name. */
  toSQLDown(options: { schema?: string } = {}): string {
    return odbLobPackage.toSQLDown(options)
  },

  /** `odb_lob.clob_to_blob(<clob>)` \u2192 BLOB */
  clobToBlob(
    clob: PlsqlRenderable,
    ...options:
      | []
      | [charsetId: PlsqlRenderable]
      | [charsetId: PlsqlRenderable, errorOnWarning: PlsqlRenderable]
  ) {
    return odbLobPackage.clobToBlob(clob, ...options)
  },

  /** `odb_lob.blob_to_clob(<blob>)` \u2192 CLOB */
  blobToClob(
    blob: PlsqlRenderable,
    ...options:
      | []
      | [charsetId: PlsqlRenderable]
      | [charsetId: PlsqlRenderable, errorOnWarning: PlsqlRenderable]
  ) {
    return odbLobPackage.blobToClob(blob, ...options)
  },

  /** `odb_lob.blob_to_base64(<blob>)` \u2192 CLOB */
  blobToBase64(blob: PlsqlRenderable, ...options: [] | [newline: PlsqlRenderable]) {
    return odbLobPackage.blobToBase64(blob, ...options)
  },

  /** `odb_lob.clob_to_base64(<clob>)` \u2192 CLOB */
  clobToBase64(clob: PlsqlRenderable, ...options: [] | [newline: PlsqlRenderable]) {
    return odbLobPackage.clobToBase64(clob, ...options)
  },

  /** `odb_lob.varchar2_to_base64(<varchar2>)` \u2192 CLOB */
  varchar2ToBase64(value: PlsqlRenderable, ...options: [] | [newline: PlsqlRenderable]) {
    return odbLobPackage.varchar2ToBase64(value, ...options)
  },

  /** `odb_lob.base64_to_blob(<b64>)` \u2192 BLOB */
  base64ToBlob(base64: PlsqlRenderable) {
    return odbLobPackage.base64ToBlob(base64)
  },

  /** `odb_lob.base64_to_clob(<b64>)` \u2192 CLOB */
  base64ToClob(base64: PlsqlRenderable) {
    return odbLobPackage.base64ToClob(base64)
  },

  /** `odb_lob.base64_to_varchar2(<b64>)` \u2192 VARCHAR2 */
  base64ToVarchar2(base64: PlsqlRenderable) {
    return odbLobPackage.base64ToVarchar2(base64)
  },
}
