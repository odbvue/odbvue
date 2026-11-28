export interface JsonNode {
  id: string
  key?: string
  kind: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'
  display: string
  children?: JsonNode[]
}

export function createJsonNode(
  value: unknown,
  path: string[] = [],
  ancestors = new WeakSet<object>(),
): JsonNode {
  const node: JsonNode = {
    id: JSON.stringify(path),
    key: path.at(-1),
    kind: 'null',
    display: 'null',
  }
  if (value === null) return node
  if (typeof value === 'string') return { ...node, kind: 'string', display: value }
  if (typeof value === 'boolean') return { ...node, kind: 'boolean', display: String(value) }
  if (typeof value === 'number' && Number.isFinite(value))
    return { ...node, kind: 'number', display: String(value) }
  if (
    typeof value !== 'object' ||
    ancestors.has(value) ||
    Object.getOwnPropertySymbols(value).length ||
    (!Array.isArray(value) &&
      Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  )
    throw new TypeError(`Invalid JSON value at ${node.id}`)

  ancestors.add(value)
  const entries = Array.isArray(value)
    ? Array.from(value, (item: unknown, index) => [String(index), item] as const)
    : Object.entries(value)
  const children = entries.map(([key, item]) => createJsonNode(item, [...path, key], ancestors))
  ancestors.delete(value)
  const array = Array.isArray(value)
  return {
    ...node,
    kind: array ? 'array' : 'object',
    display: array
      ? children.length
        ? `[${children.length}]`
        : '[]'
      : children.length
        ? `{${children.length}}`
        : '{}',
    children: children.length ? children : undefined,
  }
}

export function hasJsonChildren(node: JsonNode): boolean {
  return !!node.children?.length
}

export function getJsonRecordTable(node: JsonNode) {
  const first = node.children?.[0]
  if (node.kind !== 'array' || first?.kind !== 'object' || !first.children?.length) return undefined
  const columns: string[] = []
  for (const cell of first.children) {
    if (cell.key === undefined) return undefined
    columns.push(cell.key)
  }
  const rows: { id: string; cells: JsonNode[] }[] = []
  for (const row of node.children ?? []) {
    if (
      row.kind !== 'object' ||
      row.children?.length !== columns.length ||
      row.children.some((cell) => cell.kind === 'object' || cell.kind === 'array')
    )
      return undefined
    const cells: JsonNode[] = []
    for (const key of columns) {
      const cell = row.children.find((candidate) => candidate.key === key)
      if (!cell) return undefined
      cells.push(cell)
    }
    rows.push({ id: row.id, cells })
  }
  return { columns, rows }
}
