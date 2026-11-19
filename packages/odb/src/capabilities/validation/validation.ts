import type { PlsqlRenderable } from '../../schema/attribute.js'
import { odbValidationPackage } from './package.js'

/** Installable portable validation rules for PL/SQL mutations. */
export const odbValidation = {
  toSQLUp(options: { schema?: string } = {}) {
    return odbValidationPackage.toSQLUp(options)
  },
  toSQLDown(options: { schema?: string } = {}) {
    return odbValidationPackage.toSQLDown(options)
  },
  isNumber(value: PlsqlRenderable) {
    return odbValidationPackage.isNumber(value)
  },
  isPort(value: PlsqlRenderable) {
    return odbValidationPackage.isPort(value)
  },
  inSet(value: PlsqlRenderable, items: PlsqlRenderable) {
    return odbValidationPackage.inSet(value, items)
  },
  checkRule(value: PlsqlRenderable, rule: PlsqlRenderable) {
    return odbValidationPackage.checkRule(value, rule)
  },
}
