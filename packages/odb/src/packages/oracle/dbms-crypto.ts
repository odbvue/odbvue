// Oracle built-in package: DBMS_CRYPTO.
//
// DBMS_CRYPTO ships with the database (installed in SYS; grant EXECUTE as
// needed). It provides hashing, keyed-hash (MAC), symmetric encrypt/decrypt of
// RAW data, public-key encrypt/decrypt, sign/verify, and cryptographically
// secure random generators.
//
// The RAW-returning subprograms are exposed here as typed `PlsqlExpression<T>`
// expression builders. The LOB (BLOB/CLOB) ENCRYPT/DECRYPT *procedure*
// overloads are not wrapped — convert LOB data to RAW and use the function
// forms, or emit the procedure call via `body.raw(...)`.
//
// Algorithm/modifier constants are exposed as `PlsqlExpression<'PLS_INTEGER'>`
// so they pass straight into the `typ` argument. Block-cipher suites are the
// sum of an encryption algorithm + a chaining mode + a padding mode; use
// `odbDbmsCrypto.cipherSuite(...)` to combine them.
//
// Reference: https://docs.oracle.com/en/database/oracle/oracle-database/21/arpls/DBMS_CRYPTO.html
//
// @example
// body.set(pDigest, odbDbmsCrypto.hash(pSrc, odbDbmsCrypto.HASH_SH256))
// const typ = odbDbmsCrypto.cipherSuite(
//   odbDbmsCrypto.ENCRYPT_AES256,
//   odbDbmsCrypto.CHAIN_CBC,
//   odbDbmsCrypto.PAD_PKCS5,
// )
// body.set(pEnc, odbDbmsCrypto.encrypt(pSrc, typ, pKey, pIv))

import { PlsqlExpression, renderPlsql, type PlsqlRenderable } from '../../schema/attribute.js'

function arg(value: PlsqlRenderable | number): string {
  return typeof value === 'number' ? String(value) : renderPlsql(value)
}

function call<T extends string>(type: T, fn: string, args: string[]): PlsqlExpression<T> {
  return new PlsqlExpression(type, `DBMS_CRYPTO.${fn}(${args.join(', ')})`)
}

function konst(name: string): PlsqlExpression<'PLS_INTEGER'> {
  return new PlsqlExpression('PLS_INTEGER', `DBMS_CRYPTO.${name}`)
}

/**
 * Typed wrappers for Oracle's built-in `DBMS_CRYPTO` package.
 */
export const odbDbmsCrypto = {
  // ── Hash / MAC ─────────────────────────────────────────────────────────────

  /** `DBMS_CRYPTO.HASH(<src>, <typ>)` → RAW */
  hash(src: PlsqlRenderable, typ: PlsqlRenderable): PlsqlExpression<'RAW'> {
    return call('RAW', 'HASH', [renderPlsql(src), renderPlsql(typ)])
  },

  /** `DBMS_CRYPTO.MAC(<src>, <typ>, <key>)` → RAW */
  mac(src: PlsqlRenderable, typ: PlsqlRenderable, key: PlsqlRenderable): PlsqlExpression<'RAW'> {
    return call('RAW', 'MAC', [renderPlsql(src), renderPlsql(typ), renderPlsql(key)])
  },

  // ── Symmetric encrypt / decrypt (RAW) ──────────────────────────────────────

  /** `DBMS_CRYPTO.ENCRYPT(<src>, <typ>, <key>[, <iv>])` → RAW */
  encrypt(
    src: PlsqlRenderable,
    typ: PlsqlRenderable,
    key: PlsqlRenderable,
    iv?: PlsqlRenderable,
  ): PlsqlExpression<'RAW'> {
    const args = [renderPlsql(src), renderPlsql(typ), renderPlsql(key)]
    if (iv !== undefined) args.push(renderPlsql(iv))
    return call('RAW', 'ENCRYPT', args)
  },

  /** `DBMS_CRYPTO.DECRYPT(<src>, <typ>, <key>[, <iv>])` → RAW */
  decrypt(
    src: PlsqlRenderable,
    typ: PlsqlRenderable,
    key: PlsqlRenderable,
    iv?: PlsqlRenderable,
  ): PlsqlExpression<'RAW'> {
    const args = [renderPlsql(src), renderPlsql(typ), renderPlsql(key)]
    if (iv !== undefined) args.push(renderPlsql(iv))
    return call('RAW', 'DECRYPT', args)
  },

  // ── Public-key encrypt / decrypt / sign / verify ───────────────────────────

  /** `DBMS_CRYPTO.PKENCRYPT(<src>, <pub_key>, <pubkey_alg>, <enc_alg>)` → RAW */
  pkEncrypt(
    src: PlsqlRenderable,
    pubKey: PlsqlRenderable,
    pubkeyAlg: PlsqlRenderable,
    encAlg: PlsqlRenderable,
  ): PlsqlExpression<'RAW'> {
    return call('RAW', 'PKENCRYPT', [
      renderPlsql(src),
      renderPlsql(pubKey),
      renderPlsql(pubkeyAlg),
      renderPlsql(encAlg),
    ])
  },

  /** `DBMS_CRYPTO.PKDECRYPT(<src>, <prv_key>, <pubkey_alg>, <enc_alg>)` → RAW */
  pkDecrypt(
    src: PlsqlRenderable,
    prvKey: PlsqlRenderable,
    pubkeyAlg: PlsqlRenderable,
    encAlg: PlsqlRenderable,
  ): PlsqlExpression<'RAW'> {
    return call('RAW', 'PKDECRYPT', [
      renderPlsql(src),
      renderPlsql(prvKey),
      renderPlsql(pubkeyAlg),
      renderPlsql(encAlg),
    ])
  },

  /** `DBMS_CRYPTO.SIGN(<src>, <prv_key>, <pubkey_alg>, <sign_alg>)` → RAW */
  sign(
    src: PlsqlRenderable,
    prvKey: PlsqlRenderable,
    pubkeyAlg: PlsqlRenderable,
    signAlg: PlsqlRenderable,
  ): PlsqlExpression<'RAW'> {
    return call('RAW', 'SIGN', [
      renderPlsql(src),
      renderPlsql(prvKey),
      renderPlsql(pubkeyAlg),
      renderPlsql(signAlg),
    ])
  },

  /** `DBMS_CRYPTO.VERIFY(<src>, <sign>, <pub_key>, <pubkey_alg>, <sign_alg>)` → BOOLEAN */
  verify(
    src: PlsqlRenderable,
    signature: PlsqlRenderable,
    pubKey: PlsqlRenderable,
    pubkeyAlg: PlsqlRenderable,
    signAlg: PlsqlRenderable,
  ): PlsqlExpression<'BOOLEAN'> {
    return call('BOOLEAN', 'VERIFY', [
      renderPlsql(src),
      renderPlsql(signature),
      renderPlsql(pubKey),
      renderPlsql(pubkeyAlg),
      renderPlsql(signAlg),
    ])
  },

  // ── Random generators ──────────────────────────────────────────────────────

  /** `DBMS_CRYPTO.RANDOMBYTES(<number_bytes>)` → RAW */
  randomBytes(numberBytes: PlsqlRenderable | number): PlsqlExpression<'RAW'> {
    return call('RAW', 'RANDOMBYTES', [arg(numberBytes)])
  },

  /** `DBMS_CRYPTO.RANDOMINTEGER` → BINARY_INTEGER */
  randomInteger(): PlsqlExpression<'BINARY_INTEGER'> {
    return new PlsqlExpression('BINARY_INTEGER', 'DBMS_CRYPTO.RANDOMINTEGER')
  },

  /** `DBMS_CRYPTO.RANDOMNUMBER` → NUMBER */
  randomNumber(): PlsqlExpression<'NUMBER'> {
    return new PlsqlExpression('NUMBER', 'DBMS_CRYPTO.RANDOMNUMBER')
  },

  // ── Cipher-suite helper ─────────────────────────────────────────────────────

  /**
   * Combine an encryption algorithm, chaining mode, and padding mode into a
   * single cipher-suite `typ` value: `A + B + C`.
   */
  cipherSuite(...parts: PlsqlRenderable[]): PlsqlExpression<'PLS_INTEGER'> {
    return new PlsqlExpression('PLS_INTEGER', parts.map(renderPlsql).join(' + '))
  },

  // ── Cryptographic hash constants ────────────────────────────────────────────

  /** `DBMS_CRYPTO.HASH_MD4` */
  HASH_MD4: konst('HASH_MD4'),
  /** `DBMS_CRYPTO.HASH_MD5` */
  HASH_MD5: konst('HASH_MD5'),
  /** `DBMS_CRYPTO.HASH_SH1` (SHA-1) */
  HASH_SH1: konst('HASH_SH1'),
  /** `DBMS_CRYPTO.HASH_SH256` (SHA-2, 256-bit) */
  HASH_SH256: konst('HASH_SH256'),
  /** `DBMS_CRYPTO.HASH_SH384` (SHA-2, 384-bit) */
  HASH_SH384: konst('HASH_SH384'),
  /** `DBMS_CRYPTO.HASH_SH512` (SHA-2, 512-bit) */
  HASH_SH512: konst('HASH_SH512'),

  // ── Keyed-hash (MAC) constants ──────────────────────────────────────────────

  /** `DBMS_CRYPTO.HMAC_MD5` */
  HMAC_MD5: konst('HMAC_MD5'),
  /** `DBMS_CRYPTO.HMAC_SH1` */
  HMAC_SH1: konst('HMAC_SH1'),
  /** `DBMS_CRYPTO.HMAC_SH256` */
  HMAC_SH256: konst('HMAC_SH256'),
  /** `DBMS_CRYPTO.HMAC_SH384` */
  HMAC_SH384: konst('HMAC_SH384'),
  /** `DBMS_CRYPTO.HMAC_SH512` */
  HMAC_SH512: konst('HMAC_SH512'),

  // ── Encryption algorithm constants ──────────────────────────────────────────

  /** `DBMS_CRYPTO.ENCRYPT_DES` */
  ENCRYPT_DES: konst('ENCRYPT_DES'),
  /** `DBMS_CRYPTO.ENCRYPT_3DES_2KEY` */
  ENCRYPT_3DES_2KEY: konst('ENCRYPT_3DES_2KEY'),
  /** `DBMS_CRYPTO.ENCRYPT_3DES` */
  ENCRYPT_3DES: konst('ENCRYPT_3DES'),
  /** `DBMS_CRYPTO.ENCRYPT_AES128` */
  ENCRYPT_AES128: konst('ENCRYPT_AES128'),
  /** `DBMS_CRYPTO.ENCRYPT_AES192` */
  ENCRYPT_AES192: konst('ENCRYPT_AES192'),
  /** `DBMS_CRYPTO.ENCRYPT_AES256` */
  ENCRYPT_AES256: konst('ENCRYPT_AES256'),

  // ── Block-cipher chaining modifiers ─────────────────────────────────────────

  /** `DBMS_CRYPTO.CHAIN_CBC` */
  CHAIN_CBC: konst('CHAIN_CBC'),
  /** `DBMS_CRYPTO.CHAIN_CFB` */
  CHAIN_CFB: konst('CHAIN_CFB'),
  /** `DBMS_CRYPTO.CHAIN_ECB` */
  CHAIN_ECB: konst('CHAIN_ECB'),
  /** `DBMS_CRYPTO.CHAIN_OFB` */
  CHAIN_OFB: konst('CHAIN_OFB'),

  // ── Block-cipher padding modifiers ──────────────────────────────────────────

  /** `DBMS_CRYPTO.PAD_PKCS5` */
  PAD_PKCS5: konst('PAD_PKCS5'),
  /** `DBMS_CRYPTO.PAD_NONE` */
  PAD_NONE: konst('PAD_NONE'),
  /** `DBMS_CRYPTO.PAD_ZERO` */
  PAD_ZERO: konst('PAD_ZERO'),

  // ── Predefined cipher suites ────────────────────────────────────────────────

  /** `DBMS_CRYPTO.DES_CBC_PKCS5` */
  DES_CBC_PKCS5: konst('DES_CBC_PKCS5'),
  /** `DBMS_CRYPTO.DES3_CBC_PKCS5` */
  DES3_CBC_PKCS5: konst('DES3_CBC_PKCS5'),
  /** `DBMS_CRYPTO.DES3_CBC_NONE` */
  DES3_CBC_NONE: konst('DES3_CBC_NONE'),

  // ── Public-key / sign constants ─────────────────────────────────────────────

  /** `DBMS_CRYPTO.KEY_TYPE_RSA` */
  KEY_TYPE_RSA: konst('KEY_TYPE_RSA'),
  /** `DBMS_CRYPTO.PKENCRYPT_RSA_PKCS1_OAEP` */
  PKENCRYPT_RSA_PKCS1_OAEP: konst('PKENCRYPT_RSA_PKCS1_OAEP'),
  /** `DBMS_CRYPTO.SIGN_SHA256_RSA` */
  SIGN_SHA256_RSA: konst('SIGN_SHA256_RSA'),
  /** `DBMS_CRYPTO.SIGN_SHA384_RSA` */
  SIGN_SHA384_RSA: konst('SIGN_SHA384_RSA'),
  /** `DBMS_CRYPTO.SIGN_SHA512_RSA` */
  SIGN_SHA512_RSA: konst('SIGN_SHA512_RSA'),

  /** `DBMS_CRYPTO.LEGACY_DEFAULT_IV` (VARCHAR2) */
  LEGACY_DEFAULT_IV: new PlsqlExpression('VARCHAR2', 'DBMS_CRYPTO.LEGACY_DEFAULT_IV'),
}
