/** Qualify an Oracle object name when a target schema is supplied. */
export function qualify(name: string, schema?: string): string {
  return schema ? `${schema}.${name}` : name
}

/** Render one SQL statement as a SQL*Plus-compatible anonymous PL/SQL block. */
export function plsqlBlock(statement: string): string {
  return ['BEGIN', `  ${statement};`, 'END;', '/'].join('\n')
}

/** Drop a package while treating Oracle's "does not exist" error as success. */
export function dropPackageIfExists(name: string, schema?: string): string {
  return [
    'BEGIN',
    `  EXECUTE IMMEDIATE 'DROP PACKAGE ${qualify(name, schema)}';`,
    'EXCEPTION WHEN OTHERS THEN',
    '  IF SQLCODE != -4043 THEN RAISE; END IF;',
    'END;',
    '/',
  ].join('\n')
}
