import { cond, odbLiteral, plsqlExpr } from '../../schema/attribute.js'
import { odbPackage, odbType } from '../../schema/package.js'
import { odbTable } from '../../schema/table.js'
import { odbQuery } from '../../query/index.js'
import { odbDbmsNetworkAclAdmin, odbOracle } from '../../oracle/index.js'

export const aclTypes = {
  host: odbType.string(255),
  port: odbType.number(),
}

// Dictionary metadata only; this capability does not create or drop the view.
const hostAces = odbTable('dba_host_aces', (t) => ({
  host: t.string(255).notNull(),
  lowerPort: t.number(),
  upperPort: t.number(),
  principal: t.string(128),
  principalType: t.string(16),
  privilege: t.string(128).notNull(),
  grantType: t.string(5),
  invertedPrincipal: t.string(3),
}))

export const odbAclPackage = odbPackage('odb_acl', (pkg) => {
  const change = pkg.privateProc('change_host_ace', (proc) => {
    const { host, port, privilege, removing } = proc.parameters({
      in: {
        host: aclTypes.host,
        port: aclTypes.port,
        privilege: odbType.string(7),
        removing: odbType.boolean(),
      },
    })
    proc.body((body) => {
      body.ifThen(
        cond.or([
          cond.isNull(host),
          cond.gt(odbOracle.length(host), 255),
          cond.not(cond.regexpLike(host, '^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$')),
        ]),
        (then) => then.invalid('ACL_HOST_INVALID'),
      )
      body.ifThen(
        cond.or([
          cond.isNull(port),
          cond.lt(port, 1),
          cond.gt(port, 65535),
          cond.ne(port, odbOracle.trunc(port)),
        ]),
        (then) => then.invalid('ACL_PORT_INVALID'),
      )
      const { count } = body.variables({ count: odbType.integer() })
      const owner = odbOracle.sysContext(odbLiteral('USERENV'), odbLiteral('CURRENT_USER'))
      const normalizedHost = odbOracle.lower(host)
      const ace = plsqlExpr.call(
        'XS$ACE_TYPE',
        'XS$ACE_TYPE',
        `privilege_list => ${plsqlExpr.call('XS$NAME_LIST', 'XS$NAME_LIST', privilege).toSQL()}`,
        `principal_name => ${owner.toSQL()}`,
        'principal_type => XS_ACL.PTYPE_DB',
      )
      body.ifThen(
        cond.eq(removing, true),
        (then) => {
          then.query(
            odbQuery()
              .selectFrom(hostAces)
              .select(odbOracle.count())
              .into(count)
              .where(
                cond.and([
                  cond.eq(hostAces.host, normalizedHost),
                  cond.eq(hostAces.lowerPort, port),
                  cond.eq(hostAces.upperPort, port),
                  cond.eq(hostAces.principal, owner),
                  cond.eq(hostAces.principalType, 'DATABASE'),
                  cond.eq(odbOracle.lower(hostAces.privilege), privilege),
                  cond.eq(hostAces.grantType, 'GRANT'),
                  cond.eq(hostAces.invertedPrincipal, 'NO'),
                ]),
              ),
          )
          then.ifThen(cond.gt(count, 0), (exists) =>
            exists.call(
              odbDbmsNetworkAclAdmin.removeHostAce(normalizedHost, ace, {
                lowerPort: port,
                upperPort: port,
              }),
            ),
          )
        },
        (otherwise) =>
          otherwise.call(
            odbDbmsNetworkAclAdmin.appendHostAce(normalizedHost, ace, {
              lowerPort: port,
              upperPort: port,
            }),
          ),
      )
    })
  })

  const procedures = {
    addHttp: ['add_http', 'http', 443, false],
    removeHttp: ['remove_http', 'http', 443, true],
    addSmtp: ['add_smtp', 'smtp', 587, false],
    removeSmtp: ['remove_smtp', 'smtp', 587, true],
    addLdap: ['add_ldap', 'connect', 636, false],
    removeLdap: ['remove_ldap', 'connect', 636, true],
  } as const
  const define = (key: keyof typeof procedures) => {
    const [name, privilege, defaultPort, removing] = procedures[key]
    return pkg.proc(
      name,
      { in: { host: aclTypes.host, port: aclTypes.port } },
      ({ params: { host, port }, body }) =>
        body.call(
          change.invoke(
            host,
            odbOracle.nvl(port, odbLiteral(defaultPort)),
            odbLiteral(privilege),
            removing ? 'TRUE' : 'FALSE',
          ),
        ),
    )
  }
  const addHttp = define('addHttp')
  const removeHttp = define('removeHttp')
  const addSmtp = define('addSmtp')
  const removeSmtp = define('removeSmtp')
  const addLdap = define('addLdap')
  const removeLdap = define('removeLdap')
  const list = pkg.proc(
    'list',
    { out: { items: odbType.resultset() } },
    ({ params: { items }, body }) =>
      body.openFor(
        items,
        odbQuery()
          .selectFrom(hostAces)
          .select([hostAces.host, hostAces.lowerPort, hostAces.upperPort, hostAces.privilege])
          .where(
            cond.and([
              cond.eq(
                hostAces.principal,
                odbOracle.sysContext(odbLiteral('USERENV'), odbLiteral('CURRENT_USER')),
              ),
              cond.eq(hostAces.principalType, 'DATABASE'),
              cond.eq(hostAces.grantType, 'GRANT'),
              cond.eq(hostAces.invertedPrincipal, 'NO'),
              cond.or([
                cond.eq(odbOracle.lower(hostAces.privilege), 'http'),
                cond.eq(odbOracle.lower(hostAces.privilege), 'smtp'),
                cond.eq(odbOracle.lower(hostAces.privilege), 'connect'),
              ]),
            ]),
          )
          .orderBy(hostAces.host)
          .orderBy(hostAces.lowerPort)
          .orderBy(hostAces.upperPort)
          .orderBy(hostAces.privilege),
      ),
  )
  return { addHttp, removeHttp, addSmtp, removeSmtp, addLdap, removeLdap, list }
})
