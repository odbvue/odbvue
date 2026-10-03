import { odbType, type OdbTypeDescriptor } from '../../schema/package.js'
import { BODY_LENGTH, SEVERITY_TEXT_LENGTH } from './constants.js'

/** Parameter types for audit values, without referring to `odb_audit_logs`. */
export const auditTypes = {
  id: odbType.guid(),
  severityText: odbType.string(SEVERITY_TEXT_LENGTH),
  body: odbType.string(BODY_LENGTH),
  attributes: odbType.json(),
  eventTimestamp: odbType.timestamp(),
  attributeKey: odbType.string(),
  attributeValue: odbType.string(),
  severityNumber: odbType.integer(),
}

export function withDefault<TType extends string>(
  descriptor: OdbTypeDescriptor<TType>,
  expression: string,
): OdbTypeDescriptor<TType> {
  return { ...descriptor, default: expression }
}
