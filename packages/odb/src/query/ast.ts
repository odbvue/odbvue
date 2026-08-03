import { Column } from '../schema/column.js'

export type ComparisonOperator = '=' | '!=' | '<' | '>' | '<=' | '>=' | 'LIKE'
export type NullOperator = 'IS NULL' | 'IS NOT NULL'
export type Operator = ComparisonOperator | NullOperator

export type CompiledQuery = {
  sql: string
  bindings: Record<string, unknown>
}

/** Anything that can be compiled to a parametrized query and rendered inline. */
export type Compilable = {
  compile(): CompiledQuery
  toSQL(): string
}

// ── AST node types ────────────────────────────────────────────────────────────

export type ColumnRefNode = { kind: 'column'; name: string }
export type ValueNode = { kind: 'value'; value: unknown }
export type RawSqlNode = { kind: 'raw'; sql: string }
export type BinaryExpressionNode = {
  kind: 'binary'
  left: ExpressionNode
  op: ComparisonOperator
  right: ExpressionNode
}
export type NullTestNode = { kind: 'nullTest'; operand: ExpressionNode; op: NullOperator }
export type LogicalExpressionNode = {
  kind: 'logical'
  op: 'AND' | 'OR'
  expressions: ExpressionNode[]
}
export type NotNode = { kind: 'not'; operand: ExpressionNode }
export type FunctionCallNode = { kind: 'function'; name: string; args: ExpressionNode[] }
export type SubqueryNode = { kind: 'subquery'; query: Compilable }

export type ExpressionNode =
  | ColumnRefNode
  | ValueNode
  | RawSqlNode
  | BinaryExpressionNode
  | NullTestNode
  | LogicalExpressionNode
  | NotNode
  | FunctionCallNode
  | SubqueryNode

const NODE_KINDS = new Set([
  'column',
  'value',
  'raw',
  'binary',
  'nullTest',
  'logical',
  'not',
  'function',
  'subquery',
])

function isExpressionNode(value: unknown): value is ExpressionNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    NODE_KINDS.has((value as { kind: string }).kind)
  )
}

/** An operand accepted by the expression builder: identifier, node, or column. */
export type ExprInput = string | Column<any, string> | ExpressionNode

function toReference(input: ExprInput): ExpressionNode {
  if (typeof input === 'string') return { kind: 'column', name: input }
  if (input instanceof Column) return { kind: 'column', name: input.name }
  return input
}

function toOperand(value: unknown): ExpressionNode {
  if (value instanceof Column) return { kind: 'column', name: value.name }
  if (isExpressionNode(value)) return value
  return { kind: 'value', value }
}

// ── Expression builder ────────────────────────────────────────────────────────

export interface ExpressionBuilder {
  (left: ExprInput, op: ComparisonOperator, right: unknown): BinaryExpressionNode
  (left: ExprInput, op: NullOperator): NullTestNode
  and(expressions: ExpressionNode[]): LogicalExpressionNode
  or(expressions: ExpressionNode[]): LogicalExpressionNode
  not(expression: ExpressionNode): NotNode
  ref(name: string): ColumnRefNode
  val(value: unknown): ValueNode
  raw(sql: string): RawSqlNode
  fn(name: string, ...args: ExprInput[]): FunctionCallNode
  subquery(query: Compilable): SubqueryNode
}

export function predicate(
  left: ExprInput,
  op: Operator,
  right?: unknown,
): BinaryExpressionNode | NullTestNode {
  if (op === 'IS NULL' || op === 'IS NOT NULL') {
    return { kind: 'nullTest', operand: toReference(left), op }
  }
  return { kind: 'binary', left: toReference(left), op, right: toOperand(right) }
}

export const odbExpr: ExpressionBuilder = Object.assign(predicate as ExpressionBuilder, {
  and: (expressions: ExpressionNode[]): LogicalExpressionNode => ({
    kind: 'logical',
    op: 'AND',
    expressions,
  }),
  or: (expressions: ExpressionNode[]): LogicalExpressionNode => ({
    kind: 'logical',
    op: 'OR',
    expressions,
  }),
  not: (operand: ExpressionNode): NotNode => ({ kind: 'not', operand }),
  ref: (name: string): ColumnRefNode => ({ kind: 'column', name }),
  val: (value: unknown): ValueNode => ({ kind: 'value', value }),
  raw: (sql: string): RawSqlNode => ({ kind: 'raw', sql }),
  fn: (name: string, ...args: ExprInput[]): FunctionCallNode => ({
    kind: 'function',
    name,
    args: args.map(toReference),
  }),
  subquery: (query: Compilable): SubqueryNode => ({ kind: 'subquery', query }),
})

// ── Value rendering ───────────────────────────────────────────────────────────

/** Render a JavaScript value as an inline Oracle SQL literal. */
export function inlineValue(v: unknown): string {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? '1' : '0'
  if (v instanceof Date) {
    const iso = v.toISOString().replace('T', ' ').substring(0, 19)
    return `TO_TIMESTAMP('${iso}', 'YYYY-MM-DD HH24:MI:SS')`
  }
  if (
    typeof v === 'object' &&
    v !== null &&
    'toSQL' in v &&
    typeof (v as { toSQL(): string }).toSQL === 'function'
  ) {
    return (v as { toSQL(): string }).toSQL()
  }
  return `'${String(v).replace(/'/g, "''")}'`
}

// ── Bind context ──────────────────────────────────────────────────────────────

/** Accumulates bind parameters with sequential keys during compilation. */
export class BindContext {
  readonly bindings: Record<string, unknown> = {}
  private counter = 0

  constructor(private readonly prefix = 'w') {}

  add(value: unknown): string {
    const key = `${this.prefix}${this.counter++}`
    this.bindings[key] = value
    return key
  }
}

// ── Compiler ──────────────────────────────────────────────────────────────────

/** Parenthesize nested logical groups so operator precedence is preserved. */
function needsParens(node: ExpressionNode): boolean {
  return node.kind === 'logical'
}

/** Merge a nested compiled query's binds into the context, re-keying safely. */
function embedSubquery(query: Compilable, ctx: BindContext): string {
  const { sql, bindings } = query.compile()
  let result = sql
  const keys = Object.keys(bindings).toSorted((a, b) => b.length - a.length)
  for (const key of keys) {
    const newKey = ctx.add(bindings[key])
    result = result.replace(new RegExp(`:${key}(?![0-9A-Za-z_])`, 'g'), `:${newKey}`)
  }
  return `(${result})`
}

/** Compile an expression node into parametrized SQL, collecting binds in `ctx`. */
export function compileNode(node: ExpressionNode, ctx: BindContext): string {
  switch (node.kind) {
    case 'column':
      return node.name
    case 'raw':
      return node.sql
    case 'value':
      return `:${ctx.add(node.value)}`
    case 'function':
      return `${node.name}(${node.args.map((a) => compileNode(a, ctx)).join(', ')})`
    case 'binary':
      return `${compileNode(node.left, ctx)} ${node.op} ${compileNode(node.right, ctx)}`
    case 'nullTest':
      return `${compileNode(node.operand, ctx)} ${node.op}`
    case 'not':
      return `NOT (${compileNode(node.operand, ctx)})`
    case 'logical':
      return node.expressions
        .map((e) => (needsParens(e) ? `(${compileNode(e, ctx)})` : compileNode(e, ctx)))
        .join(` ${node.op} `)
    case 'subquery':
      return embedSubquery(node.query, ctx)
  }
}

/** Render an expression node as inline SQL with literal values (no binds). */
export function renderNode(node: ExpressionNode): string {
  switch (node.kind) {
    case 'column':
      return node.name
    case 'raw':
      return node.sql
    case 'value':
      return inlineValue(node.value)
    case 'function':
      return `${node.name}(${node.args.map(renderNode).join(', ')})`
    case 'binary':
      return `${renderNode(node.left)} ${node.op} ${renderNode(node.right)}`
    case 'nullTest':
      return `${renderNode(node.operand)} ${node.op}`
    case 'not':
      return `NOT (${renderNode(node.operand)})`
    case 'logical':
      return node.expressions
        .map((e) => (needsParens(e) ? `(${renderNode(e)})` : renderNode(e)))
        .join(` ${node.op} `)
    case 'subquery':
      return `(${node.query.toSQL()})`
  }
}

/** Compile a standalone expression node to `{ sql, bindings }`. */
export function compileExpression(node: ExpressionNode, prefix = 'w'): CompiledQuery {
  const ctx = new BindContext(prefix)
  const sql = compileNode(node, ctx)
  return { sql, bindings: ctx.bindings }
}

/** Render a standalone expression node as inline SQL. */
export function renderExpression(node: ExpressionNode): string {
  return renderNode(node)
}

/** Combine predicate nodes into a single node, AND-joined when there are many. */
export function combinePredicates(predicates: ExpressionNode[]): ExpressionNode | undefined {
  if (predicates.length === 0) return undefined
  if (predicates.length === 1) return predicates[0]
  return { kind: 'logical', op: 'AND', expressions: predicates }
}
