type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' | 'CROSS'
type ComparisonOperator =
  | '='
  | '!='
  | '<'
  | '>'
  | '<='
  | '>='
  | 'LIKE'
  | 'IN'
  | 'NOT IN'
  | 'IS NULL'
  | 'IS NOT NULL'
type LogicalOperator = 'AND' | 'OR'
type OrderDirection = 'ASC' | 'DESC'

interface JoinClause {
  type: JoinType
  table: string
  alias?: string
  conditions: JoinCondition[]
}

interface JoinCondition {
  leftColumn: string
  operator: ComparisonOperator
  rightColumn: string
}

interface WhereCondition {
  column: string
  operator: ComparisonOperator
  value: string | number | boolean | null | Array<string | number>
  logical?: LogicalOperator
}

interface SelectColumn {
  column: string
  alias?: string
  table?: string
}

interface OrderByClause {
  column: string
  direction: OrderDirection
}

export class Query {
  private tables: Map<string, Record<string, unknown>> = new Map()
  private fromTable: string = ''
  private fromAlias?: string
  private joins: JoinClause[] = []
  private currentJoin?: JoinClause
  private selectColumns: SelectColumn[] = []
  private whereConditions: WhereCondition[] = []
  private rawWhereConditions: string[] = []
  private currentColumn?: string
  private orderByClauses: OrderByClause[] = []
  private groupByColumns: string[] = []
  private havingConditions: WhereCondition[] = []
  private isHavingContext: boolean = false
  private limitValue?: number
  private limitParam?: string
  private offsetValue?: number
  private offsetParam?: string
  private distinctFlag: boolean = false

  public DML: string = ''

  constructor(tables?: Record<string, unknown>[] | Record<string, unknown>) {
    if (tables) {
      const tableArray = Array.isArray(tables) ? tables : [tables]
      for (const table of tableArray) {
        const tableName =
          typeof table === 'object' && table !== null && 'name' in table
            ? String(table.name)
            : String(table)
        this.tables.set(tableName, table)
      }
    }
  }

  from(tableName: string, alias?: string): this {
    if (this.tables.size > 0 && !this.tables.has(tableName)) {
      throw new Error(`Table "${tableName}" not found in schema`)
    }
    this.fromTable = tableName
    this.fromAlias = alias
    return this
  }

  join(tableName: string, alias?: string): this {
    return this.innerJoin(tableName, alias)
  }

  innerJoin(tableName: string, alias?: string): this {
    return this.addJoin('INNER', tableName, alias)
  }

  leftJoin(tableName: string, alias?: string): this {
    return this.addJoin('LEFT', tableName, alias)
  }

  rightJoin(tableName: string, alias?: string): this {
    return this.addJoin('RIGHT', tableName, alias)
  }

  fullJoin(tableName: string, alias?: string): this {
    return this.addJoin('FULL', tableName, alias)
  }

  crossJoin(tableName: string, alias?: string): this {
    return this.addJoin('CROSS', tableName, alias)
  }

  private addJoin(type: JoinType, tableName: string, alias?: string): this {
    if (this.tables.size > 0 && !this.tables.has(tableName)) {
      throw new Error(`Table "${tableName}" not found in schema`)
    }
    this.currentJoin = {
      type,
      table: tableName,
      alias,
      conditions: [],
    }
    this.joins.push(this.currentJoin)
    return this
  }

  on(leftColumn: string, operator: ComparisonOperator, rightColumn: string): this
  on(leftColumn: string): this
  on(leftColumn: string, operator?: ComparisonOperator, rightColumn?: string): this {
    if (!this.currentJoin) {
      throw new Error('No join clause to add ON condition to')
    }
    if (operator && rightColumn) {
      this.currentJoin.conditions.push({
        leftColumn,
        operator,
        rightColumn,
      })
    } else {
      this.currentColumn = leftColumn
    }
    return this
  }

  eq(columnOrValue: string): this {
    return this.addCondition('=', columnOrValue)
  }

  neq(columnOrValue: string): this {
    return this.addCondition('!=', columnOrValue)
  }

  lt(columnOrValue: string): this {
    return this.addCondition('<', columnOrValue)
  }

  lte(columnOrValue: string): this {
    return this.addCondition('<=', columnOrValue)
  }

  gt(columnOrValue: string): this {
    return this.addCondition('>', columnOrValue)
  }

  gte(columnOrValue: string): this {
    return this.addCondition('>=', columnOrValue)
  }

  private addCondition(operator: ComparisonOperator, rightValue: string): this {
    if (!this.currentColumn) {
      throw new Error('No column specified for condition')
    }
    if (
      (this.currentJoin && this.currentJoin.conditions.length === 0) ||
      (this.currentJoin && this.joins[this.joins.length - 1] === this.currentJoin)
    ) {
      this.currentJoin.conditions.push({
        leftColumn: this.currentColumn,
        operator,
        rightColumn: rightValue,
      })
    } else {
      this.whereConditions.push({
        column: this.currentColumn,
        operator,
        value: rightValue,
        logical: this.whereConditions.length > 0 ? 'AND' : undefined,
      })
    }
    this.currentColumn = undefined
    return this
  }

  select(column: string, alias?: string): this
  select(columns: string[]): this
  select(columnOrColumns: string | string[], alias?: string): this {
    if (Array.isArray(columnOrColumns)) {
      for (const col of columnOrColumns) {
        this.selectColumns.push({ column: col })
      }
    } else {
      this.selectColumns.push({ column: columnOrColumns, alias })
    }
    return this
  }

  selectAll(): this {
    this.selectColumns.push({ column: '*' })
    return this
  }

  distinct(): this {
    this.distinctFlag = true
    return this
  }

  where(column: string): this {
    this.currentColumn = column
    this.currentJoin = undefined
    return this
  }

  and(column: string): this {
    this.currentColumn = column
    return this
  }

  or(column: string): this {
    const lastCondition = this.whereConditions[this.whereConditions.length - 1]
    if (lastCondition) {
      lastCondition.logical = 'OR'
    }
    this.currentColumn = column
    return this
  }

  equals(value: string | number | boolean): this {
    return this.addWhereCondition('=', value)
  }

  notEquals(value: string | number | boolean): this {
    return this.addWhereCondition('!=', value)
  }

  lessThan(value: string | number): this {
    return this.addWhereCondition('<', value)
  }

  lessThanOrEqual(value: string | number): this {
    return this.addWhereCondition('<=', value)
  }

  greaterThan(value: string | number): this {
    return this.addWhereCondition('>', value)
  }

  greaterThanOrEqual(value: string | number): this {
    return this.addWhereCondition('>=', value)
  }

  like(pattern: string): this {
    return this.addWhereCondition('LIKE', pattern)
  }

  in(values: Array<string | number>): this {
    return this.addWhereCondition('IN', values)
  }

  notIn(values: Array<string | number>): this {
    return this.addWhereCondition('NOT IN', values)
  }

  isNull(): this {
    return this.addWhereCondition('IS NULL', null)
  }

  isNotNull(): this {
    return this.addWhereCondition('IS NOT NULL', null)
  }

  whereRaw(condition: string): this {
    this.rawWhereConditions.push(condition)
    return this
  }

  private addWhereCondition(
    operator: ComparisonOperator,
    value: string | number | boolean | null | Array<string | number>,
  ): this {
    if (!this.currentColumn) {
      throw new Error('No column specified for WHERE condition')
    }
    if (this.isHavingContext) {
      return this.addHavingCondition(operator, value)
    }
    const logical = this.whereConditions.length > 0 ? 'AND' : undefined
    this.whereConditions.push({
      column: this.currentColumn,
      operator,
      value,
      logical,
    })
    this.currentColumn = undefined
    return this
  }

  orderBy(column: string, direction: OrderDirection = 'ASC'): this {
    this.orderByClauses.push({ column, direction })
    return this
  }

  groupBy(column: string): this
  groupBy(columns: string[]): this
  groupBy(columnOrColumns: string | string[]): this {
    if (Array.isArray(columnOrColumns)) {
      this.groupByColumns.push(...columnOrColumns)
    } else {
      this.groupByColumns.push(columnOrColumns)
    }
    return this
  }

  having(column: string): this {
    this.currentColumn = column
    this.isHavingContext = true
    return this
  }

  private addHavingCondition(
    operator: ComparisonOperator,
    value: string | number | boolean | null | Array<string | number>,
  ): this {
    if (!this.currentColumn) {
      throw new Error('No column specified for HAVING condition')
    }
    const logical = this.havingConditions.length > 0 ? 'AND' : undefined
    this.havingConditions.push({
      column: this.currentColumn,
      operator,
      value,
      logical,
    })
    this.currentColumn = undefined
    this.isHavingContext = false
    return this
  }

  limit(value: number): this {
    this.limitValue = value
    this.limitParam = undefined
    return this
  }

  limitP(param: string): this {
    this.limitParam = param
    this.limitValue = undefined
    return this
  }

  offset(value: number): this {
    this.offsetValue = value
    this.offsetParam = undefined
    return this
  }

  offsetP(param: string): this {
    this.offsetParam = param
    this.offsetValue = undefined
    return this
  }

  private formatValue(value: string | number | boolean | null | Array<string | number>): string {
    if (value === null) {
      return ''
    }
    if (Array.isArray(value)) {
      return `(${value.map((v) => this.formatSingleValue(v)).join(', ')})`
    }
    return this.formatSingleValue(value)
  }

  private formatSingleValue(value: string | number | boolean): string {
    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`
    }
    if (typeof value === 'boolean') {
      return value ? '1' : '0'
    }
    return String(value)
  }

  private buildSelectClause(): string {
    const distinct = this.distinctFlag ? 'DISTINCT ' : ''
    if (this.selectColumns.length === 0) {
      return `SELECT ${distinct}*`
    }
    const columns = this.selectColumns.map((col) => {
      let result = col.table ? `${col.table}.${col.column}` : col.column
      if (col.alias) {
        result += ` AS ${col.alias}`
      }
      return result
    })
    return `SELECT ${distinct}${columns.join(', ')}`
  }

  private buildFromClause(): string {
    if (!this.fromTable) {
      throw new Error('No FROM table specified')
    }
    let clause = `FROM ${this.fromTable}`
    if (this.fromAlias) {
      clause += ` ${this.fromAlias}`
    }
    return clause
  }

  private buildJoinClauses(): string {
    if (this.joins.length === 0) {
      return ''
    }
    return this.joins
      .map((join) => {
        let clause = `${join.type} JOIN ${join.table}`
        if (join.alias) {
          clause += ` ${join.alias}`
        }
        if (join.conditions.length > 0 && join.type !== 'CROSS') {
          const conditions = join.conditions
            .map((cond) => `${cond.leftColumn} ${cond.operator} ${cond.rightColumn}`)
            .join(' AND ')
          clause += ` ON ${conditions}`
        }
        return clause
      })
      .join('\n')
  }

  private buildWhereClause(): string {
    const allConditions: string[] = []

    if (this.whereConditions.length > 0) {
      const conditions = this.whereConditions.map((cond, index) => {
        let condition = ''
        if (index > 0 && cond.logical) {
          condition += `${cond.logical} `
        }
        condition += cond.column
        if (cond.operator === 'IS NULL' || cond.operator === 'IS NOT NULL') {
          condition += ` ${cond.operator}`
        } else {
          condition += ` ${cond.operator} ${this.formatValue(cond.value)}`
        }
        return condition
      })
      allConditions.push(...conditions)
    }

    for (const rawCond of this.rawWhereConditions) {
      if (allConditions.length > 0) {
        allConditions.push(`AND ${rawCond}`)
      } else {
        allConditions.push(rawCond)
      }
    }

    if (allConditions.length === 0) {
      return ''
    }
    return `WHERE ${allConditions.join(' ')}`
  }

  private buildGroupByClause(): string {
    if (this.groupByColumns.length === 0) {
      return ''
    }
    return `GROUP BY ${this.groupByColumns.join(', ')}`
  }

  private buildHavingClause(): string {
    if (this.havingConditions.length === 0) {
      return ''
    }
    const conditions = this.havingConditions.map((cond, index) => {
      let condition = ''
      if (index > 0 && cond.logical) {
        condition += `${cond.logical} `
      }
      condition += cond.column
      if (cond.operator === 'IS NULL' || cond.operator === 'IS NOT NULL') {
        condition += ` ${cond.operator}`
      } else {
        condition += ` ${cond.operator} ${this.formatValue(cond.value)}`
      }
      return condition
    })
    return `HAVING ${conditions.join(' ')}`
  }

  private buildOrderByClause(): string {
    if (this.orderByClauses.length === 0) {
      return ''
    }
    const clauses = this.orderByClauses.map((ob) => `${ob.column} ${ob.direction}`)
    return `ORDER BY ${clauses.join(', ')}`
  }

  private buildLimitClause(): string {
    const parts: string[] = []
    const hasOffset = this.offsetValue !== undefined || this.offsetParam !== undefined
    const hasLimit = this.limitValue !== undefined || this.limitParam !== undefined

    if (hasOffset) {
      const offsetVal = this.offsetParam ?? this.offsetValue
      parts.push(`OFFSET ${offsetVal} ROWS`)
    }
    if (hasLimit) {
      const limitVal = this.limitParam ?? this.limitValue
      if (hasOffset) {
        parts.push(`FETCH NEXT ${limitVal} ROWS ONLY`)
      } else {
        parts.push(`FETCH FIRST ${limitVal} ROWS ONLY`)
      }
    }
    return parts.join(' ')
  }

  build(): string {
    const parts = [
      this.buildSelectClause(),
      this.buildFromClause(),
      this.buildJoinClauses(),
      this.buildWhereClause(),
      this.buildGroupByClause(),
      this.buildHavingClause(),
      this.buildOrderByClause(),
      this.buildLimitClause(),
    ].filter((part) => part.length > 0)

    this.DML = parts.join('\n')
    return this.DML
  }

  toString(): string {
    return this.build()
  }

  reset(): this {
    this.fromTable = ''
    this.fromAlias = undefined
    this.joins = []
    this.currentJoin = undefined
    this.selectColumns = []
    this.whereConditions = []
    this.rawWhereConditions = []
    this.currentColumn = undefined
    this.orderByClauses = []
    this.groupByColumns = []
    this.havingConditions = []
    this.isHavingContext = false
    this.limitValue = undefined
    this.limitParam = undefined
    this.offsetValue = undefined
    this.offsetParam = undefined
    this.distinctFlag = false
    this.DML = ''
    return this
  }
}
