export class Update {
  private table: string = ''
  private setters: { column: string; value: string | number | boolean }[] = []
  private whereCondition: string = ''

  table_name(name: string): this {
    this.table = name
    return this
  }

  set(column: string, value: string | number | boolean): this {
    this.setters.push({ column, value })
    return this
  }

  where(condition: string): this {
    this.whereCondition = condition
    return this
  }

  build(): string {
    if (!this.table) {
      throw new Error('Table name not specified')
    }
    if (this.setters.length === 0) {
      throw new Error('No columns to update')
    }

    let sql = `UPDATE ${this.table}\n    SET\n`
    sql += this.setters.map(({ column, value }) => `      ${column} = ${value}`).join(',\n')

    if (this.whereCondition) {
      sql += `\n    WHERE ${this.whereCondition}`
    }

    return sql
  }

  toString(): string {
    return this.build()
  }
}
