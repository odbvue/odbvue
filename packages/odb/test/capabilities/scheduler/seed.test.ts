import { describe, expect, it } from 'vitest'
import { odbScheduler } from '../../../src/capabilities/scheduler/index.js'

describe('scheduler migration seed', () => {
  it('creates a schema-qualified disabled job and removes it only when present', () => {
    const seed = odbScheduler.seed({
      name: 'demo_job',
      action: 'demo_pkg.tick',
      schedule: 'FREQ=MINUTELY;INTERVAL=1',
      description: "Owner's demo",
    })
    const up = seed.toSQLUp({ schema: 'app' })
    expect(up).toContain(
      "APP.odb_scheduler.seed_job('DEMO_JOB', 'APP.DEMO_PKG.TICK', 'FREQ=MINUTELY;INTERVAL=1', 'Owner''s demo')",
    )
    const down = seed.toSQLDown({ schema: 'app' })
    expect(down).toContain("APP.odb_scheduler.remove_seeded_job('DEMO_JOB')")
    expect(up).not.toContain('SELECT')
    expect(down).not.toContain('SELECT')
    const sql = odbScheduler.toSQLUp({ schema: 'APP' })
    const start = sql.indexOf('PROCEDURE remove_seeded_job', sql.indexOf('PACKAGE BODY'))
    const removal = sql.slice(start, sql.indexOf('END remove_seeded_job;', start))
    expect(removal).toContain('FROM user_scheduler_jobs WHERE job_name = p_name')
    expect(removal).toContain('IF l_count > 0 THEN')
    expect(removal).toContain('DBMS_SCHEDULER.DROP_JOB(p_name, TRUE)')
    expect(sql).not.toContain('dba_scheduler_jobs')
    expect(sql).not.toContain('owner =')
  })

  it('rejects missing schemas and invalid identifiers rather than emitting unsafe SQL', () => {
    const job = {
      name: 'JOB',
      action: 'PKG.TICK',
      schedule: 'FREQ=DAILY',
      description: 'Demo',
    }
    const seed = odbScheduler.seed(job)
    expect(() => seed.toSQLUp()).toThrow('schema is required')
    expect(() => seed.toSQLDown({ schema: 'APP; DROP USER X' })).toThrow('invalid schema')
    expect(() => odbScheduler.seed({ ...job, name: 'JOB,OTHER' })).toThrow('invalid job name')
    expect(() => odbScheduler.seed({ ...job, action: 'OTHER.PKG.TICK' })).toThrow(
      'action must be a procedure or package procedure',
    )
    expect(() => odbScheduler.seed({ ...job, schedule: ' ' })).toThrow('schedule is required')
  })

  it('validates existing definitions before repairing run logging without recreating or resetting enabled state', () => {
    const packageSql = odbScheduler.toSQLUp({ schema: 'APP' })
    const start = packageSql.indexOf('PROCEDURE seed_job', packageSql.indexOf('PACKAGE BODY'))
    const sql = packageSql.slice(start, packageSql.indexOf('END seed_job;', start))
    expect(sql).toContain('FROM user_scheduler_jobs WHERE job_name = p_name')
    expect(sql).toContain('IF l_count = 0 THEN')
    expect(sql).toContain('ELSE')
    expect(sql).toContain("job_type = 'STORED_PROCEDURE'")
    expect(sql).toContain('job_action = p_action')
    expect(sql).toContain('number_of_arguments = 0')
    expect(sql).toContain('program_name IS NULL')
    expect(sql).toContain('schedule_name IS NULL')
    expect(sql).toContain('repeat_interval = p_schedule')
    expect(sql).toContain('comments = p_description')
    expect(sql).toContain('(comments IS NULL AND p_description IS NULL)')
    expect(sql).toContain("auto_drop = 'FALSE'")
    expect(sql).toContain('SCHEDULER_JOB_DRIFT')
    expect(sql).toContain("l_logging_level != 'RUNS' AND l_logging_level != 'FULL'")
    expect(sql.indexOf('SCHEDULER_JOB_DRIFT')).toBeLessThan(
      sql.indexOf('DBMS_SCHEDULER.SET_ATTRIBUTE'),
    )
    expect(sql).not.toContain('.enable_job')
    expect(sql).not.toContain('.disable_job')
    expect(sql).not.toContain('DROP_JOB')
    expect(sql.match(/create_job\(/g)).toHaveLength(1)
  })
})
