import { PlsqlExpression } from '../../schema/attribute.js'

export const odbDbmsUtility = {
  formatErrorBacktrace(): PlsqlExpression<'VARCHAR2'> {
    return new PlsqlExpression('VARCHAR2', 'DBMS_UTILITY.FORMAT_ERROR_BACKTRACE')
  },
}
