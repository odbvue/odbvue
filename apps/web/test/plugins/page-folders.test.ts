import { afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { discoverPageFolders, moduleFromComponent } from '../../plugins/routing'

let fixture: string | undefined
afterEach(() => {
  if (fixture) rmSync(fixture, { recursive: true })
  fixture = undefined
})

describe('main application and module page boundaries', () => {
  it('scans main pages and module page folders, not module UI or translations', () => {
    fixture = mkdtempSync(join(tmpdir(), 'odbvue-pages-'))
    for (const directory of [
      'src/app/pages',
      'src/app/i18n',
      'src/capabilities/ui',
      'src/capabilities/routing',
      'src/modules/sandbox/pages',
      'src/modules/sandbox/components',
      'src/modules/sandbox/i18n',
      'src/modules/helpers/components',
    ]) {
      mkdirSync(resolve(fixture, directory), { recursive: true })
    }
    expect(discoverPageFolders(fixture)).toEqual([
      'src/app/pages',
      { src: 'src/modules/sandbox/pages', path: 'sandbox/' },
    ])
  })

  it('assigns module metadata only to module pages', () => {
    expect(moduleFromComponent(resolve('src/modules/sandbox/pages/index.vue'))).toBe('sandbox')
    expect(moduleFromComponent(resolve('src/modules/sandbox/pages/capabilities/auth.vue'))).toBe(
      'sandbox',
    )
    expect(moduleFromComponent(resolve('src/modules/sandbox/components/Form.vue'))).toBeUndefined()
    expect(moduleFromComponent(resolve('src/app/pages/index.vue'))).toBeUndefined()
    expect(moduleFromComponent(resolve('src/capabilities/routing/index.ts'))).toBeUndefined()
    expect(moduleFromComponent()).toBeUndefined()
  })
})
