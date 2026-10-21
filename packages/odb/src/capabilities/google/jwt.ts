import { cond, odbLiteral, plsqlExpr, PlsqlExpression } from '../../schema/attribute.js'
import {
  odbType,
  PlsqlException,
  type PackageImpl,
  type PlsqlFunction,
  type Procedure,
} from '../../schema/package.js'
import { odbQuery } from '../../query/index.js'
import {
  odbDbmsCrypto,
  odbDbmsLob,
  odbJson,
  odbOracle,
  odbUtlEncode,
  odbUtlI18n,
  odbUtlRaw,
} from '../../oracle/index.js'

export function defineGoogleJwt(
  pkg: PackageImpl,
  dependencies: {
    hash: PlsqlFunction<'VARCHAR2'>
    request: PlsqlFunction<'CLOB'>
    readKeys: PlsqlFunction<'CLOB'>
    storeKeys: Procedure
  },
) {
  const { hash, request, readKeys, storeKeys } = dependencies
  const invalid = new PlsqlException('VALUE_ERROR')
  const charset = odbLiteral('AL32UTF8')
  const encode = pkg.privateFunc('encode_url', odbType.string(12000), (fn) => {
    const { value } = fn.parameters({ in: { value: odbType.raw(8192) } })
    fn.body((body) =>
      body.return(
        odbOracle.rtrim(
          odbOracle.translate(
            odbOracle.replace(
              odbOracle.replace(
                odbUtlRaw.castToVarchar2(odbUtlEncode.base64Encode(value)),
                odbOracle.chr(13),
                odbLiteral(''),
              ),
              odbOracle.chr(10),
              odbLiteral(''),
            ),
            odbLiteral('+/'),
            odbLiteral('-_'),
          ),
          odbLiteral('='),
        ),
      ),
    )
  })
  const decode = pkg.privateFunc('decode_url', odbType.raw(8192), (fn) => {
    const { value } = fn.parameters({ in: { value: odbType.string(12000) } })
    fn.body((body) => {
      const { result, encoded } = body.variables({
        result: odbType.raw(8192),
        encoded: odbType.string(12000),
      })
      body.ifThen(
        cond.or([
          cond.isNull(value),
          cond.gt(odbOracle.length(value), 10924),
          cond.not(cond.regexpLike(value, '^[A-Za-z0-9_-]+$', 'c')),
          cond.eq(odbOracle.mod(odbOracle.length(value), 4), 1),
        ]),
        (then) => then.raise(invalid),
      )
      body.set(encoded, odbOracle.translate(value, odbLiteral('-_'), odbLiteral('+/')))
      body.set(
        result,
        odbUtlEncode.base64Decode(
          odbUtlRaw.castToRaw(
            odbOracle.rpad(
              encoded,
              plsqlExpr.add(
                odbOracle.length(encoded),
                odbOracle.mod(
                  plsqlExpr.subtract(4, odbOracle.mod(odbOracle.length(encoded), 4)),
                  4,
                ),
              ),
              odbLiteral('='),
            ),
          ),
        ),
      )
      body.ifThen(cond.ne(encode.invoke(result), value), (then) => then.raise(invalid))
      body.return(result)
    })
  })
  const strictObject = pkg.privateFunc('strict_object', odbJson.object, (fn) => {
    const { document } = fn.parameters({ in: { document: odbType.clob() } })
    fn.body((body) => {
      const { valid, object } = body.variables({ valid: odbType.integer(), object: odbJson.object })
      // IS JSON is a SQL predicate, not a PL/SQL expression.
      body.query(
        odbQuery()
          .selectFrom('dual')
          .select(
            odbOracle.caseWhen(
              cond.isJson(document, { strict: true, uniqueKeys: true }),
              odbLiteral(1),
              odbLiteral(0),
              'NUMBER',
            ),
          )
          .into(valid),
      )
      body.ifThen(cond.ne(valid, 1), (then) => then.raise(invalid))
      body.set(object, odbJson.parse(document))
      body.call(odbJson.onError(object, odbLiteral(1)))
      body.return(object)
    })
  })
  const hasMember = pkg.privateFunc('has_member', odbType.boolean(), (fn) => {
    const { object, key } = fn.parameters({
      in: { object: odbJson.object, key: odbType.string(128) },
    })
    fn.body((body) => {
      const { keys } = body.variables({ keys: odbJson.keyList })
      // Oracle 19c has() can raise for missing keys under on_error(1).
      body.set(keys, odbJson.getKeys(object))
      body.forRange('i', 1, keys.field('COUNT', 'NUMBER'), (i, each) => {
        each.ifThen(
          cond.eq(odbUtlRaw.castToRaw(odbJson.keyAt(keys, i)), odbUtlRaw.castToRaw(key)),
          (match) => match.return(true),
        )
      })
      body.return(false)
    })
  })
  const requiredString = pkg.privateFunc('required_string', odbType.string(32767), (fn) => {
    const { object, key, limit } = fn.parameters({
      in: { object: odbJson.object, key: odbType.string(128), limit: odbType.integer() },
    })
    fn.body((body) => {
      const { element, text } = body.variables({
        element: odbJson.element,
        text: odbType.string(32767),
      })
      body.ifThen(cond.eq(hasMember.invoke(object, key), false), (then) => then.raise(invalid))
      body.set(element, odbJson.get(object, key))
      body.ifThen(
        cond.or([
          cond.isNull(element),
          cond.eq(odbJson.isNull(element), true),
          cond.eq(odbJson.isString(element), false),
        ]),
        (then) => then.raise(invalid),
      )
      body.set(text, odbJson.getString(object, key))
      body.ifThen(cond.or([cond.isNull(text), cond.gt(odbOracle.length(text), limit)]), (then) =>
        then.raise(invalid),
      )
      body.return(text)
    })
  })
  const requiredNumber = pkg.privateFunc('required_number', odbType.number(), (fn) => {
    const { object, key } = fn.parameters({
      in: { object: odbJson.object, key: odbType.string(128) },
    })
    fn.body((body) => {
      const { element, number } = body.variables({
        element: odbJson.element,
        number: odbType.number(),
      })
      body.ifThen(cond.eq(hasMember.invoke(object, key), false), (then) => then.raise(invalid))
      body.set(element, odbJson.get(object, key))
      body.ifThen(
        cond.or([
          cond.isNull(element),
          cond.eq(odbJson.isNull(element), true),
          cond.eq(odbJson.isNumber(element), false),
        ]),
        (then) => then.raise(invalid),
      )
      body.set(number, odbJson.getNumber(object, key))
      body.ifThen(
        cond.or([cond.isNull(number), cond.ne(number, odbOracle.trunc(number))]),
        (then) => then.raise(invalid),
      )
      body.return(number)
    })
  })
  const tlv = pkg.privateFunc('tlv', odbType.raw(4096), (fn) => {
    const { tag, value } = fn.parameters({
      in: { tag: odbType.string(2), value: odbType.raw(2048) },
    })
    fn.body((body) => {
      const { size, length } = body.variables({ size: odbType.number(), length: odbType.string(8) })
      body.set(size, odbUtlRaw.length(value))
      body.ifThen(cond.or([cond.isNull(size), cond.gt(size, 2048)]), (then) => then.raise(invalid))
      body.case((branches) => {
        branches.when(cond.lt(size, 128), (then) =>
          then.set(
            length,
            odbOracle.lpad(odbOracle.toChar(size, odbLiteral('FMXX')), 2, odbLiteral('0')),
          ),
        )
        branches.when(cond.lt(size, 256), (then) =>
          then.set(
            length,
            plsqlExpr.concat(
              '81',
              odbOracle.lpad(odbOracle.toChar(size, odbLiteral('FMXX')), 2, odbLiteral('0')),
            ),
          ),
        )
        branches.else((then) =>
          then.set(
            length,
            plsqlExpr.concat(
              '82',
              odbOracle.lpad(odbOracle.toChar(size, odbLiteral('FMXXXX')), 4, odbLiteral('0')),
            ),
          ),
        )
      })
      body.return(odbUtlRaw.concat(odbOracle.hexToRaw(plsqlExpr.concat(tag, length)), value))
    })
  })
  const unsignedInteger = pkg.privateFunc('unsigned_integer', odbType.raw(1024), (fn) => {
    const { value } = fn.parameters({ in: { value: odbType.raw(1024) } })
    fn.body((body) => {
      const { integer } = body.variables({ integer: odbType.raw(1024) })
      body.set(integer, value)
      body.ifThen(
        cond.or([
          cond.isNull(integer),
          cond.eq(odbUtlRaw.substr(integer, 1, 1), odbOracle.hexToRaw(odbLiteral('00'))),
        ]),
        (then) => then.raise(invalid),
      )
      body.ifThen(
        cond.gte(
          odbOracle.toNumber(odbOracle.substr(odbOracle.rawToHex(integer), 1, 2), odbLiteral('XX')),
          128,
        ),
        (then) =>
          then.set(integer, odbUtlRaw.concat(odbOracle.hexToRaw(odbLiteral('00')), integer)),
      )
      body.return(tlv.invoke(odbLiteral('02'), integer))
    })
  })
  const signingKey = pkg.privateFunc('signing_key', odbType.raw(4000), (fn) => {
    const { kid } = fn.parameters({ in: { kid: odbType.string(128) } })
    fn.body((body) => {
      const { document, object, keys, element, key, modulus, exponent, der, found } =
        body.variables({
          document: odbType.clob(),
          object: odbJson.object,
          keys: odbJson.array,
          element: odbJson.element,
          key: odbJson.object,
          modulus: odbType.raw(1024),
          exponent: odbType.raw(16),
          der: odbType.raw(2048),
          found: odbType.boolean(),
        })
      body.set(found, false)
      body.forRange('attempt', 1, 2, (attempt, loop) => {
        loop.set(document, null)
        loop.ifThen(cond.eq(attempt, 1), (then) => then.set(document, readKeys.invoke()))
        loop.ifThen(cond.isNull(document), (then) => {
          then.set(
            document,
            request.invoke(
              odbLiteral('https://www.googleapis.com/oauth2/v3/certs'),
              odbLiteral('GET'),
              'NULL',
            ),
          )
          then.set(object, strictObject.invoke(document))
          then.call(storeKeys.invoke(document))
        })
        loop.set(object, strictObject.invoke(document))
        loop.set(element, odbJson.get(object, odbLiteral('keys')))
        loop.ifThen(
          cond.or([cond.isNull(element), cond.eq(odbJson.isArray(element), false)]),
          (then) => then.raise(invalid),
        )
        loop.set(keys, odbJson.getArray(object, odbLiteral('keys')))
        loop.call(odbJson.onError(keys, odbLiteral(1)))
        loop.ifThen(
          cond.or([cond.lt(odbJson.getSize(keys), 1), cond.gt(odbJson.getSize(keys), 100)]),
          (then) => then.raise(invalid),
        )
        loop.forRange('i', 0, plsqlExpr.subtract(odbJson.getSize(keys), 1), (i, each) => {
          each.set(element, odbJson.get(keys, i))
          each.ifThen(cond.eq(odbJson.isObject(element), false), (then) => then.raise(invalid))
          each.set(key, odbJson.asObject(element))
          each.call(odbJson.onError(key, odbLiteral(1)))
          each.ifThen(
            cond.eq(requiredString.invoke(key, odbLiteral('kid'), odbLiteral(128)), kid),
            (match) => {
              match.ifThen(cond.eq(found, true), (then) => then.raise(invalid))
              match.set(found, true)
              match.ifThen(
                cond.or([
                  cond.ne(requiredString.invoke(key, odbLiteral('kty'), odbLiteral(8)), 'RSA'),
                  cond.ne(requiredString.invoke(key, odbLiteral('use'), odbLiteral(8)), 'sig'),
                  cond.ne(requiredString.invoke(key, odbLiteral('alg'), odbLiteral(8)), 'RS256'),
                ]),
                (then) => then.raise(invalid),
              )
              match.set(
                modulus,
                decode.invoke(requiredString.invoke(key, odbLiteral('n'), odbLiteral(684))),
              )
              match.set(
                exponent,
                decode.invoke(requiredString.invoke(key, odbLiteral('e'), odbLiteral(8))),
              )
              const exponentNumber = odbOracle.toNumber(
                odbOracle.rawToHex(exponent),
                odbLiteral('XXXXXXXX'),
              )
              match.ifThen(
                cond.or([
                  cond.lt(odbUtlRaw.length(modulus), 256),
                  cond.gt(odbUtlRaw.length(modulus), 512),
                  cond.lt(
                    odbOracle.toNumber(
                      odbOracle.substr(odbOracle.rawToHex(modulus), 1, 2),
                      odbLiteral('XX'),
                    ),
                    128,
                  ),
                  cond.lt(odbUtlRaw.length(exponent), 1),
                  cond.gt(odbUtlRaw.length(exponent), 4),
                  cond.lt(exponentNumber, 3),
                  cond.ne(odbOracle.mod(exponentNumber, 2), 1),
                ]),
                (then) => then.raise(invalid),
              )
              match.set(
                der,
                tlv.invoke(
                  odbLiteral('30'),
                  odbUtlRaw.concat(
                    odbOracle.hexToRaw(odbLiteral('300D06092A864886F70D0101010500')),
                    tlv.invoke(
                      odbLiteral('03'),
                      odbUtlRaw.concat(
                        odbOracle.hexToRaw(odbLiteral('00')),
                        tlv.invoke(
                          odbLiteral('30'),
                          odbUtlRaw.concat(
                            unsignedInteger.invoke(modulus),
                            unsignedInteger.invoke(exponent),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              )
            },
          )
        })
        loop.ifThen(cond.eq(odbDbmsLob.isTemporary(document), 1), (then) =>
          then.call(odbDbmsLob.freeTemporary(document)),
        )
        // Oracle 19c VERIFY expects Base64 DER bytes, without PEM headers.
        loop.ifThen(cond.eq(found, true), (then) =>
          then.return(
            odbUtlRaw.castToRaw(
              odbOracle.replace(
                odbOracle.replace(
                  odbUtlRaw.castToVarchar2(odbUtlEncode.base64Encode(der)),
                  odbOracle.chr(13),
                  odbLiteral(''),
                ),
                odbOracle.chr(10),
                odbLiteral(''),
              ),
            ),
          ),
        )
      })
      body.raise(invalid)
      body.when('OTHERS', (handler) => {
        handler.ifThen(cond.eq(odbDbmsLob.isTemporary(document), 1), (then) =>
          then.call(odbDbmsLob.freeTemporary(document)),
        )
        handler.raise()
      })
    })
  })
  const verify = pkg.privateProc('verify_token', (proc) => {
    const { token, clientId, nonceHash, subject, email, displayName, picture } = proc.parameters({
      in: {
        token: odbType.string(8192),
        clientId: odbType.string(256),
        nonceHash: odbType.string(64),
      },
      out: {
        subject: odbType.string(255),
        email: odbType.string(128),
        displayName: odbType.string(256),
        picture: odbType.string(2048),
      },
    })
    proc.body((body) => {
      const {
        first,
        second,
        header,
        claims,
        element,
        audiences,
        audience,
        matches,
        key,
        signature,
        kid,
        now,
        exp,
        iat,
        issuer,
        verified,
        emailVerified,
      } = body.variables({
        first: odbType.number(),
        second: odbType.number(),
        header: odbJson.object,
        claims: odbJson.object,
        element: odbJson.element,
        audiences: odbJson.array,
        audience: odbType.string(256),
        matches: odbType.boolean(),
        key: odbType.raw(4000),
        signature: odbType.raw(1024),
        kid: odbType.string(128),
        now: odbType.number(),
        exp: odbType.number(),
        iat: odbType.number(),
        issuer: odbType.string(128),
        verified: odbType.boolean(),
        emailVerified: odbType.boolean(),
      })
      body.set(matches, false)
      body.set(
        now,
        new PlsqlExpression(
          'NUMBER',
          "(CAST(SYS_EXTRACT_UTC(SYSTIMESTAMP) AS DATE) - DATE '1970-01-01') * 86400",
        ),
      )
      body.ifThen(
        cond.or([
          cond.isNull(token),
          cond.gt(odbOracle.length(token), 8192),
          cond.not(
            cond.regexpLike(token, '^[A-Za-z0-9_-]+[.][A-Za-z0-9_-]+[.][A-Za-z0-9_-]+$', 'c'),
          ),
        ]),
        (then) => then.raise(invalid),
      )
      body.set(first, odbOracle.instr(token, odbLiteral('.')))
      body.set(second, odbOracle.instr(token, odbLiteral('.'), plsqlExpr.add(first, 1)))
      body.set(
        header,
        strictObject.invoke(
          odbOracle.toClob(
            odbUtlI18n.rawToChar(
              decode.invoke(odbOracle.substr(token, 1, plsqlExpr.subtract(first, 1))),
              charset,
            ),
          ),
        ),
      )
      body.ifThen(
        cond.or([
          cond.ne(requiredString.invoke(header, odbLiteral('alg'), odbLiteral(16)), 'RS256'),
          ...['crit', 'jku', 'x5u', 'b64'].map((name) =>
            cond.eq(hasMember.invoke(header, odbLiteral(name)), true),
          ),
        ]),
        (then) => then.raise(invalid),
      )
      body.set(kid, requiredString.invoke(header, odbLiteral('kid'), odbLiteral(128)))
      body.set(key, signingKey.invoke(kid))
      body.set(signature, decode.invoke(odbOracle.substr(token, plsqlExpr.add(second, 1))))
      body.set(
        verified,
        odbDbmsCrypto.verify(
          odbUtlI18n.stringToRaw(
            odbOracle.substr(token, 1, plsqlExpr.subtract(second, 1)),
            charset,
          ),
          signature,
          key,
          odbDbmsCrypto.KEY_TYPE_RSA,
          odbDbmsCrypto.SIGN_SHA256_RSA,
        ),
      )
      body.ifThen(cond.or([cond.isNull(verified), cond.eq(verified, false)]), (then) =>
        then.raise(invalid),
      )
      body.set(
        claims,
        strictObject.invoke(
          odbOracle.toClob(
            odbUtlI18n.rawToChar(
              decode.invoke(
                odbOracle.substr(
                  token,
                  plsqlExpr.add(first, 1),
                  plsqlExpr.subtract(plsqlExpr.subtract(second, first), 1),
                ),
              ),
              charset,
            ),
          ),
        ),
      )
      body.set(issuer, requiredString.invoke(claims, odbLiteral('iss'), odbLiteral(128)))
      body.ifThen(
        cond.and([
          cond.ne(issuer, 'accounts.google.com'),
          cond.ne(issuer, 'https://accounts.google.com'),
        ]),
        (then) => then.raise(invalid),
      )
      body.set(element, odbJson.get(claims, odbLiteral('aud')))
      body.ifThen(cond.or([cond.isNull(element), cond.eq(odbJson.isNull(element), true)]), (then) =>
        then.raise(invalid),
      )
      body.case((branches) => {
        branches.when(cond.eq(odbJson.isString(element), true), (then) => {
          then.ifThen(
            cond.ne(requiredString.invoke(claims, odbLiteral('aud'), odbLiteral(256)), clientId),
            (reject) => reject.raise(invalid),
          )
        })
        branches.when(cond.eq(odbJson.isArray(element), true), (then) => {
          then.set(audiences, odbJson.getArray(claims, odbLiteral('aud')))
          then.call(odbJson.onError(audiences, odbLiteral(1)))
          then.ifThen(
            cond.or([
              cond.lt(odbJson.getSize(audiences), 1),
              cond.gt(odbJson.getSize(audiences), 16),
            ]),
            (reject) => reject.raise(invalid),
          )
          then.forRange('i', 0, plsqlExpr.subtract(odbJson.getSize(audiences), 1), (i, each) => {
            each.set(element, odbJson.get(audiences, i))
            each.ifThen(
              cond.or([
                cond.isNull(element),
                cond.eq(odbJson.isNull(element), true),
                cond.eq(odbJson.isString(element), false),
              ]),
              (reject) => reject.raise(invalid),
            )
            each.set(audience, odbJson.getString(audiences, i))
            each.ifThen(
              cond.or([cond.isNull(audience), cond.gt(odbOracle.length(audience), 256)]),
              (reject) => reject.raise(invalid),
            )
            each.ifThen(cond.eq(audience, clientId), (match) => match.set(matches, true))
          })
          then.ifThen(
            cond.or([
              cond.eq(matches, false),
              cond.ne(requiredString.invoke(claims, odbLiteral('azp'), odbLiteral(256)), clientId),
            ]),
            (reject) => reject.raise(invalid),
          )
        })
        branches.else((reject) => reject.raise(invalid))
      })
      body.ifThen(
        cond.and([
          cond.eq(hasMember.invoke(claims, odbLiteral('azp')), true),
          cond.ne(requiredString.invoke(claims, odbLiteral('azp'), odbLiteral(256)), clientId),
        ]),
        (then) => then.raise(invalid),
      )
      body.set(exp, requiredNumber.invoke(claims, odbLiteral('exp')))
      body.set(iat, requiredNumber.invoke(claims, odbLiteral('iat')))
      body.ifThen(
        cond.or([
          cond.lte(exp, now),
          cond.gt(iat, plsqlExpr.add(now, 60)),
          cond.lt(iat, plsqlExpr.subtract(now, 600)),
          cond.lte(exp, iat),
        ]),
        (then) => then.raise(invalid),
      )
      body.ifThen(
        cond.and([
          cond.eq(hasMember.invoke(claims, odbLiteral('nbf')), true),
          cond.gt(requiredNumber.invoke(claims, odbLiteral('nbf')), plsqlExpr.add(now, 60)),
        ]),
        (then) => then.raise(invalid),
      )
      body.ifThen(
        cond.or([
          cond.isNull(nonceHash),
          cond.ne(
            hash.invoke(requiredString.invoke(claims, odbLiteral('nonce'), odbLiteral(128))),
            nonceHash,
          ),
        ]),
        (then) => then.raise(invalid),
      )
      body.set(subject, requiredString.invoke(claims, odbLiteral('sub'), odbLiteral(255)))
      body.ifThen(cond.not(cond.regexpLike(subject, '^[0-9]{1,255}$', 'c')), (then) =>
        then.raise(invalid),
      )
      body.set(element, odbJson.get(claims, odbLiteral('email_verified')))
      body.ifThen(
        cond.or([
          cond.isNull(element),
          cond.eq(odbJson.isNull(element), true),
          cond.eq(odbJson.isBoolean(element), false),
        ]),
        (then) => then.raise(invalid),
      )
      body.set(emailVerified, odbJson.getBoolean(claims, odbLiteral('email_verified')))
      body.ifThen(cond.or([cond.isNull(emailVerified), cond.eq(emailVerified, false)]), (then) =>
        then.raise(invalid),
      )
      body.set(
        email,
        odbOracle.lower(requiredString.invoke(claims, odbLiteral('email'), odbLiteral(128))),
      )
      body.ifThen(
        cond.or([
          cond.not(cond.regexpLike(email, '^[^[:space:]@]+@[^[:space:]@.]+([.][^[:space:]@.]+)+$')),
          cond.regexpLike(email, '[[:cntrl:]]'),
        ]),
        (then) => then.raise(invalid),
      )
      body.set(displayName, email)
      body.ifThen(cond.eq(hasMember.invoke(claims, odbLiteral('name')), true), (then) =>
        then.set(displayName, requiredString.invoke(claims, odbLiteral('name'), odbLiteral(256))),
      )
      body.set(picture, null)
      body.ifThen(cond.eq(hasMember.invoke(claims, odbLiteral('picture')), true), (then) => {
        const { candidate } = then.variables({ candidate: odbType.string(2048) })
        then.set(candidate, requiredString.invoke(claims, odbLiteral('picture'), odbLiteral(2048)))
        then.ifThen(
          cond.regexpLike(
            candidate,
            '^https://lh[0-9]+[.]googleusercontent[.]com/[^[:space:][:cntrl:]]+$',
            'c',
          ),
          (valid) => valid.set(picture, candidate),
        )
      })
      body.when('OTHERS', (handler) => {
        handler.block((log) => {
          log.auditError('GOOGLE_TOKEN_INVALID')
          log.when('OTHERS', (ignored) => ignored.null())
        })
        handler.unauthorized('GOOGLE_TOKEN_INVALID')
      })
    })
  })
  return { encode, strictObject, requiredString, verify }
}
