import type { Table } from './table';
import type { Pckg } from './package';

export type SchemaInfo = {
  DDLs: string[];
  DMLs: string[];
};

export class Schema {
  private tables: Table[] = [];
  private packages: Pckg[] = [];

  private tableNames: Set<string> = new Set();

  public DDLs: string[] = [];
  public DMLs: string[] = [];

  constructor() {}

  addTable(table: Table) {
    this.tables.push(table);
    return this;
  }

  addPackage(pck: Pckg) {
    this.packages.push(pck);
    return this;
  }

  build(): SchemaInfo {
    this.DDLs = [];
    this.DMLs = [];

    this.tableNames.clear();
    [...this.tables].reverse().forEach((t) => this.tableNames.add(t['info'].name));

    this.tableNames.forEach((tableName) => {
      this.DDLs.push(
        `BEGIN\n  EXECUTE IMMEDIATE 'DROP TABLE ${tableName}';\nEXCEPTION\n  WHEN OTHERS THEN\n    IF SQLCODE != -942 THEN\n      RAISE;\n    END IF;\nEND;`,
      );
    });

    for (const table of this.tables) {
      table.build();
      this.DDLs.push(...table.DDLs);
    }

    for (const pckg of this.packages) {
      pckg.build();
      this.DDLs.push(pckg.spec);
      this.DDLs.push(pckg.body);
    }

    return {
      DDLs: this.DDLs,
      DMLs: this.DMLs,
    };
  }
}
