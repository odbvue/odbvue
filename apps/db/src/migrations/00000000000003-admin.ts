import {
  authUsers,
  cond,
  defineMigration,
  defineService,
  odbEnv,
  odbLiteral,
  odbOracle,
  odbPackage,
  odbQuery,
  odbType,
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
        after: odbType.guid(),
        limit: odbType.integer(),
        search: odbType.string(256),
      },
      out: { items: odbType.resultset() },
    },
    ({ params: { after, limit, search, items }, body }) => {
      body.ifThen(cond.or([cond.lt(limit, 1), cond.gt(limit, 101)]), (invalid) =>
        invalid.invalid('ADMIN_LIMIT_INVALID'),
      )
      const term = odbOracle.lower(odbOracle.trim(search))
      body.openFor(
        items,
        userQuery()
          .where(cond.or([cond.isNull(after), cond.gt(authUsers.id, after)]))
          .where(
            cond.or([
              cond.isNull(term),
              cond.gt(odbOracle.instr(odbOracle.lower(authUsers.username), term), 0),
              cond.gt(odbOracle.instr(odbOracle.lower(authUsers.displayName), term), 0),
            ]),
          )
          .orderBy(authUsers.id)
          .limit(odbOracle.nvl(limit, odbLiteral(26))),
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

  return {}
})

export const migration = defineMigration('00000000000003_admin', {
  schema: odbEnv.schemaUsername,
}).install(adminPackage)
