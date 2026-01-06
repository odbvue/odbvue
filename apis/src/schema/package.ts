export type ProcedureInfo = {
  name: string;
  description?: string;
  params: {
    name: string;
    dataType: string;
    mode: 'IN' | 'OUT' | 'IN OUT';
    defaultValue?: string;
  }[];
  body: string;
};

export type PckgInfo = {
  name: string;
  description?: string;
  procedures: ProcedureInfo[];
};

export class Pckg {
  private info: PckgInfo;

  public spec: string;
  public body: string;

  constructor(name: string) {
    this.info = { name, procedures: [] };
    this.spec = 'CREATE OR REPLACE PACKAGE ' + name + ' AS\nEND ' + name + ';';
    this.body = 'CREATE OR REPLACE PACKAGE BODY ' + name + ' AS\nEND ' + name + ';';
  }

  addProcedure(procedure: ProcedureInfo): this {
    this.info.procedures.push(procedure);
    return this;
  }

  build(): PckgInfo {
    this.spec = `CREATE OR REPLACE PACKAGE ${this.info.name} AS\n\n`;
    this.body = `CREATE OR REPLACE PACKAGE BODY ${this.info.name} AS\n\n`;

    for (const proc of this.info.procedures) {
      this.spec += `  PROCEDURE ${proc.name}(\n`;
      this.spec += proc.params
        .map((p) => {
          let def = `    ${p.name} ${p.mode} ${p.dataType}`;
          if (p.defaultValue) def += ` DEFAULT ${p.defaultValue}`;
          return def;
        })
        .join(`,\n`);
      this.spec += `\n  );\n\n`;

      this.body += `  PROCEDURE ${proc.name}(\n`;
      this.body += proc.params
        .map((p) => {
          let def = `    ${p.name} ${p.mode} ${p.dataType}`;
          if (p.defaultValue) def += ` DEFAULT ${p.defaultValue}`;
          return def;
        })
        .join(`,\n`);
      this.body += `\n  ) IS\n  BEGIN\n${proc.body}\n  END ${proc.name};\n\n`;
    }

    this.spec += `END ${this.info.name};`;
    this.body += `END ${this.info.name};`;

    return this.info;
  }
}
