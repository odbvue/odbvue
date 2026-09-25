import { defineMigration, defineService, odbEnv, odbSettingsApi } from '@odbvue/odb'

const readSetting = odbSettingsApi.procedure('readSetting')
const writeSetting = odbSettingsApi.procedure('writeSetting')
const readSecretSetting = odbSettingsApi.procedure('readSecretSetting')
const writeSecretSetting = odbSettingsApi.procedure('writeSecretSetting')

defineService(readSetting, {
  method: 'GET',
  path: '/:id',
  summary: 'Read a regular setting',
  headers: { Authorization: readSetting.parameters.authorization },
  uri: { id: readSetting.parameters.id },
  response: { value: readSetting.parameters.value },
})

defineService(writeSetting, {
  method: 'PUT',
  path: '/:id',
  summary: 'Write a regular setting',
  headers: { Authorization: writeSetting.parameters.authorization },
  uri: { id: writeSetting.parameters.id },
  body: { value: writeSetting.parameters.value },
})

defineService(readSecretSetting, {
  method: 'GET',
  path: '/secret/:id',
  summary: 'Read an encrypted setting',
  headers: { Authorization: readSecretSetting.parameters.authorization },
  uri: { id: readSecretSetting.parameters.id },
  response: { value: readSecretSetting.parameters.value },
})

defineService(writeSecretSetting, {
  method: 'PUT',
  path: '/secret/:id',
  summary: 'Write an encrypted setting',
  headers: { Authorization: writeSecretSetting.parameters.authorization },
  uri: { id: writeSecretSetting.parameters.id },
  body: { value: writeSecretSetting.parameters.value },
})

export const migration = defineMigration('00000000000002_sandbox_settings', {
  schema: odbEnv.read('ODBVUE_ADB_SCHEMA_USERNAME'),
}).install(odbSettingsApi)
