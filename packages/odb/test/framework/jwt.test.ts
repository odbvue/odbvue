import { describe, expect, it } from 'vitest'
import { odbJwt } from '../../src/packages/framework/jwt/jwt.js'

describe('odbJwt (framework package odb_jwt)', () => {
  describe('install / drop SQL', () => {
    it('toSQLUp() emits the spec and body under the odb_jwt name', () => {
      const sql = odbJwt.toSQLUp()
      expect(sql).toContain('CREATE OR REPLACE PACKAGE odb_jwt AS')
      expect(sql).toContain('CREATE OR REPLACE PACKAGE BODY odb_jwt AS')
      expect(sql).toContain('hmac_sh256')
      expect(sql).not.toContain('pck_api_auth')
    })

    it('toSQLUp({ schema }) qualifies the package name', () => {
      const sql = odbJwt.toSQLUp({ schema: 'APP_USER' })
      expect(sql).toContain('CREATE OR REPLACE PACKAGE APP_USER.odb_jwt AS')
      expect(sql).toContain('CREATE OR REPLACE PACKAGE BODY APP_USER.odb_jwt AS')
    })

    it('toSQLDown() drops odb_jwt', () => {
      expect(odbJwt.toSQLDown()).toContain('DROP PACKAGE odb_jwt')
    })

    it('toSQLDown({ schema }) drops the qualified package', () => {
      expect(odbJwt.toSQLDown({ schema: 'APP_USER' })).toContain('DROP PACKAGE APP_USER.odb_jwt')
    })
  })

  describe('call-expression helpers', () => {
    it('render odb_jwt.* calls', () => {
      expect(odbJwt.encode('v_payload', 'v_secret')).toBe('odb_jwt.encode(v_payload, v_secret)')
      expect(odbJwt.verify('v_token', 'v_secret')).toBe('odb_jwt.verify(v_token, v_secret)')
      expect(odbJwt.payload('v_token')).toBe('odb_jwt.payload(v_token)')
      expect(odbJwt.claim('v_token', "'sub'")).toBe("odb_jwt.claim(v_token, 'sub')")
      expect(odbJwt.base64urlEncode('v_text')).toBe('odb_jwt.base64url_encode(v_text)')
      expect(odbJwt.base64urlDecode('v_b64')).toBe('odb_jwt.base64url_decode(v_b64)')
      expect(odbJwt.fromEpoch('v_epoch')).toBe('odb_jwt.from_epoch(v_epoch)')
    })

    it('renders optional arguments', () => {
      expect(odbJwt.isExpired('v_token')).toBe('odb_jwt.is_expired(v_token)')
      expect(odbJwt.isExpired('v_token', '30')).toBe('odb_jwt.is_expired(v_token, 30)')
      expect(odbJwt.toEpoch()).toBe('odb_jwt.to_epoch()')
      expect(odbJwt.toEpoch('v_ts')).toBe('odb_jwt.to_epoch(v_ts)')
    })
  })
})
