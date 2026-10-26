import { type PackageImpl, odbType } from '../../../schema/package.js'
import { cond, PlsqlExpression, PlsqlStatement } from '../../../schema/attribute.js'
import { odbQuery } from '../../../query/index.js'
import { odbOracle } from '../../../oracle/index.js'
import { authUsers } from './tables/users.js'
import { authRoles, authUserRoles, authRolePermissions } from './tables/authorization.js'

export function defineAuthAuthorization(pkg: PackageImpl) {
  const defineRole = pkg.proc(
    'define_role',
    {
      in: { role: authRoles.role, description: { ...odbType.string(2000), default: 'NULL' } },
    },
    ({ params: { role, description }, body }) => {
      body.ifThen(cond.isNull(odbOracle.trim(role)), (then) => then.invalid('ROLE_REQUIRED'))
      body.query(
        odbQuery()
          .mergeInto(authRoles.as('target'))
          .using({ role }, 'source')
          .on((target, source) => cond.eq(target.role, source.role))
          .whenMatched({ description })
          .whenNotMatched({ role, description }),
      )
    },
  )

  const grantRole = pkg.proc(
    'grant_role',
    {
      in: {
        userId: authUsers.id,
        role: authRoles.role,
        validFrom: { ...odbType.timestamp(), default: 'SYSTIMESTAMP' },
        validTo: { ...odbType.timestamp(), default: 'NULL' },
      },
    },
    ({ params: { userId, role, validFrom, validTo }, body }) => {
      body.query(
        odbQuery()
          .mergeInto(authUserRoles.as('target'))
          .using({ userId, role }, 'source')
          .on((target, source) =>
            cond.and([cond.eq(target.userId, source.userId), cond.eq(target.role, source.role)]),
          )
          .whenMatched({ validFrom, validTo })
          .whenNotMatched({ userId, role, validFrom, validTo }),
      )
    },
  )

  const revokeRole = pkg.proc(
    'revoke_role',
    { in: { userId: authUsers.id, role: authRoles.role } },
    ({ params: { userId, role }, body }) =>
      body.query(
        odbQuery()
          .deleteFrom(authUserRoles)
          .where(
            cond.and([cond.eq(authUserRoles.userId, userId), cond.eq(authUserRoles.role, role)]),
          ),
      ),
  )

  const grantPermission = pkg.proc(
    'grant_permission',
    {
      in: { role: authRoles.role, permission: authRolePermissions.permission },
    },
    ({ params: { role, permission }, body }) => {
      body.ifThen(cond.isNull(odbOracle.trim(permission)), (then) =>
        then.invalid('PERMISSION_REQUIRED'),
      )
      body.query(
        odbQuery()
          .mergeInto(authRolePermissions.as('target'))
          .using({ role, permission }, 'source')
          .on((target, source) =>
            cond.and([
              cond.eq(target.role, source.role),
              cond.eq(target.permission, source.permission),
            ]),
          )
          .whenNotMatched({ role, permission }),
      )
    },
  )

  const revokePermission = pkg.proc(
    'revoke_permission',
    {
      in: { role: authRoles.role, permission: authRolePermissions.permission },
    },
    ({ params: { role, permission }, body }) =>
      body.query(
        odbQuery()
          .deleteFrom(authRolePermissions)
          .where(
            cond.and([
              cond.eq(authRolePermissions.role, role),
              cond.eq(authRolePermissions.permission, permission),
            ]),
          ),
      ),
  )

  const users = authUsers.as('u')
  const userRoles = authUserRoles.as('ur')
  const rolePermissions = authRolePermissions.as('rp')
  const activeGrant = () =>
    cond.and([
      cond.eq(users.enabled, true),
      cond.lte(userRoles.validFrom, odbOracle.sysTimestamp()),
      cond.or([
        cond.isNull(userRoles.validTo),
        cond.gt(userRoles.validTo, odbOracle.sysTimestamp()),
      ]),
    ])

  const hasRole = pkg.func('has_role', odbType.boolean(), (fn) => {
    const { userId, role } = fn.parameters({ in: { userId: authUsers.id, role: authRoles.role } })
    fn.body((body) => {
      const { count } = body.variables({ count: odbType.integer() })
      body.query(
        odbQuery()
          .selectFrom(userRoles)
          .join(users, cond.eq(users.id, userRoles.userId))
          .select('COUNT(*)')
          .into(count)
          .where(
            cond.and([
              cond.eq(userRoles.userId, userId),
              cond.eq(userRoles.role, role),
              activeGrant(),
            ]),
          ),
      )
      body.return(cond.gt(count, 0))
    })
  })

  const hasPermission = pkg.func('has_permission', odbType.boolean(), (fn) => {
    const { userId, permission } = fn.parameters({
      in: { userId: authUsers.id, permission: authRolePermissions.permission },
    })
    fn.body((body) => {
      const { count } = body.variables({ count: odbType.integer() })
      body.query(
        odbQuery()
          .selectFrom(userRoles)
          .join(users, cond.eq(users.id, userRoles.userId))
          .join(rolePermissions, cond.eq(rolePermissions.role, userRoles.role))
          .select('COUNT(*)')
          .into(count)
          .where(
            cond.and([
              cond.eq(userRoles.userId, userId),
              cond.eq(rolePermissions.permission, permission),
              activeGrant(),
            ]),
          ),
      )
      body.return(cond.gt(count, 0))
    })
  })

  const requireRole = pkg.proc(
    'require_role',
    { in: { userId: authUsers.id, role: authRoles.role } },
    ({ params: { userId, role }, body }) =>
      body.ifThen(cond.eq(hasRole.invoke(userId, role), false), (then) => then.forbidden()),
  )
  const requirePermission = pkg.proc(
    'require_permission',
    { in: { userId: authUsers.id, permission: authRolePermissions.permission } },
    ({ params: { userId, permission }, body }) =>
      body.ifThen(cond.eq(hasPermission.invoke(userId, permission), false), (then) =>
        then.forbidden(),
      ),
  )

  const readAuthorization = pkg.proc(
    'read_authorization',
    {
      in: { userId: authUsers.id },
      out: { roles: odbType.json(), permissions: odbType.json() },
    },
    ({ params: { userId, roles, permissions }, body }) => {
      body.query(
        odbQuery()
          .selectFrom(userRoles)
          .join(users, cond.eq(users.id, userRoles.userId))
          .select("COALESCE(JSON_ARRAYAGG(ur.role ORDER BY ur.role RETURNING CLOB), TO_CLOB('[]'))")
          .into(roles)
          .where(cond.and([cond.eq(userRoles.userId, userId), activeGrant()])),
      )
      const { permissionArray } = body.variables({
        permissionArray: odbType.custom('json_array_t'),
      })
      body.set(permissionArray, new PlsqlExpression('json_array_t', 'json_array_t()'))
      body.forQuery(
        'permission_row',
        odbQuery()
          .selectFrom(userRoles)
          .join(users, cond.eq(users.id, userRoles.userId))
          .join(rolePermissions, cond.eq(rolePermissions.role, userRoles.role))
          .select('DISTINCT rp.permission')
          .where(cond.and([cond.eq(userRoles.userId, userId), activeGrant()]))
          .orderBy(rolePermissions.permission),
        (record, loop) => {
          loop.call(
            new PlsqlStatement(
              `${permissionArray.toSQL()}.append(${record.column('permission').toSQL()})`,
            ),
          )
        },
      )
      body.set(permissions, new PlsqlExpression('CLOB', `${permissionArray.toSQL()}.to_clob()`))
    },
  )

  return {
    defineRole,
    grantRole,
    revokeRole,
    grantPermission,
    revokePermission,
    hasRole,
    hasPermission,
    requireRole,
    requirePermission,
    readAuthorization,
  }
}
