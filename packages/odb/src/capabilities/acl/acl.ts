import { odbLiteral, type PlsqlRenderable } from '../../schema/attribute.js'
import { aclTypes, odbAclPackage } from './package.js'

export { aclTypes, odbAclPackage } from './package.js'

type Port = PlsqlRenderable | number
const portArg = (port: Port) => (typeof port === 'number' ? odbLiteral(port) : port)

/** Protocol-specific host grants for the package owner; callers own authorization and transactions. */
export const odbAcl = {
  types: aclTypes,
  toSQLUp(options: { schema?: string } = {}): string {
    if (options.schema && !/^[A-Za-z][A-Za-z0-9_$#]{0,127}$/.test(options.schema)) {
      throw new Error(`Invalid Oracle schema name: ${options.schema}`)
    }
    return odbAclPackage.toSQLUp(options)
  },
  toSQLDown(options: { schema?: string } = {}): string {
    return odbAclPackage.toSQLDown(options)
  },
  addHttp(host: PlsqlRenderable, port: Port = 443) {
    return odbAclPackage.addHttp(host, portArg(port))
  },
  removeHttp(host: PlsqlRenderable, port: Port = 443) {
    return odbAclPackage.removeHttp(host, portArg(port))
  },
  addSmtp(host: PlsqlRenderable, port: Port = 587) {
    return odbAclPackage.addSmtp(host, portArg(port))
  },
  removeSmtp(host: PlsqlRenderable, port: Port = 587) {
    return odbAclPackage.removeSmtp(host, portArg(port))
  },
  addLdap(host: PlsqlRenderable, port: Port = 636) {
    return odbAclPackage.addLdap(host, portArg(port))
  },
  removeLdap(host: PlsqlRenderable, port: Port = 636) {
    return odbAclPackage.removeLdap(host, portArg(port))
  },
  list(items: PlsqlRenderable) {
    return odbAclPackage.list(items)
  },
}
