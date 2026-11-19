import { cond, odbLiteral, plsqlExpr, type PlsqlValue } from '../../schema/attribute.js'
import { odbPackage, odbType, type ProcedureBody } from '../../schema/package.js'
import { odbJson, odbOracle } from '../../oracle/index.js'

const oneOf = (value: PlsqlValue, choices: readonly string[]) =>
  cond.or(choices.map((choice) => cond.eq(value, choice)))
const sameText = (left: PlsqlValue, right: PlsqlValue) =>
  cond.or([
    cond.and([cond.isNull(left), cond.isNull(right)]),
    cond.and([cond.isNotNull(left), cond.isNotNull(right), cond.eq(left, right)]),
  ])
const decimal = (value: PlsqlValue) =>
  odbOracle.toNumber(
    value,
    odbLiteral('999999999999999D9999999999'),
    odbLiteral("NLS_NUMERIC_CHARACTERS='.,'"),
  )
const invalid = (target: ProcedureBody) => target.return(false)

export const odbValidationPackage = odbPackage('odb_validation', (pkg) => {
  const isNumber = pkg.func('is_number', odbType.boolean(), (fn) => {
    const { value } = fn.parameters({ in: { value: odbType.string(32767) } })
    fn.body((body) => {
      const { parsed } = body.variables({ parsed: odbType.number() })
      body.ifThen(
        cond.or([
          cond.isNull(value),
          cond.not(cond.regexpLike(value, '^[+-]?[0-9]{1,15}([.][0-9]{1,10})?$')),
        ]),
        invalid,
      )
      body.set(parsed, decimal(value))
      body.return(true)
      body.when('VALUE_ERROR', invalid)
      body.when('INVALID_NUMBER', invalid)
    })
  })

  const inSet = pkg.func('in_set', odbType.boolean(), (fn) => {
    const { value, items } = fn.parameters({
      in: { value: odbType.string(32767), items: odbJson.array },
    })
    fn.body((body) => {
      const { element, text, found } = body.variables({
        element: odbJson.element,
        text: odbType.string(32767),
        found: odbType.boolean(),
      })
      body.ifThen(cond.isNull(items), invalid)
      body.set(found, false)
      body.forRange('item', 0, plsqlExpr.subtract(odbJson.getSize(items), 1), (i, each) => {
        each.set(element, odbJson.get(items, i))
        each.ifThen(cond.eq(odbJson.isString(element), false), invalid)
        each.set(text, odbJson.getString(items, i))
        each.ifThen(sameText(value, text), (match) => match.set(found, true))
      })
      body.return(found)
    })
  })

  const isPort = pkg.func('is_port', odbType.boolean(), (fn) => {
    const { value } = fn.parameters({ in: { value: odbType.string(32767) } })
    fn.body((body) => {
      const { port } = body.variables({ port: odbType.number() })
      body.ifThen(
        cond.or([
          cond.isNull(value),
          cond.not(cond.regexpLike(value, '^[0-9]{1,5}$', 'c')),
          cond.eq(isNumber.invoke(value), false),
        ]),
        invalid,
      )
      body.set(port, odbOracle.toNumber(value))
      body.return(cond.and([cond.gte(port, 1), cond.lte(port, 65535)]))
    })
  })

  const checkRule = pkg.func('check_rule', odbType.boolean(), (fn) => {
    const { value, rule } = fn.parameters({
      in: { value: odbType.string(32767), rule: odbJson.object },
    })
    fn.body((body) => {
      const { element, params, kind, text, number } = body.variables({
        element: odbJson.element,
        params: odbJson.array,
        kind: odbType.string(32767),
        text: odbType.string(32767),
        number: odbType.number(),
      })
      const memberIs = body.localFunc('member_is', odbType.boolean(), (local) => {
        const { key, kind: expected } = local.parameters({
          in: { key: odbType.string(), kind: odbType.string() },
        })
        local.body((check) => {
          const { member } = check.variables({ member: odbJson.element })
          check.ifThen(cond.eq(odbJson.has(rule, key), false), (missing) => missing.return(false))
          check.set(member, odbJson.get(rule, key))
          check.ifThen(cond.eq(expected, 'string'), (branch) =>
            branch.return(odbJson.isString(member)),
          )
          check.elsif(cond.eq(expected, 'number'), (branch) =>
            branch.return(odbJson.isNumber(member)),
          )
          check.elsif(cond.eq(expected, 'array'), (branch) =>
            branch.return(odbJson.isArray(member)),
          )
          check.elsif(cond.eq(expected, 'boolean'), (branch) =>
            branch.return(odbJson.isBoolean(member)),
          )
          check.return(false)
        })
      })
      const validMember = (key: string, type: string) =>
        cond.eq(memberIs.invoke(odbLiteral(key), odbLiteral(type)), true)
      body.ifThen(cond.isNull(rule), invalid)
      body.ifThen(cond.not(validMember('type', 'string')), invalid)
      body.ifThen(
        cond.and([
          cond.eq(odbJson.has(rule, odbLiteral('message')), true),
          cond.not(validMember('message', 'string')),
        ]),
        invalid,
      )
      body.set(kind, odbJson.getString(rule, odbLiteral('type')))
      body.case((branches) => {
        branches.when(cond.eq(kind, 'required'), (required) => {
          required.ifThen(
            cond.and([
              cond.eq(odbJson.has(rule, odbLiteral('params')), true),
              cond.not(validMember('params', 'boolean')),
            ]),
            invalid,
          )
          required.return(cond.isNotNull(value))
        })
        branches.when(oneOf(kind, ['min-length', 'max-length']), (length) => {
          length.ifThen(cond.not(validMember('params', 'number')), invalid)
          length.set(number, odbJson.getNumber(rule, odbLiteral('params')))
          length.ifThen(
            cond.or([cond.lt(number, 0), cond.ne(number, odbOracle.trunc(number))]),
            invalid,
          )
          const actual = odbOracle.nvl(odbOracle.length2(value), odbLiteral(0))
          length.return(
            cond.or([
              cond.and([cond.eq(kind, 'min-length'), cond.gte(actual, number)]),
              cond.and([cond.eq(kind, 'max-length'), cond.lte(actual, number)]),
            ]),
          )
        })
        branches.when(oneOf(kind, ['equals', 'equals-not']), (equals) => {
          equals.ifThen(cond.not(validMember('params', 'string')), invalid)
          equals.set(text, odbJson.getString(rule, odbLiteral('params')))
          equals.return(
            cond.or([
              cond.and([cond.eq(kind, 'equals'), sameText(value, text)]),
              cond.and([cond.eq(kind, 'equals-not'), cond.not(sameText(value, text))]),
            ]),
          )
        })
        branches.when(oneOf(kind, ['greater-than', 'less-than']), (comparison) => {
          comparison.ifThen(cond.not(validMember('params', 'number')), invalid)
          comparison.ifThen(cond.eq(isNumber.invoke(value), false), invalid)
          comparison.set(number, decimal(value))
          const threshold = odbJson.getNumber(rule, odbLiteral('params'))
          comparison.return(
            cond.or([
              cond.and([cond.eq(kind, 'greater-than'), cond.gt(number, threshold)]),
              cond.and([cond.eq(kind, 'less-than'), cond.lt(number, threshold)]),
            ]),
          )
        })
        branches.when(cond.eq(kind, 'in-range'), (range) => {
          range.ifThen(cond.not(validMember('params', 'array')), invalid)
          range.set(params, odbJson.getArray(rule, odbLiteral('params')))
          range.ifThen(cond.ne(odbJson.getSize(params), 2), invalid)
          for (const index of [0, 1]) {
            range.set(element, odbJson.get(params, odbLiteral(index)))
            range.ifThen(cond.eq(odbJson.isNumber(element), false), invalid)
          }
          const min = odbJson.getNumber(params, odbLiteral(0))
          const max = odbJson.getNumber(params, odbLiteral(1))
          range.ifThen(cond.gt(min, max), invalid)
          range.ifThen(cond.eq(isNumber.invoke(value), false), invalid)
          range.set(number, decimal(value))
          range.return(cond.and([cond.gte(number, min), cond.lte(number, max)]))
        })
        branches.when(cond.eq(kind, 'set'), (set) => {
          set.ifThen(cond.not(validMember('params', 'array')), invalid)
          set.set(params, odbJson.getArray(rule, odbLiteral('params')))
          set.return(inSet.invoke(value, params))
        })
        branches.else(invalid)
      })
    })
  })
  return { isNumber, isPort, inSet, checkRule }
})
