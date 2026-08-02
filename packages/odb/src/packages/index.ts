// PL/SQL package interfaces exposed by odb.
//
// - `oracle/`    — Oracle built-in packages (UTL_RAW, DBMS_*). Always present,
//                  no install step. Pure typed expression builders.
// - `framework/` — odb-shipped packages (e.g. odb_lob). Carry .pks/.pkb
//                  source plus toSQLUp()/toSQLDown() to install into a schema.
export * from './oracle/index.js'
export * from './framework/index.js'
