import type { ParamNode, PlsqlType } from './attribute.js'
import {
  applicationNode,
  type ApplicationLike,
  type FunctionNode,
  type ProcedureNode,
} from './package.js'
import {
  emitTypeScriptType,
  odbTypeFromPlsql,
  oracleParameterName,
  toCamelCase,
  toPascalCase,
} from '../model.js'

export type ContractOptions = {
  /** Override the generated interface name (default: PascalCase of the package name). */
  interfaceName?: string
  /** Strip a leading `P_`/`R_` prefix from parameter names (default: true). */
  stripParamPrefix?: boolean
}

/** Map a PL/SQL type to the nearest TypeScript type. */
export function plsqlToTsType(type: PlsqlType | string): string {
  return emitTypeScriptType(odbTypeFromPlsql(type))
}

function paramFieldName(plsqlArg: string, stripPrefix: boolean): string {
  return oracleParameterName(plsqlArg, { stripPrefix })
}

function objectType(fields: { name: string; type: string }[]): string {
  if (fields.length === 0) return '{}'
  const body = fields.map((f) => `${f.name}: ${f.type}`).join('; ')
  return `{ ${body} }`
}

function inputFields(params: ParamNode[], stripPrefix: boolean): { name: string; type: string }[] {
  return params
    .filter((p) => p.direction === 'IN' || p.direction === 'IN OUT')
    .map((p) => ({ name: paramFieldName(p.name, stripPrefix), type: plsqlToTsType(p.type) }))
}

function outputFields(params: ParamNode[], stripPrefix: boolean): { name: string; type: string }[] {
  return params
    .filter((p) => p.direction === 'OUT' || p.direction === 'IN OUT')
    .map((p) => ({ name: paramFieldName(p.name, stripPrefix), type: plsqlToTsType(p.type) }))
}

function inputSignature(fields: { name: string; type: string }[]): string {
  return fields.length === 0 ? '' : `input: ${objectType(fields)}`
}

function procedureMethod(proc: ProcedureNode, stripPrefix: boolean): string {
  const method = toCamelCase(proc.name)
  const input = inputSignature(inputFields(proc.params, stripPrefix))
  const outputs = outputFields(proc.params, stripPrefix)
  const returnType = outputs.length === 0 ? 'void' : objectType(outputs)
  return `  ${method}(${input}): Promise<${returnType}>`
}

function functionMethod(fn: FunctionNode, stripPrefix: boolean): string {
  const method = toCamelCase(fn.name)
  const input = inputSignature(inputFields(fn.params, stripPrefix))
  return `  ${method}(${input}): Promise<${plsqlToTsType(fn.returnType)}>`
}

/**
 * Generate a TypeScript interface describing the callable surface of a package.
 * Procedures map to methods whose input is derived from IN/IN OUT parameters and
 * whose result is derived from OUT/IN OUT parameters; functions map to methods
 * returning their PL/SQL return type.
 */
export function generatePackageContract(
  pkg: ApplicationLike,
  options: ContractOptions = {},
): string {
  const node = applicationNode(pkg)
  const stripPrefix = options.stripParamPrefix ?? true
  const interfaceName = options.interfaceName ?? toPascalCase(node.name)

  const members = [
    ...node.procedures.map((p) => procedureMethod(p, stripPrefix)),
    ...node.functions.map((f) => functionMethod(f, stripPrefix)),
  ]

  return [`export interface ${interfaceName} {`, ...members, '}', ''].join('\n')
}
