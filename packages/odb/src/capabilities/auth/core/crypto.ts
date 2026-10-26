import { pbkdf2Sync } from 'node:crypto'
import { odbPackage, odbType } from '../../../schema/package.js'
import { cond, odbLiteral, plsqlExpr } from '../../../schema/attribute.js'
import { odbDbmsCrypto, odbOracle, odbUtlI18n, odbUtlRaw } from '../../../oracle/index.js'
import {
  PASSWORD_HASH_ALGORITHM,
  PASSWORD_HASH_BYTES,
  PASSWORD_HASH_ITERATIONS,
} from '../constants.js'

export function dummyPasswordHash(): string {
  const salt = Buffer.alloc(16)
  const hash = pbkdf2Sync(
    'odbvue-invalid-user',
    salt,
    PASSWORD_HASH_ITERATIONS,
    PASSWORD_HASH_BYTES,
    'sha512',
  )
  return `${PASSWORD_HASH_ALGORITHM}$${PASSWORD_HASH_ITERATIONS}$${salt.toString('hex').toUpperCase()}$${hash.toString('hex').toUpperCase()}`
}

/** Password and opaque token primitives used by `odb_auth`. */
export const odbAuthCrypto = odbPackage('odb_auth_crypto', (pkg) => {
  const totpCode = pkg.func('totp_code', odbType.string(6), (fn) => {
    const { secret, counter } = fn.parameters({
      in: { secret: odbType.string(40), counter: odbType.number() },
    })
    fn.body((body) => {
      const { digest, offset, binary } = body.variables({
        digest: odbType.string(40),
        offset: odbType.number(),
        binary: odbType.number(),
      })
      body.set(
        digest,
        odbOracle.rawToHex(
          odbDbmsCrypto.mac(
            odbOracle.hexToRaw(
              odbOracle.lpad(
                odbOracle.toChar(counter, odbLiteral('FMXXXXXXXXXXXXXXXX')),
                16,
                odbLiteral('0'),
              ),
            ),
            odbDbmsCrypto.HMAC_SH1,
            odbOracle.hexToRaw(secret),
          ),
        ),
      )
      body.set(
        offset,
        plsqlExpr.add(
          plsqlExpr.multiply(odbOracle.toNumber(odbOracle.substr(digest, -1), odbLiteral('X')), 2),
          1,
        ),
      )
      body.set(
        binary,
        odbOracle.bitAnd(
          odbOracle.toNumber(odbOracle.substr(digest, offset, 8), odbLiteral('XXXXXXXX')),
          2147483647,
        ),
      )
      body.return(
        odbOracle.lpad(
          odbOracle.toChar(odbOracle.mod(binary, 1000000), odbLiteral('FM000000')),
          6,
          odbLiteral('0'),
        ),
      )
    })
  })
  const base32Secret = pkg.func('base32_secret', odbType.string(32), (fn) => {
    const { secret } = fn.parameters({ in: { secret: odbType.string(40) } })
    fn.body((body) => {
      const { result, block } = body.variables({
        result: odbType.string(32),
        block: odbType.number(),
      })
      body.forRange('chunk', 0, 3, (chunk, loop) => {
        loop.set(
          block,
          odbOracle.toNumber(
            odbOracle.substr(secret, plsqlExpr.add(plsqlExpr.multiply(chunk, 10), 1), 10),
            odbLiteral('XXXXXXXXXX'),
          ),
        )
        loop.forRange('symbol', 0, 7, (symbol, inner) => {
          inner.set(
            result,
            plsqlExpr.concat(
              result,
              odbOracle.substr(
                odbLiteral('ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'),
                plsqlExpr.add(
                  odbOracle.mod(
                    odbOracle.trunc(
                      plsqlExpr.divide(
                        block,
                        odbOracle.power(2, plsqlExpr.subtract(35, plsqlExpr.multiply(symbol, 5))),
                      ),
                    ),
                    32,
                  ),
                  1,
                ),
                1,
              ),
            ),
          )
        })
      })
      body.return(result)
    })
  })
  const verifyTotp = pkg.func('verify_totp', odbType.number(), (fn) => {
    const { secret, code, lastCounter } = fn.parameters({
      in: { secret: odbType.string(40), code: odbType.string(128), lastCounter: odbType.number() },
    })
    fn.body((body) => {
      const { counter, candidate } = body.variables({
        counter: odbType.number(),
        candidate: odbType.number(),
      })
      body.ifThen(
        cond.or([cond.isNull(code), cond.not(cond.regexpLike(code, '^[0-9]{6}$'))]),
        (invalid) => invalid.return(-1),
      )
      body.set(
        counter,
        odbOracle.floor(plsqlExpr.divide(odbOracle.utcEpochSeconds(odbOracle.sysTimestamp()), 30)),
      )
      body.forRange('drift', -1, 1, (drift, loop) => {
        loop.set(candidate, plsqlExpr.add(counter, drift))
        loop.ifThen(
          cond.and([
            cond.gt(candidate, lastCounter),
            cond.eq(totpCode.invoke(secret, candidate), code),
          ]),
          (valid) => valid.return(candidate),
        )
      })
      body.return(-1)
    })
  })
  const deriveKey = pkg.privateFunc('derive_key', odbType.raw(PASSWORD_HASH_BYTES), (fn) => {
    const { passwordRaw, salt, iterations } = fn.parameters({
      in: {
        passwordRaw: odbType.raw(2000),
        salt: odbType.string(32),
        iterations: odbType.number(),
      },
    })
    fn.body((body) => {
      const { roundBlock, derivedKey } = body.variables({
        roundBlock: odbType.raw(PASSWORD_HASH_BYTES),
        derivedKey: odbType.raw(PASSWORD_HASH_BYTES),
      })
      body.set(
        roundBlock,
        odbDbmsCrypto.mac(
          odbUtlRaw.concat(odbOracle.hexToRaw(salt), odbOracle.hexToRaw(odbLiteral('00000001'))),
          odbDbmsCrypto.HMAC_SH512,
          passwordRaw,
        ),
      )
      body.set(derivedKey, roundBlock)
      body.forRange('round', 2, iterations, (_round, loop) => {
        loop.set(roundBlock, odbDbmsCrypto.mac(roundBlock, odbDbmsCrypto.HMAC_SH512, passwordRaw))
        loop.set(derivedKey, odbUtlRaw.bitXor(derivedKey, roundBlock))
      })
      body.return(derivedKey)
    })
  })

  return {
    totpCode,
    base32Secret,
    verifyTotp,
    hashPassword: pkg.func('hash_password', odbType.string(512), (fn) => {
      const { password } = fn.parameters({ in: { password: odbType.string() } })
      fn.body((body) => {
        const { salt, passwordRaw, hash } = body.variables({
          salt: odbType.string(32),
          passwordRaw: odbType.raw(2000),
          hash: odbType.string(128),
        })
        body.set(salt, odbOracle.rawToHex(odbDbmsCrypto.randomBytes(16)))
        body.set(passwordRaw, odbUtlI18n.stringToRaw(password, odbLiteral('AL32UTF8')))
        body.set(
          hash,
          odbOracle.rawToHex(
            deriveKey.invoke(passwordRaw, salt, odbLiteral(PASSWORD_HASH_ITERATIONS)),
          ),
        )
        body.return(
          plsqlExpr.concat(
            odbLiteral(`${PASSWORD_HASH_ALGORITHM}$${PASSWORD_HASH_ITERATIONS}$`),
            salt,
            odbLiteral('$'),
            hash,
          ),
        )
      })
    }),
    verifyPassword: pkg.func('verify_password', odbType.boolean(), (fn) => {
      const { password, storedHash } = fn.parameters({
        in: { password: odbType.string(), storedHash: odbType.string() },
      })
      fn.body((body) => {
        const { iterations, salt, expectedHash, passwordRaw, derivedHash } = body.variables({
          iterations: odbType.number(),
          salt: odbType.string(32),
          expectedHash: odbType.string(128),
          passwordRaw: odbType.raw(2000),
          derivedHash: odbType.string(128),
        })
        body.ifThen(
          cond.not(
            cond.regexpLike(
              storedHash,
              `^${PASSWORD_HASH_ALGORITHM}\\$[1-9][0-9]*\\$[[:xdigit:]]{32}\\$[[:xdigit:]]{128}$`,
            ),
          ),
          (then) => then.return(false),
        )
        body.set(
          iterations,
          odbOracle.toNumber(
            odbOracle.regexpSubstr(
              storedHash,
              odbLiteral(`^${PASSWORD_HASH_ALGORITHM}\\$([1-9][0-9]*)\\$`),
              { position: 1, occurrence: 1, matchParameter: odbOracle.null(), subexpression: 1 },
            ),
          ),
        )
        body.set(
          salt,
          odbOracle.regexpSubstr(storedHash, odbLiteral('[[:xdigit:]]{32}'), {
            position: 1,
            occurrence: 1,
          }),
        )
        body.set(
          expectedHash,
          odbOracle.regexpSubstr(storedHash, odbLiteral('[[:xdigit:]]{128}'), {
            position: 1,
            occurrence: 1,
          }),
        )
        body.set(passwordRaw, odbUtlI18n.stringToRaw(password, odbLiteral('AL32UTF8')))
        body.set(derivedHash, odbOracle.rawToHex(deriveKey.invoke(passwordRaw, salt, iterations)))
        body.ifThen(cond.eq(derivedHash, expectedHash), (then) => then.return(true))
        body.return(false)
      })
    }),
    randomToken: pkg.func('random_token', odbType.string(512), (fn) => {
      const { bytes } = fn.parameters({ in: { bytes: odbType.number() } })
      fn.body((body) => body.return(odbOracle.rawToHex(odbDbmsCrypto.randomBytes(bytes))))
    }),
    hashToken: pkg.func('hash_token', odbType.string(128), (fn) => {
      const { token } = fn.parameters({ in: { token: odbType.string() } })
      fn.body((body) =>
        body.return(
          odbOracle.rawToHex(
            odbDbmsCrypto.hash(odbUtlRaw.castToRaw(token), odbDbmsCrypto.HASH_SH256),
          ),
        ),
      )
    }),
  }
})
