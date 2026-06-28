export class odbEdition {
  private editionName: string

  constructor(
    private version: string,
    private userName: string,
  ) {
    const versionParts = version.split('.')
    if (versionParts.length !== 3) {
      throw new Error(`Invalid version format: ${version}. Expected format: x.y.z`)
    }
    this.editionName = `${userName.toUpperCase()}_${versionParts.join('_')}`
  }

  create(): string {
    return `CREATE EDITION ${this.editionName};`
  }

  grantUse(): string {
    return `GRANT USE ON EDITION ${this.editionName} TO ${this.userName};`
  }

  drop(): string {
    return `DROP EDITION ${this.editionName};`
  }

  setDefault(): string {
    return `ALTER DATABASE DEFAULT EDITION = ${this.editionName};`
  }

  setCurrent(): string {
    return `ALTER SESSION SET EDITION = ${this.editionName};`
  }

  setBase(): string {
    return `ALTER SESSION SET EDITION = ORA$BASE;`
  }
}
