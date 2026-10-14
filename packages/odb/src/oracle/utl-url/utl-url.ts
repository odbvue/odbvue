import { PlsqlExpression, renderPlsql, type PlsqlRenderable } from '../../schema/attribute.js'

export const odbUtlUrl = {
  escape(
    value: PlsqlRenderable,
    escapeReserved: boolean,
    charset: PlsqlRenderable,
  ): PlsqlExpression<'VARCHAR2'> {
    return new PlsqlExpression(
      'VARCHAR2',
      `UTL_URL.ESCAPE(${renderPlsql(value)}, ${escapeReserved ? 'TRUE' : 'FALSE'}, ${renderPlsql(charset)})`,
    )
  },
}
