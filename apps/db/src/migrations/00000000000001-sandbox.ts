import {
  cond,
  defineMigration,
  defineService,
  odbAudit,
  odbAuth,
  odbEnv,
  odbHttp,
  odbPackage,
  odbSettings,
  odbType,
  PlsqlStatement,
  type Package,
} from '@odbvue/odb'

const refreshCookie = odbHttp.defineCookie({
  name: '__Host-odb_refresh',
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'Lax',
  maxAge: odbAuth.refreshTokenMaxAge,
})

// One application package: the HTTP layer (headers, cookies, routes) over the framework packages.
export const sandboxPackage: Package<Record<never, never>> = odbPackage('pck_sandbox', (pkg) => {
  const login = pkg.proc(
    'login',
    {
      in: { username: odbAuth.types.username, password: odbAuth.types.password },
      out: { accessToken: odbAuth.types.accessToken, setCookie: odbType.string() },
    },
    ({ params: { username, password, accessToken, setCookie }, body }) => {
      const { refreshToken } = body.variables({ refreshToken: odbAuth.types.refreshToken })
      body.call(odbAuth.login(username, password, accessToken, refreshToken))
      body.set(setCookie, refreshCookie.set(refreshToken))
    },
  )
  defineService(login, {
    auth: 'anonymous',
    method: 'POST',
    path: '/login',
    module: 'auth',
    basePath: '/auth',
    summary: 'Authenticate using username and password',
    body: { username: login.parameters.username, password: login.parameters.password },
    response: { accessToken: login.parameters.accessToken },
    headers: { 'Set-Cookie': login.parameters.setCookie },
  })

  const refresh = pkg.proc(
    'refresh',
    {
      in: { cookie: odbType.string(4000) },
      out: { accessToken: odbAuth.types.accessToken, setCookie: odbType.string() },
    },
    ({ params: { cookie, accessToken, setCookie }, body }) => {
      const { nextRefreshToken } = body.variables({ nextRefreshToken: odbAuth.types.refreshToken })
      body.call(odbAuth.refresh(refreshCookie.read(cookie), accessToken, nextRefreshToken))
      body.set(setCookie, refreshCookie.set(nextRefreshToken))
    },
  )
  defineService(refresh, {
    auth: 'anonymous',
    method: 'POST',
    path: '/refresh',
    module: 'auth',
    basePath: '/auth',
    summary: 'Rotate a refresh token and issue an access token',
    headers: { Cookie: refresh.parameters.cookie, 'Set-Cookie': refresh.parameters.setCookie },
    response: { accessToken: refresh.parameters.accessToken },
  })

  const logout = pkg.proc(
    'logout',
    { in: { cookie: odbType.string(4000) }, out: { setCookie: odbType.string() } },
    ({ params: { cookie, setCookie }, body }) => {
      body.call(odbAuth.logout(refreshCookie.read(cookie)))
      body.set(setCookie, refreshCookie.expire())
    },
  )
  defineService(logout, {
    auth: 'anonymous',
    method: 'POST',
    path: '/logout',
    module: 'auth',
    basePath: '/auth',
    summary: 'Revoke an authentication session',
    headers: { Cookie: logout.parameters.cookie, 'Set-Cookie': logout.parameters.setCookie },
  })

  const me = pkg.proc(
    'me',
    {
      in: { subject: odbAuth.types.userId },
      out: {
        userId: odbAuth.types.userId,
        username: odbAuth.types.username,
        displayName: odbAuth.types.displayName,
        roles: odbType.json(),
        permissions: odbType.json(),
      },
    },
    ({ params: { subject, userId, username, displayName, roles, permissions }, body }) => {
      body.set(userId, subject)
      body.call(odbAuth.readUser(userId, username, displayName))
      body.call(odbAuth.readAuthorization(userId, roles, permissions))
    },
  )
  defineService(me, {
    auth: 'authenticated',
    method: 'GET',
    path: '/me',
    module: 'auth',
    basePath: '/auth',
    summary: 'Return the authenticated user',
    context: { userId: me.parameters.subject },
    response: {
      userId: me.parameters.userId,
      username: me.parameters.username,
      displayName: me.parameters.displayName,
      roles: me.parameters.roles,
      permissions: me.parameters.permissions,
    },
  })

  const listSettings = pkg.proc(
    'list_settings',
    {
      in: {
        after: odbSettings.types.id,
        limit: odbType.integer(),
      },
      out: { items: odbType.resultset() },
    },
    ({ params: { after, limit, items }, body }) => {
      body.call(odbSettings.list(after, limit, items))
    },
  )
  defineService(listSettings, {
    auth: { roles: ['admin'] },
    method: 'GET',
    path: '/settings',
    summary: 'List settings',
    query: { cursor: listSettings.parameters.after, limit: listSettings.parameters.limit },
    response: { items: listSettings.parameters.items },
  })

  const readSetting = pkg.proc(
    'read_setting',
    {
      in: { id: odbSettings.types.id },
      out: { value: odbSettings.types.value, meta: odbSettings.types.meta },
    },
    ({ params: { id, value, meta }, body }) => {
      body.call(odbSettings.read(id, value, meta))
    },
  )
  defineService(readSetting, {
    auth: { roles: ['admin'] },
    method: 'GET',
    path: '/settings/:id',
    summary: 'Read a setting',
    uri: { id: readSetting.parameters.id },
    response: { value: readSetting.parameters.value, meta: readSetting.parameters.meta },
  })

  const writeSetting = pkg.proc(
    'write_setting',
    {
      in: {
        id: odbSettings.types.id,
        value: odbSettings.types.value,
      },
    },
    ({ params: { id, value }, body }) => {
      body.call(odbSettings.write(id, value))
    },
  )
  defineService(writeSetting, {
    auth: { roles: ['admin'] },
    method: 'PUT',
    path: '/settings/:id',
    summary: 'Create or update a setting',
    uri: { id: writeSetting.parameters.id },
    body: { value: writeSetting.parameters.value },
  })

  const removeSetting = pkg.proc(
    'remove_setting',
    { in: { id: odbSettings.types.id } },
    ({ params: { id }, body }) => {
      body.call(odbSettings.remove(id))
    },
  )
  defineService(removeSetting, {
    auth: { roles: ['admin'] },
    method: 'DELETE',
    path: '/settings/:id',
    summary: 'Delete a setting',
    uri: { id: removeSetting.parameters.id },
  })

  const listAudit = pkg.proc(
    'list_audit',
    {
      in: {
        after: odbAudit.types.id,
        limit: odbType.integer(),
      },
      out: { items: odbType.resultset() },
    },
    ({ params: { after, limit, items }, body }) => {
      body.call(odbAudit.list(after, limit, items))
    },
  )
  defineService(listAudit, {
    auth: { roles: ['admin'] },
    method: 'GET',
    path: '/audit',
    summary: 'List audit logs',
    query: { cursor: listAudit.parameters.after, limit: listAudit.parameters.limit },
    response: { items: listAudit.parameters.items },
  })

  for (const severity of ['info', 'warn', 'error'] as const) {
    const writeAudit = pkg.proc(
      `audit_${severity}`,
      { in: { message: odbAudit.types.body } },
      ({ params: { message }, body }) => {
        body.ifThen(cond.isNull(message), (then) => then.invalid('AUDIT_MESSAGE_REQUIRED'))
        if (severity === 'error') {
          body.block((inner) => {
            inner.invalid('SANDBOX_AUDIT_ERROR')
            inner.whenOthers((handler) => {
              handler.call(odbAudit.error(message))
              handler.call(new PlsqlStatement('RAISE'))
            })
          })
        } else {
          body.call(odbAudit[severity](message))
        }
      },
    )
    defineService(writeAudit, {
      auth: { roles: ['admin'] },
      method: 'POST',
      path: `/audit/${severity}`,
      summary:
        severity === 'error'
          ? 'Raise and audit a sandbox error'
          : `Write an audit ${severity} entry`,
      body: { message: writeAudit.parameters.message },
    })
  }
  return {}
})

export const migration = defineMigration('00000000000001_sandbox', {
  schema: odbEnv.adb.schemaUsername,
}).install(sandboxPackage)
