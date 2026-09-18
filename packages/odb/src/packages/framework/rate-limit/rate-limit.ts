import { odbPackage, odbType } from '../../../schema/package.js'
import { cond, odbLiteral } from '../../../schema/attribute.js'
import { odbOracle } from '../../oracle/index.js'
import { odbTable } from '../../../schema/table.js'
import { odbQuery } from '../../../query/index.js'

export const rateLimitBuckets = odbTable('odb_rate_limit_buckets', (t) => ({
  scope: t.string(128).notNull().primaryKey(),
  subjectHash: t.string(64).notNull().primaryKey(),
  windowStartedAt: t.timestamp().notNull(),
  failureCount: t.number().notNull(),
  blockedUntil: t.timestamp(),
}))

export const odbRateLimitApi = odbPackage('odb_rate_limit', (pkg) => {
  const hashSubject = pkg.func('hash_subject', odbType.string(64), (fn) => {
    const { subject } = fn.parameters({ in: { subject: odbType.string() } })
    fn.body((body) =>
      body.returnQuery(
        odbQuery()
          .selectFrom('dual')
          .select(odbOracle.lower(odbOracle.standardHash(subject, odbLiteral('SHA256')))),
      ),
    )
  })

  const enforce = pkg.proc(
    'enforce',
    { in: { scope: odbType.string(), subject: odbType.string() } },
    ({ params: { scope, subject }, body }) => {
      const { subjectHash, blockedUntil } = body.variables({
        subjectHash: odbType.string(64),
        blockedUntil: odbType.timestamp(),
      })
      body.set(subjectHash, hashSubject.invoke(subject))
      body.query(
        odbQuery()
          .selectFrom(rateLimitBuckets)
          .select(rateLimitBuckets.blockedUntil)
          .into(blockedUntil)
          .where(
            cond.and([
              cond.eq(rateLimitBuckets.scope, scope),
              cond.eq(rateLimitBuckets.subjectHash, subjectHash),
            ]),
          ),
      )
      body.ifThen(cond.gt(blockedUntil, odbOracle.sysTimestamp()), (then) => then.tooManyRequests())
      body.when('NO_DATA_FOUND', (handler) => handler.null())
    },
  )

  const failure = pkg
    .proc(
      'failure',
      { in: { scope: odbType.string(), subject: odbType.string() } },
      ({ params: { scope, subject }, body }) => {
        const { subjectHash, windowStartedAt, failureCount } = body.variables({
          subjectHash: odbType.string(64),
          windowStartedAt: odbType.timestamp(),
          failureCount: odbType.number(),
        })
        body.set(subjectHash, hashSubject.invoke(subject))
        body.query(
          odbQuery()
            .selectFrom(rateLimitBuckets)
            .select([rateLimitBuckets.windowStartedAt, rateLimitBuckets.failureCount])
            .into(windowStartedAt, failureCount)
            .where(
              cond.and([
                cond.eq(rateLimitBuckets.scope, scope),
                cond.eq(rateLimitBuckets.subjectHash, subjectHash),
              ]),
            )
            .forUpdate(),
        )
        body.ifThen(
          cond.lte(
            odbOracle.plus(windowStartedAt, odbOracle.interval.seconds(60)),
            odbOracle.sysTimestamp(),
          ),
          (then) => {
            then.set(windowStartedAt, odbOracle.sysTimestamp())
            then.set(failureCount, 1)
          },
          (otherwise) => otherwise.set(failureCount, odbOracle.plus(failureCount, 1)),
        )
        body.query(
          odbQuery()
            .updateTable(rateLimitBuckets)
            .set({
              windowStartedAt,
              failureCount,
              blockedUntil: odbOracle.caseWhen(
                cond.gte(failureCount, 5),
                odbOracle.plus(odbOracle.sysTimestamp(), odbOracle.interval.seconds(60)),
                odbOracle.null(),
                'TIMESTAMP',
              ),
            })
            .where(
              cond.and([
                cond.eq(rateLimitBuckets.scope, scope),
                cond.eq(rateLimitBuckets.subjectHash, subjectHash),
              ]),
            ),
        )
        body.commit()
        body.when('NO_DATA_FOUND', (handler) =>
          handler
            .insertInto(rateLimitBuckets, {
              scope,
              subjectHash,
              windowStartedAt: odbOracle.sysTimestamp(),
              failureCount: 1,
            })
            .commit(),
        )
      },
    )
    .autonomous()

  const success = pkg
    .proc(
      'success',
      { in: { scope: odbType.string(), subject: odbType.string() } },
      ({ params: { scope, subject }, body }) => {
        const { subjectHash } = body.variables({ subjectHash: odbType.string(64) })
        body.set(subjectHash, hashSubject.invoke(subject))
        body.query(
          odbQuery()
            .deleteFrom(rateLimitBuckets)
            .where(
              cond.and([
                cond.eq(rateLimitBuckets.scope, scope),
                cond.eq(rateLimitBuckets.subjectHash, subjectHash),
              ]),
            ),
        )
        body.commit()
      },
    )
    .autonomous()

  return {
    hashSubject,
    enforce,
    failure,
    success,
  }
})

/** Shared fixed-window failure throttle for sensitive PL/SQL procedures. */
export const odbRateLimit = {
  toSQLUp(options: { schema?: string } = {}): string {
    return [rateLimitBuckets.toSQLUp(options), odbRateLimitApi.toSQLUp(options)].join('\n')
  },
  toSQLDown(options: { schema?: string } = {}): string {
    return [odbRateLimitApi.toSQLDown(options), rateLimitBuckets.toSQLDown(options)].join('\n')
  },
  upgrade() {
    return {
      toSQLUp(options: { schema?: string } = {}): string {
        return odbRateLimitApi.toSQLUp(options)
      },
      toSQLDown() {
        return ''
      },
    }
  },
}
