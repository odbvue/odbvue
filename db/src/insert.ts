export class Insert {
  private table: string = ''
  private cols: string[] = []
  private vals: (string | number | boolean)[] = []

  into(table: string): this {
    this.table = table
    return this
  }

  columns(cols: string[]): this {
    this.cols = cols
    return this
  }

  values(vals: (string | number | boolean)[]): this {
    this.vals = vals
    return this
  }

  column(name: string, value: string | number | boolean): this {
    this.cols.push(name)
    this.vals.push(value)
    return this
  }

  build(): string {
    if (!this.table) {
      throw new Error('Table name not specified')
    }
    if (this.cols.length === 0) {
      throw new Error('No columns specified')
    }
    if (this.cols.length !== this.vals.length) {
      throw new Error('Number of columns does not match number of values')
    }

    const sql = `INSERT INTO ${this.table} (
      ${this.cols.join(', ')}
    ) VALUES (
      ${this.vals.join(', ')}
    )`
    return sql
  }

  toString(): string {
    return this.build()
  }
}
