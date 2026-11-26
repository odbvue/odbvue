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
    expect(seed.toSQLUp({ schema: 'app' })).toContain(
      "APP.odb_scheduler.create_job('APP.DEMO_JOB', 'APP.DEMO_PKG.TICK', 'FREQ=MINUTELY;INTERVAL=1', 'Owner''s demo')",
    )
    const down = seed.toSQLDown({ schema: 'app' })
    expect(down).toContain(
      "FROM dba_scheduler_jobs WHERE (owner = 'APP' AND job_name = 'DEMO_JOB')",
    )
    expect(down).toContain('IF l_count > 0 THEN')
    expect(down).toContain("DBMS_SCHEDULER.DROP_JOB('APP.DEMO_JOB', TRUE)")
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
})
