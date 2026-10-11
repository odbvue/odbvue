import { odbLiteral, type PlsqlRenderable } from '../../schema/attribute.js'
import { odbOracle } from '../../oracle/index.js'
import { odbEmailsPackage } from './package.js'
import { emails, emailsAddr, emailsAttc } from './tables.js'
import { emailsTypes } from './types.js'

export { odbEmailsPackage } from './package.js'

export const odbEmails = {
  toSQLUp(options: { schema?: string } = {}): string {
    return [
      emails.toSQLUp(options),
      emailsAddr.toSQLUp(options),
      emailsAttc.toSQLUp(options),
      odbEmailsPackage.toSQLUp(options),
    ].join('\n')
  },
  toSQLDown(options: { schema?: string } = {}): string {
    return [
      odbEmailsPackage.toSQLDown(options),
      emailsAttc.toSQLDown(options),
      emailsAddr.toSQLDown(options),
      emails.toSQLDown(options),
    ].join('\n')
  },
  types: emailsTypes,
  mail(
    address: PlsqlRenderable,
    name: PlsqlRenderable,
    subject: PlsqlRenderable,
    content: PlsqlRenderable,
    priority: PlsqlRenderable,
    id: PlsqlRenderable,
  ) {
    return odbEmailsPackage.mail(address, name, subject, content, priority, id)
  },
  addr(
    id: PlsqlRenderable,
    type: PlsqlRenderable,
    address: PlsqlRenderable,
    name: PlsqlRenderable = odbOracle.null(),
  ) {
    return odbEmailsPackage.addr(id, type, address, name)
  },
  attc(id: PlsqlRenderable, ownerId: PlsqlRenderable, storageId: PlsqlRenderable) {
    return odbEmailsPackage.attc(id, ownerId, storageId)
  },
  /** Send a committed queue entry in an autonomous transaction; failures are persisted and raised. */
  send(id: PlsqlRenderable, postpone: PlsqlRenderable = odbLiteral(300)) {
    return odbEmailsPackage.send(id, postpone)
  },
  list(after: PlsqlRenderable, limit: PlsqlRenderable, items: PlsqlRenderable) {
    return odbEmailsPackage.list(after, limit, items)
  },
}
