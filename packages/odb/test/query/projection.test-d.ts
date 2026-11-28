import { expectTypeOf, it } from 'vitest'
import { odbQuery, resultField, type SelectQueryBuilder } from '../../src/query/index.js'
import { odbTable } from '../../src/schema/table.js'

it('infers computed result fields and their nullability', () => {
  const emails = odbTable('emails', (t) => ({ id: t.guid().primaryKey() }))
  const query = odbQuery()
    .selectFrom(emails)
    .select(emails.id)
    .selectAs('COUNT(*)', resultField('bodyLength', 'number', { nullable: false }))
    .selectAs('NULL', resultField('toRecipients', 'string'))
    .selectAs("JSON_OBJECT('ok' VALUE 1)", resultField('metadata', 'json'))

  type Row =
    typeof query extends SelectQueryBuilder<infer _Table, infer TRow, infer _Selected>
      ? TRow
      : never
  expectTypeOf<Row>().toEqualTypeOf<{
    id: string
    bodyLength: number
    toRecipients: string | null
    metadata: unknown
  }>()

  const first = odbQuery().selectFrom(emails).selectAs('NULL', resultField('recipient', 'string'))
  type FirstRow =
    typeof first extends SelectQueryBuilder<infer _Table, infer TRow, infer _Selected>
      ? TRow
      : never
  expectTypeOf<FirstRow>().toEqualTypeOf<{ recipient: string | null }>()

  // @ts-expect-error unsupported result types must not be accepted
  resultField('value', 'resultset')
})
