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

  drop(options: { cascade?: boolean } = {}): string {
    const editionLiteral = this.editionName.replace(/'/g, "''")
    const editionIdentifier = `"${this.editionName.replace(/"/g, '""')}"`

    return [
      `BEGIN`,
      `  FOR r IN (`,
      `    SELECT s.sid, s.serial#`,
      `    FROM v$session s`,
      `    WHERE s.session_edition_id = (`,
      `      SELECT o.object_id`,
      `      FROM dba_objects o`,
      `      WHERE o.object_type = 'EDITION'`,
      `        AND o.object_name = '${editionLiteral}'`,
      `    )`,
      `      AND s.sid <> TO_NUMBER(SYS_CONTEXT('USERENV', 'SID'))`,
      `  ) LOOP`,
      `    BEGIN`,
      `      EXECUTE IMMEDIATE`,
      `        'ALTER SYSTEM KILL SESSION '''`,
      `        || r.sid`,
      `        || ','`,
      `        || r.serial#`,
      `        || ''' IMMEDIATE';`,
      `    EXCEPTION`,
      `      WHEN OTHERS THEN`,
      `        NULL;`,
      `    END;`,
      `  END LOOP;`,
      `END;`,
      `/`,
      ``,
      `BEGIN`,
      `  EXECUTE IMMEDIATE`,
      `    'DROP EDITION ${editionIdentifier}${options.cascade ? ' CASCADE' : ''}';`,
      `EXCEPTION`,
      `  WHEN OTHERS THEN`,
      `    IF SQLCODE <> -38802 THEN`,
      `      RAISE;`,
      `    END IF;`,
      `END;`,
      `/`,
    ].join('\n')
  }

  setDefault(): string {
    return `ALTER DATABASE DEFAULT EDITION = ${this.editionName};`
  }

  /** Reset the database-wide default edition before dropping an edition tree. */
  setDefaultBase(): string {
    return 'ALTER DATABASE DEFAULT EDITION = ORA$BASE;'
  }

  setCurrent(): string {
    return `ALTER SESSION SET EDITION = ${this.editionName};`
  }

  setBase(): string {
    return `ALTER SESSION SET EDITION = ORA$BASE;`
  }
}
