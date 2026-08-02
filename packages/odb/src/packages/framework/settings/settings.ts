// Pre-installed API: settings store with encrypted secrets (odb_settings).
//
// This module exposes two things:
//
// 1. `odbSettings.toSQLUp()` / `odbSettings.toSQLDown()` — SQL to install / drop
//    the `odb_settings_store` table and the `odb_settings` package in the target
//    schema. Call these from a migration's `.up()` / `.down()`.
//
// 2. `odbSettings.<fn>(...)` — pure functions returning PL/SQL call/expression
//    strings that invoke `odb_settings.*`. Use them anywhere a PL/SQL statement
//    or expression is accepted (e.g. `body.set(v_out, odbSettings.read("'API_URL'"))`).
//
// Secrets are encrypted with AES-256-CBC. The master key is resolved at runtime
// by the package: first from an OCI Vault secret (via resource principal, when
// an `ODB_SETTINGS_MASTER_KEY_URI` setting is present), otherwise from a fallback
// key baked into the package body at install time. That fallback defaults to a
// built-in development key and can be overridden with the `masterKey` option or
// the `ODBVUE_SETTINGS_MASTER_KEY` environment variable (a 64-char hex / 32-byte
// AES-256 key).
//
// The PL/SQL sources below are the source-of-truth for `odb_settings`.

import { readFileSync } from 'node:fs'

import { renderPlsql, type PlsqlRenderable } from '../../../schema/attribute.js'

const spec = readFileSync(new URL('./settings.pks', import.meta.url), 'utf8')
const body = readFileSync(new URL('./settings.pkb', import.meta.url), 'utf8')

const SETTINGS_PKG_NAME = 'odb_settings'
const SETTINGS_TABLE_NAME = 'odb_settings_store'
const MASTER_KEY_MARKER = '__ODB_SETTINGS_MASTER_KEY__'
const MASTER_KEY_ENV = 'ODBVUE_SETTINGS_MASTER_KEY'

// Built-in AES-256 fallback key (64 hex / 32 bytes). This is a shared development
// default — like INITIAL_PASSWORD — used only when neither an explicit `masterKey`
// nor ODBVUE_SETTINGS_MASTER_KEY is set. Override it in production, or use OCI
// Vault (ODB_SETTINGS_MASTER_KEY_URI) so this key is never the one in effect.
const DEFAULT_MASTER_KEY = '7F3A9C1E5B08D46271AE9F0C3D5B8E1240A7C6F9B2E43D18576C0A9E3F1B8D2C'

function qualify(name: string, schema?: string): string {
  return schema ? `${schema}.${name}` : name
}

function block(stmt: string): string {
  return [`BEGIN`, `  ${stmt};`, `END;`, `/`].join('\n')
}

function lit(v: string): string {
  return `'${v.replace(/'/g, "''")}'`
}

/** Resolve and validate the fallback AES-256 master key (64 hex chars / 32 bytes). */
function resolveMasterKey(masterKey?: string): string {
  const key = masterKey ?? process.env[MASTER_KEY_ENV] ?? DEFAULT_MASTER_KEY
  const normalized = key.trim().toUpperCase()
  if (!/^[0-9A-F]{64}$/.test(normalized)) {
    throw new Error(`odb_settings: master key must be 64 hex characters (32 bytes) for AES-256.`)
  }
  return normalized
}

/** DDL for the `odb_settings_store` table, wrapped so re-installs are idempotent (ORA-00955). */
function tableUpSQL(schema?: string): string {
  const table = qualify(SETTINGS_TABLE_NAME, schema)
  const ddl = [
    `CREATE TABLE ${table} (`,
    `    id      VARCHAR2(30 CHAR) NOT NULL ENABLE,`,
    `    name    VARCHAR2(200 CHAR) NOT NULL ENABLE,`,
    `    value   VARCHAR2(2000 CHAR),`,
    `    options CLOB,`,
    `    secret  CHAR(1 CHAR) DEFAULT 'N' NOT NULL ENABLE,`,
    `    CONSTRAINT odb_settings_store_pk PRIMARY KEY (id),`,
    `    CONSTRAINT odb_settings_store_chk_options CHECK (options IS JSON),`,
    `    CONSTRAINT odb_settings_store_chk_secret CHECK (secret IN ('Y', 'N'))`,
    `)`,
  ].join('\n')

  return [
    `BEGIN`,
    `  EXECUTE IMMEDIATE q'[${ddl}]';`,
    `EXCEPTION WHEN OTHERS THEN`,
    `  IF SQLCODE != -955 THEN RAISE; END IF;`,
    `END;`,
    `/`,
  ].join('\n')
}

/**
 * Pre-installed settings store (`odb_settings` + `odb_settings_store`).
 *
 * Call `odbSettings.toSQLUp()` from a migration `.up()` to install the table and
 * package, and `odbSettings.toSQLDown()` from `.down()` to drop them. The
 * fallback encryption key defaults to a built-in development key; override it
 * with the `masterKey` option or the `ODBVUE_SETTINGS_MASTER_KEY` environment
 * variable.
 *
 * The `<fn>(...)` helpers return PL/SQL call/expression strings. Every argument
 * should be a valid PL/SQL expression (bare variable name, literal, or nested
 * call).
 */
export const odbSettings = {
  /** Install `odb_settings_store` (table) and `odb_settings` (spec + body). */
  toSQLUp(options: { schema?: string; masterKey?: string } = {}): string {
    const masterKey = resolveMasterKey(options.masterKey)
    const specSql = options.schema
      ? spec.replace(
          /^CREATE OR REPLACE PACKAGE odb_settings AS/,
          `CREATE OR REPLACE PACKAGE ${qualify(SETTINGS_PKG_NAME, options.schema)} AS`,
        )
      : spec
    const bodySql = (
      options.schema
        ? body.replace(
            /^CREATE OR REPLACE PACKAGE BODY odb_settings AS/,
            `CREATE OR REPLACE PACKAGE BODY ${qualify(SETTINGS_PKG_NAME, options.schema)} AS`,
          )
        : body
    ).replace(MASTER_KEY_MARKER, masterKey)
    return [tableUpSQL(options.schema), specSql, bodySql].join('\n')
  },

  /** Drop `odb_settings` (package) and `odb_settings_store` (table). */
  toSQLDown(options: { schema?: string } = {}): string {
    const pkg = qualify(SETTINGS_PKG_NAME, options.schema)
    const table = qualify(SETTINGS_TABLE_NAME, options.schema)
    return [
      `BEGIN`,
      `  EXECUTE IMMEDIATE 'DROP PACKAGE ${pkg}';`,
      `EXCEPTION WHEN OTHERS THEN`,
      `  IF SQLCODE != -4043 THEN RAISE; END IF;`,
      `END;`,
      `/`,
      `BEGIN`,
      `  EXECUTE IMMEDIATE 'DROP TABLE ${table} PURGE';`,
      `EXCEPTION WHEN OTHERS THEN`,
      `  IF SQLCODE != -942 THEN RAISE; END IF;`,
      `END;`,
      `/`,
    ].join('\n')
  },

  /** `odb_settings.read(<id>)` → VARCHAR2 (decrypted value). Pass `odbLiteral('KEY')` for a literal id. */
  read(id: PlsqlRenderable): string {
    return `odb_settings.read(${renderPlsql(id)})`
  },

  /**
   * `odb_settings.write(<id>, <name>, <value>, <options>, <secret>)`.
   *
   * `id` and `value` are PL/SQL expressions (use `odbLiteral(...)` for literals).
   * `name` defaults to `id`; set `secret: true` to store the value encrypted.
   */
  write(
    id: PlsqlRenderable,
    value: PlsqlRenderable,
    opts: { name?: PlsqlRenderable; options?: PlsqlRenderable; secret?: boolean } = {},
  ): string {
    const idSql = renderPlsql(id)
    const nameSql = opts.name !== undefined ? renderPlsql(opts.name) : idSql
    const optionsSql = opts.options !== undefined ? renderPlsql(opts.options) : 'NULL'
    const secretSql = opts.secret ? `'Y'` : `'N'`
    return `odb_settings.write(${idSql}, ${nameSql}, ${renderPlsql(value)}, ${optionsSql}, ${secretSql})`
  },

  /** `odb_settings.remove(<id>)`. Pass `odbLiteral('KEY')` for a literal id. */
  remove(id: PlsqlRenderable): string {
    return `odb_settings.remove(${renderPlsql(id)})`
  },

  /**
   * Build a migration artifact that seeds one or more settings via the package's
   * upsert. Install it after `odbSettings` so the package exists:
   *
   * @example
   * defineMigration('...', { schema })
   *   .install(odbSettings)
   *   .install(odbSettings.seed({ id: 'APP_VERSION', name: 'Version', value: '1.0.0' }))
   *
   * String fields are plain text (quoted automatically). `up` upserts each
   * setting (encrypting when `secret` is true); `down` removes them.
   */
  seed(
    ...settings: Array<{
      id: string
      value: string
      name?: string
      options?: string
      secret?: boolean
    }>
  ) {
    if (settings.length === 0)
      throw new Error('odbSettings.seed(): at least one setting is required.')

    return {
      toSQLUp(options: { schema?: string } = {}): string {
        const pkg = qualify(SETTINGS_PKG_NAME, options.schema)
        return settings
          .map((s) =>
            block(
              `${pkg}.write(${lit(s.id)}, ${lit(s.name ?? s.id)}, ${lit(s.value)}, ` +
                `${s.options !== undefined ? lit(s.options) : 'NULL'}, ${s.secret ? `'Y'` : `'N'`})`,
            ),
          )
          .join('\n')
      },
      toSQLDown(options: { schema?: string } = {}): string {
        const pkg = qualify(SETTINGS_PKG_NAME, options.schema)
        return settings
          .toReversed()
          .map((s) => block(`${pkg}.remove(${lit(s.id)})`))
          .join('\n')
      },
    }
  },
}
