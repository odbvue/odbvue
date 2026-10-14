import { defineMigration, odbAuth, odbEnv, odbGoogle } from '@odbvue/odb'
import { appPackage } from './00000000000000-bootstrap.js'

export const migration = defineMigration('00000000000002_google_link', {
  schema: odbEnv.schemaUsername,
})
  .install(odbAuth.upgrade())
  .install(odbGoogle.upgrade())
  .install(appPackage)
