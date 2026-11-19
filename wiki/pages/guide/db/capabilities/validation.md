# Validation

`odbValidation` installs the `odb_validation` PL/SQL package. Install it before
packages that call it, including [Settings](./settings):

```ts
import { defineMigration, odbValidation, odbSettings } from '@odbvue/odb'

defineMigration('20260802140000_settings', { schema: 'APP_USER' })
  .install(odbValidation)
  .install(odbSettings)
```

`odbValidation.checkRule(value, rule)` returns a PL/SQL `BOOLEAN`. `rule` is a
`JSON_OBJECT_T` with `type`, optional `message`, and the parameters described
below. It returns `false` for a non-matching value, malformed rule, or unsupported
rule. Always check the result and raise an appropriate application error.
`message` is validated as a string but is not emitted by the database package.

```ts
import { cond, odbJson, odbLiteral, odbType, odbValidation } from '@odbvue/odb'

pkg.proc('update_name', { in: { name: odbType.string(200) } }, ({ params, body }) => {
  const { rule } = body.variables({ rule: odbJson.object })
  body.set(rule, odbJson.parse(odbLiteral('{"type":"min-length","params":3}')))
  body.ifThen(cond.eq(odbValidation.checkRule(params.name, rule), false), (invalid) =>
    invalid.invalid('NAME_INVALID'),
  )
})
```

The exported `ValidationRule` TypeScript type describes the portable rules:

| Rule                        | Parameters                       |
| --------------------------- | -------------------------------- |
| `required`                  | Optional boolean                 |
| `min-length`, `max-length`  | Nonnegative integer              |
| `equals`, `equals-not`      | String                           |
| `greater-than`, `less-than` | Number                           |
| `in-range`                  | Two ascending numbers, inclusive |
| `set`                       | Array of strings                 |

Values are strings; Oracle treats empty strings as `NULL`. Lengths count UTF-16
code units. Numeric rules accept signed decimal strings with at most 15 integer
and 10 fractional digits and use explicit decimal separators. `inSet(value, items)`
checks a `JSON_ARRAY_T` of strings, and `isNumber(value)` checks the same decimal
syntax. `isPort(value)` checks a decimal integer from 1 through 65535. All return
`false` for invalid input. Named custom rules remain the
responsibility of the consuming capability; they are not accepted by `checkRule`.
