import {
  defineMigration,
  defineService,
  odbAuth,
  odbAuthApi,
  odbEnv,
  odbPackage,
  odbSettings,
  odbType,
} from '@odbvue/odb'

// One application package: ORDS services only, each delegating to framework packages.
const sandboxPackage = odbPackage('pck_sandbox', (pkg) => {
  const login = pkg.proc(
    'login',
    {
      in: { username: odbType.string(128), password: odbType.string(512) },
      out: { accessToken: odbType.clob(), setCookie: odbType.string() },
    },
    ({ params: { username, password, accessToken, setCookie }, body }) => {
      body.call(odbAuthApi.login(username, password, accessToken, setCookie))
    },
  )
  defineService(login, {
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
      out: { accessToken: odbType.clob(), setCookie: odbType.string() },
    },
    ({ params: { cookie, accessToken, setCookie }, body }) => {
      body.call(odbAuthApi.refresh(cookie, accessToken, setCookie))
    },
  )
  defineService(refresh, {
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
      body.call(odbAuthApi.logout(cookie, setCookie))
    },
  )
  defineService(logout, {
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
      in: { authorization: odbType.string(4000) },
      out: {
        userId: odbType.guid(),
        username: odbType.string(128),
        displayName: odbType.string(256),
      },
    },
    ({ params: { authorization, userId, username, displayName }, body }) => {
      body.call(odbAuthApi.me(authorization, userId, username, displayName))
    },
  )
  defineService(me, {
    method: 'GET',
    path: '/me',
    module: 'auth',
    basePath: '/auth',
    summary: 'Return the authenticated user',
    headers: { Authorization: me.parameters.authorization },
    response: {
      userId: me.parameters.userId,
      username: me.parameters.username,
      displayName: me.parameters.displayName,
    },
  })

  const listSettings = pkg.proc(
    'list_settings',
    {
      in: { authorization: odbType.string(4000), after: odbType.string(128) },
      out: { items: odbType.resultset() },
    },
    ({ params: { authorization, after, items }, body }) => {
      const { subject } = body.variables({ subject: odbType.guid() })
      body.set(subject, odbAuth.requireUser(authorization))
      body.call(odbSettings.list(after, items))
    },
  )
  defineService(listSettings, {
    method: 'GET',
    path: '/settings',
    summary: 'List settings, 50 per page',
    headers: {
      Authorization: listSettings.parameters.authorization,
      'X-After': listSettings.parameters.after,
    },
    response: { items: listSettings.parameters.items },
  })

  const readSetting = pkg.proc(
    'read_setting',
    {
      in: { authorization: odbType.string(4000), id: odbType.string(128) },
      out: { value: odbType.string(2000), meta: odbType.string(2000) },
    },
    ({ params: { authorization, id, value, meta }, body }) => {
      const { subject } = body.variables({ subject: odbType.guid() })
      body.set(subject, odbAuth.requireUser(authorization))
      body.call(odbSettings.read(id, value, meta))
    },
  )
  defineService(readSetting, {
    method: 'GET',
    path: '/settings/:id',
    summary: 'Read a setting',
    headers: { Authorization: readSetting.parameters.authorization },
    uri: { id: readSetting.parameters.id },
    response: { value: readSetting.parameters.value, meta: readSetting.parameters.meta },
  })

  const writeSetting = pkg.proc(
    'write_setting',
    {
      in: {
        authorization: odbType.string(4000),
        id: odbType.string(128),
        value: odbType.string(2000),
      },
    },
    ({ params: { authorization, id, value }, body }) => {
      const { subject } = body.variables({ subject: odbType.guid() })
      body.set(subject, odbAuth.requireUser(authorization))
      body.call(odbSettings.write(id, value))
    },
  )
  defineService(writeSetting, {
    method: 'PUT',
    path: '/settings/:id',
    summary: 'Create or update a setting',
    headers: { Authorization: writeSetting.parameters.authorization },
    uri: { id: writeSetting.parameters.id },
    body: { value: writeSetting.parameters.value },
  })

  const removeSetting = pkg.proc(
    'remove_setting',
    { in: { authorization: odbType.string(4000), id: odbType.string(128) } },
    ({ params: { authorization, id }, body }) => {
      const { subject } = body.variables({ subject: odbType.guid() })
      body.set(subject, odbAuth.requireUser(authorization))
      body.call(odbSettings.remove(id))
    },
  )
  defineService(removeSetting, {
    method: 'DELETE',
    path: '/settings/:id',
    summary: 'Delete a setting',
    headers: { Authorization: removeSetting.parameters.authorization },
    uri: { id: removeSetting.parameters.id },
  })
})

export const migration = defineMigration('00000000000001_sandbox', {
  schema: odbEnv.read('ODBVUE_ADB_SCHEMA_USERNAME'),
})
  .install(
    odbSettings.seed({
      id: 'SANDBOX_DEMO',
      value: 'Hello from the sandbox',
      meta: { label: 'Sandbox demo setting' },
    }),
  )
  .install(sandboxPackage)
