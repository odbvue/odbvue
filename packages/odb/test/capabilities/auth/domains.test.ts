import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { odbAuthPackage } from '../../../src/capabilities/auth/package.js'
import { odbAuth } from '../../../src/capabilities/auth/auth.js'

describe('odbAuth domain surface', () => {
  it('maps domain helpers to the unchanged database routines', () => {
    const calls = [
      [odbAuth.confirmSignup('token'), 'confirm_email(token)'],
      [odbAuth.password.change('user', 'current', 'next'), 'change_password(user, current, next)'],
      [odbAuth.password.recover('username', 'token'), 'recover_password(username, token)'],
      [odbAuth.password.reset('token', 'password'), 'reset_password(token, password)'],
      [
        odbAuth.google.login('sub', 'email', 'name', 'access', 'refresh'),
        'login_google(sub, email, name, access, refresh)',
      ],
      [
        odbAuth.google.prepareLink('user', 'refresh', 'password', 'session', 'version'),
        'prepare_google_link(user, refresh, password, session, version)',
      ],
      [
        odbAuth.google.checkLink('user', 'session', 'version', 'refresh'),
        'check_google_link(user, session, version, refresh)',
      ],
      [
        odbAuth.google.link('user', 'session', 'version', 'refresh', 'sub'),
        'link_google(user, session, version, refresh, sub)',
      ],
      [odbAuth.google.updateAvatar('sub', 'picture'), 'update_google_avatar(sub, picture)'],
      [
        odbAuth.twoFactor.verify(
          'challenge',
          'code',
          'access',
          'refresh',
          'codes',
          'next',
          'secret',
        ),
        'verify_two_factor(challenge, code, access, refresh, codes, next, secret)',
      ],
      [
        odbAuth.profile.read('user', 'url', 'uploaded', 'password', 'google', 'avatar'),
        'read_profile(user, url, uploaded, password, google, avatar)',
      ],
      [odbAuth.profile.updateAvatar('user', 'avatar'), 'update_avatar(user, avatar)'],
    ] as const
    for (const [call, routine] of calls) expect(call.toSQL()).toBe(`odb_auth.${routine}`)
  })

  it('does not retain flat compatibility aliases or separate feature capabilities', () => {
    for (const name of [
      'confirmEmail',
      'changePassword',
      'recoverPassword',
      'resetPassword',
      'loginGoogle',
      'prepareGoogleLink',
      'checkGoogleLink',
      'linkGoogle',
      'updateGoogleAvatar',
      'verifyTwoFactor',
      'readProfile',
      'updateAvatar',
    ])
      expect(odbAuth).not.toHaveProperty(name)
    for (const domain of [odbAuth.password, odbAuth.google, odbAuth.twoFactor, odbAuth.profile])
      expect(domain).not.toHaveProperty('toSQLUp')
    const sql = odbAuth.toSQLUp()
    expect(sql.match(/CREATE OR REPLACE PACKAGE odb_auth AS/g)).toHaveLength(1)
    expect(odbAuthPackage.signup('username', 'password', 'name', 'token').toSQL()).toBe(
      'odb_auth.signup(username, password, name, token)',
    )
  })

  it('keeps core implementation independent of feature modules and composition', () => {
    const core = new URL('../../../src/capabilities/auth/core/', import.meta.url)
    for (const file of readdirSync(core, { recursive: true })) {
      if (typeof file !== 'string' || !file.endsWith('.ts')) continue
      const source = readFileSync(new URL(file, core), 'utf8')
      expect(source, file).not.toMatch(/from ['"][^'"]*features\//)
      expect(source, file).not.toMatch(/from ['"]\.\.\/(?:login|auth|package)\.js['"]/)
    }
  })
})
