# Analysis & Strategy for Oracle DB CLI Tool

## Current Structure Analysis

Based on the workspace, we have:

- **`./cli`** - CLI commands (likely using a framework like Commander/Yargs)
- **`./db`** - SQL scripts and database artifacts
- **`./apps/src/api`** - TypeScript API definitions (likely the type-safe backend)

The `test.sql` shows idempotent DDL generation - a good pattern for repeatability.

## Proposed Strategy

### Recommended Approach: **TypeScript-First with Bidirectional Sync**

```
┌─────────────────────────────────────────────────────────────────┐
│                      SOURCE OF TRUTH                            │
│                    TypeScript Definitions                       │
│                    (./apps/src/api/schema)                      │
└─────────────────────────┬───────────────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
    ov db-scaffold    ov db-export    ov db-diff
         │                │                │
         ▼                ▼                ▼
┌─────────────┐    ┌─────────────┐   ┌─────────────┐
│    JSON     │◄───│   Oracle    │   │  Migration  │
│   Schema    │    │     DB      │   │   Scripts   │
└──────┬──────┘    └─────────────┘   └─────────────┘
       │
       ▼
   ov db-import
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Generated SQL                               │
│                  (./db/migrations)                              │
│              - Versioned & Idempotent                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Organization

### TypeScript Definition (Source of Truth)

```typescript
// filepath: ./apps/src/api/schema/tables/app-users.ts
import { defineTable, varchar, number, timestamp, raw } from '@odbvue/schema'

export const appUsers = defineTable('APP_USERS', {
  schema: 'ODBVUE',
  columns: {
    id: number({ precision: 19, identity: true, primaryKey: true }),
    uuid: raw(16, { default: 'SYS_GUID()', notNull: true }),
    username: varchar(200, { notNull: true }),
    fullname: varchar(200, { notNull: true }),
    created: timestamp({ default: 'SYSTIMESTAMP', notNull: true }),
    updated: timestamp(),
  },
  constraints: {
    unique: [['uuid'], ['username']],
  },
})
```

### JSON Schema (Intermediate Format)

```json
// filepath: ./db/schema/tables/app-users.json
{
  "name": "APP_USERS",
  "schema": "ODBVUE",
  "columns": [
    { "name": "ID", "type": "NUMBER(19,0)", "identity": true, "primaryKey": true },
    { "name": "UUID", "type": "RAW(16)", "default": "SYS_GUID()", "notNull": true },
    { "name": "USERNAME", "type": "VARCHAR2(200 CHAR)", "notNull": true },
    { "name": "FULLNAME", "type": "VARCHAR2(200 CHAR)", "notNull": true },
    { "name": "CREATED", "type": "TIMESTAMP(6)", "default": "SYSTIMESTAMP", "notNull": true },
    { "name": "UPDATED", "type": "TIMESTAMP(6)" }
  ],
  "constraints": {
    "unique": [["UUID"], ["USERNAME"]]
  }
}
```

---

## CLI Commands Structure

| Command          | Description                            |
| ---------------- | -------------------------------------- |
| `ov db-scaffold` | TS → JSON schema generation            |
| `ov db-import`   | JSON → SQL migration scripts           |
| `ov db-export`   | Oracle DB → JSON (reverse engineering) |
| `ov db-diff`     | Compare JSON ↔ DB, generate delta SQL  |
| `ov db-run`      | Execute SQL scripts against DB         |
| `ov db-release`  | Tag version, generate changelog        |

---

## Recommended Directory Structure

```
odbvue/
├── cli/
│   ├── commands/
│   │   ├── db-scaffold.ts
│   │   ├── db-import.ts
│   │   ├── db-export.ts
│   │   ├── db-diff.ts
│   │   ├── db-run.ts
│   │   └── db-release.ts
│   └── index.ts
├── db/
│   ├── schema/           # JSON (intermediate format)
│   │   ├── tables/
│   │   ├── views/
│   │   └── packages/
│   ├── migrations/       # Versioned SQL
│   │   ├── v1.0.0/
│   │   └── v1.1.0/
│   └── releases/         # Release bundles
├── apps/src/api/
│   └── schema/           # TypeScript definitions (source of truth)
│       ├── tables/
│       ├── relations/
│       └── index.ts
```

---

## Key Recommendations

1. **TypeScript as source of truth** - Better IDE support, type checking, reusable in API layer
2. **JSON as intermediate format** - Language-agnostic, easy to diff, version control friendly
3. **Idempotent SQL** - Keep the current pattern from `test.sql`, it's solid
4. **Versioned migrations** - Store in `db/migrations/vX.X.X/` for release management
5. **Separate concerns**: Schema definition (TS) → Transport (JSON) → Execution (SQL)

---

## Workflow Options

### Option 1: Forward Engineering (Recommended)

```
TS definitions → ov db-scaffold → JSON → ov db-import → SQL → ov db-run
```

### Option 2: Reverse Engineering

```
Develop in DB → ov db-export → JSON → TS
```

### Release Management (Separate Process)

```
ov db-diff → stage changes → ov db-release → version control
```
