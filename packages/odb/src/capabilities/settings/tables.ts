import { odbTable } from '../../schema/table.js'
import { ID_LENGTH } from './constants.js'
import type { SettingMeta } from './types.js'
import { odbOracle } from '../../oracle/index.js'
import { odbLiteral } from '../../schema/attribute.js'

export const settingsStore = odbTable('odb_settings_store', (t) => ({
  id: t.string(ID_LENGTH).primaryKey(),
  value: t.clob(),
  meta: t.json<SettingMeta>().notNull().default({}),
  secret: t.string(1).generatedAs(
    odbOracle
      .nvl(
        odbOracle.jsonValue('meta', odbLiteral('$.secret'), {
          length: 1,
          errorOnError: true,
          nullOnEmpty: true,
        }),
        odbLiteral('N'),
      )
      .toSQL(),
  ),
}))
  .check('odb_settings_chk_secret', "secret IN ('Y', 'N')")
  .comment('Application settings')
