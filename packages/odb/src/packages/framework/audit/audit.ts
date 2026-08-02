// Pre-installed API: OpenTelemetry-aligned audit log (odb_audit).
//
// This module exposes two things:
//
// 1. `odbAudit.toSQLUp()` / `odbAudit.toSQLDown()` — SQL to install / drop the
//    `odb_audit_logs` table and the `odb_audit` package in the target schema.
//    Call these from a migration's `.up()` / `.down()`.
//
// 2. `odbAudit.<fn>(...)` — pure functions returning PL/SQL call/expression
//    strings that invoke `odb_audit.*`. Use them anywhere a PL/SQL statement
//    or expression is accepted (e.g. `body.raw(odbAudit.info("'started'"))`).
//    For the common case prefer the `body.audit*` helpers, e.g.
//    `body.auditEvent('user logged in', { 'user.id': 'p_uuid' })`.
//
// The table and package model an OpenTelemetry LogRecord (logs only — no
// spans or traces yet). Column names follow the OTel Logs data model and the
// enriched `attributes` use OTel semantic-convention keys (e.g. `service.name`,
// `http.request.method`, `exception.message`).
//
// The PL/SQL sources below are the source-of-truth for `odb_audit`.

import { readFileSync } from 'node:fs'

const spec = readFileSync(new URL('./audit.pks', import.meta.url), 'utf8')
const body = readFileSync(new URL('./audit.pkb', import.meta.url), 'utf8')

const AUDIT_PKG_NAME = 'odb_audit'
const AUDIT_TABLE_NAME = 'odb_audit_logs'

function qualify(name: string, schema?: string): string {
  return schema ? `${schema}.${name}` : name
}

/** DDL for the `odb_audit_logs` table, wrapped so re-installs are idempotent (ORA-00955). */
function tableUpSQL(schema?: string): string {
  const table = qualify(AUDIT_TABLE_NAME, schema)
  const ddl = [
    `CREATE TABLE ${table} (`,
    `    id                 CHAR(32 CHAR) DEFAULT lower(sys_guid()) NOT NULL ENABLE,`,
    `    observed_timestamp TIMESTAMP(6) DEFAULT systimestamp NOT NULL ENABLE,`,
    `    event_timestamp    TIMESTAMP(6) DEFAULT systimestamp NOT NULL ENABLE,`,
    `    severity_number    NUMBER(2) DEFAULT 9 NOT NULL ENABLE,`,
    `    severity_text      VARCHAR2(30 CHAR) DEFAULT 'INFO' NOT NULL ENABLE,`,
    `    body               VARCHAR2(2000 CHAR) NOT NULL ENABLE,`,
    `    attributes         CLOB,`,
    `    service_name       VARCHAR2(255 CHAR) GENERATED ALWAYS AS (JSON_VALUE(attributes FORMAT JSON, '$."service.name"' RETURNING VARCHAR2(255) NULL ON ERROR)) VIRTUAL,`,
    `    service_version    VARCHAR2(255 CHAR) GENERATED ALWAYS AS (JSON_VALUE(attributes FORMAT JSON, '$."service.version"' RETURNING VARCHAR2(255) NULL ON ERROR)) VIRTUAL,`,
    `    CONSTRAINT odb_audit_logs_pk PRIMARY KEY (id),`,
    `    CONSTRAINT odb_audit_logs_chk_attributes CHECK (attributes IS JSON),`,
    `    CONSTRAINT odb_audit_logs_chk_severity CHECK (severity_text IN ('TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'))`,
    `)`,
  ].join('\n')

  const index = `CREATE INDEX ${qualify('odb_audit_logs_ix_event', schema)} ON ${table} (event_timestamp)`

  return [
    `BEGIN`,
    `  EXECUTE IMMEDIATE q'[${ddl}]';`,
    `EXCEPTION WHEN OTHERS THEN`,
    `  IF SQLCODE != -955 THEN RAISE; END IF;`,
    `END;`,
    `/`,
    `BEGIN`,
    `  EXECUTE IMMEDIATE q'[${index}]';`,
    `EXCEPTION WHEN OTHERS THEN`,
    `  IF SQLCODE NOT IN (-955, -1408) THEN RAISE; END IF;`,
    `END;`,
    `/`,
  ].join('\n')
}

/**
 * Pre-installed audit log API (`odb_audit` + `odb_audit_logs`).
 *
 * Call `odbAudit.toSQLUp()` from a migration `.up()` to install the table and
 * package, and `odbAudit.toSQLDown()` from `.down()` to drop them.
 *
 * The `<fn>(...)` helpers return PL/SQL call/expression strings. Every argument
 * should be a valid PL/SQL expression (bare variable name, literal, or nested
 * call).
 */
export const odbAudit = {
  /** Install `odb_audit_logs` (table) and `odb_audit` (spec + body). Optional schema qualifies the names. */
  toSQLUp(options: { schema?: string } = {}): string {
    const specSql = options.schema
      ? spec.replace(
          /^CREATE OR REPLACE PACKAGE odb_audit AS/,
          `CREATE OR REPLACE PACKAGE ${qualify(AUDIT_PKG_NAME, options.schema)} AS`,
        )
      : spec
    const bodySql = options.schema
      ? body.replace(
          /^CREATE OR REPLACE PACKAGE BODY odb_audit AS/,
          `CREATE OR REPLACE PACKAGE BODY ${qualify(AUDIT_PKG_NAME, options.schema)} AS`,
        )
      : body
    return [tableUpSQL(options.schema), specSql, bodySql].join('\n')
  },

  /** Drop `odb_audit` (package) and `odb_audit_logs` (table). Optional schema qualifies the names. */
  toSQLDown(options: { schema?: string } = {}): string {
    const pkg = qualify(AUDIT_PKG_NAME, options.schema)
    const table = qualify(AUDIT_TABLE_NAME, options.schema)
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

  /** `odb_audit.log(<severity>, <body>[, <attributes>[, <event_timestamp>]])` */
  log(severity: string, message: string, attributes?: string, eventTimestamp?: string): string {
    const args = [severity, message]
    if (attributes !== undefined || eventTimestamp !== undefined) args.push(attributes ?? 'NULL')
    if (eventTimestamp !== undefined) args.push(eventTimestamp)
    return `odb_audit.log(${args.join(', ')})`
  },

  /** `odb_audit.debug(<body>[, <attributes>])` */
  debug(message: string, attributes?: string): string {
    return attributes === undefined
      ? `odb_audit.debug(${message})`
      : `odb_audit.debug(${message}, ${attributes})`
  },

  /** `odb_audit.info(<body>[, <attributes>])` */
  info(message: string, attributes?: string): string {
    return attributes === undefined
      ? `odb_audit.info(${message})`
      : `odb_audit.info(${message}, ${attributes})`
  },

  /** `odb_audit.warn(<body>[, <attributes>])` */
  warn(message: string, attributes?: string): string {
    return attributes === undefined
      ? `odb_audit.warn(${message})`
      : `odb_audit.warn(${message}, ${attributes})`
  },

  /** `odb_audit.error(<body>[, <attributes>])` */
  error(message: string, attributes?: string): string {
    return attributes === undefined
      ? `odb_audit.error(${message})`
      : `odb_audit.error(${message}, ${attributes})`
  },

  /** `odb_audit.fatal(<body>[, <attributes>])` */
  fatal(message: string, attributes?: string): string {
    return attributes === undefined
      ? `odb_audit.fatal(${message})`
      : `odb_audit.fatal(${message}, ${attributes})`
  },

  /** `odb_audit.severity_number(<severity>)` → PLS_INTEGER (OTel SeverityNumber) */
  severityNumber(severity: string): string {
    return `odb_audit.severity_number(${severity})`
  },

  /** `odb_audit.bulk(<json_array>)` */
  bulk(data: string): string {
    return `odb_audit.bulk(${data})`
  },

  /** `odb_audit.purge(<older_than>)` */
  purge(olderThan: string): string {
    return `odb_audit.purge(${olderThan})`
  },
}
