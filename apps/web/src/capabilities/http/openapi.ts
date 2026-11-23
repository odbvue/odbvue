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

/** The subset of an OpenAPI 3.1 document used by the HTTP client. */
export interface OdbOpenApiDocument {
  security?: Record<string, readonly string[]>[]
  paths?: Record<string, Record<string, Operation | undefined>>
  components?: {
    schemas?: Record<string, Schema>
    securitySchemes?: Record<string, { type?: string; scheme?: string }>
  }
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
