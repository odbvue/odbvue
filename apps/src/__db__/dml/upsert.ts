import { Update } from './update.js'
import { Insert } from './insert.js'

export type UpsertInfo = {
  table: string
  set: Record<string, string | number | boolean>
  where?: string
}

class ConditionBuilder {
  private upsert: Upsert
  private conditions: string[] = []

  constructor(upsert: Upsert) {
    this.upsert = upsert
  }

  where(column: string): ComparisonBuilder {
    return new ComparisonBuilder(this, column, 'where')
  }

  and(column: string): ComparisonBuilder {
    return new ComparisonBuilder(this, column, 'and')
  }

  or(column: string): ComparisonBuilder {
    return new ComparisonBuilder(this, column, 'or')
  }

  addCondition(condition: string, operator: 'where' | 'and' | 'or'): ConditionBuilder {
    if (operator === 'where' || this.conditions.length === 0) {
      this.conditions.push(condition)
    } else {
      this.conditions.push(`${operator.toUpperCase()} ${condition}`)
    }
    return this
  }

  build(): string {
    return this.conditions.join(' ')
  }

  back(): Upsert {
    this.upsert.setCondition(this.build())
    return this.upsert
  }
}

class ComparisonBuilder {
  private conditionBuilder: ConditionBuilder
  private column: string
  private operator: 'where' | 'and' | 'or'

  constructor(
    conditionBuilder: ConditionBuilder,
    column: string,
    operator: 'where' | 'and' | 'or',
  ) {
    this.conditionBuilder = conditionBuilder
    this.column = column
    this.operator = operator
  }

  private formatValue(value: string | number | boolean): string {
    return typeof value === 'string' ? `'${value}'` : String(value)
  }

  eq(value: string | number | boolean): Upsert {
    const formattedValue = this.formatValue(value)
    return this.conditionBuilder
      .addCondition(`${this.column} = ${formattedValue}`, this.operator)
      .back()
  }

  ne(value: string | number | boolean): Upsert {
    const formattedValue = this.formatValue(value)
    return this.conditionBuilder
      .addCondition(`${this.column} != ${formattedValue}`, this.operator)
      .back()
  }

  gt(value: string | number): Upsert {
    return this.conditionBuilder.addCondition(`${this.column} > ${value}`, this.operator).back()
  }

  lt(value: string | number): Upsert {
    return this.conditionBuilder.addCondition(`${this.column} < ${value}`, this.operator).back()
  }

  gte(value: string | number): Upsert {
    return this.conditionBuilder.addCondition(`${this.column} >= ${value}`, this.operator).back()
  }

  lte(value: string | number): Upsert {
    return this.conditionBuilder.addCondition(`${this.column} <= ${value}`, this.operator).back()
  }

  in(values: (string | number)[]): Upsert {
    const formatted = values.map((v) => (typeof v === 'string' ? `'${v}'` : v)).join(', ')
    return this.conditionBuilder
      .addCondition(`${this.column} IN (${formatted})`, this.operator)
      .back()
  }

  like(pattern: string): Upsert {
    return this.conditionBuilder
      .addCondition(`${this.column} LIKE '${pattern}'`, this.operator)
      .back()
  }
}

export class Upsert {
  private table: string = ''
  private updates: Map<string, string | number | boolean> = new Map()
  private inserts: Map<string, string | number | boolean> = new Map()
  private whereCondition: string = ''

  constructor(tableName: string) {
    this.table = tableName
  }

  set(values: Record<string, string | number | boolean>): this {
    for (const [column, value] of Object.entries(values)) {
      this.updates.set(column, value)
      this.inserts.set(column, value)
    }
    return this
  }

  condition(whereClause: string): this {
    this.whereCondition = whereClause
    return this
  }

  where(column: string): ComparisonBuilder {
    const builder = new ConditionBuilder(this)
    return builder.where(column)
  }

  setCondition(condition: string): this {
    this.whereCondition = condition
    return this
  }

  build(): { update?: string; insert?: string } {
    if (!this.table) {
      throw new Error('Table name not specified')
    }

    const result: { update?: string; insert?: string } = {}

    // Build UPDATE statement
    if (this.updates.size > 0 && this.whereCondition) {
      const update = new Update()
      update.table_name(this.table)
      for (const [column, value] of this.updates) {
        update.set(column, value)
      }
      update.where(this.whereCondition)
      result.update = update.build()
    }

    // Build INSERT statement
    if (this.inserts.size > 0) {
      const insert = new Insert()
      insert.into(this.table)
      for (const [column, value] of this.inserts) {
        insert.column(column, value)
      }
      result.insert = insert.build()
    }

    return result
  }

  toString(): string {
    const built = this.build()
    let sql = ''

    if (built.update) {
      sql += built.update + ';\n\n'
    }

    if (built.insert) {
      sql += 'IF SQL%rowcount = 0 THEN\n'
      sql += built.insert + ';\n'
      sql += 'END IF;\n'
    }

    sql += '\nCOMMIT;'

    return sql
  }

  toObject(): UpsertInfo {
    return {
      table: this.table,
      set: Object.fromEntries(this.updates),
      ...(this.whereCondition && { where: this.whereCondition }),
    }
  }

  toJson(): string {
    return JSON.stringify(this.toObject(), null, 2)
  }
}
