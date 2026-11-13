import {
  authUsers,
  authSessions,
  cond,
  defineMigration,
  defineService,
  odbEnv,
  odbOracle,
  odbPackage,
  odbQuery,
  odbType,
  plsqlExpr,
  type Package,
} from '@odbvue/odb'

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

  return {}
})

export const migration = defineMigration('00000000000003_admin', {
  schema: odbEnv.schemaUsername,
}).install(adminPackage)
