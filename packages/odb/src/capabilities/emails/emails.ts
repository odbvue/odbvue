import { readFileSync } from 'node:fs'
import { PlsqlStatement, renderPlsql, type PlsqlRenderable } from '../../schema/attribute.js'
import { dropPackageIfExists, qualify } from '../../schema/ddl.js'
import { emails, emailsAddr, emailsAttc } from './tables.js'
import { emailsTypes } from './types.js'

const spec = readFileSync(new URL('./emails.pks', import.meta.url), 'utf8')
const body = readFileSync(new URL('./emails.pkb', import.meta.url), 'utf8')

function call(name: string, ...args: PlsqlRenderable[]): PlsqlStatement {
  return new PlsqlStatement(`odb_emails.${name}(${args.map(renderPlsql).join(', ')})`)
}

export const odbEmails = {
  toSQLUp(options: { schema?: string } = {}): string {
    const name = qualify('odb_emails', options.schema)
    return [
      emails.toSQLUp(options),
      emailsAddr.toSQLUp(options),
      emailsAttc.toSQLUp(options),
      spec.replace('PACKAGE odb_emails AS', `PACKAGE ${name} AS`),
      body.replace('PACKAGE BODY odb_emails AS', `PACKAGE BODY ${name} AS`),
    ].join('\n')
  },
  toSQLDown(options: { schema?: string } = {}): string {
    return [
      dropPackageIfExists('odb_emails', options.schema),
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
    return call('mail', address, name, subject, content, priority, id)
  },
  addr(
    id: PlsqlRenderable,
    type: PlsqlRenderable,
    address: PlsqlRenderable,
    name: PlsqlRenderable = 'NULL',
  ) {
    return call('addr', id, type, address, name)
  },
  attc(id: PlsqlRenderable, ownerId: PlsqlRenderable, storageId: PlsqlRenderable) {
    return call('attc', id, ownerId, storageId)
  },
  /** Send a committed queue entry in an autonomous transaction; failures are persisted and raised. */
  send(id: PlsqlRenderable, postpone: PlsqlRenderable = '300') {
    return call('send', id, postpone)
  },
  list(after: PlsqlRenderable, limit: PlsqlRenderable, items: PlsqlRenderable) {
    return new PlsqlStatement(call('list', after, limit, items).toSQL(), {
      [renderPlsql(items).toUpperCase()]: [
        emails.id,
        emails.subject,
        emails.priority,
        emails.status,
        emails.created,
        emails.delivered,
        emails.attempts,
        emails.postponed,
        emails.error,
      ].map((column) => {
        const node = column.toNode()
        return { name: node.name, type: node.type, nullable: node.options.nullable !== false }
      }),
    })
  },
}
