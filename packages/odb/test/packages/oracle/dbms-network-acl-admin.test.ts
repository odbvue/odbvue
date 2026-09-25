import { describe, expect, it } from 'vitest'
import { odbDbmsNetworkAclAdmin } from '../../../src/packages/oracle/dbms-network-acl-admin.js'
import { odbLiteral } from '../../../src/schema/attribute.js'

describe('odbDbmsNetworkAclAdmin', () => {
  const host = odbLiteral('kms')
  const walletPath = odbLiteral('file:/wallet')
  const ace = "XS$ACE_TYPE(XS$NAME_LIST('connect'), 'ODB', XS_ACL.PTYPE_DB)"
  const acl = odbLiteral('/sys/acls/kms.xml')

  it('appends host ACEs with optional ports', () => {
    expect(odbDbmsNetworkAclAdmin.appendHostAce(host, ace).toSQL()).toBe(
      "DBMS_NETWORK_ACL_ADMIN.APPEND_HOST_ACE(host => 'kms', ace => XS$ACE_TYPE(XS$NAME_LIST('connect'), 'ODB', XS_ACL.PTYPE_DB))",
    )
    expect(
      odbDbmsNetworkAclAdmin.appendHostAce(host, ace, { lowerPort: 443, upperPort: 8443 }).toSQL(),
    ).toBe(
      "DBMS_NETWORK_ACL_ADMIN.APPEND_HOST_ACE(host => 'kms', lower_port => 443, upper_port => 8443, ace => XS$ACE_TYPE(XS$NAME_LIST('connect'), 'ODB', XS_ACL.PTYPE_DB))",
    )
  })

  it('appends host and wallet ACL content', () => {
    expect(odbDbmsNetworkAclAdmin.appendHostAcl(host, acl, { lowerPort: 443 }).toSQL()).toBe(
      "DBMS_NETWORK_ACL_ADMIN.APPEND_HOST_ACL(host => 'kms', lower_port => 443, acl => '/sys/acls/kms.xml')",
    )
    expect(odbDbmsNetworkAclAdmin.appendWalletAce(walletPath, ace).toSQL()).toBe(
      "DBMS_NETWORK_ACL_ADMIN.APPEND_WALLET_ACE(wallet_path => 'file:/wallet', ace => XS$ACE_TYPE(XS$NAME_LIST('connect'), 'ODB', XS_ACL.PTYPE_DB))",
    )
    expect(odbDbmsNetworkAclAdmin.appendWalletAcl(walletPath, acl).toSQL()).toBe(
      "DBMS_NETWORK_ACL_ADMIN.APPEND_WALLET_ACL(wallet_path => 'file:/wallet', acl => '/sys/acls/kms.xml')",
    )
  })

  it('removes host and wallet ACEs', () => {
    expect(
      odbDbmsNetworkAclAdmin
        .removeHostAce(host, ace, { lowerPort: 443, removeEmptyAcl: true })
        .toSQL(),
    ).toBe(
      "DBMS_NETWORK_ACL_ADMIN.REMOVE_HOST_ACE(host => 'kms', lower_port => 443, ace => XS$ACE_TYPE(XS$NAME_LIST('connect'), 'ODB', XS_ACL.PTYPE_DB), remove_empty_acl => TRUE)",
    )
    expect(odbDbmsNetworkAclAdmin.removeWalletAce(walletPath, ace, false).toSQL()).toBe(
      "DBMS_NETWORK_ACL_ADMIN.REMOVE_WALLET_ACE(wallet_path => 'file:/wallet', ace => XS$ACE_TYPE(XS$NAME_LIST('connect'), 'ODB', XS_ACL.PTYPE_DB), remove_empty_acl => FALSE)",
    )
  })

  it('sets host and wallet ACLs', () => {
    expect(odbDbmsNetworkAclAdmin.setHostAcl(host, acl, { lowerPort: 443 }).toSQL()).toBe(
      "DBMS_NETWORK_ACL_ADMIN.SET_HOST_ACL(host => 'kms', lower_port => 443, acl => '/sys/acls/kms.xml')",
    )
    expect(odbDbmsNetworkAclAdmin.setWalletAcl(walletPath, acl).toSQL()).toBe(
      "DBMS_NETWORK_ACL_ADMIN.SET_WALLET_ACL(wallet_path => 'file:/wallet', acl => '/sys/acls/kms.xml')",
    )
  })
})
