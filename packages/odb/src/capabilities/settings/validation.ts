import { cond, odbLiteral, plsqlExpr, type PlsqlValue } from '../../schema/attribute.js'
import { odbType, type PackageImpl, type ProcedureBody } from '../../schema/package.js'
import { odbJson, odbOracle } from '../../oracle/index.js'
import { settingsStore } from './tables.js'
import { settingsTypes } from './types.js'
import { odbValidation } from '../validation/index.js'

const fieldTypes = [
  'string',
  'text',
  'textarea',
  'markdown',
  'number',
  'switch',
  'checkbox',
  'select',
  'combobox',
  'autocomplete',
  'email',
  'password',
  'color',
  'date',
  'time',
  'datetime',
]

const oneOf = (value: PlsqlValue, choices: readonly string[]) =>
  cond.or(choices.map((choice) => cond.eq(value, choice)))
const invalid = (body: ProcedureBody) => body.invalid('SETTINGS_VALIDATION_INVALID')

export function defineSettingsValidation(pkg: PackageImpl) {
  return pkg.privateProc('validate_setting', (proc) => {
    const { value, meta } = proc.parameters({
      in: { value: settingsTypes.value, meta: settingsStore.meta },
    })
    proc.body((body) => {
      const { object, rules, rule, params, element, kind, fieldType, text, number } =
        body.variables({
          object: odbJson.object,
          rules: odbJson.array,
          rule: odbJson.object,
          params: odbJson.array,
          element: odbJson.element,
          kind: odbType.string(32767),
          fieldType: odbType.string(32767),
          text: odbType.string(32767),
          number: odbType.number(),
        })

      const memberIs = body.localFunc('member_is', odbType.boolean(), (fn) => {
        const {
          object: source,
          key,
          kind: expected,
        } = fn.parameters({
          in: { object: odbJson.object, key: odbType.string(), kind: odbType.string() },
        })
        fn.body((check) => {
          const { member } = check.variables({ member: odbJson.element })
          check.ifThen(cond.eq(odbJson.has(source, key), false), (missing) => missing.return(false))
          check.set(member, odbJson.get(source, key))
          check.ifThen(cond.eq(expected, 'string'), (branch) =>
            branch.return(odbJson.isString(member)),
          )
          check.elsif(cond.eq(expected, 'array'), (branch) =>
            branch.return(odbJson.isArray(member)),
          )
          check.return(false)
        })
      })
      const checkMember = (
        target: ProcedureBody,
        source: typeof object,
        key: string,
        expected: string,
      ) =>
        target.ifThen(
          cond.eq(memberIs.invoke(source, odbLiteral(key), odbLiteral(expected)), false),
          invalid,
        )

      body.set(element, odbJson.parseElement(meta))
      body.ifThen(cond.eq(odbJson.isObject(element), false), invalid)
      body.set(object, odbJson.asObject(element))
      body.ifThen(cond.eq(odbJson.has(object, odbLiteral('type')), true), (typed) => {
        checkMember(typed, object, 'type', 'string')
        typed.set(fieldType, odbJson.getString(object, odbLiteral('type')))
        typed.ifThen(
          cond.or([cond.isNull(fieldType), cond.not(oneOf(fieldType, fieldTypes))]),
          invalid,
        )
        typed.ifThen(
          cond.and([
            cond.eq(fieldType, 'number'),
            cond.isNotNull(value),
            cond.eq(odbValidation.isNumber(value), false),
          ]),
          invalid,
        )
        typed.ifThen(
          cond.and([
            oneOf(fieldType, ['switch', 'checkbox']),
            cond.or([cond.isNull(value), cond.not(oneOf(value, ['Y', 'N']))]),
          ]),
          invalid,
        )
        typed.ifThen(cond.eq(fieldType, 'select'), (select) => {
          checkMember(select, object, 'items', 'array')
          select.set(params, odbJson.getArray(object, odbLiteral('items')))
          select.ifThen(cond.eq(odbValidation.inSet(value, params), false), invalid)
        })
      })
      body.ifThen(cond.eq(odbJson.has(object, odbLiteral('rules')), true), (hasRules) => {
        checkMember(hasRules, object, 'rules', 'array')
        hasRules.set(rules, odbJson.getArray(object, odbLiteral('rules')))
        hasRules.ifThen(cond.gt(odbJson.getSize(rules), 32), invalid)
        hasRules.forRange(
          'ruleIndex',
          0,
          plsqlExpr.subtract(odbJson.getSize(rules), 1),
          (i, each) => {
            each.set(element, odbJson.get(rules, i))
            each.ifThen(cond.eq(odbJson.isObject(element), false), invalid)
            each.set(rule, odbJson.asObject(element))
            checkMember(each, rule, 'type', 'string')
            each.ifThen(
              cond.and([
                cond.eq(odbJson.has(rule, odbLiteral('message')), true),
                cond.eq(memberIs.invoke(rule, odbLiteral('message'), odbLiteral('string')), false),
              ]),
              invalid,
            )
            each.set(kind, odbJson.getString(rule, odbLiteral('type')))
            each.ifThen(
              cond.eq(kind, 'custom'),
              (custom) => {
                checkMember(custom, rule, 'params', 'string')
                custom.set(text, odbJson.getString(rule, odbLiteral('params')))
                custom.case((validators) => {
                  validators.when(cond.eq(text, 'jwt-secret'), (secret) =>
                    secret.ifThen(
                      cond.or([
                        cond.isNull(value),
                        cond.not(cond.regexpLike(value, '^[0-9A-Fa-f]{64}$', 'c')),
                      ]),
                      invalid,
                    ),
                  )
                  validators.when(cond.eq(text, 'jwt-issuer'), (issuer) =>
                    issuer.ifThen(
                      cond.or([
                        cond.isNull(value),
                        cond.not(cond.regexpLike(value, '^[!-~]{1,255}$', 'c')),
                      ]),
                      invalid,
                    ),
                  )
                  validators.when(cond.eq(text, 'port'), (port) =>
                    port.ifThen(cond.eq(odbValidation.isPort(value), false), invalid),
                  )
                  validators.when(cond.eq(text, 'jwt-expiration'), (bounded) => {
                    bounded.ifThen(
                      cond.or([
                        cond.isNull(value),
                        cond.not(cond.regexpLike(value, '^[0-9]{1,5}$', 'c')),
                      ]),
                      invalid,
                    )
                    bounded.ifThen(cond.eq(odbValidation.isNumber(value), false), invalid)
                    bounded.set(number, odbOracle.toNumber(value))
                    bounded.ifThen(cond.or([cond.lt(number, 1), cond.gt(number, 86400)]), invalid)
                  })
                  validators.else(invalid)
                })
              },
              (portable) =>
                portable.ifThen(cond.eq(odbValidation.checkRule(value, rule), false), invalid),
            )
          },
        )
      })
    })
  })
}
