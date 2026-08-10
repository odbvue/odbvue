import { odbEnv, odbSchema } from '@odbvue/odb'

const schemaName = odbEnv.read('ODBVUE_ADB_SCHEMA_USERNAME')
const schemaPassword = odbEnv.read('ODBVUE_ADB_SCHEMA_PASSWORD')

export const schema = odbSchema(schemaName, schemaPassword, (definition) => {
  definition.grant('EXECUTE ON DBMS_CRYPTO')
})
