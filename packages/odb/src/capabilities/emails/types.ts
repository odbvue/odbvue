import { odbType } from '../../schema/package.js'

export const emailsTypes = {
  id: odbType.guid(),
  address: odbType.string(240),
  name: odbType.string(240),
  subject: odbType.string(240),
  content: odbType.clob(),
  priority: odbType.integer(),
  addressType: odbType.string(7),
}
