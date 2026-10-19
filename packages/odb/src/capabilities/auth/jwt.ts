import { odbPackage, odbType } from '../../schema/package.js'
import { cond, odbLiteral, PlsqlExpression, plsqlExpr } from '../../schema/attribute.js'
import { odbQuery } from '../../query/index.js'
import { odbDbmsCrypto, odbJson, odbOracle, odbUtlEncode, odbUtlRaw } from '../../oracle/index.js'
import { odbSettings } from '../settings/settings.js'
import { odbAudit } from '../audit/audit.js'
import { authJwtSettings } from './settings.js'
import { authSessions, authUsers } from './tables.js'

const JWT_HEADER = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')
const EPOCH_NOW = new PlsqlExpression(
  'NUMBER',
  "FLOOR((CAST(SYS_EXTRACT_UTC(SYSTIMESTAMP) AS DATE) - DATE '1970-01-01') * 86400)",
)

/** HS256 access tokens: issue them and resolve them back to an authenticated user. */
export const odbAuthJwt = odbPackage('odb_auth_jwt', (pkg) => {
  const jwtSecret = pkg.privateVariable('g_jwt_secret', odbType.string(64))
  const jwtIssuer = pkg.privateVariable('g_jwt_issuer', odbType.string(255))
  const jwtExpiration = pkg.privateVariable('g_jwt_expiration_seconds', odbType.number())
  const cacheExpiresAt = pkg.privateVariable('g_config_expires_at', odbType.timestamp())
  const loadConfig = pkg.privateProc('load_config', (proc) => {
    proc.body((body) => {
      const { secret, issuer, expiration, meta } = body.variables({
        secret: odbSettings.types.value,
        issuer: odbSettings.types.value,
        expiration: odbSettings.types.value,
        meta: odbSettings.types.meta,
      })
      body.ifThen(
        cond.and([
          cond.isNotNull(cacheExpiresAt),
          cond.lt(odbOracle.sysTimestamp(), cacheExpiresAt),
        ]),
        (hit) => hit.return(),
      )
      body.set(cacheExpiresAt, null)
      body.set(jwtSecret, null)
      body.set(jwtIssuer, null)
      body.set(jwtExpiration, null)
      body.call(odbSettings.read(odbLiteral('AUTH_JWT_SECRET'), secret, meta))
      body.call(odbSettings.read(odbLiteral('AUTH_JWT_ISSUER'), issuer, meta))
      body.call(odbSettings.read(odbLiteral('AUTH_JWT_EXPIRATION_SECONDS'), expiration, meta))
      body.ifThen(
        cond.or([
          cond.isNull(secret),
          cond.not(cond.regexpLike(secret, authJwtSettings.secretPattern)),
        ]),
        (invalid) => invalid.invalid('AUTH_JWT_SECRET_INVALID'),
      )
      body.ifThen(
        cond.or([
          cond.isNull(issuer),
          cond.not(cond.regexpLike(issuer, authJwtSettings.issuerPattern)),
        ]),
        (invalid) => invalid.invalid('AUTH_JWT_ISSUER_INVALID'),
      )
      body.ifThen(
        cond.or([
          cond.isNull(expiration),
          cond.not(cond.regexpLike(expiration, authJwtSettings.expirationPattern)),
        ]),
        (invalid) => invalid.invalid('AUTH_JWT_EXPIRATION_INVALID'),
      )
      body.ifThen(
        cond.or([
          cond.lt(odbOracle.toNumber(expiration), 1),
          cond.gt(odbOracle.toNumber(expiration), authJwtSettings.maxExpirationSeconds),
        ]),
        (invalid) => invalid.invalid('AUTH_JWT_EXPIRATION_INVALID'),
      )
      body.set(jwtSecret, secret)
      body.set(jwtIssuer, issuer)
      body.set(jwtExpiration, odbOracle.toNumber(expiration))
      body.set(
        cacheExpiresAt,
        odbOracle.plus(
          odbOracle.sysTimestamp(),
          odbOracle.interval.seconds(authJwtSettings.cacheSeconds),
        ),
      )
      body.whenOthers((handler) => {
        handler.set(cacheExpiresAt, null)
        handler.set(jwtSecret, null)
        handler.set(jwtIssuer, null)
        handler.set(jwtExpiration, null)
        handler.call(odbAudit.error(odbLiteral('Auth JWT: configuration loading failed')))
        handler.raise()
      })
    })
  })

  const base64urlEncode = pkg.privateFunc('base64url_encode', odbType.string(4000), (fn) => {
    const { bytes } = fn.parameters({ in: { bytes: odbType.raw(2000) } })
    fn.body((body) =>
      body.return(
        odbOracle.translate(
          odbUtlRaw.castToVarchar2(odbUtlEncode.base64Encode(bytes)),
          plsqlExpr.concat(odbLiteral('+/='), odbOracle.chr(10), odbOracle.chr(13)),
          odbLiteral('-_'),
        ),
      ),
    )
  })

  const base64urlDecode = pkg.privateFunc('base64url_decode', odbType.string(4000), (fn) => {
    const { input } = fn.parameters({ in: { input: odbType.string(4000) } })
    fn.body((body) => {
      const { b64 } = body.variables({ b64: odbType.string(4000) })
      body.set(b64, odbOracle.translate(input, odbLiteral('-_'), odbLiteral('+/')))
      body.set(
        b64,
        odbOracle.rpad(
          b64,
          plsqlExpr.add(
            odbOracle.length(b64),
            odbOracle.mod(plsqlExpr.subtract(4, odbOracle.mod(odbOracle.length(b64), 4)), 4),
          ),
          odbLiteral('='),
        ),
      )
      body.return(odbUtlRaw.castToVarchar2(odbUtlEncode.base64Decode(odbUtlRaw.castToRaw(b64))))
    })
  })

  const sign = pkg.privateFunc('sign', odbType.string(4000), (fn) => {
    const { input } = fn.parameters({ in: { input: odbType.string(4000) } })
    fn.body((body) =>
      body.return(
        base64urlEncode.invoke(
          odbDbmsCrypto.mac(
            odbUtlRaw.castToRaw(input),
            odbDbmsCrypto.HMAC_SH256,
            odbUtlRaw.castToRaw(jwtSecret),
          ),
        ),
      ),
    )
  })

  return {
    createAccessToken: pkg.func('create_access_token', odbType.string(4000), (fn) => {
      const { userId, sessionId, tokenVersion } = fn.parameters({
        in: { userId: odbType.guid(), sessionId: odbType.guid(), tokenVersion: odbType.number() },
      })
      fn.body((body) => {
        const { now, payload, signingInput } = body.variables({
          now: odbType.number(),
          payload: odbType.string(4000),
          signingInput: odbType.string(4000),
        })
        body.call(loadConfig.invoke())
        body.set(now, EPOCH_NOW)
        body.set(
          payload,
          plsqlExpr.jsonObject(
            {
              sub: userId,
              sid: sessionId,
              ver: tokenVersion,
              iss: jwtIssuer,
              iat: now,
              exp: plsqlExpr.add(now, jwtExpiration),
            },
            'VARCHAR2',
          ),
        )
        body.set(
          signingInput,
          plsqlExpr.concat(
            odbLiteral(JWT_HEADER),
            odbLiteral('.'),
            base64urlEncode.invoke(odbUtlRaw.castToRaw(payload)),
          ),
        )
        body.return(plsqlExpr.concat(signingInput, odbLiteral('.'), sign.invoke(signingInput)))
      })
    }),
    requireUser: pkg.func('require_user', odbType.guid(), (fn) => {
      const { token } = fn.parameters({ in: { token: odbType.string(4000) } })
      fn.body((body) => {
        const {
          now,
          dot1,
          dot2,
          payload,
          issuer,
          expiresAt,
          subject,
          sessionId,
          tokenVersion,
          signatureMatches,
          active,
        } = body.variables({
          now: odbType.number(),
          dot1: odbType.number(),
          dot2: odbType.number(),
          payload: odbType.string(4000),
          issuer: odbType.string(4000),
          expiresAt: odbType.number(),
          subject: authUsers.id,
          sessionId: authSessions.id,
          tokenVersion: authUsers.tokenVersion,
          signatureMatches: odbType.boolean(),
          active: odbType.number(),
        })
        body.ifThen(cond.isNull(token), (then) => then.unauthorized())
        body.set(dot1, odbOracle.instr(token, odbLiteral('.'), 1, 1))
        body.set(dot2, odbOracle.instr(token, odbLiteral('.'), 1, 2))
        body.ifThen(
          cond.or([
            cond.gt(odbOracle.length(token), 4000),
            cond.lte(dot1, 1),
            cond.lte(dot2, plsqlExpr.add(dot1, 1)),
            cond.gte(dot2, odbOracle.length(token)),
            cond.ne(odbOracle.instr(token, odbLiteral('.'), 1, 3), 0),
            cond.not(cond.regexpLike(token, '^[A-Za-z0-9_.-]+$', 'c')),
            cond.ne(odbOracle.substr(token, 1, plsqlExpr.subtract(dot1, 1)), JWT_HEADER),
          ]),
          (then) => then.unauthorized(),
        )
        body.call(loadConfig.invoke())
        body.set(
          signatureMatches,
          cond.eq(
            sign.invoke(odbOracle.substr(token, 1, plsqlExpr.subtract(dot2, 1))),
            odbOracle.substr(token, plsqlExpr.add(dot2, 1)),
          ),
        )
        body.ifThen(
          cond.or([cond.isNull(signatureMatches), cond.eq(signatureMatches, false)]),
          (then) => then.unauthorized(),
        )
        body.block((parse) => {
          const { claims, element, validJson, encodedPayload } = parse.variables({
            claims: odbJson.object,
            element: odbJson.element,
            validJson: odbType.number(),
            encodedPayload: odbType.string(4000),
          })
          parse.set(
            encodedPayload,
            odbOracle.substr(
              token,
              plsqlExpr.add(dot1, 1),
              plsqlExpr.subtract(plsqlExpr.subtract(dot2, dot1), 1),
            ),
          )
          parse.set(payload, base64urlDecode.invoke(encodedPayload))
          parse.ifThen(
            cond.or([
              cond.isNull(payload),
              cond.ne(base64urlEncode.invoke(odbUtlRaw.castToRaw(payload)), encodedPayload),
            ]),
            (then) => then.unauthorized(),
          )
          parse.query(
            odbQuery()
              .selectFrom('dual')
              .select(
                odbOracle.caseWhen(
                  cond.isJson(payload, { strict: true, uniqueKeys: true }),
                  odbLiteral(1),
                  odbLiteral(0),
                  'NUMBER',
                ),
              )
              .into(validJson),
          )
          parse.ifThen(cond.ne(validJson, 1), (then) => then.unauthorized())
          parse.set(claims, odbJson.parse(payload))
          parse.call(odbJson.onError(claims, odbLiteral(1)))
          for (const [name, target] of [
            ['iss', issuer],
            ['sub', subject],
            ['sid', sessionId],
          ] as const) {
            parse.set(element, odbJson.get(claims, odbLiteral(name)))
            parse.ifThen(
              cond.or([cond.isNull(element), cond.eq(odbJson.isString(element), false)]),
              (then) => then.unauthorized(),
            )
            parse.set(target, odbJson.getString(claims, odbLiteral(name)))
            parse.ifThen(cond.isNull(target), (then) => then.unauthorized())
          }
          for (const [name, target] of [
            ['exp', expiresAt],
            ['ver', tokenVersion],
          ] as const) {
            parse.set(element, odbJson.get(claims, odbLiteral(name)))
            parse.ifThen(
              cond.or([cond.isNull(element), cond.eq(odbJson.isNumber(element), false)]),
              (then) => then.unauthorized(),
            )
            parse.set(target, odbJson.getNumber(claims, odbLiteral(name)))
            parse.ifThen(
              cond.or([cond.isNull(target), cond.ne(target, odbOracle.trunc(target))]),
              (then) => then.unauthorized(),
            )
          }
          parse.set(now, EPOCH_NOW)
          parse.ifThen(cond.ne(issuer, jwtIssuer), (then) => then.unauthorized())
          parse.ifThen(cond.gte(now, expiresAt), (then) => then.unauthorized())
          // Only untrusted token decoding and claims are normalized to Unauthorized.
          parse.whenOthers((handler) => handler.unauthorized())
        })
        const sessions = authSessions.as('s')
        const users = authUsers.as('u')
        body.query(
          odbQuery()
            .selectFrom(sessions)
            .join(users, cond.eq(users.id, sessions.userId))
            .select('COUNT(*)')
            .into(active)
            .where(
              cond.and([
                cond.eq(sessions.id, sessionId),
                cond.eq(sessions.userId, subject),
                cond.isNull(sessions.revokedAt),
                cond.gt(sessions.expiresAt, odbOracle.sysTimestamp()),
                cond.eq(users.enabled, true),
                cond.eq(users.tokenVersion, tokenVersion),
              ]),
            ),
        )
        body.ifThen(cond.eq(active, 0), (then) => then.unauthorized())
        body.return(subject)
      })
    }),
  }
})
