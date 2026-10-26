import { type PackageImpl } from '../../../schema/package.js'
import { cond } from '../../../schema/attribute.js'
import { odbQuery } from '../../../query/index.js'
import { odbAuthJwt } from './tokens.js'
import { authTypes } from './types.js'
import { authUsers } from './tables/users.js'

export function defineAuthUsers(pkg: PackageImpl) {
  const requireUser = pkg.func('require_user', authTypes.userId, (fn) => {
    const { accessToken } = fn.parameters({ in: { accessToken: authTypes.accessToken } })
    fn.body((body) => body.return(odbAuthJwt.requireUser(accessToken)))
  })

  /** Reads an enabled user's profile; raises NOT_FOUND when the user does not exist. */
  const readUser = pkg.proc(
    'read_user',
    {
      in: { userId: authUsers.id },
      out: { username: authUsers.username, displayName: authUsers.displayName },
    },
    ({ params: { userId, username, displayName }, body: statements }) => {
      statements.query(
        odbQuery()
          .selectFrom(authUsers)
          .select([authUsers.username, authUsers.displayName])
          .into(username, displayName)
          .where(cond.and([cond.eq(authUsers.id, userId), cond.eq(authUsers.enabled, true)])),
      )

      statements.when('NO_DATA_FOUND', (handler) => handler.notFound())
    },
  )

  return { requireUser, readUser }
}
