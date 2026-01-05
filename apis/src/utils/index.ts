import type {
  DatabaseSchema,
  ColumnValue,
  UpsertData,
  UpsertKeys,
  ProcedureParam,
  ProcedureSchema,
  PackageSchema,
  Schema,
  TableSchema,
} from '../types';

export class Column {
  private name: string;
  private type: string;
  private isPrimary: boolean = false;
  private isNullable: boolean = true;
  private isUnique: boolean = false;
  private defaultValue: string | null = null;
  private columnComment: string | null = null;

  constructor(name: string, type: string) {
    this.name = name;
    this.type = type;
  }

  primaryKey(): this {
    this.isPrimary = true;
    this.isNullable = false;
    return this;
  }

  notNullable(): this {
    this.isNullable = false;
    return this;
  }

  nullable(): this {
    this.isNullable = true;
    return this;
  }

  unique(): this {
    this.isUnique = true;
    return this;
  }

  default(value: string): this {
    this.defaultValue = value;
    return this;
  }

  comment(text: string): this {
    this.columnComment = text;
    return this;
  }

  build(): {
    name: string;
    type: string;
    isPrimary: boolean;
    isNullable: boolean;
    isUnique: boolean;
    defaultValue: string | null;
    comment: string | null;
  } {
    return {
      name: this.name,
      type: this.type,
      isPrimary: this.isPrimary,
      isNullable: this.isNullable,
      isUnique: this.isUnique,
      defaultValue: this.defaultValue,
      comment: this.columnComment,
    };
  }
}

export class Table {
  private tableName: string;
  private columns: Column[] = [];
  private tableComment: string | null = null;
  private dmls: string[] = [];

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  addColumn(name: string, type: string): Column {
    const column = new Column(name, type);
    this.columns.push(column);
    return column;
  }

  comment(text: string): this {
    this.tableComment = text;
    return this;
  }

  upsert(data: UpsertData, keys: UpsertKeys): this {
    const keyColumns = Object.keys(keys);
    const dataColumns = Object.keys(data).filter((col) => data[col] !== undefined);
    const nonKeyColumns = dataColumns.filter((col) => !keyColumns.includes(col));

    if (keyColumns.length === 0) {
      throw new Error(`No key columns provided for MERGE operation on table ${this.tableName}`);
    }

    const matchCondition = keyColumns.map((key) => `target.${key} = source.${key}`).join(' AND ');

    const updateSet = nonKeyColumns.map((col) => `target.${col} = source.${col}`).join(', ');

    const insertColumns = dataColumns.join(', ');

    const insertValues = dataColumns.map((col) => `source.${col}`).join(', ');

    const sourceSelect = dataColumns
      .map((col) => `${this.formatValue(data[col])} AS ${col}`)
      .join(', ');

    let mergeDml = `MERGE INTO ${this.tableName} target\n`;
    mergeDml += `USING (SELECT ${sourceSelect} FROM DUAL) source\n`;
    mergeDml += `ON (${matchCondition})\n`;

    if (nonKeyColumns.length > 0) {
      mergeDml += `WHEN MATCHED THEN\n`;
      mergeDml += `  UPDATE SET ${updateSet}\n`;
    }

    mergeDml += `WHEN NOT MATCHED THEN\n`;
    mergeDml += `  INSERT (${insertColumns})\n`;
    mergeDml += `  VALUES (${insertValues});`;

    this.dmls.push(mergeDml);
    return this;
  }

  generateDMLs(): string[] {
    return [...this.dmls];
  }

  clearDMLs(): void {
    this.dmls = [];
  }

  build(): {
    tableName: string;
    columns: ReturnType<Column['build']>[];
    comment: string | null;
  } {
    return {
      tableName: this.tableName,
      columns: this.columns.map((col) => col.build()),
      comment: this.tableComment,
    };
  }

  private formatValue(value: ColumnValue): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (value instanceof Date) {
      return `TO_TIMESTAMP('${value.toISOString()}', 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"')`;
    }
    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`;
    }
    if (typeof value === 'boolean') {
      return value ? '1' : '0';
    }
    return String(value);
  }
}

export function generateDDL(schema: DatabaseSchema): string {
  let ddl = '';

  if (schema.tables) {
    for (const table of schema.tables) {
      ddl += `CREATE TABLE ${table.tableName} (\n`;
      const columnDefs = table.columns.map((col) => {
        let colDef = `  ${col.name} ${col.type.toUpperCase()}`;
        if (col.isPrimary) colDef += ' PRIMARY KEY';
        if (col.isNullable === false) colDef += ' NOT NULL';
        if (col.isUnique) colDef += ' UNIQUE';
        if (col.comment) colDef += ` -- ${col.comment}`;
        return colDef;
      });
      ddl += columnDefs.join(',\n') + '\n);\n\n';
      if (table.comment) {
        ddl += `-- Table Comment: ${table.comment}\n\n`;
      }
    }
  }

  return ddl;
}

export class Procedure {
  private procedureName: string;
  private params: ProcedureParam[] = [];
  private returnType: string | null = null;
  private bodyContent: string = '';

  constructor(name: string) {
    this.procedureName = name;
  }

  addParam(
    name: string,
    type: string,
    direction: 'IN' | 'OUT' | 'IN OUT' = 'IN',
    defaultValue?: string,
  ): this {
    this.params.push({ name, type, direction, defaultValue });
    return this;
  }

  returns(type: string): this {
    this.returnType = type;
    return this;
  }

  body(content: string): this {
    this.bodyContent = content;
    return this;
  }

  build(): ProcedureSchema {
    return {
      name: this.procedureName,
      params: [...this.params],
      returnType: this.returnType ?? undefined,
      body: this.bodyContent,
    };
  }

  generateSpec(): string {
    const paramDefs = this.params
      .map((p) => {
        let def = `${p.name} ${p.direction ?? 'IN'} ${p.type}`;
        if (p.defaultValue) def += ` DEFAULT ${p.defaultValue}`;
        return def;
      })
      .join(', ');

    const returnClause = this.returnType ? ` RETURN ${this.returnType}` : '';
    return `PROCEDURE ${this.procedureName}(${paramDefs})${returnClause}`;
  }

  generateBody(): string {
    const paramDefs = this.params
      .map((p) => {
        let def = `${p.name} ${p.direction ?? 'IN'} ${p.type}`;
        if (p.defaultValue) def += ` DEFAULT ${p.defaultValue}`;
        return def;
      })
      .join(', ');

    const returnClause = this.returnType ? ` RETURN ${this.returnType}` : '';
    let body = `PROCEDURE ${this.procedureName}(${paramDefs})${returnClause} IS\n`;
    body += `BEGIN\n`;
    body += `  ${this.bodyContent}\n`;
    body += `END ${this.procedureName};`;
    return body;
  }
}

export class Package {
  private packageName: string;
  private procedures: Procedure[] = [];

  constructor(name: string) {
    this.packageName = name;
  }

  addProcedure(procedure: Procedure): this {
    this.procedures.push(procedure);
    return this;
  }

  build(): PackageSchema {
    return {
      name: this.packageName,
      procedures: this.procedures.map((p) => p.build()),
    };
  }

  generateSpec(): string {
    let spec = `CREATE OR REPLACE PACKAGE ${this.packageName} AS\n`;
    for (const proc of this.procedures) {
      spec += `  ${proc.generateSpec()};\n`;
    }
    spec += `END ${this.packageName};`;
    return spec;
  }

  generateBody(): string {
    let body = `CREATE OR REPLACE PACKAGE BODY ${this.packageName} AS\n`;
    for (const proc of this.procedures) {
      body += `  ${proc.generateBody()}\n\n`;
    }
    body += `END ${this.packageName};`;
    return body;
  }
}

export class SchemaBuilder {
  private tables: Table[] = [];
  private packages: Package[] = [];

  addTable(table: Table): this {
    this.tables.push(table);
    return this;
  }

  addPackage(pkg: Package): this {
    this.packages.push(pkg);
    return this;
  }

  build(): Schema {
    const tableSchemas: TableSchema[] = this.tables.map((t) => t.build() as TableSchema);
    const packageSchemas: PackageSchema[] = this.packages.map((p) => p.build());

    const ddls: string[] = [];
    const dmls: string[] = [];

    // Generate table DDLs
    for (const table of this.tables) {
      const built = table.build();
      let ddl = `CREATE TABLE ${built.tableName} (\n`;
      const columnDefs = built.columns.map((col) => {
        let colDef = `  ${col.name} ${col.type.toUpperCase()}`;
        if (col.isPrimary) colDef += ' PRIMARY KEY';
        if (col.isNullable === false) colDef += ' NOT NULL';
        if (col.isUnique) colDef += ' UNIQUE';
        if (col.defaultValue) colDef += ` DEFAULT ${col.defaultValue}`;
        return colDef;
      });
      ddl += columnDefs.join(',\n') + '\n);';
      ddls.push(ddl);

      if (built.comment) {
        ddls.push(`COMMENT ON TABLE ${built.tableName} IS '${built.comment}';`);
      }

      // Collect DMLs from table
      dmls.push(...table.generateDMLs());
    }

    // Generate package DDLs
    for (const pkg of this.packages) {
      ddls.push(pkg.generateSpec());
      ddls.push(pkg.generateBody());
    }

    return {
      tables: tableSchemas,
      packages: packageSchemas,
      ddls,
      dmls,
    };
  }
}

export function createTable(tableName: string): Table {
  return new Table(tableName);
}

export function createProcedure(name: string): Procedure {
  return new Procedure(name);
}

export function createPackage(name: string): Package {
  return new Package(name);
}

export function createSchema(): SchemaBuilder {
  return new SchemaBuilder();
}
