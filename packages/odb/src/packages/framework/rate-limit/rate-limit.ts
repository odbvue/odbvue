import { odbPackage, odbType } from '../../../schema/package.js'
import { PlsqlExpression } from '../../../schema/attribute.js'
import { odbTable } from '../../../schema/table.js'
import { odbQuery } from '../../../query/index.js'

export const rateLimitBuckets = odbTable('odb_rate_limit_buckets', (t) => ({
  scope: t.string(128).notNull().primaryKey(),
  subjectHash: t.string(64).notNull().primaryKey(),
  windowStartedAt: t.timestamp().notNull(),
  failureCount: t.number().notNull(),
  blockedUntil: t.timestamp(),
}))

const odbRateLimitPackage = odbPackage('odb_rate_limit', (pkg) => ({
  hashSubject: pkg.func('hash_subject', 'VARCHAR2', (fn) => {
    const subject = fn.param('p_subject', 'VARCHAR2')
    fn.returnLength(64).body((body) =>
      body.returnQuery(
        odbQuery()
          .selectFrom('dual')
          .select(
            new PlsqlExpression('VARCHAR2', `LOWER(STANDARD_HASH(${subject.name}, 'SHA256'))`),
          ),
      ),
    )
  }),
  enforce: pkg.proc('enforce', (proc) => {
    const { scope, subject } = proc.parameters({
      in: { scope: 'VARCHAR2', subject: 'VARCHAR2' },
    })
    proc.body((body) => {
      const { subjectHash, blockedUntil } = body.variables({
        subjectHash: odbType.string(64),
        blockedUntil: odbType.timestamp(),
      })
      body.set(subjectHash, new PlsqlExpression('VARCHAR2', `hash_subject(${subject.name})`))
      body.query(
        odbQuery()
          .selectFrom(rateLimitBuckets)
          .select(rateLimitBuckets.blockedUntil)
          .into(blockedUntil)
          .where((expression) =>
            expression.and([
              expression(rateLimitBuckets.scope, '=', scope),
              expression(rateLimitBuckets.subjectHash, '=', subjectHash),
            ]),
          ),
      )
      body.ifThen(`${blockedUntil.name} > SYSTIMESTAMP`, (then) => then.tooManyRequests())
      body.when('NO_DATA_FOUND', (handler) => handler.null())
    })
  }),
  failure: pkg.proc('failure', (proc) => {
    const { scope, subject } = proc.parameters({
      in: { scope: 'VARCHAR2', subject: 'VARCHAR2' },
    })
    proc.autonomous().body((body) => {
      const { subjectHash, windowStartedAt, failureCount } = body.variables({
        subjectHash: odbType.string(64),
        windowStartedAt: odbType.timestamp(),
        failureCount: odbType.number(),
      })
      body.set(subjectHash, new PlsqlExpression('VARCHAR2', `hash_subject(${subject.name})`))
      body.query(
        odbQuery()
          .selectFrom(rateLimitBuckets)
          .select([rateLimitBuckets.windowStartedAt, rateLimitBuckets.failureCount])
          .into(windowStartedAt, failureCount)
          .where((expression) =>
            expression.and([
              expression(rateLimitBuckets.scope, '=', scope),
              expression(rateLimitBuckets.subjectHash, '=', subjectHash),
            ]),
          )
          .forUpdate(),
      )
      body.ifThen(
        `${windowStartedAt.name} + NUMTODSINTERVAL(60, 'SECOND') <= SYSTIMESTAMP`,
        (then) => {
          then.set(windowStartedAt, new PlsqlExpression('TIMESTAMP', 'SYSTIMESTAMP'))
          then.set(failureCount, new PlsqlExpression('NUMBER', '1'))
        },
        (otherwise) =>
          otherwise.set(failureCount, new PlsqlExpression('NUMBER', `${failureCount.name} + 1`)),
      )
      body.query(
        odbQuery()
          .updateTable(rateLimitBuckets)
          .set({
            windowStartedAt,
            failureCount,
            blockedUntil: new PlsqlExpression(
              'TIMESTAMP',
              `CASE WHEN ${failureCount.name} >= 5 THEN SYSTIMESTAMP + NUMTODSINTERVAL(60, 'SECOND') ELSE NULL END`,
            ),
          })
          .where((expression) =>
            expression.and([
              expression(rateLimitBuckets.scope, '=', scope),
              expression(rateLimitBuckets.subjectHash, '=', subjectHash),
            ]),
          ),
      )
      body.commit()
      body.when('NO_DATA_FOUND', (handler) =>
        handler
          .insertInto(rateLimitBuckets, {
            scope,
            subjectHash,
            windowStartedAt: new PlsqlExpression('TIMESTAMP', 'SYSTIMESTAMP'),
            failureCount: 1,
          })
          .commit(),
      )
    })
  }),
  success: pkg.proc('success', (proc) => {
    const { scope, subject } = proc.parameters({
      in: { scope: 'VARCHAR2', subject: 'VARCHAR2' },
    })
    proc.autonomous().body((body) => {
      const { subjectHash } = body.variables({ subjectHash: odbType.string(64) })
      body.set(subjectHash, new PlsqlExpression('VARCHAR2', `hash_subject(${subject.name})`))
      body.query(
        odbQuery()
          .deleteFrom(rateLimitBuckets)
          .where((expression) =>
            expression.and([
              expression(rateLimitBuckets.scope, '=', scope),
              expression(rateLimitBuckets.subjectHash, '=', subjectHash),
            ]),
          ),
      )
      body.commit()
    })
  }),
}))

/** Shared fixed-window failure throttle for sensitive PL/SQL procedures. */
export const odbRateLimit = {
  toSQLUp(options: { schema?: string } = {}): string {
    return [rateLimitBuckets.toSQLUp(options), odbRateLimitPackage.toSQLUp(options)].join('\n')
  },
  toSQLDown(options: { schema?: string } = {}): string {
    return [odbRateLimitPackage.toSQLDown(options), rateLimitBuckets.toSQLDown(options)].join('\n')
  },
  upgrade() {
    return {
      toSQLUp(options: { schema?: string } = {}): string {
        return odbRateLimitPackage.toSQLUp(options)
      },
      toSQLDown() {
        return ''
      },
    }
  },
  check(scope: string, subject: string): string {
    return `odb_rate_limit.enforce(${scope}, ${subject})`
  },
  failure(scope: string, subject: string): string {
    return `odb_rate_limit.failure(${scope}, ${subject})`
  },
  success(scope: string, subject: string): string {
    return `odb_rate_limit.success(${scope}, ${subject})`
  },
}
