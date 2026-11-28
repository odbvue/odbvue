import {
  authUsers,
  authSessions,
  authRoles,
  authUserRoles,
  auditLogs,
  emails,
  emailsAddr,
  emailsAttc,
  storageFiles,
  cond,
  defineMigration,
  defineService,
  odbEnv,
  odbAuth,
  odbDbmsLob,
  odbOracle,
  odbLiteral,
  odbPackage,
  odbQuery,
  odbSettings,
  odbScheduler,
  odbTable,
  odbType,
  plsqlExpr,
  PlsqlExpression,
  resultField,
  settingsStore,
  type Package,
  type PlsqlValue,
  type ProcedureBody,
} from '@odbvue/odb'

const searchPageInputs = {
  after: odbType.json(),
  limit: odbType.integer(),
  search: odbType.string(256),
}

function timestampRange(
  body: ProcedureBody,
  from: PlsqlValue<'VARCHAR2'>,
  to: PlsqlValue<'VARCHAR2'>,
  errorPrefix: string,
  variablePrefix = 'l',
) {
  const { fromTimestamp, toTimestamp } = body.variables(
    {
      fromTimestamp: odbType.timestamp(),
      toTimestamp: odbType.timestamp(),
    },
    { prefix: variablePrefix },
  )
  body.block((dates) => {
    for (const [value, target] of [
      [from, fromTimestamp],
      [to, toTimestamp],
    ] as const) {
      dates.ifThen(
        cond.and([
          cond.isNotNull(value),
          cond.not(
            cond.regexpLike(
              value,
              '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$',
            ),
          ),
        ]),
        (invalid) => invalid.invalid(`${errorPrefix}_DATE_INVALID`),
      )
      dates.set(
        target,
        plsqlExpr.call(
          'TIMESTAMP',
          'TO_TIMESTAMP',
          value,
          odbLiteral('FXYYYY-MM-DD"T"HH24:MI:SS.FF3"Z"'),
        ),
      )
    }
    dates.whenOthers((invalid) => invalid.invalid(`${errorPrefix}_DATE_INVALID`))
  })
  body.ifThen(cond.gt(fromTimestamp, toTimestamp), (invalid) =>
    invalid.invalid(`${errorPrefix}_INTERVAL_INVALID`),
  )
  return { fromTimestamp, toTimestamp }
}

const findUserId = (id: Parameters<typeof cond.eq>[1]) =>
  odbQuery().selectFrom(authUsers).select(authUsers.id).where(cond.eq(authUsers.id, id))

const userQuery = () =>
  odbQuery()
    .selectFrom(authUsers)
    .select([
      authUsers.id,
      authUsers.username,
      authUsers.displayName,
      authUsers.enabled,
      authUsers.createdAt,
      authUsers.updatedAt,
    ])

const schedulerJobs = odbTable('user_scheduler_jobs', (t) => ({
  jobName: t.string(128).primaryKey(),
  jobSubname: t.string(128),
  enabled: t.string(5),
  state: t.string(30),
  scheduleName: t.string(128),
  repeatInterval: t.string(4000),
  comments: t.string(4000),
}))

const schedulerRuns = odbTable('user_scheduler_job_run_details', (t) => ({
  logId: t.number().primaryKey(),
  jobName: t.string(261),
  status: t.string(30),
  actualStartDate: t.timestamp(),
  runDuration: t.string(128),
  errors: t.string(4000),
  output: t.string(4000),
}))

export const adminPackage: Package<Record<never, never>> = odbPackage('pck_admin', (pkg) => {
  const listEmails = pkg.proc(
    'list_emails',
    {
      in: {
        ...searchPageInputs,
        address: odbType.string(240),
        recipient: odbType.string(240),
        from: odbType.string(24),
        to: odbType.string(24),
        deliveredFrom: odbType.string(24),
        deliveredTo: odbType.string(24),
      },
      out: { items: odbType.resultset() },
    },
    ({
      params: {
        after,
        limit,
        search,
        address,
        recipient,
        from,
        to,
        deliveredFrom,
        deliveredTo,
        items,
      },
      body,
    }) => {
      const { fromTimestamp, toTimestamp } = timestampRange(body, from, to, 'ADMIN_EMAIL')
      const { fromTimestamp: deliveredFromTimestamp, toTimestamp: deliveredToTimestamp } =
        timestampRange(body, deliveredFrom, deliveredTo, 'ADMIN_EMAIL', 'l_delivered')
      const candidate = emailsAddr.as('candidate')
      const recipients = (type: 'To' | 'Cc' | 'Bcc') =>
        new PlsqlExpression(
          'VARCHAR2',
          `(${odbQuery()
            .selectFrom(candidate)
            .select(
              new PlsqlExpression(
                'VARCHAR2',
                `LISTAGG(${candidate.addrAddr.toSQL()}, ', ' ON OVERFLOW TRUNCATE '...' WITH COUNT) WITHIN GROUP (ORDER BY ${candidate.addrAddr.toSQL()})`,
              ),
            )
            .where(
              cond.and([cond.eq(candidate.idEmail, emails.id), cond.eq(candidate.addrType, type)]),
            )
            .toSQL()})`,
        )
      const term = odbOracle.lower(odbOracle.trim(search))
      const addressTerm = odbOracle.lower(odbOracle.trim(address))
      const matchingAddress = odbQuery()
        .selectFrom(candidate)
        .select('1')
        .where(
          cond.and([
            cond.eq(candidate.idEmail, emails.id),
            cond.or(['To', 'Cc', 'Bcc'].map((type) => cond.eq(candidate.addrType, type))),
            cond.gt(odbOracle.instr(odbOracle.lower(candidate.addrAddr), addressTerm), 0),
          ]),
        )
      const matchingRecipient = odbQuery()
        .selectFrom(candidate)
        .select('1')
        .where(
          cond.and([
            cond.eq(candidate.idEmail, emails.id),
            cond.or(['To', 'Cc', 'Bcc'].map((type) => cond.eq(candidate.addrType, type))),
            cond.eq(
              odbOracle.lower(candidate.addrAddr),
              odbOracle.lower(odbOracle.trim(recipient)),
            ),
          ]),
        )
      body.openFor(
        items,
        odbQuery()
          .selectFrom(emails)
          .select([
            emails.id,
            emails.subject,
            emails.status,
            emails.created,
            emails.delivered,
            emails.attempts,
            emails.error,
          ])
          .selectAs(recipients('To'), resultField('toRecipients', 'string'))
          .selectAs(recipients('Cc'), resultField('ccRecipients', 'string'))
          .selectAs(recipients('Bcc'), resultField('bccRecipients', 'string'))
          .where(
            cond.or([
              cond.isNull(term),
              cond.gt(odbOracle.instr(odbOracle.lower(emails.subject), term), 0),
            ]),
          )
          .where({
            toSQL: () => `(${addressTerm.toSQL()} IS NULL OR EXISTS (${matchingAddress.toSQL()}))`,
          })
          .where({
            toSQL: () =>
              `(TRIM(${recipient.toSQL()}) IS NULL OR EXISTS (${matchingRecipient.toSQL()}))`,
          })
          .where(cond.or([cond.isNull(fromTimestamp), cond.gte(emails.created, fromTimestamp)]))
          .where(cond.or([cond.isNull(toTimestamp), cond.lte(emails.created, toTimestamp)]))
          .where(
            cond.or([
              cond.isNull(deliveredFromTimestamp),
              cond.gte(emails.delivered, deliveredFromTimestamp),
            ]),
          )
          .where(
            cond.or([
              cond.isNull(deliveredToTimestamp),
              cond.lte(emails.delivered, deliveredToTimestamp),
            ]),
          )
          .orderBy(emails.created, 'desc')
          .orderBy(emails.id, 'desc')
          .paginate({ cursor: after, limit }),
      )
    },
  )
  defineService(listEmails, {
    auth: { roles: ['admin'] },
    module: 'admin',
    basePath: '/admin',
    method: 'GET',
    path: '/emails',
    summary: 'List email history filtered by subject, recipient address and timestamp intervals',
    query: {
      cursor: listEmails.parameters.after,
      limit: listEmails.parameters.limit,
      search: listEmails.parameters.search,
      address: listEmails.parameters.address,
      recipient: listEmails.parameters.recipient,
      from: listEmails.parameters.from,
      to: listEmails.parameters.to,
      deliveredFrom: listEmails.parameters.deliveredFrom,
      deliveredTo: listEmails.parameters.deliveredTo,
    },
    response: { items: listEmails.parameters.items },
  })

  const getEmail = pkg.proc(
    'get_email',
    {
      in: { id: odbType.guid() },
      out: {
        emailId: odbType.guid(),
        subject: odbType.string(240),
        priority: odbType.number(),
        status: odbType.string(1),
        created: odbType.string(32),
        delivered: { ...odbType.string(32), nullable: true },
        attempts: odbType.number(),
        postponed: { ...odbType.string(32), nullable: true },
        error: { ...odbType.string(2000), nullable: true },
        bodyLength: odbType.number(),
        addresses: odbType.resultset(),
        attachments: odbType.resultset(),
      },
    },
    ({
      params: {
        id,
        emailId,
        subject,
        priority,
        status,
        created,
        delivered,
        attempts,
        postponed,
        error,
        bodyLength,
        addresses,
        attachments,
      },
      body,
    }) => {
      const utcTimestamp = (column: { toSQL(): string }) =>
        new PlsqlExpression(
          'VARCHAR2',
          `TO_CHAR(${column.toSQL()}, 'YYYY-MM-DD"T"HH24:MI:SS.FF6"Z"')`,
        )
      body.query(
        odbQuery()
          .selectFrom(emails)
          .select([
            emails.id,
            emails.subject,
            emails.priority,
            emails.status,
            utcTimestamp(emails.created),
            utcTimestamp(emails.delivered),
            emails.attempts,
            utcTimestamp(emails.postponed),
            emails.error,
            odbDbmsLob.getLength(emails.content),
          ])
          .into(
            emailId,
            subject,
            priority,
            status,
            created,
            delivered,
            attempts,
            postponed,
            error,
            bodyLength,
          )
          .where(cond.eq(emails.id, id)),
      )
      body.openFor(
        addresses,
        odbQuery()
          .selectFrom(emailsAddr)
          .select([emailsAddr.addrType, emailsAddr.addrAddr, emailsAddr.addrName])
          .where(cond.eq(emailsAddr.idEmail, id))
          .orderBy(emailsAddr.addrType)
          .orderBy(emailsAddr.addrAddr),
      )
      const attachment = emailsAttc.as('a')
      const file = storageFiles.as('s')
      body.openFor(
        attachments,
        odbQuery()
          .selectFrom(attachment)
          .join(file, cond.eq(file.id, attachment.idStorage))
          .selectAs(file.fileName, file.fileName)
          .selectAs(file.fileSize, file.fileSize)
          .where(cond.eq(attachment.idEmail, id))
          .orderBy(attachment.idStorage),
      )
      body.when('NO_DATA_FOUND', (missing) => missing.notFound('ADMIN_EMAIL_NOT_FOUND'))
    },
  )
  defineService(getEmail, {
    auth: { roles: ['admin'] },
    module: 'admin',
    basePath: '/admin',
    method: 'GET',
    path: '/emails/:id',
    summary: 'Read email delivery metadata, addresses and attachment details',
    uri: { id: getEmail.parameters.id },
    response: {
      id: getEmail.parameters.emailId,
      subject: getEmail.parameters.subject,
      priority: getEmail.parameters.priority,
      status: getEmail.parameters.status,
      created: getEmail.parameters.created,
      delivered: getEmail.parameters.delivered,
      attempts: getEmail.parameters.attempts,
      postponed: getEmail.parameters.postponed,
      error: getEmail.parameters.error,
      bodyLength: getEmail.parameters.bodyLength,
      addresses: getEmail.parameters.addresses,
      attachments: getEmail.parameters.attachments,
    },
  })

  const listUsers = pkg.proc(
    'list_users',
    {
      in: {
        after: odbType.json(),
        limit: odbType.integer(),
        search: odbType.string(256),
      },
      out: { items: odbType.resultset() },
    },
    ({ params: { after, limit, search, items }, body }) => {
      const term = odbOracle.lower(odbOracle.trim(search))
      body.openFor(
        items,
        userQuery()
          .where(
            cond.or([
              cond.isNull(term),
              cond.gt(odbOracle.instr(odbOracle.lower(authUsers.username), term), 0),
              cond.gt(odbOracle.instr(odbOracle.lower(authUsers.displayName), term), 0),
            ]),
          )
          .orderBy(authUsers.id)
          .paginate({ cursor: after, limit }),
      )
    },
  )
  defineService(listUsers, {
    auth: { roles: ['admin'] },
    module: 'admin',
    basePath: '/admin',
    method: 'GET',
    path: '/users',
    summary: 'List users with case-insensitive username or display name search',
    query: {
      cursor: listUsers.parameters.after,
      limit: listUsers.parameters.limit,
      search: listUsers.parameters.search,
    },
    response: { items: listUsers.parameters.items },
  })

  const getUser = pkg.proc(
    'get_user',
    {
      in: { id: odbType.guid() },
      out: { items: odbType.resultset() },
    },
    ({ params: { id, items }, body }) => {
      const { foundId } = body.variables({ foundId: odbType.guid() })
      body.query(
        odbQuery()
          .selectFrom(authUsers)
          .select(authUsers.id)
          .into(foundId)
          .where(cond.eq(authUsers.id, id)),
      )
      body.openFor(items, userQuery().where(cond.eq(authUsers.id, id)))
      body.when('NO_DATA_FOUND', (missing) => missing.notFound('ADMIN_USER_NOT_FOUND'))
    },
  )
  defineService(getUser, {
    auth: { roles: ['admin'] },
    module: 'admin',
    basePath: '/admin',
    method: 'GET',
    path: '/users/:id',
    summary: 'Read one user without credentials or authentication secrets',
    uri: { id: getUser.parameters.id },
    response: { items: getUser.parameters.items },
  })

  const setUserEnabled = pkg.proc(
    'set_user_enabled',
    {
      in: { id: odbType.guid(), actorId: odbType.guid(), enabled: odbType.boolean() },
      out: { items: odbType.resultset() },
    },
    ({ params: { id, actorId, enabled, items }, body }) => {
      const { currentEnabled, requestedEnabled } = body.variables({
        currentEnabled: authUsers.enabled,
        requestedEnabled: odbType.number(),
      })
      body.ifThen(cond.isNull(enabled), (invalid) => invalid.invalid('ADMIN_USER_STATUS_INVALID'))
      body.ifThen(cond.and([cond.eq(id, actorId), cond.eq(enabled, false)]), (forbidden) =>
        forbidden.forbidden('ADMIN_SELF_DISABLE_FORBIDDEN'),
      )
      body.ifThen(
        cond.eq(enabled, true),
        (enable) => enable.set(requestedEnabled, 1),
        (disable) => disable.set(requestedEnabled, 0),
      )
      body.query(
        odbQuery()
          .selectFrom(authUsers)
          .select(authUsers.enabled)
          .into(currentEnabled)
          .where(cond.eq(authUsers.id, id))
          .forUpdate(),
      )
      body.ifThen(cond.ne(currentEnabled, requestedEnabled), (changed) => {
        changed.query(
          odbQuery()
            .updateTable(authUsers)
            .set({ enabled: requestedEnabled, updatedAt: odbOracle.utcNow() })
            .where(cond.eq(authUsers.id, id)),
        )
        changed.ifThen(cond.eq(enabled, false), (disabled) => {
          disabled.query(
            odbQuery()
              .updateTable(authUsers)
              .set({ tokenVersion: plsqlExpr.add(authUsers.tokenVersion, 1) })
              .where(cond.eq(authUsers.id, id)),
          )
          disabled.query(
            odbQuery()
              .updateTable(authSessions)
              .set({ revokedAt: odbOracle.utcNow() })
              .where(
                cond.and([cond.eq(authSessions.userId, id), cond.isNull(authSessions.revokedAt)]),
              ),
          )
        })
        changed.auditEvent('User account status changed', {
          'user.id': actorId,
          'target.user.id': id,
          'event.name': odbLiteral('admin.user.status'),
          enabled: requestedEnabled,
        })
      })
      body.openFor(items, userQuery().where(cond.eq(authUsers.id, id)))
      body.when('NO_DATA_FOUND', (missing) => missing.notFound('ADMIN_USER_NOT_FOUND'))
    },
  )
  defineService(setUserEnabled, {
    auth: { roles: ['admin'] },
    module: 'admin',
    basePath: '/admin',
    method: 'PUT',
    path: '/users/:id/status',
    summary: 'Enable or disable a user; disabling revokes sessions and cannot target yourself',
    uri: { id: setUserEnabled.parameters.id },
    context: { userId: setUserEnabled.parameters.actorId },
    body: { enabled: setUserEnabled.parameters.enabled },
    response: { items: setUserEnabled.parameters.items },
  })

  const listRoles = pkg.proc(
    'list_roles',
    {
      in: searchPageInputs,
      out: { items: odbType.resultset() },
    },
    ({ params: { after, limit, search, items }, body }) => {
      const term = odbOracle.lower(odbOracle.trim(search))
      body.openFor(
        items,
        odbQuery()
          .selectFrom(authRoles)
          .select([authRoles.role, authRoles.description])
          .where(
            cond.or([
              cond.isNull(term),
              cond.gt(odbOracle.instr(odbOracle.lower(authRoles.role), term), 0),
              cond.gt(odbOracle.instr(odbOracle.lower(authRoles.description), term), 0),
            ]),
          )
          .orderBy(authRoles.role)
          .paginate({ cursor: after, limit }),
      )
    },
  )
  defineService(listRoles, {
    auth: { roles: ['admin'] },
    module: 'admin',
    basePath: '/admin',
    method: 'GET',
    path: '/roles',
    summary: 'List roles with case-insensitive role name or description search',
    query: {
      cursor: listRoles.parameters.after,
      limit: listRoles.parameters.limit,
      search: listRoles.parameters.search,
    },
    response: { items: listRoles.parameters.items },
  })

  const listUserRoles = pkg.proc(
    'list_user_roles',
    { in: { id: odbType.guid(), ...searchPageInputs }, out: { items: odbType.resultset() } },
    ({ params: { id, after, limit, search, items }, body }) => {
      const { foundId } = body.variables({ foundId: authUsers.id })
      body.query(findUserId(id).into(foundId))
      const term = odbOracle.lower(odbOracle.trim(search))
      body.openFor(
        items,
        odbQuery()
          .selectFrom(authUserRoles)
          .select([
            authUserRoles.userId,
            authUserRoles.role,
            authUserRoles.validFrom,
            authUserRoles.validTo,
          ])
          .where(
            cond.and([
              cond.eq(authUserRoles.userId, id),
              cond.or([
                cond.isNull(term),
                cond.gt(odbOracle.instr(odbOracle.lower(authUserRoles.role), term), 0),
              ]),
            ]),
          )
          .orderBy(authUserRoles.userId)
          .orderBy(authUserRoles.role)
          .paginate({ cursor: after, limit }),
      )
      body.when('NO_DATA_FOUND', (missing) => missing.notFound('ADMIN_USER_NOT_FOUND'))
    },
  )
  defineService(listUserRoles, {
    auth: { roles: ['admin'] },
    module: 'admin',
    basePath: '/admin',
    method: 'GET',
    path: '/users/:id/roles',
    summary: 'List a user’s role assignments and their validity dates',
    uri: { id: listUserRoles.parameters.id },
    query: {
      cursor: listUserRoles.parameters.after,
      limit: listUserRoles.parameters.limit,
      search: listUserRoles.parameters.search,
    },
    response: { items: listUserRoles.parameters.items },
  })

  const listAvailableUserRoles = pkg.proc(
    'list_available_user_roles',
    { in: { id: odbType.guid(), ...searchPageInputs }, out: { items: odbType.resultset() } },
    ({ params: { id, after, limit, search, items }, body }) => {
      const { foundId } = body.variables({ foundId: authUsers.id })
      body.query(findUserId(id).into(foundId))
      const term = odbOracle.lower(odbOracle.trim(search))
      const grants = authUserRoles.as('ur')
      const catalogRole = { toSQL: () => `${authRoles.name}.${authRoles.role.name}` }
      const existing = odbQuery()
        .selectFrom(grants)
        .select('1')
        .where(cond.and([cond.eq(grants.userId, id), cond.eq(grants.role, catalogRole)]))
      body.openFor(
        items,
        odbQuery()
          .selectFrom(authRoles)
          .select([authRoles.role, authRoles.description])
          .where({ toSQL: () => `NOT EXISTS (${existing.toSQL()})` })
          .where(
            cond.or([
              cond.isNull(term),
              cond.gt(odbOracle.instr(odbOracle.lower(authRoles.role), term), 0),
              cond.gt(odbOracle.instr(odbOracle.lower(authRoles.description), term), 0),
            ]),
          )
          .orderBy(authRoles.role)
          .paginate({ cursor: after, limit }),
      )
      body.when('NO_DATA_FOUND', (missing) => missing.notFound('ADMIN_USER_NOT_FOUND'))
    },
  )
  defineService(listAvailableUserRoles, {
    auth: { roles: ['admin'] },
    module: 'admin',
    basePath: '/admin',
    method: 'GET',
    path: '/users/:id/roles/available',
    summary: 'Search for roles not already assigned to this user',
    uri: { id: listAvailableUserRoles.parameters.id },
    query: {
      cursor: listAvailableUserRoles.parameters.after,
      limit: listAvailableUserRoles.parameters.limit,
      search: listAvailableUserRoles.parameters.search,
    },
    response: { items: listAvailableUserRoles.parameters.items },
  })

  const setUserRole = pkg.proc(
    'set_user_role',
    {
      in: {
        id: odbType.guid(),
        actorId: odbType.guid(),
        role: authRoles.role,
        assigned: odbType.boolean(),
      },
    },
    ({ params: { id, actorId, role, assigned }, body }) => {
      const { foundId, roleCount } = body.variables({
        foundId: authUsers.id,
        roleCount: odbType.integer(),
      })
      body.ifThen(cond.or([cond.isNull(odbOracle.trim(role)), cond.isNull(assigned)]), (invalid) =>
        invalid.invalid('ADMIN_USER_ROLE_INVALID'),
      )
      body.ifThen(
        cond.and([cond.eq(id, actorId), cond.eq(role, 'admin'), cond.eq(assigned, false)]),
        (forbidden) => forbidden.forbidden('ADMIN_SELF_ROLE_REMOVAL_FORBIDDEN'),
      )
      body.query(findUserId(id).into(foundId).forUpdate())
      body.ifThen(
        cond.eq(assigned, true),
        (add) => {
          add.query(
            odbQuery()
              .selectFrom(authRoles)
              .select('COUNT(*)')
              .into(roleCount)
              .where(cond.eq(authRoles.role, role)),
          )
          add.ifThen(cond.eq(roleCount, 0), (missing) => missing.notFound('ADMIN_ROLE_NOT_FOUND'))
          add.query(
            odbQuery()
              .mergeInto(authUserRoles.as('target'))
              .using({ userId: id, role }, 'source')
              .on((target, source) =>
                cond.and([
                  cond.eq(target.userId, source.userId),
                  cond.eq(target.role, source.role),
                ]),
              )
              .whenNotMatched({ userId: id, role }),
          )
        },
        (remove) => remove.call(odbAuth.role.revoke(id, role)),
      )
      const attributes = {
        'user.id': actorId,
        'target.user.id': id,
        'event.name': odbLiteral('admin.user.role'),
        'event.outcome': odbLiteral('success'),
        role,
      }
      body.ifThen(
        cond.eq(assigned, true),
        (added) => added.auditEvent('User role assigned', attributes),
        (removed) => removed.auditEvent('User role removed', attributes),
      )
      body.when('NO_DATA_FOUND', (missing) => missing.notFound('ADMIN_USER_NOT_FOUND'))
    },
  )
  defineService(setUserRole, {
    auth: { roles: ['admin'] },
    module: 'admin',
    basePath: '/admin',
    method: 'PUT',
    path: '/users/:id/roles',
    summary: 'Add or remove a role assignment without changing existing validity dates',
    uri: { id: setUserRole.parameters.id },
    context: { userId: setUserRole.parameters.actorId },
    body: { role: setUserRole.parameters.role, assigned: setUserRole.parameters.assigned },
    responseStatus: 204,
  })

  const listSettings = pkg.proc(
    'list_settings',
    { in: searchPageInputs, out: { items: odbType.resultset() } },
    ({ params: { after, limit, search, items }, body }) => {
      const term = odbOracle.lower(odbOracle.trim(search))
      body.openFor(
        items,
        odbQuery()
          .selectFrom(settingsStore)
          .select([
            settingsStore.id,
            settingsStore.secret,
            settingsStore.readonly,
            settingsStore.meta,
          ])
          .selectAs(
            odbOracle.caseWhen(
              cond.eq(settingsStore.secret, 'N'),
              settingsStore.value,
              odbOracle.toClob('NULL'),
              'CLOB',
            ),
            settingsStore.value,
          )
          .where(
            cond.or([
              cond.isNull(term),
              cond.gt(odbOracle.instr(odbOracle.lower(settingsStore.id), term), 0),
            ]),
          )
          .orderBy(settingsStore.id)
          .paginate({ cursor: after, limit }),
      )
    },
  )
  defineService(listSettings, {
    auth: { roles: ['admin'] },
    module: 'admin',
    basePath: '/admin',
    method: 'GET',
    path: '/settings',
    summary: 'List settings by ID with JSON metadata without returning secret values',
    query: {
      cursor: listSettings.parameters.after,
      limit: listSettings.parameters.limit,
      search: listSettings.parameters.search,
    },
    response: { items: listSettings.parameters.items },
  })

  const updateSetting = pkg.proc(
    'update_setting',
    { in: { id: odbSettings.types.id, value: odbSettings.types.value, actorId: odbType.guid() } },
    ({ params: { id, value, actorId }, body }) => {
      body.call(odbSettings.updateValue(id, value))
      body.auditEvent('Application setting updated', {
        'user.id': actorId,
        'event.name': odbLiteral('admin.setting.update'),
        'setting.id': id,
      })
    },
  )
  defineService(updateSetting, {
    auth: { roles: ['admin'] },
    module: 'admin',
    basePath: '/admin',
    method: 'PUT',
    path: '/settings/:id',
    summary: 'Update an existing setting without returning its value',
    uri: { id: updateSetting.parameters.id },
    context: { userId: updateSetting.parameters.actorId },
    body: { value: updateSetting.parameters.value },
    responseStatus: 204,
  })

  const listUserAudit = pkg.proc(
    'list_user_audit',
    {
      in: {
        id: odbType.guid(),
        ...searchPageInputs,
        severity: odbType.string(64),
        from: odbType.string(24),
        to: odbType.string(24),
        messageType: odbType.string(255),
      },
      out: { items: odbType.resultset() },
    },
    ({ params: { id, after, limit, search, severity, from, to, messageType, items }, body }) => {
      const { foundId, fromTimestamp, toTimestamp } = body.variables({
        foundId: authUsers.id,
        fromTimestamp: odbType.timestamp(),
        toTimestamp: odbType.timestamp(),
      })
      body.query(findUserId(id).into(foundId))
      body.ifThen(
        cond.and([
          cond.isNotNull(severity),
          cond.not(cond.regexpLike(severity, '^(ERROR|WARN|INFO)(,(ERROR|WARN|INFO))*$')),
        ]),
        (invalid) => invalid.invalid('ADMIN_AUDIT_SEVERITY_INVALID'),
      )
      body.block((dates) => {
        for (const [value, target] of [
          [from, fromTimestamp],
          [to, toTimestamp],
        ] as const) {
          dates.ifThen(
            cond.and([
              cond.isNotNull(value),
              cond.not(
                cond.regexpLike(
                  value,
                  '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$',
                ),
              ),
            ]),
            (invalid) => invalid.invalid('ADMIN_AUDIT_DATE_INVALID'),
          )
          dates.set(
            target,
            plsqlExpr.call(
              'TIMESTAMP',
              'TO_TIMESTAMP',
              value,
              odbLiteral('FXYYYY-MM-DD"T"HH24:MI:SS.FF3"Z"'),
            ),
          )
        }
        dates.whenOthers((invalid) => invalid.invalid('ADMIN_AUDIT_DATE_INVALID'))
      })
      body.ifThen(cond.gt(fromTimestamp, toTimestamp), (invalid) =>
        invalid.invalid('ADMIN_AUDIT_INTERVAL_INVALID'),
      )
      const term = odbOracle.lower(odbOracle.trim(search))
      const type = odbOracle.lower(odbOracle.trim(messageType))
      body.openFor(
        items,
        odbQuery()
          .selectFrom(auditLogs)
          .select([
            auditLogs.id,
            auditLogs.observedTimestamp,
            auditLogs.eventTimestamp,
            auditLogs.severityText,
            auditLogs.eventName,
            auditLogs.body,
            auditLogs.userId,
            auditLogs.targetUserId,
            auditLogs.attributes,
          ])
          .where(
            cond.and([
              cond.or([cond.eq(auditLogs.userId, id), cond.eq(auditLogs.targetUserId, id)]),
              cond.or([
                cond.isNull(severity),
                cond.gt(
                  odbOracle.instr(
                    plsqlExpr.concat(',', severity, ','),
                    plsqlExpr.concat(',', auditLogs.severityText, ','),
                  ),
                  0,
                ),
              ]),
              cond.or([
                cond.isNull(fromTimestamp),
                cond.gte(auditLogs.eventTimestamp, fromTimestamp),
              ]),
              cond.or([cond.isNull(toTimestamp), cond.lte(auditLogs.eventTimestamp, toTimestamp)]),
              cond.or([
                cond.isNull(type),
                cond.gt(odbOracle.instr(odbOracle.lower(auditLogs.eventName), type), 0),
              ]),
              cond.or([
                cond.isNull(term),
                cond.gt(odbOracle.instr(odbOracle.lower(auditLogs.body), term), 0),
              ]),
            ]),
          )
          .orderBy(auditLogs.observedTimestamp, 'desc')
          .orderBy(auditLogs.id, 'desc')
          .paginate({ cursor: after, limit }),
      )
      body.when('NO_DATA_FOUND', (missing) => missing.notFound('ADMIN_USER_NOT_FOUND'))
    },
  )
  defineService(listUserAudit, {
    auth: { roles: ['admin'] },
    module: 'admin',
    basePath: '/admin',
    method: 'GET',
    path: '/users/:id/audit',
    summary: 'List activity by or affecting a user, filtered before cursor pagination',
    uri: { id: listUserAudit.parameters.id },
    query: {
      cursor: listUserAudit.parameters.after,
      limit: listUserAudit.parameters.limit,
      search: listUserAudit.parameters.search,
      severity: listUserAudit.parameters.severity,
      from: listUserAudit.parameters.from,
      to: listUserAudit.parameters.to,
      messageType: listUserAudit.parameters.messageType,
    },
    response: { items: listUserAudit.parameters.items },
  })

  // Describe the inline query's row shape for typed keyset pagination.
  const auditEvents = odbTable('audit_events', (t) => ({
    id: t.guid().primaryKey(),
    observedTimestamp: t.timestamp().notNull(),
    eventTimestamp: t.timestamp().notNull(),
    severityText: t.string(30).notNull(),
    eventName: t.string(255),
    body: t.string(2000).notNull(),
    userId: t.string(255),
    targetUserId: t.string(255),
    attributes: t.json(),
    username: t.string(128),
    displayName: t.string(256),
  }))

  function auditEventsQuery() {
    const logs = auditLogs.as('logs')
    const actor = authUsers.as('actor')
    const target = authUsers.as('target')
    const hasActor = cond.isNotNull(actor.id)
    return odbQuery()
      .selectFrom(logs)
      .leftJoin(actor, cond.eq(actor.id, logs.userId))
      .leftJoin(target, cond.eq(target.id, logs.targetUserId))
      .select([
        logs.id,
        logs.observedTimestamp,
        logs.eventTimestamp,
        logs.severityText,
        logs.eventName,
        logs.body,
        logs.userId,
        logs.targetUserId,
        logs.attributes,
      ])
      .selectAs(
        odbOracle.caseWhen(hasActor, actor.username, target.username, 'VARCHAR2'),
        actor.username,
      )
      .selectAs(
        odbOracle.caseWhen(hasActor, actor.displayName, target.displayName, 'VARCHAR2'),
        actor.displayName,
      )
  }

  const listAudit = pkg.proc(
    'list_audit',
    {
      in: {
        after: odbType.json(),
        limit: odbType.integer(),
        search: odbType.string(256),
        severity: odbType.string(64),
        from: odbType.string(24),
        to: odbType.string(24),
        messageType: odbType.string(255),
        userId: odbType.guid(),
      },
      out: { items: odbType.resultset() },
    },
    ({
      params: { after, limit, userId, severity, from, to, messageType, search, items },
      body,
    }) => {
      body.ifThen(
        cond.and([
          cond.isNotNull(severity),
          cond.not(cond.regexpLike(severity, '^(ERROR|WARN|INFO)(,(ERROR|WARN|INFO))*$')),
        ]),
        (invalid) => invalid.invalid('ADMIN_AUDIT_SEVERITY_INVALID'),
      )
      const { fromTimestamp, toTimestamp } = timestampRange(body, from, to, 'ADMIN_AUDIT')
      const term = odbOracle.lower(odbOracle.trim(search))
      const type = odbOracle.lower(odbOracle.trim(messageType))
      const page = odbQuery()
        .selectFromSubquery(auditEvents, auditEventsQuery())
        .where(
          cond.and([
            cond.or([
              cond.isNull(userId),
              cond.eq(auditEvents.userId, userId),
              cond.eq(auditEvents.targetUserId, userId),
            ]),
            cond.or([
              cond.isNull(severity),
              cond.gt(
                odbOracle.instr(
                  plsqlExpr.concat(',', severity, ','),
                  plsqlExpr.concat(',', auditEvents.severityText, ','),
                ),
                0,
              ),
            ]),
            cond.or([
              cond.isNull(fromTimestamp),
              cond.gte(auditEvents.eventTimestamp, fromTimestamp),
            ]),
            cond.or([cond.isNull(toTimestamp), cond.lte(auditEvents.eventTimestamp, toTimestamp)]),
            cond.or([
              cond.isNull(type),
              cond.gt(odbOracle.instr(odbOracle.lower(auditEvents.eventName), type), 0),
            ]),
            cond.or([
              cond.isNull(term),
              cond.gt(odbOracle.instr(odbOracle.lower(auditEvents.body), term), 0),
            ]),
          ]),
        )
        .orderBy(auditEvents.observedTimestamp, 'desc')
        .orderBy(auditEvents.id, 'desc')
        .paginate({ cursor: after, limit })
      body.openFor(items, page)
    },
  )
  defineService(listAudit, {
    auth: { roles: ['admin'] },
    module: 'admin',
    basePath: '/admin',
    method: 'GET',
    path: '/audit/events',
    summary: 'List global audit activity, optionally filtered by actor or affected user',
    query: {
      cursor: listAudit.parameters.after,
      limit: listAudit.parameters.limit,
      severity: listAudit.parameters.severity,
      search: listAudit.parameters.search,
      from: listAudit.parameters.from,
      to: listAudit.parameters.to,
      messageType: listAudit.parameters.messageType,
      userId: listAudit.parameters.userId,
    },
    response: { items: listAudit.parameters.items },
  })

  const listJobs = pkg.proc(
    'list_jobs',
    { in: searchPageInputs, out: { items: odbType.resultset() } },
    ({ params: { after, limit, search, items }, body }) => {
      const term = odbOracle.lower(odbOracle.trim(search))
      body.openFor(
        items,
        odbQuery()
          .selectFrom(schedulerJobs)
          .select([
            schedulerJobs.jobName,
            schedulerJobs.enabled,
            schedulerJobs.state,
            schedulerJobs.scheduleName,
            schedulerJobs.repeatInterval,
            schedulerJobs.comments,
          ])
          .where(
            cond.and([
              cond.isNull(schedulerJobs.jobSubname),
              cond.or([
                cond.isNull(term),
                cond.gt(odbOracle.instr(odbOracle.lower(schedulerJobs.jobName), term), 0),
              ]),
            ]),
          )
          .orderBy(schedulerJobs.jobName)
          .paginate({ cursor: after, limit }),
      )
    },
  )
  defineService(listJobs, {
    auth: { roles: ['admin'] },
    module: 'admin',
    basePath: '/admin',
    method: 'GET',
    path: '/jobs',
    summary: 'List schema-owned Scheduler jobs',
    query: {
      cursor: listJobs.parameters.after,
      limit: listJobs.parameters.limit,
      search: listJobs.parameters.search,
    },
    response: { items: listJobs.parameters.items },
  })

  const listJobHistory = pkg.proc(
    'list_job_history',
    {
      in: { name: odbType.string(128), after: odbType.json(), limit: odbType.integer() },
      out: { items: odbType.resultset() },
    },
    ({ params: { name, after, limit, items }, body }) => {
      body.openFor(
        items,
        odbQuery()
          .selectFrom(schedulerRuns)
          .select([
            schedulerRuns.logId,
            schedulerRuns.jobName,
            schedulerRuns.status,
            schedulerRuns.errors,
            schedulerRuns.output,
          ])
          .selectAs(
            plsqlExpr.call('TIMESTAMP', 'SYS_EXTRACT_UTC', schedulerRuns.actualStartDate),
            schedulerRuns.actualStartDate,
          )
          .selectAs(
            plsqlExpr.call('VARCHAR2', 'TO_CHAR', schedulerRuns.runDuration),
            schedulerRuns.runDuration,
          )
          .where(cond.eq(schedulerRuns.jobName, name))
          .orderBy(schedulerRuns.logId, 'desc')
          .paginate({ cursor: after, limit }),
      )
    },
  )
  defineService(listJobHistory, {
    auth: { roles: ['admin'] },
    module: 'admin',
    basePath: '/admin',
    method: 'GET',
    path: '/jobs/:name/history',
    summary: 'List Scheduler runs for one schema-owned job',
    uri: { name: listJobHistory.parameters.name },
    query: { cursor: listJobHistory.parameters.after, limit: listJobHistory.parameters.limit },
    response: { items: listJobHistory.parameters.items },
  })

  for (const action of ['enable', 'disable', 'run'] as const) {
    const operation = pkg.proc(
      `${action}_job`,
      {
        in: { name: odbType.string(128), actorId: odbAuth.types.userId },
        out: { auditRecorded: odbType.integer() },
      },
      ({ params: { name, actorId, auditRecorded }, body }) => {
        const { found } = body.variables({ found: odbType.string(128) })
        body.ifThen(
          cond.or([cond.isNull(name), cond.not(cond.regexpLike(name, '^[A-Z][A-Z0-9_$#]*$'))]),
          (invalid) => invalid.invalid('ADMIN_JOB_NAME_INVALID'),
        )
        body.query(
          odbQuery()
            .selectFrom(schedulerJobs)
            .select(schedulerJobs.jobName)
            .into(found)
            .where(
              cond.and([
                cond.eq(schedulerJobs.jobName, name),
                cond.isNull(schedulerJobs.jobSubname),
              ]),
            ),
        )
        body.call(odbScheduler[action](name))
        body.set(auditRecorded, 1)
        body.block((audit) => {
          audit.auditEvent('Scheduler job action', {
            'user.id': actorId,
            'event.name': odbLiteral(`admin.job.${action}`),
            'job.name': name,
          })
          audit.whenOthers((failed) => {
            failed.set(auditRecorded, 0)
          })
        })
        body.when('NO_DATA_FOUND', (missing) => missing.notFound('ADMIN_JOB_NOT_FOUND'))
      },
    )
    defineService(operation, {
      auth: { roles: ['admin'] },
      module: 'admin',
      basePath: '/admin',
      method: 'POST',
      path: `/jobs/:name/${action}`,
      summary: `${action} a schema-owned Scheduler job`,
      uri: { name: operation.parameters.name },
      context: { userId: operation.parameters.actorId },
      response: { auditRecorded: operation.parameters.auditRecorded },
    })
  }
  return {}
})

export const migration = defineMigration('00000000000003_admin', {
  schema: odbEnv.schemaUsername,
}).install(adminPackage)
