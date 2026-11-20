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
below. It returns `true` or `false`, never `NULL`. Non-matching values, missing
or unsupported rule types, and missing or malformed required parameters return
`false`. Always check the result and raise an appropriate application error.
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

| Rule                        | Parameters                     | Result for `NULL` or `''`                  |
| --------------------------- | ------------------------------ | ------------------------------------------ |
| `required`                  | Optional boolean               | `false`                                    |
| `min-length`, `max-length`  | Nonnegative integer            | Tests a length of zero                     |
| `equals`                    | String                         | `true` only for an empty parameter string  |
| `equals-not`                | String                         | `false` only for an empty parameter string |
| `greater-than`, `less-than` | Number                         | `false`                                    |
| `in-range`                  | Two ordered numbers, inclusive | `false`                                    |
| `set`                       | Array of strings               | `true` only if the set has an empty string |

Oracle treats empty input strings as `NULL`. A JSON `null` parameter or array
element is invalid and is not equivalent to a JSON empty string. Numeric
parameters must be finite Oracle numbers. Lengths count
UTF-16 code units. Numeric rules accept signed decimal strings with at most 15 integer
and 10 fractional digits and use explicit decimal separators. `inSet(value, items)`
checks a `JSON_ARRAY_T` of strings, and `isNumber(value)` checks the same decimal
syntax. `isPort(value)` checks a decimal integer from 1 through 65535. All return
`false` for invalid input. Named custom rules remain the
responsibility of the consuming capability; they are not accepted by `checkRule`.

To run the Oracle integration tests, set `ODB_TEST_CONNECT_STRING`,
`ODB_TEST_USER`, and `ODB_TEST_PASSWORD` for a development database. For a
wallet connection, also set `ODB_TEST_WALLET_DIR` and, if needed,
`ODB_TEST_WALLET_PASSWORD`. Then run
`pnpm --filter @odbvue/odb test:run validation.oracle.test.ts`.
The tests execute the generated PL/SQL without installing any database objects.
