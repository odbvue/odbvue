import { Table, TableInfo, ColumnInfo } from './table';

type SeedValue = string | number | boolean | null;
type SeedRow = Record<string, SeedValue>;

export class Seed {
  private tableInfo: TableInfo;
  private tableName: string;
  private rows: SeedRow[] = [];
  private columnMap: Map<string, ColumnInfo> = new Map();

  public DMLs: string[] = [];

  constructor(table: Table | TableInfo | string) {
    if (typeof table === 'string') {
      this.tableName = table;
      this.tableInfo = { name: table, columns: [] };
    } else if (table instanceof Table) {
      this.tableInfo = table.build();
      this.tableName = this.tableInfo.name;
    } else {
      this.tableInfo = table;
      this.tableName = table.name;
    }

    for (const col of this.tableInfo.columns) {
      this.columnMap.set(col.name, col);
    }
  }

  add(row: SeedRow): this {
    if (this.columnMap.size > 0) {
      for (const key of Object.keys(row)) {
        if (!this.columnMap.has(key)) {
          throw new Error(`Column "${key}" not found in table "${this.tableName}"`);
        }
      }
    }
    this.rows.push(row);
    return this;
  }

  addMany(rows: SeedRow[]): this {
    for (const row of rows) {
      this.add(row);
    }
    return this;
  }

  private formatValue(value: SeedValue): string {
    if (value === null) {
      return 'NULL';
    }

    if (typeof value === 'string') {
      // Check if it's a raw SQL expression (e.g., SYSTIMESTAMP, SYSDATE, sequences)
      const rawExpressions = [
        'SYSTIMESTAMP',
        'SYSDATE',
        'CURRENT_TIMESTAMP',
        'CURRENT_DATE',
        'NULL',
      ];
      const upperValue = value.toUpperCase().trim();

      if (
        rawExpressions.includes(upperValue) ||
        upperValue.endsWith('.NEXTVAL') ||
        upperValue.endsWith('.CURRVAL') ||
        upperValue.startsWith('TO_DATE(') ||
        upperValue.startsWith('TO_TIMESTAMP(')
      ) {
        return value;
      }

      // Escape single quotes and wrap in quotes
      return `'${value.replace(/'/g, "''")}'`;
    }

    if (typeof value === 'boolean') {
      return value ? '1' : '0';
    }

    return String(value);
  }

  private buildSingleInsert(row: SeedRow): string {
    const columns = Object.keys(row);
    const values = columns.map((col) => this.formatValue(row[col]));

    return `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});`;
  }

  private buildInsertAll(): string {
    if (this.rows.length === 0) {
      return '';
    }

    const lines: string[] = ['INSERT ALL'];

    for (const row of this.rows) {
      const columns = Object.keys(row);
      const values = columns.map((col) => this.formatValue(row[col]));
      lines.push(`  INTO ${this.tableName} (${columns.join(', ')}) VALUES (${values.join(', ')})`);
    }

    lines.push('SELECT 1 FROM DUAL;');

    return lines.join('\n');
  }

  build(): string[] {
    this.DMLs = [];

    if (this.rows.length === 0) {
      return this.DMLs;
    }

    if (this.rows.length === 1) {
      this.DMLs.push(this.buildSingleInsert(this.rows[0]));
    } else {
      this.DMLs.push(this.buildInsertAll());
    }

    return this.DMLs;
  }

  buildSeparate(): string[] {
    this.DMLs = this.rows.map((row) => this.buildSingleInsert(row));
    return this.DMLs;
  }

  reset(): this {
    this.rows = [];
    this.DMLs = [];
    return this;
  }
}
