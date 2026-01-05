export type TableColumnType =
  | 'char'
  | 'varchar'
  | 'text'
  | 'int'
  | 'bigint'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'float'
  | 'double';

export interface TableColumn {
  name: string;
  type: TableColumnType;
  isPrimary?: boolean;
  isNullable?: boolean;
  isUnique?: boolean;
  defaultValue?: string;
  comment?: string;
}

export interface TableSchema {
  tableName: string;
  columns: TableColumn[];
  comment?: string;
}

export interface DatabaseSchema {
  tables?: TableSchema[];
}

export type ColumnValue = string | number | boolean | Date | null | undefined;

export interface UpsertData {
  [key: string]: ColumnValue;
}

export interface UpsertKeys {
  [key: string]: string | number;
}

export interface ProcedureParam {
  name: string;
  type: string;
  direction?: 'IN' | 'OUT' | 'IN OUT';
  defaultValue?: string;
}

export interface ProcedureSchema {
  name: string;
  params: ProcedureParam[];
  returnType?: string;
  body: string;
}

export interface PackageSchema {
  name: string;
  procedures: ProcedureSchema[];
}

export interface Schema {
  tables: TableSchema[];
  packages: PackageSchema[];
  ddls: string[];
  dmls: string[];
}
