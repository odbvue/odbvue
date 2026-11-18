import {
  authUsers,
  authSessions,
  authRoles,
  authUserRoles,
  cond,
  defineMigration,
  defineService,
  odbEnv,
  odbAuth,
  odbOracle,
  odbPackage,
  odbQuery,
  odbType,
  plsqlExpr,
  type Package,
} from '@odbvue/odb'

const rolePageInputs = {
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
      in: rolePageInputs,
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
    { in: { id: odbType.guid(), ...rolePageInputs }, out: { items: odbType.resultset() } },
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
    { in: { id: odbType.guid(), ...rolePageInputs }, out: { items: odbType.resultset() } },
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

  return {}
})

export const migration = defineMigration('00000000000003_admin', {
  schema: odbEnv.schemaUsername,
}).install(adminPackage)
