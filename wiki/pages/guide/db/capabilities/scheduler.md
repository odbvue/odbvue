# Scheduler

`odbScheduler` installs the `odb_scheduler` package for schema-owned Oracle
Scheduler jobs. Bootstrap grants only `CREATE JOB` and
`EXECUTE ON SYS.DBMS_SCHEDULER` for this capability. `MANAGE SCHEDULER` and
`CREATE ANY JOB` are not granted. The explicit package execution grant is kept
so compilation does not depend on role-based access or a deployment retaining
public execution grants. It does not authorize creating jobs in other schemas.

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

`seed` creates a missing job disabled and removes it on rollback, even if it is
running. On retry it validates an existing job's type, action, arguments,
schedule, description, auto-drop setting, style, class, and end date. A mismatch
raises `SCHEDULER_JOB_DRIFT` without replacing the job. A matching job keeps its
enabled state and start date; missing run logging is repaired, while `RUNS` or
`FULL` logging is preserved. It accepts ordinary unquoted identifiers and a procedure or
package-procedure in the migration schema. Seed and rollback lookups use
`USER_SCHEDULER_JOBS` inside the schema-owned, definer-rights `odb_scheduler`
package, so they inspect the application schema even when migrations run as
ADMIN. The migration executor needs permission to execute that package, not
access to DBA Scheduler views. Keep the capability installed until seeded jobs
have been removed on rollback.

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
latter fails, the disabled job may remain. Retry `seed` to validate the definition
and finish configuring logging. Direct `create` calls still reject existing jobs.

## Admin action audit policy

Scheduler actions and audit writes cannot be made atomic. Admin enable, disable,
and run endpoints therefore use **best-effort completion auditing**: Scheduler
errors propagate normally; after a successful action, an audit-write failure is
reported as `auditRecorded: 0` rather than a failed mutation. Successful audit
writes return `auditRecorded: 1`. The flag explicitly surfaces the audit failure;
no secondary logging operation is allowed to turn it back into a failed mutation.

The UI warns that the action completed without a confirmed audit record and
refreshes the jobs list. Do not repeat the action to repair auditing, especially
for manual runs. For run requests, completion means asynchronous submission,
not successful execution of the target procedure.

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
