// Oracle built-in package: DBMS_NETWORK_ACL_ADMIN.
//
// This package administers host and wallet network ACLs. The legacy XML ACL
// procedures deprecated since Oracle Database 12c are intentionally omitted.
// Pass an `XS$ACE_TYPE(...)` expression as `ace`; constructing that SQL object
// is outside DBMS_NETWORK_ACL_ADMIN itself.
//
// Reference: https://docs.oracle.com/en/database/oracle/oracle-database/21/arpls/DBMS_NETWORK_ACL_ADMIN.html

import { PlsqlStatement, renderPlsql, type PlsqlRenderable } from '../../schema/attribute.js'

type Port = PlsqlRenderable | number

export type NetworkAclPortRange = {
  lowerPort?: Port
  upperPort?: Port
}

function portArg(value: Port): string {
  return typeof value === 'number' ? String(value) : renderPlsql(value)
}

function boolArg(value: PlsqlRenderable | boolean): string {
  return typeof value === 'boolean' ? (value ? 'TRUE' : 'FALSE') : renderPlsql(value)
}

function portArgs({ lowerPort, upperPort }: NetworkAclPortRange): string[] {
  const args: string[] = []
  if (lowerPort !== undefined) args.push(`lower_port => ${portArg(lowerPort)}`)
  if (upperPort !== undefined) args.push(`upper_port => ${portArg(upperPort)}`)
  return args
}

function proc(name: string, args: string[]): PlsqlStatement {
  return new PlsqlStatement(`DBMS_NETWORK_ACL_ADMIN.${name}(${args.join(', ')})`)
}

/**
 * Typed statement builders for the non-deprecated Oracle 21c
 * `DBMS_NETWORK_ACL_ADMIN` procedures.
 */
export const odbDbmsNetworkAclAdmin = {
  /** `DBMS_NETWORK_ACL_ADMIN.APPEND_HOST_ACE` */
  appendHostAce(
    host: PlsqlRenderable,
    ace: PlsqlRenderable,
    ports: NetworkAclPortRange = {},
  ): PlsqlStatement {
    return proc('APPEND_HOST_ACE', [
      `host => ${renderPlsql(host)}`,
      ...portArgs(ports),
      `ace => ${renderPlsql(ace)}`,
    ])
  },

  /** `DBMS_NETWORK_ACL_ADMIN.APPEND_HOST_ACL` */
  appendHostAcl(
    host: PlsqlRenderable,
    acl: PlsqlRenderable,
    ports: NetworkAclPortRange = {},
  ): PlsqlStatement {
    return proc('APPEND_HOST_ACL', [
      `host => ${renderPlsql(host)}`,
      ...portArgs(ports),
      `acl => ${renderPlsql(acl)}`,
    ])
  },

  /** `DBMS_NETWORK_ACL_ADMIN.APPEND_WALLET_ACE` */
  appendWalletAce(walletPath: PlsqlRenderable, ace: PlsqlRenderable): PlsqlStatement {
    return proc('APPEND_WALLET_ACE', [
      `wallet_path => ${renderPlsql(walletPath)}`,
      `ace => ${renderPlsql(ace)}`,
    ])
  },

  /** `DBMS_NETWORK_ACL_ADMIN.APPEND_WALLET_ACL` */
  appendWalletAcl(walletPath: PlsqlRenderable, acl: PlsqlRenderable): PlsqlStatement {
    return proc('APPEND_WALLET_ACL', [
      `wallet_path => ${renderPlsql(walletPath)}`,
      `acl => ${renderPlsql(acl)}`,
    ])
  },

  /** `DBMS_NETWORK_ACL_ADMIN.REMOVE_HOST_ACE` */
  removeHostAce(
    host: PlsqlRenderable,
    ace: PlsqlRenderable,
    options: NetworkAclPortRange & { removeEmptyAcl?: PlsqlRenderable | boolean } = {},
  ): PlsqlStatement {
    const args = [
      `host => ${renderPlsql(host)}`,
      ...portArgs(options),
      `ace => ${renderPlsql(ace)}`,
    ]
    if (options.removeEmptyAcl !== undefined) {
      args.push(`remove_empty_acl => ${boolArg(options.removeEmptyAcl)}`)
    }
    return proc('REMOVE_HOST_ACE', args)
  },

  /** `DBMS_NETWORK_ACL_ADMIN.REMOVE_WALLET_ACE` */
  removeWalletAce(
    walletPath: PlsqlRenderable,
    ace: PlsqlRenderable,
    removeEmptyAcl?: PlsqlRenderable | boolean,
  ): PlsqlStatement {
    const args = [`wallet_path => ${renderPlsql(walletPath)}`, `ace => ${renderPlsql(ace)}`]
    if (removeEmptyAcl !== undefined) args.push(`remove_empty_acl => ${boolArg(removeEmptyAcl)}`)
    return proc('REMOVE_WALLET_ACE', args)
  },

  /** `DBMS_NETWORK_ACL_ADMIN.SET_HOST_ACL` */
  setHostAcl(
    host: PlsqlRenderable,
    acl: PlsqlRenderable,
    ports: NetworkAclPortRange = {},
  ): PlsqlStatement {
    return proc('SET_HOST_ACL', [
      `host => ${renderPlsql(host)}`,
      ...portArgs(ports),
      `acl => ${renderPlsql(acl)}`,
    ])
  },

  /** `DBMS_NETWORK_ACL_ADMIN.SET_WALLET_ACL` */
  setWalletAcl(walletPath: PlsqlRenderable, acl: PlsqlRenderable): PlsqlStatement {
    return proc('SET_WALLET_ACL', [
      `wallet_path => ${renderPlsql(walletPath)}`,
      `acl => ${renderPlsql(acl)}`,
    ])
  },
}
