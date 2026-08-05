import {
  generateOrdsClient,
  generateOrdsClientModules,
  type OrdsClientOptions,
} from './ords-client.js'
import {
  applicationEndpoints,
  applicationNode,
  emitApplicationOrdsSql,
  emitApplicationSql,
  type ApplicationLike,
  type OdbApplication,
} from './schema/package.js'
import { generatePackageContract, type ContractOptions } from './schema/contract.js'
import { emitTypeScriptType, odbTypeFromOrds, oracleParameterName } from './model.js'

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

/** Emit a TypeScript ORDS client directly from an application model. */
export function generateApplicationClient(
  application: ApplicationLike,
  options: OrdsClientOptions = {},
): string {
  return generateOrdsClient(applicationEndpoints(application), options)
}

/** Emit per-module TypeScript clients from one or more application models. */
export function generateApplicationClientModules(
  applications: ApplicationLike[],
  options: OrdsClientOptions = {},
) {
  return generateOrdsClientModules(applications.flatMap(applicationEndpoints), options)
}

/** Emit OpenAPI 3.1 from procedure service metadata in the application model. */
export function generateApplicationOpenApi(
  application: ApplicationLike,
  options: OpenApiOptions = {},
): Record<string, unknown> {
  const node = applicationNode(application)
  const paths: Record<string, Record<string, unknown>> = {}

  for (const endpoint of applicationEndpoints(node).map((value) => value.toNode())) {
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
        schema: openApiSchema(param.paramType),
      }))
    const outputs = Object.fromEntries(
      endpoint.params
        .filter((param) => param.direction === 'OUT' || param.direction === 'IN OUT')
        .map((param) => [
          oracleParameterName(param.plsqlArg),
          param.resultColumns?.length
            ? {
                type: 'array',
                items: {
                  type: 'object',
                  properties: Object.fromEntries(
                    param.resultColumns.map((column) => [
                      oracleParameterName(column.name, { stripPrefix: false }),
                      {
                        ...jsonSchema(emitTypeScriptType(column.type, 'json')),
                        nullable: column.nullable || undefined,
                      },
                    ]),
                  ),
                },
              }
            : openApiSchema(param.paramType),
        ]),
    )

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
              schema: { type: 'object', properties: outputs },
            },
          },
        },
      },
    }
  }

  return {
    openapi: '3.1.0',
    info: { title: options.title ?? node.name, version: options.version ?? '1.0.0' },
    paths,
  }
}

function openApiSchema(type: Parameters<typeof odbTypeFromOrds>[0]): Record<string, unknown> {
  return jsonSchema(emitTypeScriptType(odbTypeFromOrds(type), 'json'))
}

function jsonSchema(type: string): Record<string, unknown> {
  if (type === 'number') return { type: 'number' }
  if (type === 'boolean') return { type: 'boolean' }
  if (type.endsWith('[]')) return { type: 'array', items: {} }
  if (type === 'unknown') return {}
  return { type: 'string' }
}

export type { ApplicationLike, OdbApplication }
