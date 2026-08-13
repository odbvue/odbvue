import {
  generateOrdsClient,
  generateOrdsClientModules,
  type OrdsClientOptions,
} from './ords-client.js'
import {
  applicationNode,
  compileApplicationEndpoints,
  emitApplicationSql,
  type ApplicationLike,
  type OdbApplication,
} from './schema/package.js'
import { generatePackageContract, type ContractOptions } from './schema/contract.js'
import {
  odbTypeFromOrds,
  odbTypeToJsonSchema,
  oracleParameterName,
  toPascalCase,
  type OdbType,
} from './model.js'

export type ApplicationArtifacts = {
  plsql: string
  ords: string
  contract: string
  client: string
  openapi: Record<string, unknown>
}

export type ApplicationGeneratorOptions = {
  contract?: ContractOptions
  client?: OrdsClientOptions
  openapi?: OpenApiOptions
}

export type OpenApiOptions = {
  title?: string
  version?: string
}

/** Emit every external contract from one canonical ODB application model. */
export function generateApplication(
  application: ApplicationLike,
  options: ApplicationGeneratorOptions = {},
): ApplicationArtifacts {
  return {
    plsql: emitApplicationSql(application),
    ords: emitApplicationOrdsSql(application),
    contract: generatePackageContract(application, options.contract),
    client: generateApplicationClient(application, options.client),
    openapi: generateApplicationOpenApi(application, options.openapi),
  }
}

/** Emit ORDS registration SQL from application service metadata. */
export function emitApplicationOrdsSql(
  application: ApplicationLike,
  options: { schema?: string } = {},
): string {
  const definedModules = new Set<string>()
  return compileApplicationEndpoints(application)
    .map((endpoint) => {
      const defineModule = !definedModules.has(endpoint.module)
      definedModules.add(endpoint.module)
      return endpoint.toSQLUp({ ...options, defineModule })
    })
    .join('\n\n')
}

/** Emit SQL that removes every ORDS module declared by an application. */
export function emitApplicationOrdsDownSql(
  application: ApplicationLike,
  options: { schema?: string } = {},
): string {
  const modules = new Set<string>()
  return compileApplicationEndpoints(application)
    .filter((endpoint) => {
      if (modules.has(endpoint.module)) return false
      modules.add(endpoint.module)
      return true
    })
    .map((endpoint) => endpoint.toSQLDown(options))
    .join('\n\n')
}

/** Emit a TypeScript ORDS client directly from an application model. */
export function generateApplicationClient(
  application: ApplicationLike,
  options: OrdsClientOptions = {},
): string {
  return generateOrdsClient(compileApplicationEndpoints(application), options)
}

/** Emit per-module TypeScript clients from one or more application models. */
export function generateApplicationClientModules(
  applications: ApplicationLike[],
  options: OrdsClientOptions = {},
) {
  return generateOrdsClientModules(applications.flatMap(compileApplicationEndpoints), options)
}

/** Emit OpenAPI 3.1 from procedure service metadata in the application model. */
export function generateApplicationOpenApi(
  application: ApplicationLike,
  options: OpenApiOptions = {},
): Record<string, unknown> {
  const node = applicationNode(application)
  return generateApplicationsOpenApi([node], {
    title: options.title ?? node.name,
    version: options.version,
  })
}

/** Emit one OpenAPI 3.1 document for every service in the supplied applications. */
export function generateApplicationsOpenApi(
  applications: ApplicationLike[],
  options: OpenApiOptions = {},
): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {}
  const schemas: Record<string, Record<string, unknown>> = {}

  for (const application of applications) {
    for (const endpoint of compileApplicationEndpoints(application).map((value) =>
      value.toNode(),
    )) {
      const path = `/${[endpoint.basePath, endpoint.pattern]
        .map((part) => part.replace(/^\/+|\/+$/g, ''))
        .filter(Boolean)
        .join('/')}`.replace(/:([A-Za-z0-9_-]+)/g, '{$1}')
      const parameters = endpoint.params
        .filter((param) => param.direction === 'IN' || param.direction === 'IN OUT')
        .map((param) => ({
          name: param.name,
          in: param.sourceType === 'URI' ? 'path' : 'header',
          required: param.sourceType === 'URI',
          schema: openApiSchema(param.paramType, param.odbType),
        }))
      const operationName = toPascalCase(`${endpoint.module}_${endpoint.procedureName}`)
      const outputs: Record<string, Record<string, unknown>> = {}
      const requiredOutputs: string[] = []

      for (const param of endpoint.params.filter(
        (value) => value.direction === 'OUT' || value.direction === 'IN OUT',
      )) {
        const outputName = oracleParameterName(param.plsqlArg)
        requiredOutputs.push(outputName)
        if (param.resultColumns?.length) {
          const itemName = `${operationName}${toPascalCase(param.name)}Item`
          schemas[itemName] = objectSchema(
            Object.fromEntries(
              param.resultColumns.map((column) => [
                oracleParameterName(column.name, { stripPrefix: false }),
                nullableSchema(odbTypeToJsonSchema(column.type), column.nullable),
              ]),
            ),
            param.resultColumns
              .filter((column) => !column.nullable)
              .map((column) => oracleParameterName(column.name, { stripPrefix: false })),
          )
          outputs[outputName] = {
            type: 'array',
            items: { $ref: `#/components/schemas/${itemName}` },
            'x-odb-oracle': { plsqlType: 'SYS_REFCURSOR', ordsType: param.paramType },
          }
        } else {
          outputs[outputName] = openApiSchema(param.paramType, param.odbType)
        }
      }

      const responseName = `${operationName}Response`
      schemas[responseName] = objectSchema(outputs, requiredOutputs)

      paths[path] ??= {}
      paths[path][endpoint.method.toLowerCase()] = {
        operationId: `${endpoint.module}_${endpoint.procedureName}`,
        summary: endpoint.comment,
        parameters,
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/${responseName}` },
              },
            },
          },
        },
      }
    }
  }

  return {
    openapi: '3.1.0',
    info: { title: options.title ?? 'ODB API', version: options.version ?? '1.0.0' },
    paths,
    components: { schemas },
  }
}

function openApiSchema(
  type: Parameters<typeof odbTypeFromOrds>[0],
  odbType?: OdbType,
): Record<string, unknown> {
  return odbTypeToJsonSchema(odbType ?? odbTypeFromOrds(type))
}

function nullableSchema(
  schema: Record<string, unknown>,
  nullable: boolean,
): Record<string, unknown> {
  if (!nullable) return schema
  const type = schema.type
  return typeof type === 'string' ? { ...schema, type: [type, 'null'] } : schema
}

function objectSchema(
  properties: Record<string, Record<string, unknown>>,
  required: string[],
): Record<string, unknown> {
  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
    additionalProperties: false,
  }
}

export type { ApplicationLike, OdbApplication }
