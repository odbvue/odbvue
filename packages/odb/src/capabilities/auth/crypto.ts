import { pbkdf2Sync } from 'node:crypto'
import { odbPackage, odbType } from '../../schema/package.js'
import { cond, odbLiteral, plsqlExpr } from '../../schema/attribute.js'
import { odbDbmsCrypto, odbOracle, odbUtlI18n, odbUtlRaw } from '../../oracle/index.js'
import {
  PASSWORD_HASH_ALGORITHM,
  PASSWORD_HASH_BYTES,
  PASSWORD_HASH_ITERATIONS,
} from './constants.js'

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
