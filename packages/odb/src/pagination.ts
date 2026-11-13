import type { ColumnType } from './schema/column.js'

export { CURSOR_PAGE_DEFAULTS } from './constants.js'

export interface CursorPageOptions {
  defaultLimit?: number
  maxLimit?: number
}

export interface CursorOrder {
  name: string
  type: ColumnType
  direction: 'asc' | 'desc'
  length?: number
}

export interface CursorQueryMetadata {
  cursor: string
  limit: string
  order: CursorOrder[]
}

/** Decode the same lossless scalar representation used by the response serializer. */
export function cursorValueSql(
  cursor: string,
  index: number,
  column: CursorOrder,
  onError: 'ERROR' | 'NULL' = 'ERROR',
): string {
  const path = `'$[${index}]'`
  if (column.type === 'number' || column.type === 'boolean') {
    return `JSON_VALUE(${cursor}, ${path} RETURNING NUMBER ${onError} ON ERROR)`
  }
  const value = `JSON_VALUE(${cursor}, ${path} RETURNING VARCHAR2(${column.type === 'guid' ? 32 : (column.length ?? 4000)}) ${onError} ON ERROR)`
  if (column.type === 'timestamp') {
    return `TO_TIMESTAMP(${value}${onError === 'NULL' ? ' DEFAULT NULL ON CONVERSION ERROR' : ''}, 'FXYYYY-MM-DD"T"HH24:MI:SS.FF6"Z"')`
  }
  if (column.type === 'date') {
    return `TO_DATE(${value}${onError === 'NULL' ? ' DEFAULT NULL ON CONVERSION ERROR' : ''}, 'FXYYYY-MM-DD"T"HH24:MI:SS"Z"')`
  }
  return value
}
