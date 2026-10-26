import { type PackageImpl, odbType } from '../../../schema/package.js'
import { cond } from '../../../schema/attribute.js'
import { odbQuery } from '../../../query/index.js'
import { authUsers } from './tables/users.js'
import { authIdentities } from './tables/identities.js'

export function defineAuthIdentities(pkg: PackageImpl) {
  const readPasswordHash = pkg.privateFunc('read_password_hash', odbType.string(512), (fn) => {
    const { userId } = fn.parameters({ in: { userId: authUsers.id } })
    fn.body((body) => {
      const { passwordHash } = body.variables({ passwordHash: authIdentities.passwordHash })
      body.query(
        odbQuery()
          .selectFrom(authIdentities)
          .select(authIdentities.passwordHash)
          .into(passwordHash)
          .where(
            cond.and([
              cond.eq(authIdentities.userId, userId),
              cond.eq(authIdentities.issuer, 'password'),
            ]),
          ),
      )
      body.return(passwordHash)
      body.when('NO_DATA_FOUND', (handler) => handler.return(null))
    })
  })

  return { readPasswordHash }
}
