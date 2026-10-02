import { describe, expect, expectTypeOf, it } from 'vitest'
import { Column } from '../../src/schema/column.js'
import { odbTable } from '../../src/schema/table.js'

describe('odbTable', () => {
  it('emits typed foreign keys with schema-qualified tables and delete actions', () => {
    const users = odbTable('APP_USERS', (table) => ({
      id: table.guid().primaryKey(),
      tenantId: table.number().primaryKey(),
    }))
    const sessions = odbTable('APP_SESSIONS', (table) => ({
      userId: table.guid(),
      tenantId: table.number(),
    }))
      .foreignKey(
        'fk_session_user',
        (columns) => [columns.userId],
        users,
        (columns) => [columns.id],
        { onDelete: 'cascade' },
      )
      .foreignKey(
        'fk_session_tenant_user',
        (columns) => [columns.tenantId, columns.userId],
        users,
        (columns) => [columns.tenantId, columns.id],
        { onDelete: 'set null' },
      )

    expect(sessions.toSQLUp({ schema: 'APP' })).toContain(
      'ALTER TABLE APP.APP_SESSIONS ADD CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES APP.APP_USERS (id) ON DELETE CASCADE;',
    )
    expect(sessions.toSQLUp()).toContain(
      'FOREIGN KEY (tenant_id, user_id) REFERENCES APP_USERS (tenant_id, id) ON DELETE SET NULL;',
    )
    expect(sessions.toNode().foreignKeys[0]).toEqual({
      kind: 'foreignKey',
      name: 'fk_session_user',
      columns: ['user_id'],
      referencedTable: 'APP_USERS',
      referencedColumns: ['id'],
      onDelete: 'cascade',
    })

    if (process.env.TYPE_CHECK_ONLY) {
      // @ts-expect-error unknown local columns are rejected
      sessions.foreignKey(
        'bad',
        (columns) => [columns.missing],
        users,
        (columns) => [columns.id],
      )
      // @ts-expect-error unknown referenced columns are rejected
      sessions.foreignKey(
        'bad',
        (columns) => [columns.userId],
        users,
        (columns) => [columns.missing],
      )
      // @ts-expect-error mismatched column types are rejected
      sessions.foreignKey(
        'bad',
        (columns) => [columns.userId],
        users,
        (columns) => [columns.tenantId],
      )
      // @ts-expect-error mismatched tuple lengths are rejected
      sessions.foreignKey(
        'bad',
        (columns) => [columns.userId, columns.tenantId],
        users,
        (columns) => [columns.id],
      )
      // @ts-expect-error empty column lists are rejected
      sessions.foreignKey(
        'bad',
        () => [],
        users,
        (columns) => [columns.id],
      )
    }
  })

  it('rejects foreign key columns from the wrong table', () => {
    const users = odbTable('USERS', (table) => ({ id: table.guid().primaryKey() }))
    const other = odbTable('OTHER', (table) => ({
      id: table.guid().primaryKey(),
      userId: table.guid(),
    }))
    const sessions = odbTable('SESSIONS', (table) => ({ userId: table.guid() }))
    expect(() =>
      sessions.foreignKey(
        'bad',
        () => [other.userId],
        users,
        (columns) => [columns.id],
      ),
    ).toThrow('Foreign key columns must belong to their declared tables.')
    expect(() =>
      sessions.foreignKey(
        'bad',
        (columns) => [columns.userId],
        users,
        () => [other.id],
      ),
    ).toThrow('Foreign key columns must belong to their declared tables.')
  })

  it('preserves the table name when a returned column uses a reserved property name', () => {
    const users = odbTable('APP_USERS', (t) => ({
      id: t.number('id').notNull(),
      name: t.string('name', 100).notNull(),
    }))

    expect(users.name).toBe('APP_USERS')
    expect(users.toNode().columns.some((column) => column.name === 'name')).toBe(true)
  })

  it('registers returned columns in the generated table schema', () => {
    const table = odbTable('APP_TABLE', (t) => {
      const columns = {
        created: t.timestamp('created').defaultCurrentTimestamp().notNull(),
        name: t.string('name', 200).notNull(),
      }

      t.unique('uq_app_table_name', ['name'])
      return columns
    })

    expect(table.toNode().columns.map((column) => column.name)).toEqual(['created', 'name'])
    expect(table.toSQLUp()).toContain('name VARCHAR2(200 CHAR) NOT NULL')
    expect(table.toSQLUp()).toContain('CREATE UNIQUE INDEX uq_app_table_name')
  })

  it('emits a unique constraint for column-level unique metadata', () => {
    const table = odbTable('APP_USERS', (t) => ({
      email: t.string('EMAIL').unique(),
    }))

    expect(table.toSQLUp()).toContain('EMAIL VARCHAR2(255 CHAR) UNIQUE')
  })

  it('emits a json column as CLOB with an IS JSON check and typed value', () => {
    const table = odbTable('APP_CONFIG', (t) => ({
      meta: t.json<{ label: string }>('meta').notNull().default({ label: "it's" }),
    }))

    expect(table.toSQLUp()).toContain(
      `meta CLOB DEFAULT '{"label":"it''s"}' NOT NULL CHECK (meta IS JSON)`,
    )
    expectTypeOf(table.meta).toMatchTypeOf<Column<{ label: string }, 'meta'>>()
  })

  it('emits an identity primary key column', () => {
    const table = odbTable('APP_USERS', (t) => ({
      id: t.number('id').identity().primaryKey(),
    }))

    const sql = table.toSQLUp()
    expect(sql).toContain('id NUMBER GENERATED BY DEFAULT AS IDENTITY NOT NULL')
    expect(sql).toContain('CONSTRAINT primary_key_APP_USERS PRIMARY KEY (id)')
  })

  it('emits escaped table and column comments', () => {
    const table = odbTable('APP_USERS', (t) => ({
      id: t.number().primaryKey().comment("User's primary key"),
    })).comment('Application users table')

    const sql = table.toSQLUp({ schema: 'APP' })
    expect(sql).toContain("COMMENT ON TABLE APP.APP_USERS IS 'Application users table';")
    expect(sql).toContain("COMMENT ON COLUMN APP.APP_USERS.id IS 'User''s primary key';")
  })

  it('emits named check constraints', () => {
    const table = odbTable('APP_USERS', (t) => {
      const columns = { status: t.string('status', 1).default('N').notNull() }
      t.check('csc_app_users_status', "status IN ( 'A', 'D', 'N' )")
      return columns
    })

    expect(table.toSQLUp()).toContain("status VARCHAR2(1 CHAR) DEFAULT 'N' NOT NULL")
    expect(table.toSQLUp()).toContain(
      "CONSTRAINT csc_app_users_status CHECK (status IN ( 'A', 'D', 'N' ))",
    )
  })

  it('generates names for indexes, unique indexes, and checks', () => {
    const table = odbTable('APP_USERS', (t) => ({
      tenantId: t.number().notNull(),
      emailAddress: t.string().notNull(),
      status: t.string(1).notNull(),
    }))
      .index(['tenant_id', 'email_address'])
      .unique(['email_address'])
      .check(['status'], "status IN ('A', 'D')")

    const sql = table.toSQLUp()
    expect(sql).toContain("CONSTRAINT check_app_users_status CHECK (status IN ('A', 'D'))")
    expect(sql).toContain('CREATE INDEX index_app_users_tenant_id_email_address')
    expect(sql).toContain('CREATE UNIQUE INDEX unique_app_users_email_address')
  })

  it('supports typed column selectors and check expressions', () => {
    const table = odbTable('APP_USERS', (t) => ({
      tenantId: t.number().notNull(),
      emailAddress: t.string().notNull(),
      status: t.string(1).notNull(),
    }))
      .index((columns) => [columns.tenantId, columns.emailAddress])
      .unique((columns) => [columns.emailAddress])
      .check((columns, expression) => expression.in(columns.status, ['A', 'D', 'N']))

    const sql = table.toSQLUp()
    expect(sql).toContain("CONSTRAINT check_app_users_status CHECK (status IN ('A', 'D', 'N'))")
    expect(sql).toContain(
      'CREATE INDEX index_app_users_tenant_id_email_address ON APP_USERS (tenant_id, email_address)',
    )
    expect(sql).toContain(
      'CREATE UNIQUE INDEX unique_app_users_email_address ON APP_USERS (email_address)',
    )

    if (process.env.TYPE_CHECK_ONLY) {
      // @ts-expect-error unknown columns are rejected by selectors
      table.unique((columns) => [columns.missing])
      // @ts-expect-error check values must match the selected column type
      table.check((columns, expression) => expression.in(columns.status, [1]))
    }
  })

  it('renders typed literals and explicit SQL expression defaults', () => {
    const table = odbTable('DEFAULTS', (t) => ({
      label: t.string().default("O'Reilly"),
      attempts: t.number().default(0),
      enabled: t.boolean().default(true),
      calculated: t.number().defaultSql('1 + 1'),
    }))

    const sql = table.toSQLUp()
    expect(sql).toContain("label VARCHAR2(255 CHAR) DEFAULT 'O''Reilly'")
    expect(sql).toContain('attempts NUMBER DEFAULT 0')
    expect(sql).toContain('enabled NUMBER(1) DEFAULT 1')
    expect(sql).toContain('calculated NUMBER DEFAULT 1 + 1')
  })

  it('accepts column instances when defining indexes', () => {
    const users = odbTable('APP_USERS', (t) => ({
      email: t.string('EMAIL').notNull(),
      tenantId: t.string('TENANT_ID').notNull(),
    }))

    const table = odbTable('APP_USERS', (t) => {
      t.index('idx_app_users_email_tenant', [users.email, users.tenantId])
      return {
        email: users.email,
        tenantId: users.tenantId,
      }
    })

    expect(table.toSQLUp()).toContain('CREATE INDEX idx_app_users_email_tenant')
    expect(table.toSQLUp()).toContain('ON APP_USERS (EMAIL, TENANT_ID)')
  })

  it('infers column value types from the schema', () => {
    const users = odbTable('APP_USERS', (t) => ({
      id: t.number('id').notNull(),
      username: t.string('username', 100).notNull(),
    }))

    expectTypeOf(users.id).toEqualTypeOf<Column<number, 'id'>>()
    expectTypeOf(users.username).toEqualTypeOf<Column<string, 'username'>>()
  })

  it('infers omitted column names from object keys as snake_case', () => {
    const users = odbTable('APP_USERS', (t) => {
      const columns = {
        id: t.number().identity().primaryKey(),
        displayName: t.string(240).notNull(),
        createdAt: t.timestamp().notNull(),
      }
      t.index([columns.displayName])
      return columns
    })

    expect(users.toNode().columns.map((column) => column.name)).toEqual([
      'id',
      'display_name',
      'created_at',
    ])
    expect(users.toSQLUp()).toContain(
      'CREATE INDEX index_app_users_display_name ON APP_USERS (display_name)',
    )
    expectTypeOf(users.id).toEqualTypeOf<Column<number, 'id', false, false, true, true, 'number'>>()
    expectTypeOf(users.displayName).toEqualTypeOf<
      Column<string, 'displayName', false, false, false, false, 'string'>
    >()
  })
})
