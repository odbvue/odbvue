export type OdbType =
  | 'string'
  | 'number'
  | 'guid'
  | 'boolean'
  | 'date'
  | 'timestamp'
  | 'clob'
  | 'blob'
  | 'resultset'
  | 'unknown'

export type OdbColumnType = Exclude<OdbType, 'blob' | 'resultset' | 'unknown'>
export type TypeScriptTarget = 'model' | 'json'
export type OdbOrdsType =
  | 'STRING'
  | 'INT'
  | 'DOUBLE'
  | 'BOOLEAN'
  | 'LONG'
  | 'TIMESTAMP'
  | 'RESULTSET'

export type OdbValueTypeMap = {
  string: string
  number: number
  guid: string
  boolean: boolean
  date: Date
  timestamp: Date
  clob: string
  blob: Buffer
  resultset: unknown[]
  unknown: unknown
}

export type OdbValueForType<TType extends OdbType> = OdbValueTypeMap[TType]

type OdbTypeDefinition = {
  typescript: Record<TypeScriptTarget, string>
  ords: OdbOrdsType
  oracle?: (options: { length?: number }) => string
  columnBuilder?: string
  supportsLength?: true
}

export const odbTypes = {
  string: {
    typescript: { model: 'string', json: 'string' },
    ords: 'STRING',
    oracle: ({ length }) => `VARCHAR2(${length ?? 255} CHAR)`,
    columnBuilder: 'string',
    supportsLength: true,
  },
  number: {
    typescript: { model: 'number', json: 'number' },
    ords: 'DOUBLE',
    oracle: () => 'NUMBER',
    columnBuilder: 'number',
  },
  guid: {
    typescript: { model: 'string', json: 'string' },
    ords: 'STRING',
    oracle: () => 'RAW(16)',
    columnBuilder: 'guid',
  },
  boolean: {
    typescript: { model: 'boolean', json: 'boolean' },
    ords: 'BOOLEAN',
    oracle: () => 'NUMBER(1)',
    columnBuilder: 'boolean',
  },
  date: {
    typescript: { model: 'Date', json: 'string' },
    ords: 'TIMESTAMP',
    oracle: () => 'DATE',
    columnBuilder: 'column',
  },
  timestamp: {
    typescript: { model: 'Date', json: 'string' },
    ords: 'TIMESTAMP',
    oracle: () => 'TIMESTAMP(6)',
    columnBuilder: 'timestamp',
  },
  clob: {
    typescript: { model: 'string', json: 'string' },
    ords: 'STRING',
    oracle: () => 'CLOB',
    columnBuilder: 'clob',
  },
  blob: { typescript: { model: 'Buffer', json: 'string' }, ords: 'STRING' },
  resultset: {
    typescript: { model: 'unknown[]', json: 'unknown[]' },
    ords: 'RESULTSET',
  },
  unknown: { typescript: { model: 'unknown', json: 'unknown' }, ords: 'STRING' },
} satisfies Record<OdbType, OdbTypeDefinition>

export function emitTypeScriptType(type: OdbType, target: TypeScriptTarget = 'model'): string {
  return odbTypes[type].typescript[target]
}

export function emitOracleType(type: OdbColumnType, options: { length?: number } = {}): string {
  return odbTypes[type].oracle(options)
}

export function emitOrdsType(type: OdbType): OdbOrdsType {
  return odbTypes[type].ords
}

export function columnBuilderMethod(type: OdbColumnType): string {
  return odbTypes[type].columnBuilder
}

export function columnTypeSupportsLength(type: OdbColumnType): boolean {
  return 'supportsLength' in odbTypes[type] && odbTypes[type].supportsLength === true
}

export function odbTypeFromOracle(dataType: string, length?: number): OdbColumnType {
  const type = normalizeOracleIdentifier(dataType)
  if (type.startsWith('TIMESTAMP')) return 'timestamp'
  if (type === 'DATE') return 'date'
  if (type === 'CLOB' || type === 'NCLOB') return 'clob'
  if (type === 'RAW') return length === 16 ? 'guid' : 'string'
  if (type === 'NUMBER' || type === 'FLOAT' || type === 'INTEGER') return 'number'
  if (/^(N?VARCHAR|N?CHAR)/.test(type)) return 'string'
  return 'string'
}

export function odbTypeFromPlsql(type: string): OdbType {
  switch (normalizeOracleIdentifier(type)) {
    case 'VARCHAR2':
      return 'string'
    case 'CLOB':
      return 'clob'
    case 'NUMBER':
    case 'PLS_INTEGER':
    case 'INTEGER':
    case 'BINARY_INTEGER':
      return 'number'
    case 'BOOLEAN':
      return 'boolean'
    case 'DATE':
      return 'date'
    case 'TIMESTAMP':
      return 'timestamp'
    case 'BLOB':
      return 'blob'
    case 'SYS_REFCURSOR':
    case 'REF CURSOR':
      return 'resultset'
    default:
      return 'unknown'
  }
}

export function odbTypeFromOrds(type: string): OdbType {
  switch (type.toUpperCase()) {
    case 'INT':
    case 'DOUBLE':
    case 'LONG':
      return 'number'
    case 'BOOLEAN':
      return 'boolean'
    case 'TIMESTAMP':
      return 'timestamp'
    case 'RESULTSET':
      return 'resultset'
    case 'STRING':
      return 'string'
    default:
      return 'unknown'
  }
}

export function ordsTypeFromPlsql(type: string): OdbOrdsType {
  switch (normalizeOracleIdentifier(type)) {
    case 'SYS_REFCURSOR':
      return 'RESULTSET'
    case 'PLS_INTEGER':
    case 'INTEGER':
    case 'BINARY_INTEGER':
      return 'INT'
    case 'DATE':
    case 'TIMESTAMP':
      return 'TIMESTAMP'
    case 'BOOLEAN':
      return 'BOOLEAN'
    default:
      return 'STRING'
  }
}

function identifierWords(name: string): string[] {
  return name.split(/[-_\s]+/).filter(Boolean)
}

export function toPascalCase(name: string): string {
  return identifierWords(name)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}

export function toCamelCase(name: string): string {
  const pascal = toPascalCase(name)
  return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

export function toKebabCase(name: string): string {
  return identifierWords(name)
    .map((word) => word.toLowerCase())
    .join('-')
}

export function stripOracleParameterPrefix(name: string): string {
  return /^[PR]_/i.test(name) ? name.slice(2) : name
}

export function oracleParameterName(
  name: string,
  options: { stripPrefix?: boolean; style?: 'camel' | 'kebab' } = {},
): string {
  const raw = options.stripPrefix === false ? name : stripOracleParameterPrefix(name)
  return options.style === 'kebab' ? toKebabCase(raw) : toCamelCase(raw)
}

export function normalizeOracleIdentifier(name: string): string {
  const trimmed = name.trim()
  return trimmed.startsWith('"') && trimmed.endsWith('"')
    ? trimmed.slice(1, -1).replace(/""/g, '"')
    : trimmed.toUpperCase()
}

export function oracleIdentifierEquals(left: string, right: string): boolean {
  return normalizeOracleIdentifier(left) === normalizeOracleIdentifier(right)
}
