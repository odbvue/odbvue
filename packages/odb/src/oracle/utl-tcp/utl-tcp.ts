import type { OdbTypeDescriptor } from '../../schema/package.js'
import {
  PlsqlExpression,
  PlsqlStatement,
  renderPlsql,
  type PlsqlRenderable,
} from '../../schema/attribute.js'

export const odbUtlTcp = {
  connection: { type: 'UTL_TCP.CONNECTION' } satisfies OdbTypeDescriptor<'UTL_TCP.CONNECTION'>,
  CRLF: new PlsqlExpression('VARCHAR2', 'UTL_TCP.CRLF'),

  closeConnection(connection: PlsqlRenderable): PlsqlStatement {
    return new PlsqlStatement(`UTL_TCP.CLOSE_CONNECTION(${renderPlsql(connection)})`)
  },
}
