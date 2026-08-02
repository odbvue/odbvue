import { describe, expect, it } from 'vitest'
import { odbDbmsCrypto } from '../../src/packages/oracle/dbms-crypto.js'

describe('odbDbmsCrypto', () => {
  describe('hash / mac', () => {
    it('hash → RAW', () => {
      const e = odbDbmsCrypto.hash('v_src', odbDbmsCrypto.HASH_SH256)
      expect(e.toSQL()).toBe('DBMS_CRYPTO.HASH(v_src, DBMS_CRYPTO.HASH_SH256)')
      expect(e.type).toBe('RAW')
    })

    it('mac → RAW', () => {
      expect(odbDbmsCrypto.mac('v_src', odbDbmsCrypto.HMAC_SH256, 'v_key').toSQL()).toBe(
        'DBMS_CRYPTO.MAC(v_src, DBMS_CRYPTO.HMAC_SH256, v_key)',
      )
    })
  })

  describe('encrypt / decrypt', () => {
    it('encrypt without iv', () => {
      expect(odbDbmsCrypto.encrypt('v_src', 'v_typ', 'v_key').toSQL()).toBe(
        'DBMS_CRYPTO.ENCRYPT(v_src, v_typ, v_key)',
      )
    })

    it('decrypt with iv', () => {
      expect(odbDbmsCrypto.decrypt('v_src', 'v_typ', 'v_key', 'v_iv').toSQL()).toBe(
        'DBMS_CRYPTO.DECRYPT(v_src, v_typ, v_key, v_iv)',
      )
    })

    it('cipherSuite combines algorithm + chaining + padding', () => {
      const typ = odbDbmsCrypto.cipherSuite(
        odbDbmsCrypto.ENCRYPT_AES256,
        odbDbmsCrypto.CHAIN_CBC,
        odbDbmsCrypto.PAD_PKCS5,
      )
      expect(typ.toSQL()).toBe(
        'DBMS_CRYPTO.ENCRYPT_AES256 + DBMS_CRYPTO.CHAIN_CBC + DBMS_CRYPTO.PAD_PKCS5',
      )
      expect(typ.type).toBe('PLS_INTEGER')
    })

    it('encrypt accepts a composed cipher suite as typ', () => {
      const typ = odbDbmsCrypto.cipherSuite(
        odbDbmsCrypto.ENCRYPT_AES128,
        odbDbmsCrypto.CHAIN_CBC,
        odbDbmsCrypto.PAD_PKCS5,
      )
      expect(odbDbmsCrypto.encrypt('v_src', typ, 'v_key', 'v_iv').toSQL()).toBe(
        'DBMS_CRYPTO.ENCRYPT(v_src, DBMS_CRYPTO.ENCRYPT_AES128 + DBMS_CRYPTO.CHAIN_CBC + DBMS_CRYPTO.PAD_PKCS5, v_key, v_iv)',
      )
    })
  })

  describe('public key', () => {
    it('pkEncrypt', () => {
      expect(
        odbDbmsCrypto
          .pkEncrypt(
            'v_src',
            'v_pub',
            odbDbmsCrypto.KEY_TYPE_RSA,
            odbDbmsCrypto.PKENCRYPT_RSA_PKCS1_OAEP,
          )
          .toSQL(),
      ).toBe(
        'DBMS_CRYPTO.PKENCRYPT(v_src, v_pub, DBMS_CRYPTO.KEY_TYPE_RSA, DBMS_CRYPTO.PKENCRYPT_RSA_PKCS1_OAEP)',
      )
    })

    it('sign → RAW and verify → BOOLEAN', () => {
      expect(
        odbDbmsCrypto
          .sign('v_src', 'v_prv', odbDbmsCrypto.KEY_TYPE_RSA, odbDbmsCrypto.SIGN_SHA256_RSA)
          .toSQL(),
      ).toBe(
        'DBMS_CRYPTO.SIGN(v_src, v_prv, DBMS_CRYPTO.KEY_TYPE_RSA, DBMS_CRYPTO.SIGN_SHA256_RSA)',
      )
      const v = odbDbmsCrypto.verify(
        'v_src',
        'v_sign',
        'v_pub',
        odbDbmsCrypto.KEY_TYPE_RSA,
        odbDbmsCrypto.SIGN_SHA256_RSA,
      )
      expect(v.type).toBe('BOOLEAN')
    })
  })

  describe('random generators', () => {
    it('randomBytes → RAW', () => {
      const e = odbDbmsCrypto.randomBytes(16)
      expect(e.toSQL()).toBe('DBMS_CRYPTO.RANDOMBYTES(16)')
      expect(e.type).toBe('RAW')
    })

    it('randomInteger → BINARY_INTEGER (no parens)', () => {
      const e = odbDbmsCrypto.randomInteger()
      expect(e.toSQL()).toBe('DBMS_CRYPTO.RANDOMINTEGER')
      expect(e.type).toBe('BINARY_INTEGER')
    })

    it('randomNumber → NUMBER (no parens)', () => {
      const e = odbDbmsCrypto.randomNumber()
      expect(e.toSQL()).toBe('DBMS_CRYPTO.RANDOMNUMBER')
      expect(e.type).toBe('NUMBER')
    })
  })

  describe('constants', () => {
    it('exposes hash, hmac, encrypt, chain and pad constants', () => {
      expect(odbDbmsCrypto.HASH_MD5.toSQL()).toBe('DBMS_CRYPTO.HASH_MD5')
      expect(odbDbmsCrypto.HMAC_SH512.toSQL()).toBe('DBMS_CRYPTO.HMAC_SH512')
      expect(odbDbmsCrypto.ENCRYPT_3DES.toSQL()).toBe('DBMS_CRYPTO.ENCRYPT_3DES')
      expect(odbDbmsCrypto.CHAIN_OFB.toSQL()).toBe('DBMS_CRYPTO.CHAIN_OFB')
      expect(odbDbmsCrypto.PAD_ZERO.toSQL()).toBe('DBMS_CRYPTO.PAD_ZERO')
    })

    it('LEGACY_DEFAULT_IV is a VARCHAR2 constant', () => {
      expect(odbDbmsCrypto.LEGACY_DEFAULT_IV.toSQL()).toBe('DBMS_CRYPTO.LEGACY_DEFAULT_IV')
      expect(odbDbmsCrypto.LEGACY_DEFAULT_IV.type).toBe('VARCHAR2')
    })
  })
})
