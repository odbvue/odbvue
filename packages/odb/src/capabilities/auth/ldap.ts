import { cond, odbLiteral, plsqlExpr, PlsqlExpression, LocalVar } from '../../schema/attribute.js'
import { odbType, type PackageImpl, type ProcedureBody } from '../../schema/package.js'
import { odbOracle } from '../../oracle/index.js'
import { odbSettings } from '../settings/settings.js'
import { authTypes } from './types.js'
import { odbAudit } from '../audit/audit.js'

/** Search with a service account, then bind the matching entry using the configured transport. */
export function defineLdapCredentials(pkg: PackageImpl) {
  return pkg.privateProc('verify_ldap_credentials', (proc) => {
    const { username, password, subject } = proc.parameters({
      in: { username: authTypes.username, password: authTypes.password },
      out: { subject: odbType.string(255) },
    })
    proc.body((body) => {
      const config = body.variables({
        tlsEnabled: odbType.string(1),
        host: odbType.string(255),
        port: odbType.string(5),
        baseDn: odbType.string(2000),
        attribute: odbType.string(128),
        bindDn: odbType.string(2000),
        bindPassword: odbType.string(2000),
        walletPath: odbType.string(2000),
        walletPassword: odbType.string(2000),
      })
      const {
        value,
        meta,
        session,
        result,
        entry,
        attributes,
        timeout,
        status,
        count,
        dn,
        escaped,
        previousExceptions,
        configured,
      } = body.variables({
        value: odbSettings.types.value,
        meta: odbSettings.types.meta,
        session: odbType.custom('DBMS_LDAP.SESSION'),
        result: odbType.custom('DBMS_LDAP.MESSAGE'),
        entry: odbType.custom('DBMS_LDAP.MESSAGE'),
        attributes: odbType.custom('DBMS_LDAP.STRING_COLLECTION'),
        timeout: odbType.custom('DBMS_LDAP.TIMEVAL'),
        status: odbType.integer(),
        count: odbType.integer(),
        dn: odbType.string(32767),
        escaped: odbType.string(2000),
        previousExceptions: odbType.boolean(),
        configured: odbType.boolean(),
      })
      const exceptionMode = new LocalVar('DBMS_LDAP.use_exception', 'BOOLEAN')
      body.set(configured, false)
      body.set(subject, null)
      for (const [key, id, limit] of [
        ['tlsEnabled', 'AUTH_LDAP_TLS_ENABLED', 1],
        ['host', 'AUTH_LDAP_HOST', 255],
        ['port', 'AUTH_LDAP_PORT', 5],
        ['baseDn', 'AUTH_LDAP_BASE_DN', 2000],
        ['attribute', 'AUTH_LDAP_LOGIN_ATTRIBUTE', 128],
        ['bindDn', 'AUTH_LDAP_BIND_DN', 2000],
        ['bindPassword', 'AUTH_LDAP_BIND_PASSWORD', 2000],
        ['walletPath', 'AUTH_LDAP_WALLET_PATH', 2000],
        ['walletPassword', 'AUTH_LDAP_WALLET_PASSWORD', 2000],
      ] as const) {
        body.call(odbSettings.read(odbLiteral(id), value, meta))
        body.ifThen(
          cond.or([
            ...(key === 'walletPassword' || key === 'walletPath' ? [] : [cond.isNull(value)]),
            cond.gt(odbOracle.length(value), limit),
          ]),
          (invalid) => invalid.invalid('LDAP_CONFIG_INVALID'),
        )
        body.set(config[key], value)
      }
      body.ifThen(
        cond.or([
          cond.and([cond.ne(config.tlsEnabled, 'Y'), cond.ne(config.tlsEnabled, 'N')]),
          cond.not(cond.regexpLike(config.host, '^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$')),
          cond.not(cond.regexpLike(config.port, '^[0-9]{1,5}$')),
          cond.not(cond.regexpLike(config.attribute, '^[A-Za-z][A-Za-z0-9-]*$')),
          cond.and([
            cond.isNotNull(config.walletPath),
            cond.not(cond.regexpLike(config.walletPath, '^file:.+')),
          ]),
        ]),
        (invalid) => invalid.invalid('LDAP_CONFIG_INVALID'),
      )
      const port = odbOracle.toNumber(config.port)
      body.ifThen(cond.or([cond.lt(port, 1), cond.gt(port, 65535)]), (invalid) =>
        invalid.invalid('LDAP_CONFIG_INVALID'),
      )
      // Escape assertion values per RFC 4515; the attribute is validated separately.
      body.set(escaped, username)
      for (const [character, replacement] of [
        [odbLiteral('\\'), '\\5c'],
        [odbLiteral('*'), '\\2a'],
        [odbLiteral('('), '\\28'],
        [odbLiteral(')'), '\\29'],
        [plsqlExpr.call('VARCHAR2', 'CHR', odbLiteral(0)), '\\00'],
      ] as const) {
        body.set(escaped, odbOracle.replace(escaped, character, odbLiteral(replacement)))
      }
      body.set(previousExceptions, exceptionMode)
      body.set(exceptionMode, false)
      body.set(configured, true)
      body.set(session, plsqlExpr.call('DBMS_LDAP.SESSION', 'DBMS_LDAP.init', config.host, port))
      const check = (target: ProcedureBody) =>
        target.ifThen(cond.ne(status, 0), (failed) => {
          failed.call(
            odbAudit.error(
              odbLiteral('LDAP_DIRECTORY_FAILURE'),
              plsqlExpr.jsonObject({ status }, 'VARCHAR2'),
            ),
          )
          failed.raiseApplicationError(-20001, odbLiteral('LDAP_DIRECTORY_FAILURE'))
        })
      body.ifThen(cond.eq(config.tlsEnabled, 'Y'), (tls) => {
        tls.set(
          status,
          plsqlExpr.call(
            'PLS_INTEGER',
            'DBMS_LDAP.open_ssl',
            session,
            config.walletPath,
            config.walletPassword,
            odbLiteral(2),
          ),
        )
        check(tls)
      })
      body.set(
        status,
        plsqlExpr.call(
          'PLS_INTEGER',
          'DBMS_LDAP.simple_bind_s',
          session,
          config.bindDn,
          config.bindPassword,
        ),
      )
      check(body)
      body.set(new LocalVar(`${attributes.toSQL()}(1)`, 'VARCHAR2'), '1.1')
      body.set(timeout.field('seconds', 'PLS_INTEGER'), 10)
      body.set(timeout.field('useconds', 'PLS_INTEGER'), 0)
      body.set(
        status,
        plsqlExpr.call(
          'PLS_INTEGER',
          'DBMS_LDAP.search_st',
          session,
          config.baseDn,
          new PlsqlExpression('PLS_INTEGER', 'DBMS_LDAP.SCOPE_SUBTREE'),
          plsqlExpr.concat('(', config.attribute, '=', escaped, ')'),
          attributes,
          odbLiteral(0),
          timeout,
          result,
        ),
      )
      check(body)
      body.set(count, plsqlExpr.call('PLS_INTEGER', 'DBMS_LDAP.count_entries', session, result))
      body.ifThen(cond.or([cond.lt(count, 0), cond.gt(count, 1)]), (invalid) =>
        invalid.raiseApplicationError(-20001, odbLiteral('LDAP_SEARCH_AMBIGUOUS')),
      )
      body.ifThen(cond.eq(count, 1), (found) => {
        found.set(
          entry,
          plsqlExpr.call('DBMS_LDAP.MESSAGE', 'DBMS_LDAP.first_entry', session, result),
        )
        found.set(dn, plsqlExpr.call('VARCHAR2', 'DBMS_LDAP.get_dn', session, entry))
        found.ifThen(cond.or([cond.isNull(dn), cond.gt(odbOracle.length(dn), 255)]), (invalid) =>
          invalid.raiseApplicationError(-20001, odbLiteral('LDAP_IDENTITY_INVALID')),
        )
        found.set(
          status,
          plsqlExpr.call('PLS_INTEGER', 'DBMS_LDAP.simple_bind_s', session, dn, password),
        )
        found.ifThen(cond.eq(status, 49), (invalid) => invalid.unauthorized('INVALID_CREDENTIALS'))
        check(found)
        found.set(subject, dn)
      })
      const cleanup = (target: ProcedureBody) => {
        target.ifThen(cond.isNotNull(result), (free) => {
          free.set(status, plsqlExpr.call('PLS_INTEGER', 'DBMS_LDAP.msgfree', result))
          free.set(result, null)
          free.ifThen(cond.eq(status, -1), (failed) =>
            failed.raiseApplicationError(-20001, odbLiteral('LDAP_CLEANUP_FAILURE')),
          )
        })
        target.ifThen(cond.isNotNull(session), (close) => {
          close.set(status, plsqlExpr.call('PLS_INTEGER', 'DBMS_LDAP.unbind_s', session))
          close.set(session, null)
          check(close)
        })
      }
      cleanup(body)
      body.set(exceptionMode, previousExceptions)
      body.whenOthers((handler) => {
        // Restore pooled-session state and preserve the original error if cleanup also fails.
        handler.ifThen(cond.eq(configured, true), (restore) => {
          restore.block((release) => {
            cleanup(release)
            release.whenOthers((failed) =>
              failed.call(odbAudit.error(odbLiteral('LDAP_CLEANUP_FAILURE'))),
            )
          })
          restore.set(exceptionMode, previousExceptions)
        })
        handler.call(odbAudit.error(odbLiteral('LDAP_AUTHENTICATION_FAILURE')))
        handler.raise()
      })
    })
  })
}
