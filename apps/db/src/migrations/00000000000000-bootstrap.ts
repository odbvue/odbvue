import {
  cond,
  defineMigration,
  defineService,
  odbAuth,
  odbGoogle,
  odbEnv,
  odbHttp,
  odbLob,
  odbRateLimit,
  odbRateLimitApi,
  odbSchema,
  odbSettings,
  odbAudit,
  odbStorage,
  odbEmails,
  odbAcl,
  odbLiteral,
  odbOracle,
  odbPackage,
  odbType,
  plsqlExpr,
  type Package,
  PlsqlExpression,
} from '@odbvue/odb'

const schemaName = odbEnv.schemaUsername
const schemaPassword = odbEnv.schemaPassword

const refreshCookie = odbHttp.defineCookie({
  name: '__Host-odb_refresh',
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'Lax',
  maxAge: odbAuth.refreshTokenMaxAge,
})

const googleCookie = odbHttp.defineCookie({
  name: '__Host-odb_google',
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'Lax',
  maxAge: 300,
})

export const appPackage: Package<Record<never, never>> = odbPackage('pck_app', (pkg) => {
  const googleStart = pkg.proc(
    'google_start',
    {
      in: {
        redirect: odbType.string(2048),
        origin: odbType.string(2000),
        fetchSite: odbType.string(32),
      },
      out: {
        authorizationUrl: odbType.string(4000),
        setCookie: odbType.string(4000),
        cacheControl: odbType.string(32),
      },
    },
    ({
      params: { redirect, origin, fetchSite, authorizationUrl, setCookie, cacheControl },
      body,
    }) => {
      const { appUrl, browserToken } = body.variables({
        appUrl: odbSettings.types.value,
        browserToken: odbType.string(64),
      })
      body.set(appUrl, odbGoogle.publicUrl())
      body.ifThen(
        cond.or([
          cond.isNull(origin),
          cond.ne(
            odbOracle.lower(origin),
            odbOracle.lower(odbOracle.regexpSubstr(appUrl, odbLiteral('^https?://[^/]+'))),
          ),
          cond.eq(fetchSite, 'cross-site'),
        ]),
        (then) => then.forbidden('GOOGLE_ORIGIN_INVALID'),
      )
      body.call(odbGoogle.start(redirect, authorizationUrl, browserToken))
      body.set(setCookie, googleCookie.set(browserToken))
      body.set(cacheControl, 'no-store')
    },
  )
  defineService(googleStart, {
    auth: 'anonymous',
    method: 'POST',
    path: '/google/start',
    module: 'auth',
    basePath: '/auth',
    summary: 'Start a browser-bound Google authorization-code transaction',
    body: { redirect: googleStart.parameters.redirect },
    response: { authorizationUrl: googleStart.parameters.authorizationUrl },
    headers: {
      Origin: googleStart.parameters.origin,
      'Sec-Fetch-Site': googleStart.parameters.fetchSite,
      'Set-Cookie': googleStart.parameters.setCookie,
      'Cache-Control': googleStart.parameters.cacheControl,
    },
  })

  const googleCallback = pkg.proc(
    'google_callback',
    {
      in: {
        state: odbType.string(128),
        code: odbType.string(4000),
        error: odbType.string(256),
        cookie: odbType.string(4000),
      },
      out: {
        location: odbType.string(32767),
        setCookie: odbType.string(4000),
        cacheControl: odbType.string(32),
        referrerPolicy: odbType.string(32),
      },
    },
    ({
      params: { state, code, error, cookie, location, setCookie, cacheControl, referrerPolicy },
      body,
    }) => {
      const { appUrl, refreshToken, returnPath, outcome, purpose, callbackPath } = body.variables({
        appUrl: odbSettings.types.value,
        refreshToken: odbAuth.types.refreshToken,
        returnPath: odbType.string(32767),
        outcome: odbType.string(32),
        purpose: odbType.string(8),
        callbackPath: odbType.string(32),
      })
      body.set(appUrl, odbGoogle.publicUrl())
      body.call(
        odbGoogle.complete(
          state,
          code,
          googleCookie.read(cookie),
          error,
          refreshCookie.read(cookie),
          refreshToken,
          returnPath,
          outcome,
          purpose,
        ),
      )
      body.ifThen(
        cond.eq(purpose, 'link'),
        (link) => {
          link.set(callbackPath, '/account?google=')
          link.set(returnPath, odbOracle.nvl(returnPath, odbLiteral('/account')))
          link.ifThen(cond.eq(outcome, 'success'), (then) => then.set(outcome, 'linked'))
        },
        (login) => {
          login.set(callbackPath, '/login?google=')
          login.set(returnPath, odbOracle.nvl(returnPath, odbLiteral('/')))
          login.ifThen(cond.eq(outcome, 'conflict'), (then) => {
            then.set(
              returnPath,
              plsqlExpr.concat(
                '/account?redirect=',
                plsqlExpr.call(
                  'VARCHAR2',
                  'UTL_URL.ESCAPE',
                  returnPath,
                  new PlsqlExpression('BOOLEAN', 'TRUE'),
                  odbLiteral('AL32UTF8'),
                ),
              ),
            )
          })
        },
      )
      body.ifThen(
        cond.and([cond.eq(purpose, 'login'), cond.eq(outcome, 'success')]),
        (then) => then.set(setCookie, refreshCookie.set(refreshToken)),
        (otherwise) => otherwise.set(setCookie, googleCookie.expire()),
      )
      body.set(
        location,
        plsqlExpr.concat(
          odbOracle.rtrim(appUrl, odbLiteral('/')),
          callbackPath,
          outcome,
          odbLiteral('&redirect='),
          plsqlExpr.call(
            'VARCHAR2',
            'UTL_URL.ESCAPE',
            odbOracle.nvl(returnPath, odbLiteral('/')),
            new PlsqlExpression('BOOLEAN', 'TRUE'),
            odbLiteral('AL32UTF8'),
          ),
        ),
      )
      body.set(cacheControl, 'no-store')
      body.set(referrerPolicy, 'no-referrer')
    },
  )
  defineService(googleCallback, {
    auth: 'anonymous',
    method: 'GET',
    path: '/google/callback',
    module: 'auth',
    basePath: '/auth',
    summary: 'Complete Google sign-in or linking using the stored transaction purpose',
    responseStatus: 303,
    query: {
      state: googleCallback.parameters.state,
      code: googleCallback.parameters.code,
      error: googleCallback.parameters.error,
    },
    headers: {
      Cookie: googleCallback.parameters.cookie,
      Location: googleCallback.parameters.location,
      'Set-Cookie': googleCallback.parameters.setCookie,
      'Cache-Control': googleCallback.parameters.cacheControl,
      'Referrer-Policy': googleCallback.parameters.referrerPolicy,
    },
  })

  const googleLinkStart = pkg.proc(
    'google_link_start',
    {
      in: {
        subject: odbAuth.types.userId,
        redirect: odbType.string(2048),
        password: odbAuth.types.password,
        cookie: odbType.string(4000),
        origin: odbType.string(2000),
        fetchSite: odbType.string(32),
      },
      out: {
        authorizationUrl: odbType.string(4000),
        setCookie: odbType.string(4000),
        cacheControl: odbType.string(32),
      },
    },
    ({ params: p, body }) => {
      const { appUrl, browserToken } = body.variables({
        appUrl: odbSettings.types.value,
        browserToken: odbType.string(64),
      })
      body.set(appUrl, odbGoogle.publicUrl())
      body.ifThen(
        cond.or([
          cond.isNull(p.origin),
          cond.ne(
            odbOracle.lower(p.origin),
            odbOracle.lower(odbOracle.regexpSubstr(appUrl, odbLiteral('^https?://[^/]+'))),
          ),
          cond.eq(p.fetchSite, 'cross-site'),
        ]),
        (then) => then.forbidden('GOOGLE_ORIGIN_INVALID'),
      )
      body.call(
        odbGoogle.startLink(
          p.redirect,
          p.subject,
          refreshCookie.read(p.cookie),
          p.password,
          p.authorizationUrl,
          browserToken,
        ),
      )
      body.set(p.setCookie, googleCookie.set(browserToken))
      body.set(p.cacheControl, 'no-store')
    },
  )
  defineService(googleLinkStart, {
    auth: 'authenticated',
    method: 'POST',
    path: '/google/link/start',
    module: 'auth',
    basePath: '/auth',
    summary: 'Reauthenticate and bind Google linking to the current user and browser session',
    context: { userId: googleLinkStart.parameters.subject },
    body: {
      redirect: googleLinkStart.parameters.redirect,
      password: googleLinkStart.parameters.password,
    },
    response: { authorizationUrl: googleLinkStart.parameters.authorizationUrl },
    headers: {
      Cookie: googleLinkStart.parameters.cookie,
      Origin: googleLinkStart.parameters.origin,
      'Sec-Fetch-Site': googleLinkStart.parameters.fetchSite,
      'Set-Cookie': googleLinkStart.parameters.setCookie,
      'Cache-Control': googleLinkStart.parameters.cacheControl,
    },
  })

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

  const getState = pkg.proc(
    'get_state',
    {
      in: { authorization: odbType.string(4000) },
      out: {
        user: odbType.json(),
        providers: odbType.json(),
        signup: odbType.json(),
        cacheControl: odbType.string(32),
      },
    },
    ({ params: { authorization, user, providers, signup, cacheControl }, body }) => {
      const {
        userId,
        username,
        displayName,
        avatarUrl,
        avatarUploaded,
        avatarId,
        passwordConnected,
        googleConnected,
        roles,
        permissions,
        googleEnabled,
      } = body.variables({
        userId: odbAuth.types.userId,
        username: odbAuth.types.username,
        displayName: odbAuth.types.displayName,
        avatarUrl: odbType.clob(),
        avatarUploaded: odbType.number(),
        avatarId: odbStorage.types.id,
        passwordConnected: odbType.number(),
        googleConnected: odbType.number(),
        roles: odbType.json(),
        permissions: odbType.json(),
        googleEnabled: odbType.string(5),
      })
      body.set(cacheControl, 'no-store')
      body.set(signup, 'true')
      body.set(user, 'null')
      body.ifThen(
        cond.eq(odbGoogle.enabled(), true),
        (then) => then.set(googleEnabled, odbLiteral('true')),
        (otherwise) => otherwise.set(googleEnabled, odbLiteral('false')),
      )
      body.raw(`SELECT JSON_OBJECT(
        'password' VALUE 'true' FORMAT JSON,
        'google' VALUE ${googleEnabled.toSQL()} FORMAT JSON RETURNING CLOB
      ) INTO ${providers.toSQL()} FROM dual;`)
      body.ifThen(cond.isNotNull(authorization), (then) => {
        then.set(userId, odbAuth.requireUser(odbHttp.bearerToken(authorization)))
        then.call(odbAuth.readUser(userId, username, displayName))
        then.call(odbAuth.readAuthorization(userId, roles, permissions))
        then.call(
          odbAuth.readProfile(
            userId,
            avatarUrl,
            avatarUploaded,
            passwordConnected,
            googleConnected,
            avatarId,
          ),
        )
        then.raw(`SELECT JSON_OBJECT(
          'userId' VALUE ${userId.toSQL()},
          'username' VALUE ${username.toSQL()},
          'displayName' VALUE ${displayName.toSQL()},
          'avatarUrl' VALUE ${avatarUrl.toSQL()},
          'avatarUploaded' VALUE ${avatarUploaded.toSQL()},
          'avatarId' VALUE ${avatarId.toSQL()},
          'passwordConnected' VALUE ${passwordConnected.toSQL()},
          'googleConnected' VALUE ${googleConnected.toSQL()},
          'roles' VALUE ${roles.toSQL()} FORMAT JSON,
          'permissions' VALUE ${permissions.toSQL()} FORMAT JSON RETURNING CLOB
        ) INTO ${user.toSQL()} FROM dual;`)
      })
    },
  )
  defineService(getState, {
    auth: 'anonymous',
    method: 'GET',
    path: '/state',
    module: 'auth',
    basePath: '/auth',
    summary: 'Return the current user and public authentication capabilities',
    responseMediaType: 'application/json',
    headers: {
      Authorization: getState.parameters.authorization,
      'Cache-Control': getState.parameters.cacheControl,
    },
    response: {
      user: getState.parameters.user,
      providers: getState.parameters.providers,
      signup: getState.parameters.signup,
    },
  })

  const signup = pkg.proc(
    'signup',
    {
      in: {
        email: odbType.string(128),
        fullName: odbAuth.types.displayName,
        password: odbAuth.types.password,
        passwordRepeat: odbAuth.types.password,
      },
    },
    ({ params: { email, fullName, password, passwordRepeat }, body }) => {
      const { token, appUrl, meta, emailId, address, ip } = body.variables({
        token: odbType.string(64),
        appUrl: odbSettings.types.value,
        meta: odbSettings.types.meta,
        emailId: odbEmails.types.id,
        address: odbType.string(128),
        ip: odbType.string(128),
      })
      body.set(ip, odbOracle.sysContext(odbLiteral('USERENV'), odbLiteral('IP_ADDRESS')))
      body.call(odbRateLimitApi.enforce(odbLiteral('AUTH_SIGNUP_IP'), ip))
      body.call(odbRateLimitApi.failure(odbLiteral('AUTH_SIGNUP_IP'), ip))
      body.ifThen(
        cond.or([cond.isNull(passwordRepeat), cond.ne(password, passwordRepeat)]),
        (then) => then.invalid('SIGNUP_PASSWORD_MISMATCH'),
      )
      body.call(odbSettings.read(odbLiteral('APP_PUBLIC_URL'), appUrl, meta))
      body.ifThen(
        cond.or([
          cond.isNull(appUrl),
          cond.not(cond.regexpLike(appUrl, '^https?://[^[:space:]<>"\'&?#]+$')),
        ]),
        (then) => then.invalid('SIGNUP_URL_NOT_CONFIGURED'),
      )
      body.call(odbAuth.signup(email, password, fullName, token))
      body.set(address, odbOracle.lower(odbOracle.trim(email)))
      const link = plsqlExpr.concat(
        odbOracle.rtrim(appUrl, odbLiteral('/')),
        odbLiteral('/confirm-email#token='),
        token,
      )
      body.call(
        odbEmails.mail(
          address,
          odbOracle.null(),
          odbLiteral('Confirm your OdbVue email address'),
          odbOracle.toClob(
            plsqlExpr.concat(
              odbLiteral('<p>Confirm your email address to activate your account.</p><p><a href="'),
              link,
              odbLiteral(
                '">Confirm email address</a></p><p>This link expires in 24 hours. If you did not sign up, ignore this email.</p>',
              ),
            ),
          ),
          odbLiteral(1),
          emailId,
        ),
      )
      // SMTP delivery runs autonomously and must see the committed queue entry.
      body.commit()
      body.call(odbEmails.send(emailId))
    },
  )
  defineService(signup, {
    auth: 'anonymous',
    method: 'POST',
    module: 'auth',
    basePath: '/auth',
    path: '/signup',
    summary: 'Register an inactive account and send an email confirmation link',
    body: {
      email: signup.parameters.email,
      fullName: signup.parameters.fullName,
      password: signup.parameters.password,
      passwordRepeat: signup.parameters.passwordRepeat,
    },
  })

  const confirmEmail = pkg.proc(
    'confirm_email',
    { in: { token: odbType.string(64) } },
    ({ params: { token }, body }) => {
      const { ip } = body.variables({ ip: odbType.string(128) })
      body.set(ip, odbOracle.sysContext(odbLiteral('USERENV'), odbLiteral('IP_ADDRESS')))
      body.call(odbRateLimitApi.enforce(odbLiteral('AUTH_CONFIRM_IP'), ip))
      body.call(odbRateLimitApi.failure(odbLiteral('AUTH_CONFIRM_IP'), ip))
      body.call(odbAuth.confirmEmail(token))
    },
  )
  defineService(confirmEmail, {
    auth: 'anonymous',
    method: 'POST',
    module: 'auth',
    basePath: '/auth',
    path: '/confirm-email',
    summary: 'Activate an account using a single-use email confirmation token',
    body: { token: confirmEmail.parameters.token },
  })
  const recoverPassword = pkg.proc(
    'recover_password',
    { in: { email: odbType.string(128) } },
    ({ params: { email }, body }) => {
      const { token, appUrl, meta, emailId, address, ip } = body.variables({
        token: odbType.string(64),
        appUrl: odbSettings.types.value,
        meta: odbSettings.types.meta,
        emailId: odbEmails.types.id,
        address: odbType.string(128),
        ip: odbType.string(128),
      })
      body.set(ip, odbOracle.sysContext(odbLiteral('USERENV'), odbLiteral('IP_ADDRESS')))
      body.call(odbRateLimitApi.enforce(odbLiteral('AUTH_RECOVERY_IP'), ip))
      body.call(odbRateLimitApi.failure(odbLiteral('AUTH_RECOVERY_IP'), ip))
      body.call(odbSettings.read(odbLiteral('APP_PUBLIC_URL'), appUrl, meta))
      body.ifThen(
        cond.or([
          cond.isNull(appUrl),
          cond.not(cond.regexpLike(appUrl, '^https?://[^[:space:]<>"\'&?#]+$')),
        ]),
        (then) => then.invalid('RECOVERY_URL_NOT_CONFIGURED'),
      )
      body.call(odbAuth.recoverPassword(email, token))
      body.ifThen(cond.isNull(token), (then) => then.return())
      body.set(address, odbOracle.lower(odbOracle.trim(email)))
      const link = plsqlExpr.concat(
        odbOracle.rtrim(appUrl, odbLiteral('/')),
        odbLiteral('/reset-password#token='),
        token,
      )
      body.call(
        odbEmails.mail(
          address,
          odbOracle.null(),
          odbLiteral('Reset your OdbVue password'),
          odbOracle.toClob(
            plsqlExpr.concat(
              odbLiteral('<p>A password reset was requested for your account.</p><p><a href="'),
              link,
              odbLiteral(
                '">Reset password</a></p><p>This link expires in one hour. If you did not request this, ignore this email. Your password has not changed.</p>',
              ),
            ),
          ),
          odbLiteral(1),
          emailId,
        ),
      )
      body.commit()
      body.call(odbEmails.send(emailId))
    },
  )
  defineService(recoverPassword, {
    auth: 'anonymous',
    method: 'POST',
    module: 'auth',
    basePath: '/auth',
    path: '/recover-password',
    summary: 'Request a password reset email without disclosing account existence',
    body: { email: recoverPassword.parameters.email },
  })

  const resetPassword = pkg.proc(
    'reset_password',
    {
      in: {
        token: odbType.string(64),
        password: odbAuth.types.password,
        passwordRepeat: odbAuth.types.password,
      },
    },
    ({ params: { token, password, passwordRepeat }, body }) => {
      const { ip } = body.variables({ ip: odbType.string(128) })
      body.set(ip, odbOracle.sysContext(odbLiteral('USERENV'), odbLiteral('IP_ADDRESS')))
      body.call(odbRateLimitApi.enforce(odbLiteral('AUTH_RESET_IP'), ip))
      body.call(odbRateLimitApi.failure(odbLiteral('AUTH_RESET_IP'), ip))
      body.ifThen(
        cond.or([cond.isNull(passwordRepeat), cond.ne(password, passwordRepeat)]),
        (then) => then.invalid('PASSWORD_RESET_PASSWORD_MISMATCH'),
      )
      body.call(odbAuth.resetPassword(token, password))
    },
  )
  defineService(resetPassword, {
    auth: 'anonymous',
    method: 'POST',
    module: 'auth',
    basePath: '/auth',
    path: '/reset-password',
    summary: 'Consume a single-use recovery token and revoke existing sessions',
    body: {
      token: resetPassword.parameters.token,
      password: resetPassword.parameters.password,
      passwordRepeat: resetPassword.parameters.passwordRepeat,
    },
  })

  const updateAvatar = pkg.proc(
    'update_avatar',
    { in: { userId: odbAuth.types.userId, avatar: odbType.clob() } },
    ({ params: { userId, avatar }, body }) => body.call(odbAuth.updateAvatar(userId, avatar)),
  )
  defineService(updateAvatar, {
    auth: 'authenticated',
    method: 'POST',
    module: 'auth',
    basePath: '/auth',
    path: '/avatar',
    summary: 'Set a JPEG thumbnail, or remove the uploaded avatar with null',
    context: { userId: updateAvatar.parameters.userId },
    body: { avatar: updateAvatar.parameters.avatar },
  })

  const downloadAvatar = pkg.proc(
    'download_avatar',
    { in: { userId: odbAuth.types.userId, id: odbStorage.types.id } },
    ({ params: { userId, id }, body }) => {
      const {
        avatarUrl,
        avatarUploaded,
        passwordConnected,
        googleConnected,
        avatarId,
        fileName,
        mimeType,
        fileSize,
        content,
        meta,
      } = body.variables({
        avatarUrl: odbType.clob(),
        avatarUploaded: odbType.integer(),
        passwordConnected: odbType.integer(),
        googleConnected: odbType.integer(),
        avatarId: odbStorage.types.id,
        fileName: odbStorage.types.fileName,
        mimeType: odbStorage.types.mimeType,
        fileSize: odbStorage.types.fileSize,
        content: odbStorage.types.content,
        meta: odbStorage.types.meta,
      })
      body.call(
        odbAuth.readProfile(
          userId,
          avatarUrl,
          avatarUploaded,
          passwordConnected,
          googleConnected,
          avatarId,
        ),
      )
      body.ifThen(cond.or([cond.isNull(avatarId), cond.ne(avatarId, id)]), (then) =>
        then.notFound('PROFILE_AVATAR_NOT_FOUND'),
      )
      body.call(odbStorage.read(userId, id, fileName, mimeType, fileSize, content, meta))
      body.call(odbHttp.download(content, fileName, mimeType))
    },
  )
  defineService(downloadAvatar, {
    auth: 'authenticated',
    method: 'GET',
    module: 'auth',
    basePath: '/auth',
    path: '/avatar/:id',
    summary: "Download the authenticated owner's current avatar",
    context: { userId: downloadAvatar.parameters.userId },
    uri: { id: downloadAvatar.parameters.id },
    responseMediaType: 'image/jpeg',
  })

  const changePassword = pkg.proc(
    'change_password',
    {
      in: {
        userId: odbAuth.types.userId,
        currentPassword: odbAuth.types.password,
        password: odbAuth.types.password,
        passwordRepeat: odbAuth.types.password,
      },
      out: { setCookie: odbType.string(4000) },
    },
    ({ params: { userId, currentPassword, password, passwordRepeat, setCookie }, body }) => {
      body.ifThen(
        cond.or([cond.isNull(passwordRepeat), cond.ne(password, passwordRepeat)]),
        (then) => then.invalid('PASSWORD_CHANGE_PASSWORD_MISMATCH'),
      )
      body.call(odbAuth.changePassword(userId, currentPassword, password))
      body.set(setCookie, refreshCookie.expire())
    },
  )
  defineService(changePassword, {
    auth: 'authenticated',
    method: 'POST',
    module: 'auth',
    basePath: '/auth',
    path: '/change-password',
    summary: 'Change a local password after reauthentication and revoke all sessions',
    context: { userId: changePassword.parameters.userId },
    body: {
      currentPassword: changePassword.parameters.currentPassword,
      password: changePassword.parameters.password,
      passwordRepeat: changePassword.parameters.passwordRepeat,
    },
    headers: { 'Set-Cookie': changePassword.parameters.setCookie },
  })
  return {}
})

export const schema = odbSchema(schemaName, schemaPassword, (definition) => {
  definition.grant('EXECUTE ON DBMS_CRYPTO')
  definition.grant('EXECUTE ON UTL_ENCODE')
  definition.grant('EXECUTE ON UTL_I18N')
  definition.grant('EXECUTE ON UTL_INADDR')
  definition.grant('EXECUTE ON UTL_TCP')
  definition.grant('EXECUTE ON UTL_SMTP')
  definition.grant('EXECUTE ON UTL_HTTP')
  definition.grant('EXECUTE ON UTL_URL')
  definition.grant('EXECUTE ON SYS.DBMS_NETWORK_ACL_ADMIN')
  definition.grant('SELECT ON SYS.DBA_HOST_ACES')
})

export const migration = defineMigration('00000000000000_bootstrap', {
  schema: schemaName,
})
  .install(odbHttp)
  .install(odbRateLimit)
  .install(odbAudit)
  .install(odbSettings)
  .install(odbLob)
  .install(odbStorage)
  .install(odbAuth)
  .install(odbAuth.seedSettings())
  .install(odbGoogle)
  .install(odbGoogle.seedSettings())
  .install(odbAcl)
  .install(odbEmails)
  .install(
    odbSettings.seed(
      { id: 'SMTP_HOST', value: '', meta: { label: 'SMTP host', type: 'string' } },
      { id: 'SMTP_PORT', value: '', meta: { label: 'SMTP port', type: 'number' } },
      { id: 'SMTP_USERNAME', value: '', meta: { label: 'SMTP username', type: 'string' } },
      {
        id: 'SMTP_PASSWORD',
        value: '',
        meta: { label: 'SMTP password', type: 'string', secret: 'Y' },
      },
      { id: 'SMTP_FROM_ADDR', value: '', meta: { label: 'SMTP sender address', type: 'string' } },
      { id: 'SMTP_FROM_NAME', value: '', meta: { label: 'SMTP sender name', type: 'string' } },
    ),
  )
  .install(
    odbSettings.seed({
      id: 'APP_PUBLIC_URL',
      value: '',
      meta: { label: 'Public application URL for account emails', type: 'string' },
    }),
  )
  .install(
    odbSettings.seed({
      id: 'APP_SETTINGS_MASTER_KEY_URI',
      value: '',
      meta: { label: 'OCI Vault master key secret bundle URI', type: 'string' },
    }),
  )
  .install(
    odbSettings.seed({
      id: 'APP_VERSION',
      value: '1.0.0',
      meta: { label: 'Application version', type: 'string' },
    }),
  )
  .install(
    odbAuth.seedUser({
      username: odbEnv.appUsername,
      password: odbEnv.appPassword,
      displayName: 'Administrator',
    }),
  )
  .install(odbAuth.role.seed({ name: 'admin', description: 'Application administrator' }))
  .install(odbAuth.role.seedGrant({ username: odbEnv.appUsername, role: 'admin' }))
  .install(appPackage)
