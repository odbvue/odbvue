// Pre-installed API: JSON Web Token helpers (odb_jwt).
//
// This module exposes two things:
//
// 1. `odbJwt.toSQLUp()` / `odbJwt.toSQLDown()` — SQL to install / drop the
//    `odb_jwt` package in the target schema. Call these from a migration's
//    `.up()` / `.down()` (or via `defineMigration(...).install(odbJwt)`).
//
// 2. `odbJwt.<fn>(...)` — pure functions returning PL/SQL expression strings
//    that call into `odb_jwt.*`. Use them anywhere a PL/SQL expression is
//    accepted (e.g. `body.set(v_token, odbJwt.encode('v_payload', 'v_secret'))`).
//
// The package signs and verifies HS256 tokens. It is deliberately generic:
// callers build whatever JSON claims payload they need (with `JSON_OBJECT`)
// and pass it to `encode`. Reading claims back is done with `payload` / `claim`.
//
// The PL/SQL sources below are the source-of-truth for `odb_jwt`.

import { readFileSync } from 'node:fs'

const spec = readFileSync(new URL('./jwt.pks', import.meta.url), 'utf8')
const body = readFileSync(new URL('./jwt.pkb', import.meta.url), 'utf8')

const JWT_PKG_NAME = 'odb_jwt'

function qualify(name: string, schema?: string): string {
  return schema ? `${schema}.${name}` : name
}

/**
 * Pre-installed JSON Web Token API (`odb_jwt`).
 *
 * Call `odbJwt.toSQLUp()` from a migration `.up()` to install the package,
 * and `odbJwt.toSQLDown()` from `.down()` to drop it.
 *
 * The `<fn>(...)` helpers return PL/SQL expression strings suitable for
 * `body.set(target, expr)` / `body.assign(target, expr)`. Every argument
 * should be a valid PL/SQL expression (bare variable name, literal, or
 * nested call).
 */
export const odbJwt = {
  /** Install `odb_jwt` (spec + body). Optional schema qualifies the name. */
  toSQLUp(options: { schema?: string } = {}): string {
    if (!options.schema) return `${spec}\n${body}`
    // Re-qualify the package name so it is created in the target schema.
    const specHeader = `CREATE OR REPLACE PACKAGE ${qualify(JWT_PKG_NAME, options.schema)} AS`
    const bodyHeader = `CREATE OR REPLACE PACKAGE BODY ${qualify(JWT_PKG_NAME, options.schema)} AS`
    return [
      spec.replace(/^CREATE OR REPLACE PACKAGE odb_jwt AS/, specHeader),
      body.replace(/^CREATE OR REPLACE PACKAGE BODY odb_jwt AS/, bodyHeader),
    ].join('\n')
  },

  /** Drop `odb_jwt`. Optional schema qualifies the name. */
  toSQLDown(options: { schema?: string } = {}): string {
    const name = qualify(JWT_PKG_NAME, options.schema)
    return [
      `BEGIN`,
      `  EXECUTE IMMEDIATE 'DROP PACKAGE ${name}';`,
      `EXCEPTION WHEN OTHERS THEN`,
      `  IF SQLCODE != -4043 THEN RAISE; END IF;`,
      `END;`,
      `/`,
    ].join('\n')
  },

  /** `odb_jwt.encode(<payload>, <secret>)` → VARCHAR2 (signed JWT) */
  encode(payload: string, secret: string): string {
    return `odb_jwt.encode(${payload}, ${secret})`
  },

  /** `odb_jwt.verify(<token>, <secret>)` → 0/1 */
  verify(token: string, secret: string): string {
    return `odb_jwt.verify(${token}, ${secret})`
  },

  /** `odb_jwt.payload(<token>)` → VARCHAR2 (decoded JSON claims, no signature check) */
  payload(token: string): string {
    return `odb_jwt.payload(${token})`
  },

  /** `odb_jwt.claim(<token>, <name>)` → VARCHAR2 (single claim, no signature check) */
  claim(token: string, name: string): string {
    return `odb_jwt.claim(${token}, ${name})`
  },

  /** `odb_jwt.is_expired(<token>[, <leeway>])` → 0/1 */
  isExpired(token: string, leeway?: string): string {
    return leeway === undefined
      ? `odb_jwt.is_expired(${token})`
      : `odb_jwt.is_expired(${token}, ${leeway})`
  },

  /** `odb_jwt.base64url_encode(<input>)` → VARCHAR2 */
  base64urlEncode(input: string): string {
    return `odb_jwt.base64url_encode(${input})`
  },

  /** `odb_jwt.base64url_decode(<input>)` → VARCHAR2 */
  base64urlDecode(input: string): string {
    return `odb_jwt.base64url_decode(${input})`
  },

  /** `odb_jwt.to_epoch([<timestamp>])` → INTEGER (Unix seconds) */
  toEpoch(timestamp?: string): string {
    return timestamp === undefined ? `odb_jwt.to_epoch()` : `odb_jwt.to_epoch(${timestamp})`
  },

  /** `odb_jwt.from_epoch(<epoch>)` → TIMESTAMP */
  fromEpoch(epoch: string): string {
    return `odb_jwt.from_epoch(${epoch})`
  },
}
