// Pre-installed API: settings store with encrypted secrets (odb_settings).
//
// This module exposes two things:
//
// 1. `odbSettings.toSQLUp()` / `odbSettings.toSQLDown()` — SQL to install / drop
//    the settings store, local key (when used), and the `odb_settings` package in the target
//    schema. Call these from a migration's `.up()` / `.down()`.
//
// 2. `odbSettings.<fn>(...)` — pure functions returning PL/SQL call/expression
//    strings that invoke `odb_settings.*`. Use them anywhere a PL/SQL statement
//    or expression is accepted (e.g. `body.set(v_out, odbSettings.read("'API_URL'"))`).
//
// Secrets are encrypted with AES-256-CBC. The master key is obtained at runtime
// from a local development key or OCI Vault.
//
// The PL/SQL sources below are the source-of-truth for `odb_settings`.

import { readFileSync } from 'node:fs'

import {
  PlsqlExpression,
  PlsqlStatement,
  renderPlsql,
  type PlsqlRenderable,
} from '../../../schema/attribute.js'
import { dropPackageIfExists, plsqlBlock, qualify } from '../../../schema/ddl.js'
import { odbPackage, odbType } from '../../../schema/package.js'
import { odbAuth } from '../auth/auth.js'

const spec = readFileSync(new URL('./settings.pks', import.meta.url), 'utf8')
const body = readFileSync(new URL('./settings.pkb', import.meta.url), 'utf8')

const SETTINGS_PKG_NAME = 'odb_settings'
const SETTINGS_TABLE_NAME = 'odb_settings_store'
const LOCAL_KEY_TABLE = 'APP_SETTINGS_MASTER_KEY_LOCAL'
function lit(v: string): string {
  return `'${v.replace(/'/g, "''")}'`
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
 * package, and `odbSettings.toSQLDown()` from `.down()` to drop them.
 *
 * The `<fn>(...)` helpers return PL/SQL call/expression strings. Every argument
 * should be a valid PL/SQL expression (bare variable name, literal, or nested
 * call).
 */
export const odbSettings = {
  /** Install `odb_settings_store` (table) and `odb_settings` (spec + body). */
  toSQLUp(options: { schema?: string; vaultSecretUri?: string } = {}): string {
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
    ).replace(
      '__ODB_SETTINGS_VAULT_SECRET_URI__',
      (options.vaultSecretUri ?? '').replace(/'/g, "''"),
    )
    const keyTable = qualify(LOCAL_KEY_TABLE, options.schema)
    const localKeySql = options.vaultSecretUri
      ? []
      : [
          `BEGIN EXECUTE IMMEDIATE 'CREATE TABLE ${keyTable} (id NUMBER PRIMARY KEY, master_key RAW(32) NOT NULL, CONSTRAINT APP_SETTINGS_MASTER_KEY_LOCAL_CK CHECK (id = 1))'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;\n/`,
          `INSERT INTO ${keyTable} (id, master_key) SELECT 1, DBMS_CRYPTO.RANDOMBYTES(32) FROM dual WHERE NOT EXISTS (SELECT 1 FROM ${keyTable} WHERE id = 1);\nCOMMIT;`,
        ]
    return [...localKeySql, tableUpSQL(options.schema), specSql, bodySql].join('\n')
  },

  /** Drop `odb_settings` (package) and `odb_settings_store` (table). */
  toSQLDown(options: { schema?: string; vaultSecretUri?: string } = {}): string {
    const table = qualify(SETTINGS_TABLE_NAME, options.schema)
    const dropTable = (name: string) =>
      `BEGIN EXECUTE IMMEDIATE 'DROP TABLE ${qualify(name, options.schema)} PURGE'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF; END;\n/`
    return [
      dropPackageIfExists(SETTINGS_PKG_NAME, options.schema),
      `BEGIN`,
      `  EXECUTE IMMEDIATE 'DROP TABLE ${table} PURGE';`,
      `EXCEPTION WHEN OTHERS THEN`,
      `  IF SQLCODE != -942 THEN RAISE; END IF;`,
      `END;`,
      `/`,
      ...(options.vaultSecretUri ? [] : [dropTable(LOCAL_KEY_TABLE)]),
    ].join('\n')
  },

  local() {
    return {
      toSQLUp: (options: { schema?: string } = {}) => odbSettings.toSQLUp(options),
      toSQLDown: (options: { schema?: string } = {}) => odbSettings.toSQLDown(options),
    }
  },

  vaultSecret(vaultSecretUri: string) {
    return {
      toSQLUp: (options: { schema?: string } = {}) =>
        odbSettings.toSQLUp({ ...options, vaultSecretUri }),
      toSQLDown: (options: { schema?: string } = {}) =>
        odbSettings.toSQLDown({ ...options, vaultSecretUri }),
    }
  },

  /** `odb_settings.read(<id>)` → VARCHAR2 (decrypted value). Pass `odbLiteral('KEY')` for a literal id. */
  read(id: PlsqlRenderable): PlsqlExpression<'VARCHAR2'> {
    return new PlsqlExpression('VARCHAR2', `odb_settings.read(${renderPlsql(id)})`)
  },

  readRegular(id: PlsqlRenderable): PlsqlExpression<'VARCHAR2'> {
    return new PlsqlExpression('VARCHAR2', `odb_settings.read_regular(${renderPlsql(id)})`)
  },

  readSecret(id: PlsqlRenderable): PlsqlExpression<'VARCHAR2'> {
    return new PlsqlExpression('VARCHAR2', `odb_settings.read_secret(${renderPlsql(id)})`)
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
  ): PlsqlStatement {
    const idSql = renderPlsql(id)
    const nameSql = opts.name !== undefined ? renderPlsql(opts.name) : idSql
    const optionsSql = opts.options !== undefined ? renderPlsql(opts.options) : 'NULL'
    const secretSql = opts.secret ? `'Y'` : `'N'`
    return new PlsqlStatement(
      `odb_settings.write(${idSql}, ${nameSql}, ${renderPlsql(value)}, ${optionsSql}, ${secretSql})`,
    )
  },

  /** `odb_settings.remove(<id>)`. Pass `odbLiteral('KEY')` for a literal id. */
  remove(id: PlsqlRenderable): PlsqlStatement {
    return new PlsqlStatement(`odb_settings.remove(${renderPlsql(id)})`)
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
            plsqlBlock(
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
          .map((s) => plsqlBlock(`${pkg}.remove(${lit(s.id)})`))
          .join('\n')
      },
    }
  },
}

export const odbSettingsApi = odbPackage('odb_settings_api', { basePath: '/settings' }, (pkg) => {
  const readSetting = pkg.proc(
    'read_setting',
    {
      in: { authorization: odbType.string(4000), id: odbType.string(30) },
      out: { value: odbType.string(2000) },
    },
    ({ params, body: statements }) => {
      const { userId } = statements.variables({ userId: odbType.guid() })
      statements.set(userId, odbAuth.requireUser(params.authorization))
      statements.set(params.value, odbSettings.readRegular(params.id))
    },
  )
  const writeSetting = pkg.proc(
    'write_setting',
    {
      in: {
        authorization: odbType.string(4000),
        id: odbType.string(30),
        value: odbType.string(2000),
      },
    },
    ({ params, body: statements }) => {
      const { userId } = statements.variables({ userId: odbType.guid() })
      statements.set(userId, odbAuth.requireUser(params.authorization))
      statements.call(odbSettings.write(params.id, params.value)).commit()
    },
  )
  const readSecretSetting = pkg.proc(
    'read_secret_setting',
    {
      in: { authorization: odbType.string(4000), id: odbType.string(30) },
      out: { value: odbType.string(2000) },
    },
    ({ params, body: statements }) => {
      const { userId } = statements.variables({ userId: odbType.guid() })
      statements.set(userId, odbAuth.requireUser(params.authorization))
      statements.set(params.value, odbSettings.readSecret(params.id))
    },
  )
  const writeSecretSetting = pkg.proc(
    'write_secret_setting',
    {
      in: {
        authorization: odbType.string(4000),
        id: odbType.string(30),
        value: odbType.string(2000),
      },
    },
    ({ params, body: statements }) => {
      const { userId } = statements.variables({ userId: odbType.guid() })
      statements.set(userId, odbAuth.requireUser(params.authorization))
      statements.call(odbSettings.write(params.id, params.value, { secret: true })).commit()
    },
  )
  return { readSetting, writeSetting, readSecretSetting, writeSecretSetting }
})
