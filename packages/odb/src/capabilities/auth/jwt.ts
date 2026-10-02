import { odbPackage, odbType } from '../../schema/package.js'
import {
  cond,
  odbLiteral,
  PlsqlExpression,
  plsqlExpr,
  renderPlsql,
  type PlsqlRenderable,
} from '../../schema/attribute.js'
import { odbQuery } from '../../query/index.js'
import { odbDbmsCrypto, odbOracle, odbUtlEncode, odbUtlRaw } from '../../oracle/index.js'
import { ACCESS_TOKEN_SECONDS, DEFAULT_JWT_SECRET } from './constants.js'
import { authSessions, authUsers } from './tables.js'

const JWT_HEADER = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')
const EPOCH_NOW = new PlsqlExpression(
  'NUMBER',
  "FLOOR((CAST(SYS_EXTRACT_UTC(SYSTIMESTAMP) AS DATE) - DATE '1970-01-01') * 86400)",
)

export function jwtSecretOf(options: { jwtSecret?: string }): string {
  const secret = options.jwtSecret ?? process.env.ODBVUE_AUTH_JWT_SECRET ?? DEFAULT_JWT_SECRET
  if (secret.length < 32) throw new Error('odbAuth: jwtSecret must be at least 32 characters.')
  return secret
}

/** A claim read from a parsed JWT payload (no signature check). */
function claim(payload: PlsqlRenderable, name: string, kind: 'string'): PlsqlExpression<'VARCHAR2'>
function claim(payload: PlsqlRenderable, name: string, kind: 'number'): PlsqlExpression<'NUMBER'>
function claim(payload: PlsqlRenderable, name: string, kind: 'string' | 'number') {
  return new PlsqlExpression(
    kind === 'string' ? 'VARCHAR2' : 'NUMBER',
    `json_object_t.parse(${renderPlsql(payload)}).get_${kind}('${name}')`,
  )
}

/** HS256 access tokens: issue them and resolve them back to an authenticated user. */
export const odbAuthJwt = odbPackage('odb_auth_jwt', (pkg) => {
  const jwtSecret = pkg.privateConstant('c_jwt_secret', odbType.string(), 'jwtSecret')

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
        body.set(now, EPOCH_NOW)
        body.set(
          payload,
          plsqlExpr.jsonObject(
            {
              sub: userId,
              sid: sessionId,
              ver: tokenVersion,
              iat: now,
              exp: plsqlExpr.add(now, ACCESS_TOKEN_SECONDS),
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
        const { now, dot1, dot2, payload, expiresAt, subject, sessionId, tokenVersion, active } =
          body.variables({
            now: odbType.number(),
            dot1: odbType.number(),
            dot2: odbType.number(),
            payload: odbType.string(4000),
            expiresAt: odbType.number(),
            subject: authUsers.id,
            sessionId: authSessions.id,
            tokenVersion: authUsers.tokenVersion,
            active: odbType.number(),
          })
        body.ifThen(cond.isNull(token), (then) => then.unauthorized())
        body.set(dot1, odbOracle.instr(token, odbLiteral('.'), 1, 1))
        body.set(dot2, odbOracle.instr(token, odbLiteral('.'), 1, 2))
        body.ifThen(cond.eq(dot2, 0), (then) => then.unauthorized())
        body.ifThen(
          cond.ne(
            sign.invoke(odbOracle.substr(token, 1, plsqlExpr.subtract(dot2, 1))),
            odbOracle.substr(token, plsqlExpr.add(dot2, 1)),
          ),
          (then) => then.unauthorized(),
        )
        body.set(
          payload,
          base64urlDecode.invoke(
            odbOracle.substr(
              token,
              plsqlExpr.add(dot1, 1),
              plsqlExpr.subtract(plsqlExpr.subtract(dot2, dot1), 1),
            ),
          ),
        )
        body.set(now, EPOCH_NOW)
        body.set(expiresAt, claim(payload, 'exp', 'number'))
        body.ifThen(cond.or([cond.isNull(expiresAt), cond.gt(now, expiresAt)]), (then) =>
          then.unauthorized(),
        )
        body.set(subject, claim(payload, 'sub', 'string'))
        body.set(sessionId, claim(payload, 'sid', 'string'))
        body.set(tokenVersion, claim(payload, 'ver', 'number'))
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
