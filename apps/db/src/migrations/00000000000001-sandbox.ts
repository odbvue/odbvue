import {
  cond,
  defineMigration,
  defineService,
  odbAudit,
  odbAuth,
  odbDbmsLob,
  odbEnv,
  odbHttp,
  odbLob,
  odbLiteral,
  odbOracle,
  odbPackage,
  odbSettings,
  odbStorage,
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
  const listStorage = pkg.proc(
    'list_storage',
    {
      in: {
        ownerId: odbStorage.types.ownerId,
        after: odbStorage.types.id,
        limit: odbType.integer(),
      },
      out: { items: odbType.resultset() },
    },
    ({ params: { ownerId, after, limit, items }, body }) => {
      body.call(odbStorage.list(ownerId, after, limit, items))
    },
  )
  defineService(listStorage, {
    auth: 'authenticated',
    method: 'GET',
    path: '/storage',
    summary: 'List your stored files',
    context: { userId: listStorage.parameters.ownerId },
    query: { cursor: listStorage.parameters.after, limit: listStorage.parameters.limit },
    response: { items: listStorage.parameters.items },
  })

  const uploadStorage = pkg.proc(
    'upload_storage',
    {
      in: {
        ownerId: odbStorage.types.ownerId,
        fileName: odbStorage.types.fileName,
        mimeType: odbStorage.types.mimeType,
        fileSize: odbType.integer(),
        content: odbType.clob(),
        meta: odbStorage.types.meta,
      },
      out: { id: odbStorage.types.id },
    },
    ({ params: { ownerId, fileName, mimeType, fileSize, content, meta, id }, body }) => {
      const { binaryContent } = body.variables({ binaryContent: odbStorage.types.content })
      body.ifThen(cond.or([cond.isNull(fileSize), cond.lt(fileSize, 0)]), (then) =>
        then.invalid('STORAGE_FILE_SIZE_REQUIRED'),
      )
      body.ifThen(cond.gt(fileSize, odbStorage.maxFileBytes), (then) =>
        then.invalid('STORAGE_FILE_TOO_LARGE'),
      )
      body.ifThen(cond.and([cond.isNull(content), cond.gt(fileSize, 0)]), (then) =>
        then.invalid('STORAGE_CONTENT_REQUIRED'),
      )
      body.ifThen(
        cond.gt(odbOracle.length(content), Math.ceil(odbStorage.maxFileBytes / 3) * 4),
        (then) => then.invalid('STORAGE_FILE_TOO_LARGE'),
      )
      body.ifThen(cond.isNotNull(content), (then) => {
        then.ifThen(
          cond.or([
            cond.not(
              cond.regexpLike(
                content,
                '^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$',
              ),
            ),
            cond.ne(odbOracle.mod(odbOracle.length(content), odbLiteral(4)), 0),
          ]),
          (invalid) => invalid.invalid('STORAGE_BASE64_INVALID'),
        )
      })
      body.block((decode) => {
        decode.ifThen(
          cond.isNull(content),
          (empty) => {
            empty.call(odbDbmsLob.createTemporary(binaryContent, true, odbDbmsLob.CALL))
          },
          (nonempty) => {
            nonempty.set(binaryContent, odbLob.base64ToBlob(content))
          },
        )
        decode.whenOthers((handler) => handler.invalid('STORAGE_BASE64_INVALID'))
      })
      body.ifThen(cond.ne(odbDbmsLob.getLength(binaryContent), fileSize), (then) =>
        then.invalid('STORAGE_FILE_SIZE_MISMATCH'),
      )
      body.call(odbStorage.write(ownerId, fileName, mimeType, binaryContent, id, meta))
    },
  )
  defineService(uploadStorage, {
    auth: 'authenticated',
    method: 'POST',
    path: '/storage',
    summary: 'Upload a Base64-encoded file (up to 10 MiB)',
    context: { userId: uploadStorage.parameters.ownerId },
    body: {
      fileName: uploadStorage.parameters.fileName,
      mimeType: uploadStorage.parameters.mimeType,
      fileSize: uploadStorage.parameters.fileSize,
      content: uploadStorage.parameters.content,
      meta: uploadStorage.parameters.meta,
    },
    response: { id: uploadStorage.parameters.id },
  })

  const downloadStorage = pkg.proc(
    'download_storage',
    {
      in: { ownerId: odbStorage.types.ownerId, id: odbStorage.types.id },
    },
    ({ params: { ownerId, id }, body }) => {
      const { fileName, mimeType, fileSize, binaryContent, meta } = body.variables({
        fileName: odbStorage.types.fileName,
        mimeType: odbStorage.types.mimeType,
        fileSize: odbStorage.types.fileSize,
        binaryContent: odbStorage.types.content,
        meta: odbStorage.types.meta,
      })
      body.call(odbStorage.read(ownerId, id, fileName, mimeType, fileSize, binaryContent, meta))
      body.call(odbHttp.download(binaryContent, fileName, mimeType))
    },
  )
  defineService(downloadStorage, {
    auth: 'authenticated',
    method: 'GET',
    path: '/storage/:id',
    summary: 'Download your file',
    responseMediaType: 'application/octet-stream',
    context: { userId: downloadStorage.parameters.ownerId },
    uri: { id: downloadStorage.parameters.id },
  })

  const removeStorage = pkg.proc(
    'remove_storage',
    { in: { ownerId: odbStorage.types.ownerId, id: odbStorage.types.id } },
    ({ params: { ownerId, id }, body }) => body.call(odbStorage.remove(ownerId, id)),
  )
  defineService(removeStorage, {
    auth: 'authenticated',
    method: 'DELETE',
    path: '/storage/:id',
    summary: 'Delete your file',
    context: { userId: removeStorage.parameters.ownerId },
    uri: { id: removeStorage.parameters.id },
  })
  return {}
})

export const migration = defineMigration('00000000000001_sandbox', {
  schema: odbEnv.adb.schemaUsername,
}).install(sandboxPackage)
