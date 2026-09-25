import { defineMigration, defineService, odbAuth, odbAuthApi, odbEnv } from '@odbvue/odb'

const login = odbAuthApi.procedure('login')
const refresh = odbAuthApi.procedure('refresh')
const logout = odbAuthApi.procedure('logout')
const me = odbAuthApi.procedure('me')

defineService(login, {
  method: 'POST',
  path: '/login',
  summary: 'Authenticate using username and password',
  body: { username: login.parameters.loginUsername, password: login.parameters.password },
  response: { accessToken: login.parameters.accessToken },
  headers: { 'Set-Cookie': login.parameters.setCookie },
})

defineService(refresh, {
  method: 'POST',
  path: '/refresh',
  summary: 'Rotate a refresh token and issue an access token',
  headers: {
    Cookie: refresh.parameters.cookieHeader,
    'Set-Cookie': refresh.parameters.setCookie,
  },
  response: { accessToken: refresh.parameters.accessToken },
})

defineService(logout, {
  method: 'POST',
  path: '/logout',
  summary: 'Revoke an authentication session',
  headers: { Cookie: logout.parameters.cookieHeader, 'Set-Cookie': logout.parameters.setCookie },
})

defineService(me, {
  method: 'GET',
  path: '/me',
  summary: 'Return the authenticated user',
  headers: { Authorization: me.parameters.authorization },
  response: {
    userId: me.parameters.userId,
    username: me.parameters.username,
    displayName: me.parameters.displayName,
  },
})

export const migration = defineMigration('00000000000001_auth', {
  schema: odbEnv.read('ODBVUE_ADB_SCHEMA_USERNAME'),
}).install(odbAuth.api())
