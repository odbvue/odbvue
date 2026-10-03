import { odbPackage, odbType } from '../../schema/package.js'
import { cond, odbLiteral } from '../../schema/attribute.js'
import { odbOracle } from '../../oracle/index.js'
import { odbQuery } from '../../query/index.js'
import { BLOCK_SECONDS, FAILURE_LIMIT, PACKAGE_NAME, WINDOW_SECONDS } from './constants.js'
import { rateLimitBuckets } from './tables.js'
import { rateLimitTypes } from './types.js'

export const odbRateLimitApi = odbPackage(PACKAGE_NAME, (pkg) => {
  const hashSubject = pkg.func('hash_subject', rateLimitTypes.subjectHash, (fn) => {
    const { subject } = fn.parameters({ in: { subject: rateLimitTypes.subject } })
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
    { in: { scope: rateLimitTypes.scope, subject: rateLimitTypes.subject } },
    ({ params: { scope, subject }, body }) => {
      const { subjectHash, blockedUntil } = body.variables({
        subjectHash: rateLimitTypes.subjectHash,
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
      { in: { scope: rateLimitTypes.scope, subject: rateLimitTypes.subject } },
      ({ params: { scope, subject }, body }) => {
        const { subjectHash, windowStartedAt, failureCount } = body.variables({
          subjectHash: rateLimitTypes.subjectHash,
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
            odbOracle.plus(windowStartedAt, odbOracle.interval.seconds(WINDOW_SECONDS)),
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
                cond.gte(failureCount, FAILURE_LIMIT),
                odbOracle.plus(odbOracle.sysTimestamp(), odbOracle.interval.seconds(BLOCK_SECONDS)),
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
      { in: { scope: rateLimitTypes.scope, subject: rateLimitTypes.subject } },
      ({ params: { scope, subject }, body }) => {
        const { subjectHash } = body.variables({ subjectHash: rateLimitTypes.subjectHash })
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
