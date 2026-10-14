import {
  cond,
  defineMigration,
  defineService,
  odbAuth,
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

export const appPackage: Package<Record<never, never>> = odbPackage('pck_app', (pkg) => {
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
  return {}
})

export const schema = odbSchema(schemaName, schemaPassword, (definition) => {
  definition.grant('EXECUTE ON DBMS_CRYPTO')
  definition.grant('EXECUTE ON UTL_ENCODE')
  definition.grant('EXECUTE ON UTL_I18N')
  definition.grant('EXECUTE ON UTL_INADDR')
  definition.grant('EXECUTE ON UTL_TCP')
  definition.grant('EXECUTE ON UTL_SMTP')
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
  .install(odbAuth)
  .install(odbAuth.seedSettings())
  .install(odbAcl)
  .install(odbLob)
  .install(odbStorage)
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
