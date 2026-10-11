import type { OdbTypeDescriptor } from '../../schema/package.js'
import {
  PlsqlExpression,
  PlsqlStatement,
  renderPlsql,
  type PlsqlRenderable,
} from '../../schema/attribute.js'

function call(name: string, ...args: PlsqlRenderable[]): PlsqlStatement {
  return new PlsqlStatement(`UTL_SMTP.${name}(${args.map(renderPlsql).join(', ')})`)
}

export const odbUtlSmtp = {
  connection: { type: 'UTL_SMTP.CONNECTION' } satisfies OdbTypeDescriptor<'UTL_SMTP.CONNECTION'>,

  openConnection(
    host: PlsqlRenderable,
    port: PlsqlRenderable,
  ): PlsqlExpression<'UTL_SMTP.CONNECTION'> {
    return new PlsqlExpression(
      'UTL_SMTP.CONNECTION',
      `UTL_SMTP.OPEN_CONNECTION(${renderPlsql(host)}, ${renderPlsql(port)})`,
    )
  },
  startTls(connection: PlsqlRenderable): PlsqlStatement {
    return call('STARTTLS', connection)
  },
  auth(
    connection: PlsqlRenderable,
    username: PlsqlRenderable,
    password: PlsqlRenderable,
    schemes: PlsqlRenderable,
  ): PlsqlStatement {
    return new PlsqlStatement(
      `UTL_SMTP.AUTH(${[connection, username, password].map(renderPlsql).join(', ')}, schemes => ${renderPlsql(schemes)})`,
    )
  },
  mail(connection: PlsqlRenderable, address: PlsqlRenderable): PlsqlStatement {
    return call('MAIL', connection, address)
  },
  rcpt(connection: PlsqlRenderable, address: PlsqlRenderable): PlsqlStatement {
    return call('RCPT', connection, address)
  },
  openData(connection: PlsqlRenderable): PlsqlStatement {
    return call('OPEN_DATA', connection)
  },
  writeData(connection: PlsqlRenderable, data: PlsqlRenderable): PlsqlStatement {
    return call('WRITE_DATA', connection, data)
  },
  closeData(connection: PlsqlRenderable): PlsqlStatement {
    return call('CLOSE_DATA', connection)
  },
  quit(connection: PlsqlRenderable): PlsqlStatement {
    return call('QUIT', connection)
  },
}
