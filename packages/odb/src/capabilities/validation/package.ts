import {
  cond,
  odbLiteral,
  PlsqlExpression,
  plsqlExpr,
  type PlsqlValue,
} from '../../schema/attribute.js'
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
// Oracle's JSON DOM can convert an overflowing JSON number to infinity.
const finite = (value: PlsqlValue) =>
  cond.and([
    cond.isNotNull(value),
    cond.gt(value, new PlsqlExpression('BINARY_DOUBLE', '-BINARY_DOUBLE_INFINITY')),
    cond.lt(value, new PlsqlExpression('BINARY_DOUBLE', 'BINARY_DOUBLE_INFINITY')),
  ])
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
      body.return(cond.isNotNull(parsed))
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
        each.ifThen(
          cond.and([cond.isNotNull(element), cond.eq(odbJson.isString(element), true)]),
          (string) => {
            string.set(text, odbJson.getString(items, i))
            string.ifThen(sameText(value, text), (match) => match.set(found, true))
          },
          invalid,
        )
      })
      body.return(found)
    })
  })

  const isPort = pkg.func('is_port', odbType.boolean(), (fn) => {
    const { value } = fn.parameters({ in: { value: odbType.string(32767) } })
    fn.body((body) => {
      const { port } = body.variables({ port: odbType.number() })
      body.ifThen(
        cond.or([cond.isNull(value), cond.not(cond.regexpLike(value, '^[0-9]{1,5}$', 'c'))]),
        invalid,
      )
      body.set(port, odbOracle.toNumber(value))
      body.return(cond.and([cond.isNotNull(port), cond.gte(port, 1), cond.lte(port, 65535)]))
    })
  })

  const checkRule = pkg.func('check_rule', odbType.boolean(), (fn) => {
    const { value, rule } = fn.parameters({
      in: { value: odbType.string(32767), rule: odbJson.object },
    })
    fn.body((body) => {
      const { element, params, kind, text, number, min, max } = body.variables({
        element: odbJson.element,
        params: odbJson.array,
        kind: odbType.string(32767),
        text: odbType.string(32767),
        number: odbType.number(),
        min: odbType.number(),
        max: odbType.number(),
      })
      const memberIs = body.localFunc('member_is', odbType.boolean(), (local) => {
        const { key, kind: expected } = local.parameters({
          in: { key: odbType.string(), kind: odbType.string() },
        })
        local.body((check) => {
          const { member } = check.variables({ member: odbJson.element })
          check.ifThen(
            cond.eq(odbJson.has(rule, key), true),
            (present) => present.set(member, odbJson.get(rule, key)),
            invalid,
          )
          check.ifThen(cond.isNull(member), invalid)
          check.ifThen(
            cond.or([
              cond.and([cond.eq(expected, 'string'), cond.eq(odbJson.isString(member), true)]),
              cond.and([cond.eq(expected, 'number'), cond.eq(odbJson.isNumber(member), true)]),
              cond.and([cond.eq(expected, 'array'), cond.eq(odbJson.isArray(member), true)]),
              cond.and([cond.eq(expected, 'boolean'), cond.eq(odbJson.isBoolean(member), true)]),
            ]),
            (match) => match.return(true),
          )
          check.return(false)
        })
      })
      const validMember = (key: string, type: string) =>
        cond.eq(memberIs.invoke(odbLiteral(key), odbLiteral(type)), true)
      const requiredNumber = (target: ProcedureBody) => {
        target.ifThen(
          cond.eq(isNumber.invoke(value), true),
          (parsed) => parsed.set(number, decimal(value)),
          invalid,
        )
        target.ifThen(cond.isNull(number), invalid)
      }
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
            cond.or([
              cond.not(finite(number)),
              cond.lt(number, 0),
              cond.ne(number, odbOracle.trunc(number)),
            ]),
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
          comparison.set(min, odbJson.getNumber(rule, odbLiteral('params')))
          comparison.ifThen(cond.not(finite(min)), invalid)
          requiredNumber(comparison)
          comparison.return(
            cond.or([
              cond.and([cond.eq(kind, 'greater-than'), cond.gt(number, min)]),
              cond.and([cond.eq(kind, 'less-than'), cond.lt(number, min)]),
            ]),
          )
        })
        branches.when(cond.eq(kind, 'in-range'), (range) => {
          range.ifThen(cond.not(validMember('params', 'array')), invalid)
          range.set(params, odbJson.getArray(rule, odbLiteral('params')))
          range.ifThen(cond.isNull(params), invalid)
          range.ifThen(cond.ne(odbJson.getSize(params), 2), invalid)
          for (const index of [0, 1]) {
            range.set(element, odbJson.get(params, odbLiteral(index)))
            range.ifThen(
              cond.and([cond.isNotNull(element), cond.eq(odbJson.isNumber(element), true)]),
              (numeric) =>
                numeric.set(index === 0 ? min : max, odbJson.getNumber(params, odbLiteral(index))),
              invalid,
            )
          }
          range.ifThen(
            cond.or([cond.not(finite(min)), cond.not(finite(max)), cond.gt(min, max)]),
            invalid,
          )
          requiredNumber(range)
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
