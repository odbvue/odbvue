# Scheduler

`odbScheduler` installs the `odb_scheduler` package for schema-owned Oracle
Scheduler jobs. Bootstrap grants `CREATE JOB`, `EXECUTE ON SYS.DBMS_SCHEDULER`
and `MANAGE SCHEDULER` directly to the application schema. The last privilege
also permits managing Scheduler windows and job classes and is not needed for
ordinary jobs; remove it from your deployment if those privileges are unwanted.

```ts
import { defineMigration, odbScheduler } from '@odbvue/odb'

export const migration = defineMigration('scheduler', { schema: 'APP' }).install(odbScheduler)
```

For a job managed by a migration, install it after the package containing its
target procedure:

```ts
export const migration = defineMigration('reports', { schema: 'APP' })
  .install(reportsPackage)
  .install(
    odbScheduler.seed({
      name: 'REPORT_JOB',
      action: 'REPORTS.REFRESH',
      schedule: 'FREQ=DAILY;BYHOUR=2;BYMINUTE=0;BYSECOND=0',
      description: 'Refresh reports',
    }),
  )
```

`seed` creates the job disabled and removes it on rollback, even if it is
running. It accepts ordinary unquoted identifiers and a procedure or
package-procedure in the migration schema. The migration executor needs access
to `DBA_SCHEDULER_JOBS` and permission to drop the schema-owned job.

Use the typed calls in an ODB package body. `create(name, action, schedule,
description)` creates a disabled, persistent `STORED_PROCEDURE` job without
arguments, using Oracle calendaring syntax. `enable`, `disable`, `run`, `stop`
and `remove` take the exact job name. `run` submits asynchronously; `disable`
prevents future runs but allows a running instance to finish. `stop` interrupts
an active run separately. Scheduler operations can commit independently of
application transactions; do not treat them as rollback-safe.

For example, inside an ODB procedure body:

```ts
body.call(
  odbScheduler.create(
    odbLiteral('REPORT_JOB'),
    odbLiteral('REPORTS.REFRESH'),
    odbLiteral('FREQ=DAILY;BYHOUR=2;BYMINUTE=0;BYSECOND=0'),
    odbLiteral('Refresh reports'),
  ),
)
body.call(odbScheduler.enable(odbLiteral('REPORT_JOB')))
```

The target procedure must already exist and be accessible to the job owner.
Creation and logging configuration are separate Scheduler operations: if the
latter fails, the disabled job may remain and must be inspected or removed
before retrying.

Jobs created by this capability record runs (`LOGGING_RUNS`), subject to Oracle
Scheduler log retention and database configuration. The admin jobs and history
pages show schema-owned jobs and their run details. Open **Jobs** from the admin
landing page to access them. Admin actions accept ordinary
unquoted uppercase Oracle identifiers only; no SQL actions are accepted from
the browser. Open **Scheduler** from the sandbox capability catalog to start or
stop the demo job. The page shows its enabled status and a cursor-paged list of
its audit events. Use Refresh to load the latest status and events; successful
Start/Stop actions also refresh them. It is installed disabled and writes an
audit entry each minute when enabled. Its down migration removes the job.

The database must have Scheduler enabled and sufficient job worker capacity.
Review privileges and log retention for your deployment. Existing installations
require an appropriate migration; editing bootstrap alone does not update them.
See [Oracle DBMS_SCHEDULER](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_SCHEDULER.html).
