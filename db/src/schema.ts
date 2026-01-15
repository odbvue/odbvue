export class Schema {
  private name: string

  constructor(name: string) {
    this.name = name
  }

  render(): string {
    const currentTimestamp = new Date().toISOString()
    let sql = `-- [${currentTimestamp}] OdbVue Database Scaffolding\n\n`
    sql += `ALTER SESSION SET CURRENT_SCHEMA = ${this.name};\n\n`
    return sql
  }
}
