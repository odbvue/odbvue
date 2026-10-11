import { PlsqlStatement, renderPlsql, type PlsqlRenderable } from '../../schema/attribute.js'

export const odbDbmsOutput = {
  putLine(message: PlsqlRenderable): PlsqlStatement {
    return new PlsqlStatement(`DBMS_OUTPUT.PUT_LINE(${renderPlsql(message)})`)
  },
}
