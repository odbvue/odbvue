import { cond, odbLiteral, plsqlExpr } from '../../schema/attribute.js'
import { odbPackage, odbType } from '../../schema/package.js'
import { odbQuery } from '../../query/index.js'
import {
  odbDbmsLob,
  odbDbmsOutput,
  odbDbmsUtility,
  odbOracle,
  odbUtlEncode,
  odbUtlI18n,
  odbUtlRaw,
  odbUtlSmtp,
  odbUtlTcp,
} from '../../oracle/index.js'
import { odbLob } from '../../helpers/lob/lob.js'
import { odbSettings } from '../settings/settings.js'
import { odbStorage } from '../storage/storage.js'
import { storageFiles } from '../storage/tables.js'
import { emails, emailsAddr, emailsAttc } from './tables.js'
import { emailsTypes } from './types.js'

export const odbEmailsPackage = odbPackage('odb_emails', (pkg) => {
  const validateHeader = pkg.privateProc('validate_header', (proc) => {
    const { value } = proc.parameters({ in: { value: odbType.string() } })
    proc.body((body) =>
      body.ifThen(cond.regexpLike(value, '[[:cntrl:]]'), (then) =>
        then.invalid('EMAILS_HEADER_INVALID'),
      ),
    )
  })

  const validateAddress = pkg.privateProc('validate_address', (proc) => {
    const { address, name } = proc.parameters({
      in: { address: emailsTypes.address, name: emailsTypes.name },
    })
    proc.body((body) => {
      body.ifThen(
        cond.or([
          cond.isNull(address),
          cond.gt(odbOracle.length(address), 240),
          cond.not(
            cond.regexpLike(
              address,
              "^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$",
            ),
          ),
          cond.gt(odbOracle.length(name), 240),
        ]),
        (then) => then.invalid('EMAILS_ADDRESS_INVALID'),
      )
      body.call(validateHeader.invoke(address))
      body.call(validateHeader.invoke(name))
    })
  })

  const smtpSetting = pkg.privateFunc('smtp_setting', odbType.string(4000), (fn) => {
    const { id } = fn.parameters({ in: { id: odbType.string() } })
    fn.body((body) => {
      const { value, meta } = body.variables({ value: odbType.string(4000), meta: odbType.clob() })
      body.call(odbSettings.read(id, value, meta))
      body.return(value)
    })
  })

  const lockEditable = pkg.privateProc('lock_editable', (proc) => {
    const { id } = proc.parameters({ in: { id: emailsTypes.id } })
    proc.body((body) => {
      const { status } = body.variables({ status: odbType.string(1) })
      body.query(
        odbQuery()
          .selectFrom(emails)
          .select(emails.status)
          .into(status)
          .where(cond.eq(emails.id, id))
          .forUpdate(),
      )
      body.ifThen(cond.eq(status, 'S'), (then) => then.conflict('EMAILS_ALREADY_SENT'))
      body.when('NO_DATA_FOUND', (handler) => handler.notFound('EMAILS_NOT_FOUND'))
    })
  })

  const mail = pkg.proc(
    'mail',
    {
      in: {
        address: emailsTypes.address,
        name: emailsTypes.name,
        subject: emailsTypes.subject,
        content: emailsTypes.content,
        priority: emailsTypes.priority,
      },
      out: { id: emailsTypes.id },
    },
    ({ params: { address, name, subject, content, priority, id }, body }) => {
      const { sender, senderName } = body.variables({
        sender: emailsTypes.address,
        senderName: emailsTypes.name,
      })
      body.call(validateAddress.invoke(address, name))
      body.call(validateHeader.invoke(subject))
      body.ifThen(
        cond.or([cond.isNull(odbOracle.trim(subject)), cond.gt(odbOracle.length(subject), 240)]),
        (then) => then.invalid('EMAILS_SUBJECT_INVALID'),
      )
      body.ifThen(
        cond.or([cond.isNull(content), cond.eq(odbDbmsLob.getLength(content), 0)]),
        (then) => then.invalid('EMAILS_CONTENT_REQUIRED'),
      )
      body.ifThen(
        cond.or([cond.isNull(priority), cond.lt(priority, 1), cond.gt(priority, 5)]),
        (then) => then.invalid('EMAILS_PRIORITY_INVALID'),
      )
      body.set(sender, smtpSetting.invoke(odbLiteral('SMTP_FROM_ADDR')))
      body.set(senderName, smtpSetting.invoke(odbLiteral('SMTP_FROM_NAME')))
      body.ifThen(cond.isNull(sender), (then) => then.invalid('EMAILS_SMTP_NOT_CONFIGURED'))
      body.call(validateAddress.invoke(sender, senderName))
      body.set(id, odbOracle.lower(odbOracle.rawToHex(odbOracle.sysGuid())))
      body.insertInto(emails, { id, subject: odbOracle.trim(subject), content, priority })
      for (const addrType of ['From', 'ReplyTo']) {
        body.insertInto(emailsAddr, {
          idEmail: id,
          addrType,
          addrAddr: sender,
          addrName: senderName,
        })
      }
      body.insertInto(emailsAddr, {
        idEmail: id,
        addrType: 'To',
        addrAddr: address,
        addrName: name,
      })
    },
  )

  const addr = pkg.proc(
    'addr',
    {
      in: {
        id: emailsTypes.id,
        type: emailsTypes.addressType,
        address: emailsTypes.address,
        name: { ...emailsTypes.name, default: null },
      },
    },
    ({ params: { id, type, address, name }, body }) => {
      body.ifThen(
        cond.or([
          cond.isNull(type),
          cond.not(cond.or(['ReplyTo', 'To', 'Cc', 'Bcc'].map((value) => cond.eq(type, value)))),
        ]),
        (then) => then.invalid('EMAILS_ADDRESS_TYPE_INVALID'),
      )
      body.call(validateAddress.invoke(address, name))
      body.call(lockEditable.invoke(id))
      body.ifThen(cond.eq(type, 'ReplyTo'), (then) =>
        then.query(
          odbQuery()
            .deleteFrom(emailsAddr)
            .where(
              cond.and([cond.eq(emailsAddr.idEmail, id), cond.eq(emailsAddr.addrType, 'ReplyTo')]),
            ),
        ),
      )
      body.insertInto(emailsAddr, {
        idEmail: id,
        addrType: type,
        addrAddr: address,
        addrName: name,
      })
    },
  )

  const attc = pkg.proc(
    'attc',
    { in: { id: emailsTypes.id, ownerId: odbType.string(), storageId: odbType.guid() } },
    ({ params: { id, ownerId, storageId }, body }) => {
      const { fileName, mimeType, fileSize, content, meta } = body.variables({
        fileName: odbType.string(255),
        mimeType: odbType.string(200),
        fileSize: odbType.number(),
        content: odbType.blob(),
        meta: odbType.clob(),
      })
      body.call(lockEditable.invoke(id))
      body.call(odbStorage.read(ownerId, storageId, fileName, mimeType, fileSize, content, meta))
      body.insertInto(emailsAttc, { idEmail: id, idStorage: storageId })
    },
  )

  const list = pkg.proc(
    'list',
    {
      in: { after: emailsTypes.id, limit: odbType.integer() },
      out: { items: odbType.resultset() },
    },
    ({ params: { after, limit, items }, body }) => {
      body.ifThen(cond.or([cond.lt(limit, 1), cond.gt(limit, 101)]), (then) =>
        then.invalid('EMAILS_LIMIT_INVALID'),
      )
      body.openFor(
        items,
        odbQuery()
          .selectFrom(emails)
          .select([
            emails.id,
            emails.subject,
            emails.priority,
            emails.status,
            emails.created,
            emails.delivered,
            emails.attempts,
            emails.postponed,
            emails.error,
          ])
          .where(cond.or([cond.isNull(after), cond.gt(emails.id, after)]))
          .orderBy(emails.id)
          .limit(odbOracle.nvl(limit, odbLiteral(50))),
      )
    },
  )

  const send = pkg
    .proc(
      'send',
      { in: { id: emailsTypes.id, postpone: { ...odbType.integer(), default: odbLiteral(300) } } },
      ({ params: { id, postpone }, body }) => {
        const {
          emailStatus,
          emailSubject,
          emailContent,
          emailPriority,
          host,
          port,
          portValue,
          username,
          password,
          conn,
          connected,
          accepted,
          boundary,
          content,
          error,
          count,
        } = body.variables({
          emailStatus: odbType.string(1),
          emailSubject: emailsTypes.subject,
          emailContent: odbType.clob(),
          emailPriority: odbType.number(),
          host: odbType.string(255),
          port: odbType.number(),
          portValue: odbType.string(4000),
          username: odbType.string(2000),
          password: odbType.string(2000),
          conn: odbUtlSmtp.connection,
          connected: odbType.boolean(),
          accepted: odbType.boolean(),
          boundary: odbType.string(80),
          content: odbType.blob(),
          error: odbType.string(2000),
          count: odbType.number(),
        })
        connected.initialize(false)
        accepted.initialize(false)
        boundary.initialize(
          plsqlExpr.concat('odb_', odbOracle.lower(odbOracle.rawToHex(odbOracle.sysGuid()))),
        )
        const busy = body.exception('e_busy', -54)

        const line = body.localProc('line', (proc) => {
          const { value } = proc.parameters({
            in: { value: { ...odbType.string(), default: null } },
          })
          proc.body((write) =>
            write.call(odbUtlSmtp.writeData(conn, plsqlExpr.concat(value, odbUtlTcp.CRLF))),
          )
        })
        const encoded = body.localFunc('encoded', odbType.string(), (fn) => {
          const { value } = fn.parameters({ in: { value: odbType.string() } })
          fn.body((encode) => {
            const { result, offset, chunk } = encode.variables({
              result: odbType.string(4000),
              offset: odbType.integer(),
              chunk: odbType.string(240),
            })
            offset.initialize(1)
            // Nine UTF-8 characters keep each encoded word below RFC 2047's 75-byte limit.
            encode.while(cond.lte(offset, odbOracle.length(value)), (loop) => {
              loop.set(chunk, odbOracle.substr(value, offset, 9))
              loop.ifThen(cond.gt(offset, 1), (then) =>
                then.set(result, plsqlExpr.concat(result, odbUtlTcp.CRLF, ' ')),
              )
              loop.set(
                result,
                plsqlExpr.concat(
                  result,
                  '=?UTF-8?B?',
                  odbUtlRaw.castToVarchar2(
                    odbUtlEncode.base64Encode(
                      odbUtlI18n.stringToRaw(chunk, odbLiteral('AL32UTF8')),
                    ),
                  ),
                  '?=',
                ),
              )
              loop.set(offset, plsqlExpr.add(offset, 9))
            })
            encode.return(result)
          })
        })
        const address = body.localFunc('address', odbType.string(), (fn) => {
          const { addr: mailbox, name } = fn.parameters({
            in: { addr: emailsTypes.address, name: emailsTypes.name },
          })
          fn.body((format) => {
            format.ifThen(cond.isNull(name), (then) =>
              then.return(plsqlExpr.concat('<', mailbox, '>')),
            )
            format.return(plsqlExpr.concat(encoded.invoke(name), ' <', mailbox, '>'))
          })
        })
        const base64 = body.localProc('base64', (proc) => {
          const { blob } = proc.parameters({ in: { blob: odbType.blob() } })
          proc.body((encode) => {
            const { offset } = encode.variables({ offset: odbType.integer() })
            offset.initialize(1)
            encode.while(cond.lte(offset, odbDbmsLob.getLength(blob)), (loop) => {
              loop.call(
                line.invoke(
                  odbUtlRaw.castToVarchar2(
                    odbUtlEncode.base64Encode(odbDbmsLob.substrRaw(blob, 57, offset)),
                  ),
                ),
              )
              loop.set(offset, plsqlExpr.add(offset, 57))
            })
          })
        })
        const freeBody = body.localProc('free_body', (proc) =>
          proc.body((cleanup) =>
            cleanup.ifThen(cond.eq(odbDbmsLob.isTemporary(content), 1), (then) =>
              then.call(odbDbmsLob.freeTemporary(content)),
            ),
          ),
        )
        const closeConnection = body.localProc('close_connection', (proc) => {
          proc.body((cleanup) => {
            cleanup.ifThen(cond.eq(connected, true), (then) => {
              then.call(
                odbUtlTcp.closeConnection(conn.field('private_tcp_con', odbUtlTcp.connection.type)),
              )
              then.set(connected, false)
            })
            cleanup.whenOthers((handler) =>
              handler.call(
                odbDbmsOutput.putLine(
                  plsqlExpr.concat('EMAILS_CONNECTION_CLEANUP_FAILED: ', odbOracle.sqlerrm()),
                ),
              ),
            )
          })
        })
        const addressHeader = body.localProc('address_header', (proc) => {
          const { type, header } = proc.parameters({
            in: { type: emailsTypes.addressType, header: odbType.string() },
          })
          proc.body((write) => {
            const { first } = write.variables({ first: odbType.boolean() })
            first.initialize(true)
            write.forQuery(
              'a',
              odbQuery()
                .selectFrom(emailsAddr)
                .select([emailsAddr.addrAddr, emailsAddr.addrName])
                .where(
                  cond.and([cond.eq(emailsAddr.idEmail, id), cond.eq(emailsAddr.addrType, type)]),
                )
                .orderBy(emailsAddr.addrAddr),
              (record, loop) => {
                loop.call(
                  odbUtlSmtp.writeData(
                    conn,
                    plsqlExpr.concat(
                      odbOracle.caseWhen(
                        cond.eq(first, true),
                        plsqlExpr.concat(header, ': '),
                        plsqlExpr.concat(',', odbUtlTcp.CRLF, ' '),
                        'VARCHAR2',
                      ),
                      address.invoke(record.column('addr_addr'), record.column('addr_name')),
                    ),
                  ),
                )
                loop.set(first, false)
              },
            )
            write.ifThen(cond.eq(first, false), (then) => then.call(line.invoke()))
          })
        })
        const attachmentHeader = body.localProc('attachment_header', (proc) => {
          const { name } = proc.parameters({ in: { name: odbType.string() } })
          proc.body((write) => {
            const { filenameHex, hex, value, offset, part } = write.variables({
              filenameHex: odbType.string(2040),
              hex: odbType.string(40),
              value: odbType.string(80),
              offset: odbType.integer(),
              part: odbType.integer(),
            })
            filenameHex.initialize(
              odbOracle.rawToHex(odbUtlI18n.stringToRaw(name, odbLiteral('AL32UTF8'))),
            )
            offset.initialize(1)
            part.initialize(0)
            write.call(line.invoke(odbLiteral('Content-Disposition: attachment;')))
            write.while(cond.lte(offset, odbOracle.length(filenameHex)), (loop) => {
              loop.set(hex, odbOracle.substr(filenameHex, offset, 40))
              loop.set(value, null)
              loop.forRange(
                'byte',
                0,
                plsqlExpr.subtract(plsqlExpr.divide(odbOracle.length(hex), 2), 1),
                (index, bytes) =>
                  bytes.set(
                    value,
                    plsqlExpr.concat(
                      value,
                      '%',
                      odbOracle.substr(hex, plsqlExpr.add(plsqlExpr.multiply(index, 2), 1), 2),
                    ),
                  ),
              )
              loop.call(
                line.invoke(
                  plsqlExpr.concat(
                    ' filename*',
                    part,
                    '*=',
                    odbOracle.caseWhen(
                      cond.eq(part, 0),
                      odbLiteral("UTF-8''"),
                      odbOracle.null(),
                      'VARCHAR2',
                    ),
                    value,
                    odbOracle.caseWhen(
                      cond.lte(plsqlExpr.add(offset, 40), odbOracle.length(filenameHex)),
                      odbLiteral(';'),
                      odbOracle.null(),
                      'VARCHAR2',
                    ),
                  ),
                ),
              )
              loop.set(offset, plsqlExpr.add(offset, 40))
              loop.set(part, plsqlExpr.add(part, 1))
            })
          })
        })

        body.ifThen(cond.or([cond.isNull(postpone), cond.lt(postpone, 0)]), (then) =>
          then.invalid('EMAILS_POSTPONE_INVALID'),
        )
        body.block((lock) => {
          lock.query(
            odbQuery()
              .selectFrom(emails)
              .select([emails.status, emails.subject, emails.content, emails.priority])
              .into(emailStatus, emailSubject, emailContent, emailPriority)
              .where(cond.eq(emails.id, id))
              .forUpdate({ nowait: true }),
          )
          lock.when('NO_DATA_FOUND', (handler) => handler.notFound('EMAILS_NOT_FOUND'))
          lock.when(busy, (handler) => handler.conflict('EMAILS_BUSY'))
        })
        body.ifThen(cond.eq(emailStatus, 'S'), (then) => then.conflict('EMAILS_ALREADY_SENT'))
        body.query(
          odbQuery()
            .updateTable(emails)
            .set({ attempts: plsqlExpr.add(emails.attempts, 1) })
            .where(cond.eq(emails.id, id)),
        )
        body.block((delivery) => {
          delivery.set(host, smtpSetting.invoke(odbLiteral('SMTP_HOST')))
          delivery.set(portValue, smtpSetting.invoke(odbLiteral('SMTP_PORT')))
          delivery.ifThen(
            cond.or([cond.isNull(portValue), cond.not(cond.regexpLike(portValue, '^[0-9]{1,5}$'))]),
            (then) => then.invalid('EMAILS_SMTP_NOT_CONFIGURED'),
          )
          delivery.set(port, odbOracle.toNumber(portValue))
          delivery.set(username, smtpSetting.invoke(odbLiteral('SMTP_USERNAME')))
          delivery.set(password, smtpSetting.invoke(odbLiteral('SMTP_PASSWORD')))
          delivery.ifThen(
            cond.or([
              cond.isNull(host),
              cond.isNull(port),
              cond.lt(port, 1),
              cond.gt(port, 65535),
              cond.isNull(username),
              cond.isNull(password),
            ]),
            (then) => then.invalid('EMAILS_SMTP_NOT_CONFIGURED'),
          )
          delivery.query(
            odbQuery()
              .selectFrom(emailsAddr)
              .select(odbOracle.count())
              .into(count)
              .where(
                cond.and([cond.eq(emailsAddr.idEmail, id), cond.eq(emailsAddr.addrType, 'From')]),
              ),
          )
          delivery.ifThen(cond.ne(count, 1), (then) => then.invalid('EMAILS_SENDER_INVALID'))
          const recipientTypes = ['To', 'Cc', 'Bcc'].map((type) =>
            cond.eq(emailsAddr.addrType, type),
          )
          delivery.query(
            odbQuery()
              .selectFrom(emailsAddr)
              .select(odbOracle.count())
              .into(count)
              .where(cond.and([cond.eq(emailsAddr.idEmail, id), cond.or(recipientTypes)])),
          )
          delivery.ifThen(cond.eq(count, 0), (then) => then.invalid('EMAILS_RECIPIENT_REQUIRED'))
          delivery.forQuery(
            'a',
            odbQuery()
              .selectFrom(emailsAddr)
              .select([emailsAddr.addrAddr, emailsAddr.addrName])
              .where(cond.eq(emailsAddr.idEmail, id)),
            (record, loop) =>
              loop.call(
                validateAddress.invoke(record.column('addr_addr'), record.column('addr_name')),
              ),
          )
          delivery.call(validateHeader.invoke(emailSubject))
          delivery.set(conn, odbUtlSmtp.openConnection(host, port))
          delivery.set(connected, true)
          delivery.call(odbUtlSmtp.startTls(conn))
          delivery.call(odbUtlSmtp.auth(conn, username, password, odbLiteral('PLAIN')))
          delivery.forQuery(
            'a',
            odbQuery()
              .selectFrom(emailsAddr)
              .select(emailsAddr.addrAddr)
              .where(
                cond.and([cond.eq(emailsAddr.idEmail, id), cond.eq(emailsAddr.addrType, 'From')]),
              ),
            (record, loop) => loop.call(odbUtlSmtp.mail(conn, record.column('addr_addr'))),
          )
          delivery.forQuery(
            'a',
            odbQuery()
              .selectFrom(emailsAddr)
              .select(emailsAddr.addrAddr)
              .where(cond.and([cond.eq(emailsAddr.idEmail, id), cond.or(recipientTypes)])),
            (record, loop) => loop.call(odbUtlSmtp.rcpt(conn, record.column('addr_addr'))),
          )
          delivery.call(odbUtlSmtp.openData(conn))
          delivery.call(
            line.invoke(
              plsqlExpr.concat(
                'Date: ',
                odbOracle.toChar(
                  odbOracle.atTimeZone(odbOracle.sysTimestamp(), odbLiteral('UTC')),
                  odbLiteral('Dy, DD Mon YYYY HH24:MI:SS'),
                  odbLiteral('NLS_DATE_LANGUAGE=English'),
                ),
                ' +0000',
              ),
            ),
          )
          delivery.call(line.invoke(plsqlExpr.concat('Message-ID: <', id, '@odbvue.local>')))
          delivery.call(line.invoke(plsqlExpr.concat('Subject: ', encoded.invoke(emailSubject))))
          delivery.call(
            line.invoke(plsqlExpr.concat('X-Priority: ', odbOracle.toChar(emailPriority))),
          )
          for (const [type, header] of [
            ['From', 'From'],
            ['ReplyTo', 'Reply-To'],
            ['To', 'To'],
            ['Cc', 'Cc'],
          ] as const) {
            delivery.call(addressHeader.invoke(odbLiteral(type), odbLiteral(header)))
          }
          delivery.call(line.invoke(odbLiteral('MIME-Version: 1.0')))
          delivery.call(
            line.invoke(
              plsqlExpr.concat('Content-Type: multipart/mixed; boundary="', boundary, '"'),
            ),
          )
          delivery.call(line.invoke())
          delivery.call(line.invoke(plsqlExpr.concat('--', boundary)))
          delivery.call(line.invoke(odbLiteral('Content-Type: text/html; charset=UTF-8')))
          delivery.call(line.invoke(odbLiteral('Content-Transfer-Encoding: base64')))
          delivery.call(line.invoke())
          delivery.set(
            content,
            odbLob.clobToBlob(
              emailContent,
              odbOracle.nlsCharsetId(odbLiteral('AL32UTF8')),
              odbLiteral(1),
            ),
          )
          delivery.call(base64.invoke(content))
          delivery.call(freeBody.invoke())
          const attachments = emailsAttc.as('a')
          const files = storageFiles.as('s')
          delivery.forQuery(
            'a',
            odbQuery()
              .selectFrom(attachments)
              .join(files, cond.eq(files.id, attachments.idStorage))
              .select([files.fileName, files.mimeType, files.content])
              .where(cond.eq(attachments.idEmail, id))
              .orderBy(attachments.idStorage),
            (record, loop) => {
              loop.call(validateHeader.invoke(record.column('file_name')))
              loop.call(validateHeader.invoke(record.column('mime_type')))
              loop.call(line.invoke(plsqlExpr.concat('--', boundary)))
              loop.call(line.invoke(plsqlExpr.concat('Content-Type: ', record.column('mime_type'))))
              loop.call(line.invoke(odbLiteral('Content-Transfer-Encoding: base64')))
              loop.call(attachmentHeader.invoke(record.column('file_name')))
              loop.call(line.invoke())
              loop.call(base64.invoke(record.column('content', 'BLOB')))
            },
          )
          delivery.call(line.invoke(plsqlExpr.concat('--', boundary, '--')))
          delivery.call(odbUtlSmtp.closeData(conn))
          delivery.set(accepted, true)
          delivery.query(
            odbQuery()
              .updateTable(emails)
              .set({
                status: 'S',
                delivered: odbOracle.sysTimestamp(),
                postponed: null,
                error: null,
              })
              .where(cond.eq(emails.id, id)),
          )
          delivery.commit()
          delivery.whenOthers((handler) => {
            handler.set(
              error,
              odbOracle.substr(
                plsqlExpr.concat(
                  odbOracle.sqlerrm(),
                  odbOracle.chr(10),
                  odbDbmsUtility.formatErrorBacktrace(),
                ),
                1,
                2000,
              ),
            )
            handler.ifThen(cond.eq(accepted, false), (failed) => {
              failed.query(
                odbQuery()
                  .updateTable(emails)
                  .set({
                    status: 'E',
                    error,
                    postponed: odbOracle.plus(
                      odbOracle.sysTimestamp(),
                      odbOracle.interval.seconds(postpone),
                    ),
                  })
                  .where(cond.eq(emails.id, id)),
              )
              failed.commit()
            })
            handler.call(freeBody.invoke())
            handler.call(closeConnection.invoke())
            handler.raise()
          })
        })
        // DATA was accepted: a failing QUIT must not turn delivery into a retry.
        body.block((quit) => {
          quit.call(odbUtlSmtp.quit(conn))
          quit.whenOthers((handler) => {
            handler.call(
              odbDbmsOutput.putLine(plsqlExpr.concat('EMAILS_QUIT_FAILED: ', odbOracle.sqlerrm())),
            )
            handler.call(closeConnection.invoke())
          })
        })
        body.whenOthers((handler) => {
          handler.rollback()
          handler.raise()
        })
      },
    )
    .autonomous()

  return { mail, addr, attc, send, list }
})
