import { cond, odbLiteral, plsqlCall, PlsqlStatement } from '../../schema/attribute.js'
import { odbBlock, odbPackage, odbType } from '../../schema/package.js'
import { odbTable } from '../../schema/table.js'
import { odbQuery } from '../../query/index.js'

const schedulerJobs = odbTable('dba_scheduler_jobs', (table) => ({
  owner: table.string(128),
  jobName: table.string(128),
  jobType: table.string(16),
  jobAction: table.string(4000),
  numberOfArguments: table.number(),
  programName: table.string(4000),
  scheduleName: table.string(128),
  repeatInterval: table.string(4000),
  comments: table.string(4000),
  autoDrop: table.string(5),
  jobStyle: table.string(17),
  jobClass: table.string(128),
  endDate: table.timestamp(),
  loggingLevel: table.string(11),
}))

const ownedJobs = odbTable('user_scheduler_jobs', (table) => ({
  jobName: table.string(128),
  enabled: table.string(5),
  state: table.string(30),
}))

function identifier(value: string, label: string): string {
  if (!/^[A-Za-z][A-Za-z0-9_$#]{0,127}$/.test(value)) {
    throw new Error(`odbScheduler.seed(): invalid ${label}.`)
  }
  return value.toUpperCase()
}

function seedJob(job: { name: string; action: string; schedule: string; description: string }) {
  const name = identifier(job.name, 'job name')
  const parts = job.action.split('.')
  if (parts.length < 1 || parts.length > 2) {
    throw new Error('odbScheduler.seed(): action must be a procedure or package procedure.')
  }
  const action = parts.map((part) => identifier(part, 'action')).join('.')
  if (!job.schedule.trim()) throw new Error('odbScheduler.seed(): schedule is required.')

  const schemaName = (schema?: string) => {
    if (!schema) throw new Error('odbScheduler.seed(): schema is required.')
    return identifier(schema, 'schema')
  }

  return {
    toSQLUp({ schema }: { schema?: string } = {}) {
      const owner = schemaName(schema)
      return odbBlock((body) => {
        const { count, loggingLevel } = body.variables({
          count: odbType.integer(),
          loggingLevel: odbType.string(11),
        })
        const target = cond.and([
          cond.eq(schedulerJobs.owner, odbLiteral(owner)),
          cond.eq(schedulerJobs.jobName, odbLiteral(name)),
        ])
        body.query(
          odbQuery().selectFrom(schedulerJobs).select('COUNT(*)').into(count).where(target),
        )
        body.ifThen(
          cond.eq(count, 0),
          (missing) =>
            missing.call(
              plsqlCall(
                `${owner}.odb_scheduler.create_job`,
                odbLiteral(`${owner}.${name}`),
                odbLiteral(`${owner}.${action}`),
                odbLiteral(job.schedule),
                odbLiteral(job.description),
              ),
            ),
          (existing) => {
            existing.query(
              odbQuery()
                .selectFrom(schedulerJobs)
                .select('COUNT(*)')
                .into(count)
                .where(
                  cond.and([
                    target,
                    cond.eq(schedulerJobs.jobType, odbLiteral('STORED_PROCEDURE')),
                    cond.eq(schedulerJobs.jobAction, odbLiteral(`${owner}.${action}`)),
                    cond.eq(schedulerJobs.numberOfArguments, 0),
                    cond.isNull(schedulerJobs.programName),
                    cond.isNull(schedulerJobs.scheduleName),
                    cond.eq(schedulerJobs.repeatInterval, odbLiteral(job.schedule)),
                    cond.or([
                      cond.eq(schedulerJobs.comments, odbLiteral(job.description)),
                      cond.and([
                        cond.isNull(schedulerJobs.comments),
                        cond.isNull(odbLiteral(job.description)),
                      ]),
                    ]),
                    cond.eq(schedulerJobs.autoDrop, odbLiteral('FALSE')),
                    cond.eq(schedulerJobs.jobStyle, odbLiteral('REGULAR')),
                    cond.eq(schedulerJobs.jobClass, odbLiteral('DEFAULT_JOB_CLASS')),
                    cond.isNull(schedulerJobs.endDate),
                  ]),
                ),
            )
            existing.ifThen(cond.ne(count, 1), (drift) => drift.conflict('SCHEDULER_JOB_DRIFT'))
            existing.query(
              odbQuery()
                .selectFrom(schedulerJobs)
                .select(schedulerJobs.loggingLevel)
                .into(loggingLevel)
                .where(target),
            )
            existing.ifThen(
              cond.or([
                cond.isNull(loggingLevel),
                cond.and([cond.ne(loggingLevel, 'RUNS'), cond.ne(loggingLevel, 'FULL')]),
              ]),
              (repair) =>
                repair.call(
                  plsqlCall(
                    'DBMS_SCHEDULER.SET_ATTRIBUTE',
                    odbLiteral(`${owner}.${name}`),
                    odbLiteral('logging_level'),
                    'DBMS_SCHEDULER.LOGGING_RUNS',
                  ),
                ),
            )
          },
        )
      })
    },
    toSQLDown({ schema }: { schema?: string } = {}) {
      const owner = schemaName(schema)
      return odbBlock((body) => {
        const { count } = body.variables({ count: odbType.integer() })
        body.query(
          odbQuery()
            .selectFrom(schedulerJobs)
            .select('COUNT(*)')
            .into(count)
            .where(
              cond.and([
                cond.eq(schedulerJobs.owner, odbLiteral(owner)),
                cond.eq(schedulerJobs.jobName, odbLiteral(name)),
              ]),
            ),
        )
        body.ifThen(cond.gt(count, 0), (then) =>
          then.call(plsqlCall('DBMS_SCHEDULER.DROP_JOB', odbLiteral(`${owner}.${name}`), true)),
        )
      })
    },
  }
}

const schedulerPackage = odbPackage('odb_scheduler', (pkg) => {
  const create = pkg.proc(
    'create_job',
    {
      in: {
        name: odbType.string(128),
        action: odbType.string(261),
        schedule: odbType.string(4000),
        description: odbType.string(4000),
      },
    },
    ({ params: { name, action, schedule, description }, body }) => {
      body.call(
        new PlsqlStatement(
          `DBMS_SCHEDULER.CREATE_JOB(job_name => ${name.toSQL()}, job_type => 'STORED_PROCEDURE', job_action => ${action.toSQL()}, start_date => SYSTIMESTAMP, repeat_interval => ${schedule.toSQL()}, enabled => FALSE, auto_drop => FALSE, comments => ${description.toSQL()})`,
        ),
      )
      body.call(
        new PlsqlStatement(
          `DBMS_SCHEDULER.SET_ATTRIBUTE(name => ${name.toSQL()}, attribute => 'logging_level', value => DBMS_SCHEDULER.LOGGING_RUNS)`,
        ),
      )
    },
  )

  const enable = pkg.proc('enable_job', { in: { name: odbType.string(128) } }, ({ params, body }) =>
    body.call(new PlsqlStatement(`DBMS_SCHEDULER.ENABLE(${params.name.toSQL()})`)),
  )
  const disable = pkg.proc(
    'disable_job',
    { in: { name: odbType.string(128) } },
    ({ params, body }) =>
      body.call(
        new PlsqlStatement(`DBMS_SCHEDULER.DISABLE(name => ${params.name.toSQL()}, force => TRUE)`),
      ),
  )
  const run = pkg.proc('run_job', { in: { name: odbType.string(128) } }, ({ params, body }) =>
    body.call(
      new PlsqlStatement(
        `DBMS_SCHEDULER.RUN_JOB(job_name => ${params.name.toSQL()}, use_current_session => FALSE)`,
      ),
    ),
  )
  const stop = pkg.proc('stop_job', { in: { name: odbType.string(128) } }, ({ params, body }) =>
    body.call(new PlsqlStatement(`DBMS_SCHEDULER.STOP_JOB(${params.name.toSQL()})`)),
  )
  const remove = pkg.proc('remove_job', { in: { name: odbType.string(128) } }, ({ params, body }) =>
    body.call(new PlsqlStatement(`DBMS_SCHEDULER.DROP_JOB(${params.name.toSQL()})`)),
  )
  const read = pkg.proc(
    'read_job',
    {
      in: { name: odbType.string(128) },
      out: { enabled: odbType.string(5), state: odbType.string(30) },
    },
    ({ params: { name, enabled, state }, body }) => {
      body.query(
        odbQuery()
          .selectFrom(ownedJobs)
          .select([ownedJobs.enabled, ownedJobs.state])
          .into(enabled, state)
          .where(cond.eq(ownedJobs.jobName, name)),
      )
      body.when('NO_DATA_FOUND', (missing) => missing.notFound('SCHEDULER_JOB_NOT_FOUND'))
    },
  )
  return { create, enable, disable, run, stop, remove, read }
})

/** Installable wrapper for schema-owned Oracle Scheduler jobs. */
export const odbScheduler = {
  toSQLUp: (options: { schema?: string } = {}) => schedulerPackage.toSQLUp(options),
  toSQLDown: (options: { schema?: string } = {}) => schedulerPackage.toSQLDown(options),
  create: schedulerPackage.create,
  enable: schedulerPackage.enable,
  disable: schedulerPackage.disable,
  run: schedulerPackage.run,
  stop: schedulerPackage.stop,
  remove: schedulerPackage.remove,
  read: schedulerPackage.read,
  seed: seedJob,
}
