import { cond, odbLiteral, Param, PlsqlExpression, plsqlExpr } from '../../schema/attribute.js'
import { odbType, type Package } from '../../schema/package.js'
import {
  odbDbmsCloud,
  odbDbmsCrypto,
  odbDbmsLob,
  odbOracle,
  odbUtlEncode,
  odbUtlI18n,
  odbUtlRaw,
} from '../../oracle/index.js'
import { odbAudit } from '../audit/audit.js'
import { odbQuery } from '../../query/index.js'
import { settingsStore } from './tables.js'

const utf8 = (value: Parameters<typeof odbUtlI18n.stringToRaw>[0]) =>
  odbUtlI18n.stringToRaw(value, odbLiteral('AL32UTF8'))
const cipherSuite = odbDbmsCrypto.cipherSuite(
  odbDbmsCrypto.ENCRYPT_AES256,
  odbDbmsCrypto.CHAIN_CBC,
  odbDbmsCrypto.PAD_PKCS5,
)

export function settingsEncryption(pkg: Pick<Package, 'privateVariable' | 'privateFunc'>) {
  const cachedKey = pkg.privateVariable('g_master_key', odbType.raw(32))
  const cachedUri = pkg.privateVariable('g_master_key_uri', odbType.string(2000))
  const masterKey = pkg.privateFunc('master_key', odbType.raw(32), (fn) => {
    fn.body((body) => {
      const { uri, key } = body.variables({ uri: odbType.string(2000), key: odbType.raw(32767) })
      body.query(
        odbQuery()
          .selectFrom(settingsStore)
          .select(
            plsqlExpr.call('VARCHAR2', 'MAX', odbDbmsLob.substr(settingsStore.value, 2000, 1)),
          )
          .into(uri)
          .where(cond.eq(settingsStore.id, 'APP_SETTINGS_MASTER_KEY_URI')),
      )
      body.ifThen(
        cond.and([
          cond.isNotNull(cachedKey),
          cond.or([cond.eq(uri, cachedUri), cond.and([cond.isNull(uri), cond.isNull(cachedUri)])]),
        ]),
        (hit) => hit.return(cachedKey),
      )
      body.set(cachedKey, null)
      body.set(cachedUri, null)
      body.ifThen(
        cond.isNotNull(uri),
        (then) => {
          then.ifThen(
            cond.not(
              cond.regexpLike(
                uri,
                '^https://secrets[.]vaults[.][a-z0-9-]+[.]oci[.]oraclecloud[.]com/20190301/secretbundles/ocid1[.]vaultsecret[.][A-Za-z0-9._-]+$',
              ),
            ),
            (invalid) => invalid.invalid('SETTINGS_MASTER_KEY_URI_INVALID'),
          )
          then.block((request) => {
            // Dynamic SQL keeps local databases independent of the ADB-only DBMS_CLOUD packages.
            request.executeImmediate(
              (cloud) => {
                const { response, json, content } = cloud.variables({
                  response: odbDbmsCloud.response,
                  json: odbType.clob(),
                  content: odbType.string(128),
                })
                cloud.set(
                  response,
                  odbDbmsCloud.sendRequest(
                    odbLiteral('OCI$RESOURCE_PRINCIPAL'),
                    new Param(':uri', 'VARCHAR2'),
                  ),
                )
                cloud.ifThen(cond.ne(odbDbmsCloud.getResponseStatusCode(response), 200), (failed) =>
                  failed.invalid('SETTINGS_VAULT_REQUEST_FAILED'),
                )
                cloud.set(json, odbDbmsCloud.getResponseText(response))
                cloud.set(
                  content,
                  odbOracle.jsonValue(json, odbLiteral('$.secretBundleContent.content'), {
                    length: 128,
                    errorOnError: true,
                  }),
                )
                cloud.ifThen(cond.isNull(content), (missing) =>
                  missing.invalid('SETTINGS_VAULT_SECRET_MISSING'),
                )
                cloud.set(
                  new Param(':key', 'RAW'),
                  odbUtlEncode.base64Decode(odbUtlRaw.castToRaw(content)),
                )
              },
              [
                { direction: 'IN', value: uri },
                { direction: 'OUT', value: key },
              ],
            )
          })
        },
        (local) => {
          local.query(
            odbQuery()
              .selectFrom('dual')
              .select(
                odbDbmsCrypto.hash(
                  utf8(odbOracle.sysContext(odbLiteral('USERENV'), odbLiteral('DB_UNIQUE_NAME'))),
                  odbDbmsCrypto.HASH_SH256,
                ),
              )
              .into(key),
          )
        },
      )
      body.ifThen(cond.or([cond.isNull(key), cond.ne(odbUtlRaw.length(key), 32)]), (invalid) =>
        invalid.invalid('SETTINGS_MASTER_KEY_INVALID'),
      )
      body.set(cachedUri, uri)
      body.set(cachedKey, key)
      body.return(key)
      body.whenOthers((handler) => {
        handler.call(odbAudit.error(odbLiteral('Settings master key: key loading failed')))
        handler.raise()
      })
    })
  })

  const derivedKey = (key: PlsqlExpression<'RAW'> | string, purpose: string) =>
    odbDbmsCrypto.mac(utf8(odbLiteral(purpose)), odbDbmsCrypto.HMAC_SH256, key)
  const signature = (id: string, iv: string, ciphertext: string, key: string) =>
    odbDbmsCrypto.mac(
      odbUtlRaw.concat(utf8(odbLiteral('odb-settings:v1:')), utf8(id), iv, ciphertext),
      odbDbmsCrypto.HMAC_SH256,
      derivedKey(key, 'odb-settings:authentication'),
    )

  const encrypt = pkg.privateFunc('encrypt_value', odbType.clob(), (fn) => {
    const { id, value } = fn.parameters({ in: { id: odbType.string(), value: odbType.string() } })
    fn.body((body) => {
      const { key, iv, ciphertext, mac } = body.variables({
        key: odbType.raw(32),
        iv: odbType.raw(16),
        ciphertext: odbType.raw(32767),
        mac: odbType.raw(32),
      })
      body.ifThen(cond.isNull(value), (then) => then.return(odbOracle.null()))
      body.set(key, masterKey.invoke())
      body.set(iv, odbDbmsCrypto.randomBytes(16))
      body.set(
        ciphertext,
        odbDbmsCrypto.encrypt(
          utf8(value),
          cipherSuite,
          derivedKey(key.name, 'odb-settings:encryption'),
          iv,
        ),
      )
      body.set(mac, signature(id.name, iv.name, ciphertext.name, key.name))
      body.return(
        odbOracle.toClob(
          plsqlExpr.concat(
            odbLiteral('v1:'),
            odbOracle.rawToHex(iv),
            odbOracle.rawToHex(mac),
            odbOracle.rawToHex(ciphertext),
          ),
        ),
      )
    })
  })

  const decrypt = pkg.privateFunc('decrypt_value', odbType.string(), (fn) => {
    const { id, value } = fn.parameters({ in: { id: odbType.string(), value: odbType.clob() } })
    fn.body((body) => {
      const { key, envelope, iv, ciphertext, mac } = body.variables({
        key: odbType.raw(32),
        envelope: odbType.string(32767),
        iv: odbType.raw(16),
        ciphertext: odbType.raw(32767),
        mac: odbType.raw(32),
      })
      body.ifThen(cond.isNull(value), (then) => then.return(odbOracle.null()))
      body.ifThen(cond.gt(odbDbmsLob.getLength(value), 32767), (invalid) =>
        invalid.invalid('SETTINGS_CIPHERTEXT_INVALID'),
      )
      body.set(envelope, odbDbmsLob.substr(value, 32767, 1))
      body.ifThen(
        cond.or([
          cond.not(cond.regexpLike(envelope, '^v1:[0-9A-F]+$')),
          cond.lt(odbOracle.length(envelope), 131),
          cond.ne(odbOracle.mod(plsqlExpr.subtract(odbOracle.length(envelope), 99), 32), 0),
        ]),
        (invalid) => invalid.invalid('SETTINGS_CIPHERTEXT_INVALID'),
      )
      body.set(iv, odbOracle.hexToRaw(odbOracle.substr(envelope, 4, 32)))
      body.set(mac, odbOracle.hexToRaw(odbOracle.substr(envelope, 36, 64)))
      body.set(ciphertext, odbOracle.hexToRaw(odbOracle.substr(envelope, 100)))
      body.set(key, masterKey.invoke())
      body.ifThen(
        cond.ne(odbUtlRaw.compare(mac, signature(id.name, iv.name, ciphertext.name, key.name)), 0),
        (invalid) => invalid.invalid('SETTINGS_CIPHERTEXT_INVALID'),
      )
      body.return(
        plsqlExpr.call(
          'VARCHAR2',
          'UTL_I18N.RAW_TO_CHAR',
          odbDbmsCrypto.decrypt(
            ciphertext,
            cipherSuite,
            derivedKey(key.name, 'odb-settings:encryption'),
            iv,
          ),
          odbLiteral('AL32UTF8'),
        ),
      )
    })
  })
  return { encrypt, decrypt }
}
