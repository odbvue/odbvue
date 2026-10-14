import { PlsqlExpression, renderPlsql, type PlsqlRenderable } from '../../schema/attribute.js'

/** Typed wrappers for Oracle's built-in `UTL_I18N` package. */
export const odbUtlI18n = {
  rawToChar(data: PlsqlRenderable, charset: PlsqlRenderable): PlsqlExpression<'VARCHAR2'> {
    return new PlsqlExpression(
      'VARCHAR2',
      `UTL_I18N.RAW_TO_CHAR(${renderPlsql(data)}, ${renderPlsql(charset)})`,
    )
  },
  /** `UTL_I18N.STRING_TO_RAW(<data>, <charset>)` -> RAW */
  stringToRaw(data: PlsqlRenderable, charset: PlsqlRenderable): PlsqlExpression<'RAW'> {
    return new PlsqlExpression(
      'RAW',
      `UTL_I18N.STRING_TO_RAW(${renderPlsql(data)}, ${renderPlsql(charset)})`,
    )
  },
}
