import { odbPackage, odbType } from '../../schema/package.js'
import { cond, odbLiteral, plsqlExpr, PlsqlExpression } from '../../schema/attribute.js'
import { odbQuery } from '../../query/index.js'
import {
  odbDbmsCrypto,
  odbDbmsLob,
  odbJson,
  odbOracle,
  odbUtlI18n,
  odbUtlUrl,
} from '../../oracle/index.js'
import { odbSettings } from '../settings/settings.js'
import { odbRateLimitApi } from '../rate-limit/rate-limit.js'
import { authTypes } from '../auth/types.js'
import { odbAuth } from '../auth/auth.js'
import { googleKeys, googleTransactions } from './tables.js'
import { defineGoogleHttp } from './http.js'
import { defineGoogleJwt } from './jwt.js'
import { ODB_ERROR_NUMBER } from '../../schema/errors.js'
import { odbAudit } from '../audit/audit.js'

const text = odbType.string
const now = new PlsqlExpression('TIMESTAMP', 'CAST(SYSTIMESTAMP AS TIMESTAMP)')

/** Requires Oracle JSON object types, UTL_HTTP request contexts and DBMS_CRYPTO RSA VERIFY. */
export const odbGooglePackage = odbPackage('odb_google', (pkg) => {
  const hash = pkg.privateFunc('hash_value', text(64), (fn) => {
    const { value } = fn.parameters({ in: { value: text(32767) } })
    fn.body((body) =>
      body.return(
        odbOracle.rawToHex(
          odbDbmsCrypto.hash(
            odbUtlI18n.stringToRaw(value, odbLiteral('AL32UTF8')),
            odbDbmsCrypto.HASH_SH256,
          ),
        ),
      ),
    )
  })
  const random = pkg.privateFunc('random_value', text(64), (fn) => {
    fn.body((body) => body.return(odbOracle.rawToHex(odbDbmsCrypto.randomBytes(32))))
  })
  const escape = pkg.privateFunc('escape_value', text(32767), (fn) => {
    const { value } = fn.parameters({ in: { value: text(32767) } })
    fn.body((body) => body.return(odbUtlUrl.escape(value, true, odbLiteral('AL32UTF8'))))
  })
  const readKeys = pkg.privateFunc('read_keys', odbType.clob(), (fn) => {
    fn.body((body) => {
      const { document } = body.variables({ document: odbType.clob() })
      body.query(
        odbQuery()
          .selectFrom(googleKeys)
          .select(googleKeys.document)
          .into(document)
          .where(cond.and([cond.eq(googleKeys.id, 'GOOGLE'), cond.gt(googleKeys.expiresAt, now)])),
      )
      body.return(document)
      body.when('NO_DATA_FOUND', (handler) => handler.return(null))
    })
  })
  const storeKeys = pkg.privateProc('store_keys', (proc) => {
    const { document } = proc.parameters({ in: { document: odbType.clob() } })
    proc.body((body) => {
      const expiry = new PlsqlExpression(
        'TIMESTAMP',
        "CAST(SYSTIMESTAMP AS TIMESTAMP) + INTERVAL '300' SECOND",
      )
      body.query(
        odbQuery()
          .mergeInto(googleKeys.as('target'))
          .using({ id: odbLiteral('GOOGLE') }, 'source')
          .on((target, source) => cond.eq(target.id, source.id))
          .whenMatched({ document, expiresAt: expiry })
          .whenNotMatched({ id: odbLiteral('GOOGLE'), document, expiresAt: expiry }),
      )
    })
  })

  const request = defineGoogleHttp(pkg)
  const { encode, strictObject, requiredString, verify } = defineGoogleJwt(pkg, {
    hash,
    request,
    readKeys,
    storeKeys,
  })

  const publicUrl = pkg.func('public_url', odbSettings.types.value, (fn) => {
    fn.body((body) => {
      const { appUrl, meta } = body.variables({
        appUrl: odbSettings.types.value,
        meta: odbSettings.types.meta,
      })
      body.call(odbSettings.read(odbLiteral('APP_PUBLIC_URL'), appUrl, meta))
      body.ifThen(
        cond.or([
          cond.isNull(appUrl),
          cond.not(cond.regexpLike(appUrl, '^https?://[^[:space:]<>"\'&?#\\\\@]+$')),
          cond.not(
            cond.regexpLike(
              appUrl,
              '^https://|^http://(localhost|127[.]0[.]0[.]1|\\[::1\\])(:[0-9]{1,5})?(/|$)',
            ),
          ),
        ]),
        (then) => then.invalid('GOOGLE_APP_URL_INVALID'),
      )
      body.return(appUrl)
    })
  })

  const enabled = pkg.func('enabled', odbType.boolean(), (fn) => {
    fn.body((body) => {
      const { value, meta } = body.variables({ value: text(32767), meta: odbType.clob() })
      body.call(odbSettings.read(odbLiteral('AUTH_GOOGLE_ENABLED'), value, meta))
      body.ifThen(
        cond.or([cond.isNull(value), cond.and([cond.ne(value, 'Y'), cond.ne(value, 'N')])]),
        (then) => then.invalid('GOOGLE_CONFIG_INVALID'),
      )
      body.return(cond.eq(value, 'Y'))
    })
  })

  const load = pkg.privateProc('load_config', (proc) => {
    const outputs = proc.parameters({
      out: {
        clientId: text(256),
        clientSecret: text(4000),
        redirectUri: text(2048),
      },
    })
    proc.body((body) => {
      const { meta, value } = body.variables({ meta: odbType.clob(), value: text(32767) })
      body.ifThen(cond.eq(enabled.invoke(), false), (then) => then.forbidden('GOOGLE_DISABLED'))
      for (const [key, id, limit] of [
        ['clientId', 'AUTH_GOOGLE_CLIENT_ID', 256],
        ['clientSecret', 'AUTH_GOOGLE_CLIENT_SECRET', 4000],
        ['redirectUri', 'AUTH_GOOGLE_REDIRECT_URI', 2048],
      ] as const) {
        body.call(odbSettings.read(odbLiteral(id), value, meta))
        body.ifThen(cond.gt(odbOracle.length(value), limit), (then) =>
          then.invalid('GOOGLE_CONFIG_INVALID'),
        )
        body.set(outputs[key], value)
      }
      body.ifThen(
        cond.or([
          cond.isNull(odbOracle.trim(outputs.clientSecret)),
          cond.isNull(outputs.clientId),
          cond.not(
            cond.regexpLike(outputs.clientId, '^[A-Za-z0-9._-]+[.]apps[.]googleusercontent[.]com$'),
          ),
          cond.isNull(outputs.redirectUri),
          cond.regexpLike(outputs.redirectUri, '[[:space:][:cntrl:]?#\\\\]'),
          cond.not(
            cond.regexpLike(
              outputs.redirectUri,
              '^(https://[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]{1,5})?(/[^?#]*)?|http://(localhost|127[.]0[.]0[.]1|\\[::1\\])(:[0-9]{1,5})?(/[^?#]*)?)$',
            ),
          ),
        ]),
        (then) => then.invalid('GOOGLE_CONFIG_INVALID'),
      )
    })
  })

  const consume = pkg.privateProc('consume_transaction', (proc) => {
    const {
      state,
      browserToken,
      nonceHash,
      verifier,
      clientId,
      redirectUri,
      returnPath,
      purpose,
      userId,
      sessionId,
      tokenVersion,
    } = proc.parameters({
      in: { state: text(128), browserToken: text(128) },
      out: {
        nonceHash: text(64),
        verifier: text(64),
        clientId: text(256),
        redirectUri: text(2048),
        returnPath: text(2048),
        purpose: googleTransactions.purpose,
        userId: googleTransactions.userId,
        sessionId: googleTransactions.sessionId,
        tokenVersion: googleTransactions.tokenVersion,
      },
    })
    proc.autonomous()
    proc.body((body) => {
      const { expiresAt, stateHash, browserHash } = body.variables({
        expiresAt: googleTransactions.expiresAt,
        stateHash: text(64),
        browserHash: text(64),
      })
      body.ifThen(
        cond.or([
          cond.isNull(state),
          cond.isNull(browserToken),
          cond.not(cond.regexpLike(state, '^[A-F0-9]{64}$')),
          cond.not(cond.regexpLike(browserToken, '^[A-F0-9]{64}$')),
        ]),
        (then) => then.unauthorized('GOOGLE_STATE_INVALID'),
      )
      body.set(stateHash, hash.invoke(state))
      body.set(browserHash, hash.invoke(browserToken))
      body.query(
        odbQuery()
          .selectFrom(googleTransactions)
          .select([
            googleTransactions.nonceHash,
            googleTransactions.verifier,
            googleTransactions.clientId,
            googleTransactions.redirectUri,
            googleTransactions.returnPath,
            googleTransactions.expiresAt,
            googleTransactions.purpose,
            googleTransactions.userId,
            googleTransactions.sessionId,
            googleTransactions.tokenVersion,
          ])
          .into(
            nonceHash,
            verifier,
            clientId,
            redirectUri,
            returnPath,
            expiresAt,
            purpose,
            userId,
            sessionId,
            tokenVersion,
          )
          .where(
            cond.and([
              cond.eq(googleTransactions.stateHash, stateHash),
              cond.eq(googleTransactions.browserHash, browserHash),
              cond.gt(googleTransactions.expiresAt, now),
            ]),
          )
          .forUpdate(),
      )
      body.ifThen(cond.lte(expiresAt, now), (then) => then.unauthorized('GOOGLE_STATE_INVALID'))
      body.query(
        odbQuery()
          .deleteFrom(googleTransactions)
          .where(cond.eq(googleTransactions.stateHash, stateHash)),
      )
      body.commit()
      body.when('OTHERS', (handler) => {
        handler.rollback()
        handler.unauthorized('GOOGLE_STATE_INVALID')
      })
    })
  })
  const startTransaction = pkg.privateProc('start_transaction', (proc) => {
    const params = proc.parameters({
      in: {
        returnPath: text(2048),
        purpose: text(8),
        userId: authTypes.userId,
        sessionId: odbType.guid(),
        tokenVersion: odbType.number(),
      },
      out: { authorizationUrl: text(4000), browserToken: text(64) },
    })
    const { returnPath, purpose, userId, sessionId, tokenVersion, authorizationUrl, browserToken } =
      params
    proc.body((body) => {
      const {
        clientId,
        clientSecret,
        redirectUri,
        state,
        nonce,
        verifier,
        stateHash,
        browserHash,
        nonceHash,
        ip,
      } = body.variables({
        clientId: text(256),
        clientSecret: text(4000),
        redirectUri: text(2048),
        state: text(64),
        nonce: text(64),
        verifier: text(64),
        stateHash: text(64),
        browserHash: text(64),
        nonceHash: text(64),
        ip: text(128),
      })
      body.set(ip, odbOracle.sysContext(odbLiteral('USERENV'), odbLiteral('IP_ADDRESS')))
      body.call(odbRateLimitApi.enforce(odbLiteral('AUTH_GOOGLE_START_IP'), ip))
      body.call(odbRateLimitApi.failure(odbLiteral('AUTH_GOOGLE_START_IP'), ip))
      body.call(load.invoke(clientId, clientSecret, redirectUri))
      body.ifThen(
        cond.or([
          cond.isNull(returnPath),
          cond.gt(odbOracle.length(returnPath), 2048),
          cond.not(cond.regexpLike(returnPath, '^/')),
          cond.regexpLike(returnPath, '^//|[[:cntrl:]\\\\]|%0[aAdD]'),
        ]),
        (then) => then.invalid('GOOGLE_RETURN_PATH_INVALID'),
      )
      for (const variable of [state, browserToken, nonce, verifier])
        body.set(variable, random.invoke())
      body.set(stateHash, hash.invoke(state))
      body.set(browserHash, hash.invoke(browserToken))
      body.set(nonceHash, hash.invoke(nonce))
      body.set(
        authorizationUrl,
        plsqlExpr.concat(
          odbLiteral(
            'https://accounts.google.com/o/oauth2/v2/auth?response_type=code&scope=openid%20email%20profile&client_id=',
          ),
          escape.invoke(clientId),
          odbLiteral('&redirect_uri='),
          escape.invoke(redirectUri),
          odbLiteral('&state='),
          state,
          odbLiteral('&nonce='),
          nonce,
          odbLiteral('&code_challenge_method=S256&code_challenge='),
          encode.invoke(
            odbDbmsCrypto.hash(
              odbUtlI18n.stringToRaw(verifier, odbLiteral('AL32UTF8')),
              odbDbmsCrypto.HASH_SH256,
            ),
          ),
        ),
      )
      body.ifThen(cond.gt(odbOracle.length(authorizationUrl), 4000), (then) =>
        then.invalid('GOOGLE_CONFIG_INVALID'),
      )
      body.query(
        odbQuery()
          .deleteFrom(googleTransactions)
          .where(cond.lte(googleTransactions.expiresAt, now)),
      )
      body.insertInto(googleTransactions, {
        stateHash,
        browserHash,
        nonceHash,
        verifier,
        clientId,
        redirectUri,
        returnPath,
        purpose,
        userId,
        sessionId,
        tokenVersion,
        expiresAt: new PlsqlExpression(
          'TIMESTAMP',
          "CAST(SYSTIMESTAMP AS TIMESTAMP) + INTERVAL '5' MINUTE",
        ),
      })
    })
  })

  const start = pkg.proc(
    'start_login',
    {
      in: { returnPath: text(2048) },
      out: { authorizationUrl: text(4000), browserToken: text(64) },
    },
    ({ params: { returnPath, authorizationUrl, browserToken }, body }) => {
      body.call(
        startTransaction.invoke(
          returnPath,
          odbLiteral('login'),
          odbOracle.null(),
          odbOracle.null(),
          odbOracle.null(),
          authorizationUrl,
          browserToken,
        ),
      )
    },
  )

  const startLink = pkg.proc(
    'start_link',
    {
      in: {
        returnPath: text(2048),
        userId: authTypes.userId,
        refreshToken: authTypes.refreshToken,
        password: authTypes.password,
      },
      out: { authorizationUrl: text(4000), browserToken: text(64) },
    },
    ({
      params: { returnPath, userId, refreshToken, password, authorizationUrl, browserToken },
      body,
    }) => {
      const { sessionId, tokenVersion } = body.variables({
        sessionId: odbType.guid(),
        tokenVersion: odbType.number(),
      })
      body.call(odbAuth.prepareGoogleLink(userId, refreshToken, password, sessionId, tokenVersion))
      body.call(
        startTransaction.invoke(
          returnPath,
          odbLiteral('link'),
          userId,
          sessionId,
          tokenVersion,
          authorizationUrl,
          browserToken,
        ),
      )
    },
  )

  const completeTransaction = pkg.privateProc('complete_transaction', (proc) => {
    const params = proc.parameters({
      in: {
        state: text(128),
        code: text(4000),
        browserToken: text(128),
        providerError: text(256),
        currentRefresh: authTypes.refreshToken,
      },
      out: {
        refreshToken: authTypes.refreshToken,
        returnPath: text(2048),
        outcome: text(32),
        purpose: text(8),
      },
    })
    const {
      state,
      code,
      browserToken,
      providerError,
      refreshToken,
      returnPath,
      outcome,
      purpose,
      currentRefresh,
    } = params
    proc.body((body) => {
      const binding = body.variables({
        userId: authTypes.userId,
        sessionId: odbType.guid(),
        tokenVersion: odbType.number(),
      })
      const {
        nonceHash,
        verifier,
        snapshotClient,
        snapshotRedirect,
        clientId,
        clientSecret,
        redirectUri,
        subject,
        email,
        displayName,
        picture,
        accessToken,
        ip,
      } = body.variables({
        nonceHash: text(64),
        verifier: text(64),
        snapshotClient: text(256),
        snapshotRedirect: text(2048),
        clientId: text(256),
        clientSecret: text(4000),
        redirectUri: text(2048),
        subject: text(255),
        email: text(128),
        displayName: { type: 'VARCHAR2(256 CHAR)' },
        picture: text(2048),
        accessToken: authTypes.accessToken,
        ip: text(128),
      })
      body.set(refreshToken, null)
      body.set(outcome, null)
      body.set(purpose, null)
      body.set(ip, odbOracle.sysContext(odbLiteral('USERENV'), odbLiteral('IP_ADDRESS')))
      body.call(odbRateLimitApi.enforce(odbLiteral('AUTH_GOOGLE_CALLBACK_IP'), ip))
      body.call(odbRateLimitApi.failure(odbLiteral('AUTH_GOOGLE_CALLBACK_IP'), ip))
      body.call(
        consume.invoke(
          state,
          browserToken,
          nonceHash,
          verifier,
          snapshotClient,
          snapshotRedirect,
          returnPath,
          purpose,
          binding.userId,
          binding.sessionId,
          binding.tokenVersion,
        ),
      )
      body.ifThen(
        cond.or([
          cond.isNull(purpose),
          cond.and([cond.ne(purpose, 'login'), cond.ne(purpose, 'link')]),
        ]),
        (then) => then.unauthorized('GOOGLE_PURPOSE_INVALID'),
      )
      body.ifThen(cond.eq(purpose, 'link'), (then) => {
        then.call(
          odbAuth.checkGoogleLink(
            binding.userId,
            binding.sessionId,
            binding.tokenVersion,
            currentRefresh,
          ),
        )
      })
      body.call(load.invoke(clientId, clientSecret, redirectUri))
      body.ifThen(
        cond.or([cond.ne(clientId, snapshotClient), cond.ne(redirectUri, snapshotRedirect)]),
        (then) => then.unauthorized('GOOGLE_CONFIG_CHANGED'),
      )
      body.ifThen(cond.isNotNull(providerError), (then) => {
        then.ifThen(cond.eq(providerError, 'access_denied'), (cancel) => {
          cancel.set(outcome, 'cancelled')
          cancel.return()
        })
        then.unauthorized('GOOGLE_PROVIDER_ERROR')
      })
      body.ifThen(cond.or([cond.isNull(code), cond.gt(odbOracle.length(code), 4000)]), (then) =>
        then.invalid('GOOGLE_CODE_INVALID'),
      )
      body.block((exchange) => {
        const { document, tokens, idToken } = exchange.variables({
          document: odbType.clob(),
          tokens: odbJson.object,
          idToken: text(8192),
        })
        exchange.set(
          document,
          request.invoke(
            odbLiteral('https://oauth2.googleapis.com/token'),
            odbLiteral('POST'),
            plsqlExpr.concat(
              'grant_type=authorization_code&code=',
              escape.invoke(code),
              '&client_id=',
              escape.invoke(clientId),
              '&client_secret=',
              escape.invoke(clientSecret),
              '&redirect_uri=',
              escape.invoke(redirectUri),
              '&code_verifier=',
              escape.invoke(verifier),
            ),
          ),
        )
        exchange.set(tokens, strictObject.invoke(document))
        exchange.set(
          idToken,
          requiredString.invoke(tokens, odbLiteral('id_token'), odbLiteral(8192)),
        )
        exchange.ifThen(cond.eq(odbDbmsLob.isTemporary(document), 1), (then) =>
          then.call(odbDbmsLob.freeTemporary(document)),
        )
        exchange.call(
          verify.invoke(idToken, clientId, nonceHash, subject, email, displayName, picture),
        )
        exchange.when('OTHERS', (handler) => {
          handler.ifThen(cond.eq(odbDbmsLob.isTemporary(document), 1), (then) =>
            then.call(odbDbmsLob.freeTemporary(document)),
          )
          handler.block((log) => {
            log.auditError('GOOGLE_EXCHANGE_FAILED')
            log.when('OTHERS', (ignored) => ignored.null())
          })
          handler.unauthorized('GOOGLE_EXCHANGE_FAILED')
        })
      })
      // Trusted auth procedure is a cross-capability contract, never a transport action.
      body.ifThen(
        cond.eq(purpose, 'link'),
        (then) => {
          then.call(
            odbAuth.linkGoogle(
              binding.userId,
              binding.sessionId,
              binding.tokenVersion,
              currentRefresh,
              subject,
            ),
          )
        },
        (otherwise) => {
          otherwise.block((login) => {
            login.call(odbAuth.loginGoogle(subject, email, displayName, accessToken, refreshToken))
            login.call(odbAuth.updateGoogleAvatar(subject, picture))
            login.whenOthers((handler) => {
              handler.ifThen(
                cond.and([
                  cond.eq(new PlsqlExpression('NUMBER', 'SQLCODE'), ODB_ERROR_NUMBER),
                  cond.regexpLike(
                    new PlsqlExpression('VARCHAR2', 'SQLERRM'),
                    'ODB_ERROR\\|CONFLICT\\|GOOGLE_EMAIL_EXISTS',
                  ),
                ]),
                (conflict) => {
                  conflict.call(
                    odbAudit.warn(
                      odbLiteral('Google sign-in: existing account requires authentication'),
                    ),
                  )
                  conflict.set(outcome, 'conflict')
                  conflict.return()
                },
                (unexpected) => unexpected.raise(),
              )
            })
          })
        },
      )
      body.set(outcome, 'success')
      body.when('OTHERS', (handler) => {
        handler.ifThen(cond.eq(purpose, 'link'), (then) => then.rollback())
        handler.block((log) => {
          log.auditError('GOOGLE_COMPLETE_FAILED')
          log.when('OTHERS', (ignored) => ignored.null())
        })
        handler.ifThen(
          cond.eq(purpose, 'link'),
          (then) => then.set(outcome, 'error'),
          (otherwise) => otherwise.raise(),
        )
      })
    })
  })
  const complete = pkg.proc(
    'complete',
    {
      in: {
        state: text(128),
        code: text(4000),
        browserToken: text(128),
        providerError: text(256),
        currentRefresh: authTypes.refreshToken,
      },
      out: {
        refreshToken: authTypes.refreshToken,
        returnPath: text(2048),
        outcome: text(32),
        purpose: text(8),
      },
    },
    ({ params: p, body }) => {
      body.call(
        completeTransaction.invoke(
          p.state,
          p.code,
          p.browserToken,
          p.providerError,
          p.currentRefresh,
          p.refreshToken,
          p.returnPath,
          p.outcome,
          p.purpose,
        ),
      )
    },
  )
  return { publicUrl, enabled, start, complete, startLink }
})
