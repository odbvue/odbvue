// Decodes ODB `json` fields (OpenAPI `x-odb-type: json`), which ORDS delivers as JSON text, into values.

type Schema = {
  $ref?: string
  type?: string | string[]
  properties?: Record<string, Schema>
  items?: Schema
  'x-odb-type'?: string
}

type Operation = {
  security?: Record<string, readonly string[]>[]
  responses?: Record<
    string,
    { description?: string; content?: Record<string, { schema?: Schema }> }
  >
}

/** The subset of an OpenAPI 3.1 document needed to locate ODB `json` fields. */
export interface OdbOpenApiDocument {
  security?: Record<string, readonly string[]>[]
  paths?: Record<string, Record<string, Operation | undefined>>
  components?: {
    schemas?: Record<string, Schema>
    securitySchemes?: Record<string, { type?: string; scheme?: string }>
  }
}

function resolve(document: OdbOpenApiDocument, schema: Schema | undefined): Schema | undefined {
  let current = schema
  for (let depth = 0; current?.$ref && depth < 16; depth++) {
    current = document.components?.schemas?.[current.$ref.split('/').pop() ?? '']
  }
  return current
}

function segments(path: string): string[] {
  const [pathname = ''] = path.split(/[?#]/, 1)
  return pathname.split('/').filter(Boolean)
}

function findOperation(
  document: OdbOpenApiDocument,
  method: string,
  request: string,
): Operation | undefined {
  const actual = segments(request)
  const exact = document.paths?.[`/${actual.join('/')}`]?.[method.toLowerCase()]
  if (exact) return exact
  for (const [template, operations] of Object.entries(document.paths ?? {})) {
    const expected = segments(template)
    if (
      expected.length === actual.length &&
      expected.every((part, index) => /^\{.+\}$/.test(part) || part === actual[index])
    ) {
      return operations[method.toLowerCase()]
    }
  }
  return undefined
}

export function requiresBearerToken(
  document: OdbOpenApiDocument,
  method: string,
  request: string,
): boolean {
  const operation = findOperation(document, method, request)
  if (!operation) return false
  const security = operation.security ?? document.security ?? []
  if (security.some((requirement) => Object.keys(requirement).length === 0)) return false
  return security.some((requirement) =>
    Object.keys(requirement).some((name) => {
      const scheme = document.components?.securitySchemes?.[name]
      return scheme?.type === 'http' && scheme.scheme?.toLowerCase() === 'bearer'
    }),
  )
}

function decode(document: OdbOpenApiDocument, schema: Schema | undefined, value: unknown): unknown {
  const resolved = resolve(document, schema)
  if (!resolved || value === null || value === undefined) return value
  if (resolved['x-odb-type'] === 'json') {
    if (typeof value !== 'string') return value
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }
  if (Array.isArray(value)) return value.map((item) => decode(document, resolved.items, item))
  if (typeof value === 'object' && resolved.properties) {
    const record = value as Record<string, unknown>
    const result: Record<string, unknown> = { ...record }
    for (const [key, property] of Object.entries(resolved.properties)) {
      if (key in record) result[key] = decode(document, property, record[key])
    }
    return result
  }
  return value
}

/** Parses `json` fields of a successful response according to the OpenAPI operation for `method` and `request`. */
export function decodeOdbJson<T>(
  document: OdbOpenApiDocument,
  method: string,
  request: string,
  data: T,
): T {
  const schema = findOperation(document, method, request)?.responses?.['200']?.content?.[
    'application/json'
  ]?.schema
  return schema ? (decode(document, schema, data) as T) : data
}
