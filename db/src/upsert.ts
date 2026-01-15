import { Update } from './update.js'
import { Insert } from './insert.js'

export class Upsert {
  private updateStmt: Update = new Update()
  private insertStmt: Insert = new Insert()
  private insertOnlyColumns: Map<string, string | number | boolean> = new Map()
  private currentMode: 'update' | 'insert' = 'update'

  update(): this {
    this.currentMode = 'update'
    return this
  }

  insert(): this {
    this.currentMode = 'insert'
    return this
  }

  // Update methods - delegated
  table_name(name: string): this {
    this.updateStmt.table_name(name)
    this.insertStmt.into(name)
    return this
  }

  set(column: string, value: string | number | boolean): this {
    this.updateStmt.set(column, value)
    // Also add to insert for columns that will be updated
    // Include: parameters (p_*), expressions (contain spaces), quoted literals ('...')
    // Exclude: SQL functions like SYSTIMESTAMP
    if (value !== undefined && value !== null) {
      if (typeof value === 'string') {
        if (value.startsWith('p_') || value.includes(' ') || value.startsWith("'")) {
          this.insertStmt.column(column, value)
        }
      } else {
        // Non-string values (numbers, booleans)
        this.insertStmt.column(column, value)
      }
    }
    return this
  }

  where(condition: string): this {
    this.updateStmt.where(condition)
    return this
  }

  // Insert-only methods
  insertColumn(name: string, value: string | number | boolean): this {
    this.insertOnlyColumns.set(name, value)
    return this
  }

  getUpdate(): Update {
    return this.updateStmt
  }

  getInsert(): Insert {
    return this.insertStmt
  }

  private buildInsert(): Insert {
    const insert = new Insert()

    // Add insert-only columns
    for (const [name, value] of this.insertOnlyColumns) {
      insert.column(name, value)
    }

    return this.insertStmt
  }

  build(): { update?: string; insert?: string } {
    const result: { update?: string; insert?: string } = {}

    try {
      result.update = this.updateStmt.build()
    } catch {
      // Update not configured
    }

    try {
      const finalInsert = this.buildInsert()
      result.insert = finalInsert.build()
    } catch {
      // Insert not configured
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
}
