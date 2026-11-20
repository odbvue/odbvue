import {
  authUsers,
  authSessions,
  authRoles,
  authUserRoles,
  auditLogs,
  cond,
  defineMigration,
  defineService,
  odbEnv,
  odbAuth,
  odbOracle,
  odbLiteral,
  odbPackage,
  odbQuery,
  odbSettings,
  odbTable,
  odbType,
  plsqlExpr,
  settingsStore,
  type Package,
} from '@odbvue/odb'

const searchPageInputs = {
  after: odbType.json(),
  limit: odbType.integer(),
  search: odbType.string(256),
}

const findUserId = (id: Parameters<typeof cond.eq>[1]) =>
  odbQuery().selectFrom(authUsers).select(authUsers.id).where(cond.eq(authUsers.id, id))

const userQuery = () =>
  odbQuery()
    .selectFrom(authUsers)
    .select([
      authUsers.id,
      authUsers.username,
      authUsers.displayName,
      authUsers.enabled,
      authUsers.createdAt,
      authUsers.updatedAt,
    ])

export const adminPackage: Package<Record<never, never>> = odbPackage('pck_admin', (pkg) => {
  const listUsers = pkg.proc(
    'list_users',
    {
      in: {
        after: odbType.json(),
        limit: odbType.integer(),
        search: odbType.string(256),
      },
      out: { items: odbType.resultset() },
    },
    ({ params: { after, limit, search, items }, body }) => {
      const term = odbOracle.lower(odbOracle.trim(search))
      body.openFor(
        items,
        userQuery()
          .where(
            cond.or([
              cond.isNull(term),
              cond.gt(odbOracle.instr(odbOracle.lower(authUsers.username), term), 0),
              cond.gt(odbOracle.instr(odbOracle.lower(authUsers.displayName), term), 0),
            ]),
          )
          .orderBy(authUsers.id)
          .paginate({ cursor: after, limit }),
      )
    },
  )
  defineService(listUsers, {
    auth: { roles: ['admin'] },
    module: 'admin',
    basePath: '/admin',
    method: 'GET',
    path: '/users',
    summary: 'List users with case-insensitive username or display name search',
    query: {
      cursor: listUsers.parameters.after,
      limit: listUsers.parameters.limit,
      search: listUsers.parameters.search,
    },
    response: { items: listUsers.parameters.items },
  })

  const getUser = pkg.proc(
    'get_user',
    {
      in: { id: odbType.guid() },
      out: { items: odbType.resultset() },
    },
    ({ params: { id, items }, body }) => {
      const { foundId } = body.variables({ foundId: odbType.guid() })
      body.query(
        odbQuery()
          .selectFrom(authUsers)
          .select(authUsers.id)
          .into(foundId)
          .where(cond.eq(authUsers.id, id)),
      )
      body.openFor(items, userQuery().where(cond.eq(authUsers.id, id)))
      body.when('NO_DATA_FOUND', (missing) => missing.notFound('ADMIN_USER_NOT_FOUND'))
    },
  )
  defineService(getUser, {
    auth: { roles: ['admin'] },
    module: 'admin',
    basePath: '/admin',
    method: 'GET',
    path: '/users/:id',
    summary: 'Read one user without credentials or authentication secrets',
    uri: { id: getUser.parameters.id },
    response: { items: getUser.parameters.items },
  })

  const setUserEnabled = pkg.proc(
    'set_user_enabled',
    {
      in: { id: odbType.guid(), actorId: odbType.guid(), enabled: odbType.boolean() },
      out: { items: odbType.resultset() },
    },
    ({ params: { id, actorId, enabled, items }, body }) => {
      const { currentEnabled, requestedEnabled } = body.variables({
        currentEnabled: authUsers.enabled,
        requestedEnabled: odbType.number(),
      })
      body.ifThen(cond.isNull(enabled), (invalid) => invalid.invalid('ADMIN_USER_STATUS_INVALID'))
      body.ifThen(cond.and([cond.eq(id, actorId), cond.eq(enabled, false)]), (forbidden) =>
        forbidden.forbidden('ADMIN_SELF_DISABLE_FORBIDDEN'),
      )
      body.ifThen(
        cond.eq(enabled, true),
        (enable) => enable.set(requestedEnabled, 1),
        (disable) => disable.set(requestedEnabled, 0),
      )
      body.query(
        odbQuery()
          .selectFrom(authUsers)
          .select(authUsers.enabled)
          .into(currentEnabled)
          .where(cond.eq(authUsers.id, id))
          .forUpdate(),
      )
      body.ifThen(cond.ne(currentEnabled, requestedEnabled), (changed) => {
        changed.query(
          odbQuery()
            .updateTable(authUsers)
            .set({ enabled: requestedEnabled, updatedAt: odbOracle.sysTimestamp() })
            .where(cond.eq(authUsers.id, id)),
        )
        changed.ifThen(cond.eq(enabled, false), (disabled) => {
          disabled.query(
            odbQuery()
              .updateTable(authUsers)
              .set({ tokenVersion: plsqlExpr.add(authUsers.tokenVersion, 1) })
              .where(cond.eq(authUsers.id, id)),
          )
          disabled.query(
            odbQuery()
              .updateTable(authSessions)
              .set({ revokedAt: odbOracle.sysTimestamp() })
              .where(
                cond.and([cond.eq(authSessions.userId, id), cond.isNull(authSessions.revokedAt)]),
              ),
          )
        })
        changed.auditEvent('User account status changed', {
          'user.id': actorId,
          'target.user.id': id,
          'event.name': odbLiteral('admin.user.status'),
          enabled: requestedEnabled,
        })
      })
      body.openFor(items, userQuery().where(cond.eq(authUsers.id, id)))
      body.when('NO_DATA_FOUND', (missing) => missing.notFound('ADMIN_USER_NOT_FOUND'))
    },
  )
  defineService(setUserEnabled, {
    auth: { roles: ['admin'] },
    module: 'admin',
    basePath: '/admin',
    method: 'PUT',
    path: '/users/:id/status',
    summary: 'Enable or disable a user; disabling revokes sessions and cannot target yourself',
    uri: { id: setUserEnabled.parameters.id },
    context: { userId: setUserEnabled.parameters.actorId },
    body: { enabled: setUserEnabled.parameters.enabled },
    response: { items: setUserEnabled.parameters.items },
  })

  const listRoles = pkg.proc(
    'list_roles',
    {
      in: searchPageInputs,
      out: { items: odbType.resultset() },
    },
    ({ params: { after, limit, search, items }, body }) => {
      const term = odbOracle.lower(odbOracle.trim(search))
      body.openFor(
        items,
        odbQuery()
          .selectFrom(authRoles)
          .select([authRoles.role, authRoles.description])
          .where(
            cond.or([
              cond.isNull(term),
              cond.gt(odbOracle.instr(odbOracle.lower(authRoles.role), term), 0),
              cond.gt(odbOracle.instr(odbOracle.lower(authRoles.description), term), 0),
            ]),
          )
          .orderBy(authRoles.role)
          .paginate({ cursor: after, limit }),
      )
    },
  )
  defineService(listRoles, {
    auth: { roles: ['admin'] },
    module: 'admin',
    basePath: '/admin',
    method: 'GET',
    path: '/roles',
    summary: 'List roles with case-insensitive role name or description search',
    query: {
      cursor: listRoles.parameters.after,
      limit: listRoles.parameters.limit,
      search: listRoles.parameters.search,
    },
    response: { items: listRoles.parameters.items },
  })

  const listUserRoles = pkg.proc(
    'list_user_roles',
    { in: { id: odbType.guid(), ...searchPageInputs }, out: { items: odbType.resultset() } },
    ({ params: { id, after, limit, search, items }, body }) => {
      const { foundId } = body.variables({ foundId: authUsers.id })
      body.query(findUserId(id).into(foundId))
      const term = odbOracle.lower(odbOracle.trim(search))
      body.openFor(
        items,
        odbQuery()
          .selectFrom(authUserRoles)
          .select([
            authUserRoles.userId,
            authUserRoles.role,
            authUserRoles.validFrom,
            authUserRoles.validTo,
          ])
          .where(
            cond.and([
              cond.eq(authUserRoles.userId, id),
              cond.or([
                cond.isNull(term),
                cond.gt(odbOracle.instr(odbOracle.lower(authUserRoles.role), term), 0),
              ]),
            ]),
          )
          .orderBy(authUserRoles.userId)
          .orderBy(authUserRoles.role)
          .paginate({ cursor: after, limit }),
      )
      body.when('NO_DATA_FOUND', (missing) => missing.notFound('ADMIN_USER_NOT_FOUND'))
    },
  )
  defineService(listUserRoles, {
    auth: { roles: ['admin'] },
    module: 'admin',
    basePath: '/admin',
    method: 'GET',
    path: '/users/:id/roles',
    summary: 'List a user’s role assignments and their validity dates',
    uri: { id: listUserRoles.parameters.id },
    query: {
      cursor: listUserRoles.parameters.after,
      limit: listUserRoles.parameters.limit,
      search: listUserRoles.parameters.search,
    },
    response: { items: listUserRoles.parameters.items },
  })

  const listAvailableUserRoles = pkg.proc(
    'list_available_user_roles',
    { in: { id: odbType.guid(), ...searchPageInputs }, out: { items: odbType.resultset() } },
    ({ params: { id, after, limit, search, items }, body }) => {
      const { foundId } = body.variables({ foundId: authUsers.id })
      body.query(findUserId(id).into(foundId))
      const term = odbOracle.lower(odbOracle.trim(search))
      const grants = authUserRoles.as('ur')
      const catalogRole = { toSQL: () => `${authRoles.name}.${authRoles.role.name}` }
      const existing = odbQuery()
        .selectFrom(grants)
        .select('1')
        .where(cond.and([cond.eq(grants.userId, id), cond.eq(grants.role, catalogRole)]))
      body.openFor(
        items,
        odbQuery()
          .selectFrom(authRoles)
          .select([authRoles.role, authRoles.description])
          .where({ toSQL: () => `NOT EXISTS (${existing.toSQL()})` })
          .where(
            cond.or([
              cond.isNull(term),
              cond.gt(odbOracle.instr(odbOracle.lower(authRoles.role), term), 0),
              cond.gt(odbOracle.instr(odbOracle.lower(authRoles.description), term), 0),
            ]),
          )
          .orderBy(authRoles.role)
          .paginate({ cursor: after, limit }),
      )
      body.when('NO_DATA_FOUND', (missing) => missing.notFound('ADMIN_USER_NOT_FOUND'))
    },
  )
  defineService(listAvailableUserRoles, {
    auth: { roles: ['admin'] },
    module: 'admin',
    basePath: '/admin',
    method: 'GET',
    path: '/users/:id/roles/available',
    summary: 'Search for roles not already assigned to this user',
    uri: { id: listAvailableUserRoles.parameters.id },
    query: {
      cursor: listAvailableUserRoles.parameters.after,
      limit: listAvailableUserRoles.parameters.limit,
      search: listAvailableUserRoles.parameters.search,
    },
    response: { items: listAvailableUserRoles.parameters.items },
  })

  const setUserRole = pkg.proc(
    'set_user_role',
    {
      in: {
        id: odbType.guid(),
        actorId: odbType.guid(),
        role: authRoles.role,
        assigned: odbType.boolean(),
      },
    },
    ({ params: { id, actorId, role, assigned }, body }) => {
      const { foundId, roleCount } = body.variables({
        foundId: authUsers.id,
        roleCount: odbType.integer(),
      })
      body.ifThen(cond.or([cond.isNull(odbOracle.trim(role)), cond.isNull(assigned)]), (invalid) =>
        invalid.invalid('ADMIN_USER_ROLE_INVALID'),
      )
      body.ifThen(
        cond.and([cond.eq(id, actorId), cond.eq(role, 'admin'), cond.eq(assigned, false)]),
        (forbidden) => forbidden.forbidden('ADMIN_SELF_ROLE_REMOVAL_FORBIDDEN'),
      )
      body.query(findUserId(id).into(foundId).forUpdate())
      body.ifThen(
        cond.eq(assigned, true),
        (add) => {
          add.query(
            odbQuery()
              .selectFrom(authRoles)
              .select('COUNT(*)')
              .into(roleCount)
              .where(cond.eq(authRoles.role, role)),
          )
          add.ifThen(cond.eq(roleCount, 0), (missing) => missing.notFound('ADMIN_ROLE_NOT_FOUND'))
          add.query(
            odbQuery()
              .mergeInto(authUserRoles.as('target'))
              .using({ userId: id, role }, 'source')
              .on((target, source) =>
                cond.and([
                  cond.eq(target.userId, source.userId),
                  cond.eq(target.role, source.role),
                ]),
              )
              .whenNotMatched({ userId: id, role }),
          )
        },
        (remove) => remove.call(odbAuth.role.revoke(id, role)),
      )
      const attributes = {
        'user.id': actorId,
        'target.user.id': id,
        'event.name': odbLiteral('admin.user.role'),
        'event.outcome': odbLiteral('success'),
        role,
      }
      body.ifThen(
        cond.eq(assigned, true),
        (added) => added.auditEvent('User role assigned', attributes),
        (removed) => removed.auditEvent('User role removed', attributes),
      )
      body.when('NO_DATA_FOUND', (missing) => missing.notFound('ADMIN_USER_NOT_FOUND'))
    },
  )
  defineService(setUserRole, {
    auth: { roles: ['admin'] },
    module: 'admin',
    basePath: '/admin',
    method: 'PUT',
    path: '/users/:id/roles',
    summary: 'Add or remove a role assignment without changing existing validity dates',
    uri: { id: setUserRole.parameters.id },
    context: { userId: setUserRole.parameters.actorId },
    body: { role: setUserRole.parameters.role, assigned: setUserRole.parameters.assigned },
    responseStatus: 204,
  })

  const listSettings = pkg.proc(
    'list_settings',
    { in: searchPageInputs, out: { items: odbType.resultset() } },
    ({ params: { after, limit, search, items }, body }) => {
      const term = odbOracle.lower(odbOracle.trim(search))
      body.openFor(
        items,
        odbQuery()
          .selectFrom(settingsStore)
          .select([
            settingsStore.id,
            settingsStore.secret,
            settingsStore.readonly,
            settingsStore.meta,
          ])
          .selectAs(
            odbOracle.caseWhen(
              cond.eq(settingsStore.secret, 'N'),
              settingsStore.value,
              odbOracle.toClob('NULL'),
              'CLOB',
            ),
            settingsStore.value,
          )
          .where(
            cond.or([
              cond.isNull(term),
              cond.gt(odbOracle.instr(odbOracle.lower(settingsStore.id), term), 0),
            ]),
          )
          .orderBy(settingsStore.id)
          .paginate({ cursor: after, limit }),
      )
    },
  )
  defineService(listSettings, {
    auth: { roles: ['admin'] },
    module: 'admin',
    basePath: '/admin',
    method: 'GET',
    path: '/settings',
    summary: 'List settings by ID without returning secret values',
    query: {
      cursor: listSettings.parameters.after,
      limit: listSettings.parameters.limit,
      search: listSettings.parameters.search,
    },
    response: { items: listSettings.parameters.items },
  })

  const updateSetting = pkg.proc(
    'update_setting',
    { in: { id: odbSettings.types.id, value: odbSettings.types.value, actorId: odbType.guid() } },
    ({ params: { id, value, actorId }, body }) => {
      body.call(odbSettings.updateEditable(id, value))
      body.auditEvent('Application setting updated', {
        'user.id': actorId,
        'event.name': odbLiteral('admin.setting.update'),
        'setting.id': id,
      })
    },
  )
  defineService(updateSetting, {
    auth: { roles: ['admin'] },
    module: 'admin',
    basePath: '/admin',
    method: 'PUT',
    path: '/settings/:id',
    summary: 'Update an existing setting without returning its value',
    uri: { id: updateSetting.parameters.id },
    context: { userId: updateSetting.parameters.actorId },
    body: { value: updateSetting.parameters.value },
    responseStatus: 204,
  })

  const listUserAudit = pkg.proc(
    'list_user_audit',
    {
      in: {
        id: odbType.guid(),
        ...searchPageInputs,
        severity: odbType.string(64),
        from: odbType.string(24),
        to: odbType.string(24),
        messageType: odbType.string(255),
      },
      out: { items: odbType.resultset() },
    },
    ({ params: { id, after, limit, search, severity, from, to, messageType, items }, body }) => {
      const { foundId, fromTimestamp, toTimestamp } = body.variables({
        foundId: authUsers.id,
        fromTimestamp: odbType.timestamp(),
        toTimestamp: odbType.timestamp(),
      })
      body.query(findUserId(id).into(foundId))
      body.ifThen(
        cond.and([
          cond.isNotNull(severity),
          cond.not(cond.regexpLike(severity, '^(ERROR|WARN|INFO)(,(ERROR|WARN|INFO))*$')),
        ]),
        (invalid) => invalid.invalid('ADMIN_AUDIT_SEVERITY_INVALID'),
      )
      body.block((dates) => {
        for (const [value, target] of [
          [from, fromTimestamp],
          [to, toTimestamp],
        ] as const) {
          dates.ifThen(
            cond.and([
              cond.isNotNull(value),
              cond.not(
                cond.regexpLike(
                  value,
                  '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$',
                ),
              ),
            ]),
            (invalid) => invalid.invalid('ADMIN_AUDIT_DATE_INVALID'),
          )
          dates.set(
            target,
            plsqlExpr.call(
              'TIMESTAMP',
              'TO_TIMESTAMP',
              value,
              odbLiteral('FXYYYY-MM-DD"T"HH24:MI:SS.FF3"Z"'),
            ),
          )
        }
        dates.whenOthers((invalid) => invalid.invalid('ADMIN_AUDIT_DATE_INVALID'))
      })
      body.ifThen(cond.gt(fromTimestamp, toTimestamp), (invalid) =>
        invalid.invalid('ADMIN_AUDIT_INTERVAL_INVALID'),
      )
      const term = odbOracle.lower(odbOracle.trim(search))
      const type = odbOracle.lower(odbOracle.trim(messageType))
      body.openFor(
        items,
        odbQuery()
          .selectFrom(auditLogs)
          .select([
            auditLogs.id,
            auditLogs.observedTimestamp,
            auditLogs.eventTimestamp,
            auditLogs.severityText,
            auditLogs.eventName,
            auditLogs.body,
            auditLogs.userId,
            auditLogs.targetUserId,
            auditLogs.attributes,
          ])
          .where(
            cond.and([
              cond.or([cond.eq(auditLogs.userId, id), cond.eq(auditLogs.targetUserId, id)]),
              cond.or([
                cond.isNull(severity),
                cond.gt(
                  odbOracle.instr(
                    plsqlExpr.concat(',', severity, ','),
                    plsqlExpr.concat(',', auditLogs.severityText, ','),
                  ),
                  0,
                ),
              ]),
              cond.or([
                cond.isNull(fromTimestamp),
                cond.gte(auditLogs.eventTimestamp, fromTimestamp),
              ]),
              cond.or([cond.isNull(toTimestamp), cond.lte(auditLogs.eventTimestamp, toTimestamp)]),
              cond.or([
                cond.isNull(type),
                cond.gt(odbOracle.instr(odbOracle.lower(auditLogs.eventName), type), 0),
              ]),
              cond.or([
                cond.isNull(term),
                cond.gt(odbOracle.instr(odbOracle.lower(auditLogs.body), term), 0),
              ]),
            ]),
          )
          .orderBy(auditLogs.observedTimestamp, 'desc')
          .orderBy(auditLogs.id, 'desc')
          .paginate({ cursor: after, limit }),
      )
      body.when('NO_DATA_FOUND', (missing) => missing.notFound('ADMIN_USER_NOT_FOUND'))
    },
  )
  defineService(listUserAudit, {
    auth: { roles: ['admin'] },
    module: 'admin',
    basePath: '/admin',
    method: 'GET',
    path: '/users/:id/audit',
    summary: 'List activity by or affecting a user, filtered before cursor pagination',
    uri: { id: listUserAudit.parameters.id },
    query: {
      cursor: listUserAudit.parameters.after,
      limit: listUserAudit.parameters.limit,
      search: listUserAudit.parameters.search,
      severity: listUserAudit.parameters.severity,
      from: listUserAudit.parameters.from,
      to: listUserAudit.parameters.to,
      messageType: listUserAudit.parameters.messageType,
    },
    response: { items: listUserAudit.parameters.items },
  })

  // Describe the inline query's row shape for typed keyset pagination.
  const auditEvents = odbTable('audit_events', (t) => ({
    id: t.guid().primaryKey(),
    observedTimestamp: t.timestamp().notNull(),
    eventTimestamp: t.timestamp().notNull(),
    severityText: t.string(30).notNull(),
    eventName: t.string(255),
    body: t.string(2000).notNull(),
    userId: t.string(255),
    targetUserId: t.string(255),
    attributes: t.json(),
    username: t.string(128),
    displayName: t.string(256),
  }))

  function auditEventsQuery() {
    const logs = auditLogs.as('logs')
    const actor = authUsers.as('actor')
    const target = authUsers.as('target')
    const hasActor = cond.isNotNull(actor.id)
    return odbQuery()
      .selectFrom(logs)
      .leftJoin(actor, cond.eq(actor.id, logs.userId))
      .leftJoin(target, cond.eq(target.id, logs.targetUserId))
      .select([
        logs.id,
        logs.observedTimestamp,
        logs.eventTimestamp,
        logs.severityText,
        logs.eventName,
        logs.body,
        logs.userId,
        logs.targetUserId,
        logs.attributes,
      ])
      .selectAs(
        odbOracle.caseWhen(hasActor, actor.username, target.username, 'VARCHAR2'),
        actor.username,
      )
      .selectAs(
        odbOracle.caseWhen(hasActor, actor.displayName, target.displayName, 'VARCHAR2'),
        actor.displayName,
      )
  }

  const listAudit = pkg.proc(
    'list_audit',
    {
      in: {
        after: odbType.json(),
        limit: odbType.integer(),
        search: odbType.string(256),
        severity: odbType.string(64),
        from: odbType.string(24),
        to: odbType.string(24),
        messageType: odbType.string(255),
        userId: odbType.guid(),
      },
      out: { items: odbType.resultset() },
    },
    ({
      params: { after, limit, userId, severity, from, to, messageType, search, items },
      body,
    }) => {
      const { fromTimestamp, toTimestamp } = body.variables({
        fromTimestamp: odbType.timestamp(),
        toTimestamp: odbType.timestamp(),
      })
      body.ifThen(
        cond.and([
          cond.isNotNull(severity),
          cond.not(cond.regexpLike(severity, '^(ERROR|WARN|INFO)(,(ERROR|WARN|INFO))*$')),
        ]),
        (invalid) => invalid.invalid('ADMIN_AUDIT_SEVERITY_INVALID'),
      )
      body.block((dates) => {
        for (const [value, target] of [
          [from, fromTimestamp],
          [to, toTimestamp],
        ] as const) {
          dates.ifThen(
            cond.and([
              cond.isNotNull(value),
              cond.not(
                cond.regexpLike(
                  value,
                  '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$',
                ),
              ),
            ]),
            (invalid) => invalid.invalid('ADMIN_AUDIT_DATE_INVALID'),
          )
          dates.set(
            target,
            plsqlExpr.call(
              'TIMESTAMP',
              'TO_TIMESTAMP',
              value,
              odbLiteral('FXYYYY-MM-DD"T"HH24:MI:SS.FF3"Z"'),
            ),
          )
        }
        dates.whenOthers((invalid) => invalid.invalid('ADMIN_AUDIT_DATE_INVALID'))
      })
      body.ifThen(cond.gt(fromTimestamp, toTimestamp), (invalid) =>
        invalid.invalid('ADMIN_AUDIT_INTERVAL_INVALID'),
      )
      const term = odbOracle.lower(odbOracle.trim(search))
      const type = odbOracle.lower(odbOracle.trim(messageType))
      const page = odbQuery()
        .selectFromSubquery(auditEvents, auditEventsQuery())
        .where(
          cond.and([
            cond.or([
              cond.isNull(userId),
              cond.eq(auditEvents.userId, userId),
              cond.eq(auditEvents.targetUserId, userId),
            ]),
            cond.or([
              cond.isNull(severity),
              cond.gt(
                odbOracle.instr(
                  plsqlExpr.concat(',', severity, ','),
                  plsqlExpr.concat(',', auditEvents.severityText, ','),
                ),
                0,
              ),
            ]),
            cond.or([
              cond.isNull(fromTimestamp),
              cond.gte(auditEvents.eventTimestamp, fromTimestamp),
            ]),
            cond.or([cond.isNull(toTimestamp), cond.lte(auditEvents.eventTimestamp, toTimestamp)]),
            cond.or([
              cond.isNull(type),
              cond.gt(odbOracle.instr(odbOracle.lower(auditEvents.eventName), type), 0),
            ]),
            cond.or([
              cond.isNull(term),
              cond.gt(odbOracle.instr(odbOracle.lower(auditEvents.body), term), 0),
            ]),
          ]),
        )
        .orderBy(auditEvents.observedTimestamp, 'desc')
        .orderBy(auditEvents.id, 'desc')
        .paginate({ cursor: after, limit })
      body.openFor(items, page)
    },
  )
  const { after, limit, severity, search, from, to, messageType, userId, items } =
    listAudit.parameters
  defineService(listAudit, {
    auth: { roles: ['admin'] },
    module: 'admin',
    basePath: '/admin',
    method: 'GET',
    path: '/audit/events',
    summary: 'List global audit activity, optionally filtered by actor or affected user',
    query: { cursor: after, limit, severity, search, from, to, messageType, userId },
    response: { items },
  })
  return {}
})

export const migration = defineMigration('00000000000003_admin', {
  schema: odbEnv.schemaUsername,
}).install(adminPackage)
