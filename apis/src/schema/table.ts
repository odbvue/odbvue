type ColumnInfoBase = {
  name: string;
  description?: string;
  isNullable?: boolean;
};

type CharColumnInfo = ColumnInfoBase & {
  dataType: 'char' | 'varchar';
  length: number;
};

type ClobColumnInfo = ColumnInfoBase & {
  dataType: 'clob' | 'blob';
};

type NumberColumnInfo = ColumnInfoBase & {
  dataType: 'number';
  precision?: number;
  scale?: number;
};

type DateColumnInfo = ColumnInfoBase & {
  dataType: 'date' | 'timestamp';
};

type BooleanColumnInfo = ColumnInfoBase & {
  dataType: 'boolean';
};

export type ColumnInfo =
  | CharColumnInfo
  | ClobColumnInfo
  | NumberColumnInfo
  | DateColumnInfo
  | BooleanColumnInfo;

export type DataType = ColumnInfo['dataType'];

export type TableInfo = {
  name: string;
  description?: string;
  columns: ColumnInfo[];
};

export class Table {
  private info: TableInfo;

  public DDLs: string[] = [];

  constructor(info: TableInfo | string) {
    if (typeof info === 'string') {
      this.info = { name: info, columns: [] };
    } else {
      this.info = info || { name: '', columns: [] };
    }
  }

  addColumn(column: ColumnInfo): this;
  addColumn(name: string, dataType: DataType, length?: number): this;
  addColumn(columnOrName: ColumnInfo | string, dataType?: DataType, length?: number): this {
    if (typeof columnOrName === 'string') {
      const baseColumn: ColumnInfoBase = { name: columnOrName };
      let column: ColumnInfo;

      if (length && (dataType === 'char' || dataType === 'varchar')) {
        column = { ...baseColumn, dataType, length } as CharColumnInfo;
      } else if (dataType === 'clob' || dataType === 'blob') {
        column = { ...baseColumn, dataType } as ClobColumnInfo;
      } else if (dataType === 'number') {
        column = { ...baseColumn, dataType } as NumberColumnInfo;
      } else if (dataType === 'date' || dataType === 'timestamp') {
        column = { ...baseColumn, dataType } as DateColumnInfo;
      } else {
        column = { ...baseColumn, dataType } as BooleanColumnInfo;
      }

      this.info.columns.push(column);
    } else {
      this.info.columns.push(columnOrName);
    }
    return this;
  }

  build(): TableInfo {
    this.DDLs = [];

    let ddl = `CREATE TABLE ${this.info.name} (\n`;
    const columnDefs = this.info.columns.map((col) => {
      let colDef = `  ${col.name} ${col.dataType.toUpperCase()}`;
      if ('length' in col && col.length) {
        colDef += `(${col.length})`;
      }
      if (col.isNullable === false) {
        colDef += ' NOT NULL';
      }
      return colDef;
    });
    ddl += columnDefs.join(',\n') + '\n);';
    this.DDLs.push(ddl);

    return {
      name: this.info.name,
      columns: [],
    };
  }
}
