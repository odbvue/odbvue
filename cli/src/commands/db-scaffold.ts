import { Command } from 'commander';
import { tmpdir } from 'os';
import prompts from 'prompts';
import {
  logger,
  rootDir,
  path,
  existsSync,
  mkdirSync,
  writeFileSync,
  unlinkSync,
  execSync,
  platform,
  readFileSync,
  readdirSync,
} from '../utils.js';

// Recursively find all api/index.ts files
function findApiIndexFiles(dir: string, results: string[] = []): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip node_modules and dist directories
      if (entry.name === 'node_modules' || entry.name === 'dist') {
        continue;
      }
      
      // Check if this is an 'api' directory with index.ts
      if (entry.name === 'api') {
        const indexPath = path.join(fullPath, 'index.ts');
        if (existsSync(indexPath)) {
          results.push(indexPath);
        }
      }
      
      // Continue recursive search
      findApiIndexFiles(fullPath, results);
    }
  }
  
  return results;
}

export const registerDbScaffoldCommand = (program: Command) => {
  program
    .command('db-scaffold [path]')
    .alias('ds')
    .description(
      'Generate SQL scripts from module API definitions (scans current directory if no path provided)',
    )
    .option('-o, --output <dir>', 'Output directory (defaults to ./dist relative to module)')
    .option('--idempotent', 'Generate idempotent PL/SQL blocks')
    .option('--no-run', 'Skip prompt to run the generated SQL')
    .action(async (pathArg: string | undefined, options: { output?: string; idempotent?: boolean; run?: boolean }) => {
      try {
        // If no path provided, scan all api/index.ts files for Schema exports
        if (!pathArg) {
          await scanAndExportSchemas(options.idempotent || false, options.run !== false);
          return;
        }

        const cwd = process.cwd();
        let apiPath: string;

        // Path provided: look for api/index.ts relative to that path
        const targetDir = path.isAbsolute(pathArg) ? pathArg : path.resolve(cwd, pathArg);
        apiPath = path.resolve(targetDir, 'api/index.ts');

        if (!existsSync(apiPath)) {
          logger.error(`API file not found: ${apiPath}`);
          process.exit(1);
        }

        await scaffoldModule(apiPath, options.output);
      } catch (error) {
        logger.error(`Failed to scaffold: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }

      async function scanAndExportSchemas(idempotent: boolean, promptRun: boolean): Promise<void> {
        const appsDir = path.resolve(rootDir, 'apps/src');
        const schemaOutputDir = path.resolve(rootDir, 'db/schema');

        // Ensure output directory exists
        mkdirSync(schemaOutputDir, { recursive: true });

        // Find all api/index.ts files using recursive search
        const apiFiles = findApiIndexFiles(appsDir);

        if (apiFiles.length === 0) {
          logger.warn('No api/index.ts files found in apps/src/');
          return;
        }

        logger.info(`Found ${apiFiles.length} API index file(s) to scan...`);
        let exportedCount = 0;

        for (const apiFile of apiFiles) {
          const normalizedPath = apiFile.replace(/\\/g, '/');
          
          // Read file content to check for default export
          const content = readFileSync(apiFile, 'utf-8');
          
          // Check if file has a default export
          if (!content.includes('export default')) {
            logger.info(`Skipping ${path.relative(rootDir, apiFile)} - no default export`);
            continue;
          }

          try {
            // Create a loader script to extract the default export and call toJson() and toSql()
            const fileUrl = `file://${normalizedPath}`;
            const loaderScript = `import('${fileUrl}').then(m => {
  const schema = m.default;
  if (schema && typeof schema.toJson === 'function') {
    const schemaName = schema.getSchemaName ? schema.getSchemaName() : 'unknown';
    // Pass schemaName and idempotent flag to toSql() - new signature supports (schemaName, idempotent)
    const idempotent = ${idempotent};
    const sqlStatements = schema.toSql ? schema.toSql(schemaName, idempotent) : [];
    console.log(JSON.stringify({ 
      success: true, 
      schemaName: schemaName,
      json: schema.toJson(),
      sqlStatements: sqlStatements
    }));
  } else {
    console.log(JSON.stringify({ 
      success: false, 
      error: 'Default export does not have toJson() method'
    }));
  }
}).catch(err => {
  console.log(JSON.stringify({ success: false, error: err.message }));
});`;

            const loaderPath = path.resolve(tmpdir(), `ov-schema-${Date.now()}.mjs`);
            writeFileSync(loaderPath, loaderScript, 'utf-8');

            try {
              // Run from apps directory so tsx can resolve path aliases from tsconfig
              const appsRoot = path.resolve(rootDir, 'apps');
              const result = execSync(`npx tsx ${loaderPath}`, {
                cwd: appsRoot,
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe'],
              });

              const jsonMatch = result.match(/\{.*\}/s);
              if (!jsonMatch) {
                logger.warn(`No JSON output from ${path.relative(rootDir, apiFile)}`);
                continue;
              }

              const output = JSON.parse(jsonMatch[0]);

              if (!output.success) {
                logger.warn(`Skipping ${path.relative(rootDir, apiFile)} - ${output.error}`);
                continue;
              }

              // Write JSON to db/schema/{schemaName}.json
              const outputFileName = `${output.schemaName.toLowerCase()}.json`;
              const outputPath = path.resolve(schemaOutputDir, outputFileName);
              writeFileSync(outputPath, output.json, 'utf-8');

              logger.success(`Exported ${output.schemaName} → ${path.relative(rootDir, outputPath)}`);

              // Write SQL statements to db/releases/next/<object_type>/
              if (output.sqlStatements && output.sqlStatements.length > 0) {
                const releasesDir = path.resolve(rootDir, 'db/releases/next');
                
                // Group statements by type
                const statementsByType = new Map<string, Array<{name: string, sql: string}>>();
                for (const stmt of output.sqlStatements) {
                  if (!statementsByType.has(stmt.type)) {
                    statementsByType.set(stmt.type, []);
                  }
                  statementsByType.get(stmt.type)!.push({ name: stmt.name, sql: stmt.sql });
                }

                // Map types to directory names (pluralize)
                const typeToDirName: Record<string, string> = {
                  'table': 'tables',
                  'index': 'indexes',
                  'comment': 'comments',
                  'constraint': 'constraints'
                };

                // Track all generated files and their content for the master script
                const generatedFiles: { type: string; dir: string; filename: string; sql: string }[] = [];

                let sqlFileCount = 0;
                for (const [type, statements] of statementsByType) {
                  const dirName = typeToDirName[type] || type;
                  const typeDir = path.resolve(releasesDir, dirName);
                  mkdirSync(typeDir, { recursive: true });

                  // Comments: group by table name (first part of name before _table or _columnname)
                  if (type === 'comment') {
                    // Group comments by table name (extract table from comment name like "app_users_table" or "app_users_username")
                    const commentsByTable = new Map<string, string[]>();
                    for (const stmt of statements) {
                      // Name format is: tablename_table or tablename_columnname
                      // Extract table name (everything before _table suffix, or up to last underscore for column comments)
                      let tableName: string;
                      if (stmt.name.endsWith('_table')) {
                        tableName = stmt.name.slice(0, -6); // Remove '_table'
                      } else {
                        // For column comments, the table name was set as tablename_columnname
                        // We need to find the table - look for matching table comment
                        const tableCommentName = statements.find(s => s.name.endsWith('_table'))?.name;
                        if (tableCommentName) {
                          tableName = tableCommentName.slice(0, -6);
                        } else {
                          // Fallback: use the first part up to last underscore
                          const lastUnderscore = stmt.name.lastIndexOf('_');
                          tableName = lastUnderscore > 0 ? stmt.name.slice(0, lastUnderscore) : stmt.name;
                        }
                      }
                      
                      if (!commentsByTable.has(tableName)) {
                        commentsByTable.set(tableName, []);
                      }
                      commentsByTable.get(tableName)!.push(stmt.sql);
                    }

                    for (const [tableName, comments] of commentsByTable) {
                      const commentsFileName = `comments_${tableName}.sql`;
                      const commentsFilePath = path.resolve(typeDir, commentsFileName);
                      const commentsSql = comments.join('\n');
                      writeFileSync(commentsFilePath, commentsSql, 'utf-8');
                      generatedFiles.push({ type, dir: dirName, filename: commentsFileName, sql: commentsSql });
                      sqlFileCount++;
                    }
                  } else {
                    for (const stmt of statements) {
                      const sqlFileName = `${stmt.name}.sql`;
                      const sqlFilePath = path.resolve(typeDir, sqlFileName);
                      writeFileSync(sqlFilePath, stmt.sql, 'utf-8');
                      generatedFiles.push({ type, dir: dirName, filename: sqlFileName, sql: stmt.sql });
                      sqlFileCount++;
                    }
                  }
                }

                // Create master next.sql file with all SQL content in correct order
                const typeOrder = ['table', 'constraint', 'index', 'comment'];
                const masterScriptLines: string[] = [
                  '-- Auto-generated master script',
                  `-- Generated: ${new Date().toISOString()}`,
                  ''
                ];

                for (const type of typeOrder) {
                  const dirName = typeToDirName[type] || type;
                  const filesOfType = generatedFiles.filter(f => f.type === type);
                  if (filesOfType.length > 0) {
                    masterScriptLines.push(`-- ${dirName.toUpperCase()}`);
                    masterScriptLines.push(`-- Source: ${dirName}/`);
                    masterScriptLines.push('');
                    for (const file of filesOfType) {
                      masterScriptLines.push(`-- ${file.filename}`);
                      masterScriptLines.push(file.sql);
                      masterScriptLines.push('');
                    }
                  }
                }

                const masterScriptPath = path.resolve(releasesDir, 'next.sql');
                writeFileSync(masterScriptPath, masterScriptLines.join('\n'), 'utf-8');

                logger.success(`Generated ${sqlFileCount} SQL file(s) → ${path.relative(rootDir, releasesDir)}/`);
                logger.success(`Created master script → ${path.relative(rootDir, masterScriptPath)}`);
                if (idempotent) {
                  logger.info('Generated idempotent PL/SQL blocks');
                }

                // Prompt user to run (if enabled)
                if (promptRun) {
                  const response = await prompts({
                    type: 'confirm',
                    name: 'run',
                    message: 'Would you like to run next.sql?',
                    initial: false,
                  });

                  if (response.run) {
                    try {
                      execSync(`ov dr ${masterScriptPath}`, {
                        cwd: rootDir,
                        stdio: 'inherit',
                      });
                    } catch (error) {
                      logger.error(`Failed to run script: ${error instanceof Error ? error.message : String(error)}`);
                    }
                  }
                }
              }

              exportedCount++;
            } finally {
              // Clean up temp file
              try {
                unlinkSync(loaderPath);
              } catch {
                // Ignore cleanup errors
              }
            }
          } catch (error) {
            logger.error(`Failed to process ${path.relative(rootDir, apiFile)}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        if (exportedCount > 0) {
          logger.success(`\nExported ${exportedCount} schema(s) to ${path.relative(rootDir, schemaOutputDir)}/`);
        } else {
          logger.warn('No schemas with default export found');
        }
      }

      async function scaffoldModule(apiPath: string, outputDir?: string): Promise<void> {
        const moduleName = path.basename(path.dirname(path.dirname(apiPath)));
        const apiDir = path.dirname(apiPath);
        const distDir = outputDir || path.resolve(apiDir, 'dist');

        // Create dist directory if it doesn't exist
        mkdirSync(distDir, { recursive: true });

        try {
          // Create a temporary loader script
          const fileUrl = `file://${path.resolve(apiDir, 'index.ts').replace(/\\/g, '/')}`;
          const loaderScript = `import('${fileUrl}').then(m => {
  const schema = m.schema;
  const tables = m.tables || [];
  const packages = m.packages || [];
  const sqlParts = [];
  
  if (schema && typeof schema.render === 'function') {
    sqlParts.push(schema.render());
  }
  
  for (const table of tables) {
    if (typeof table.render === 'function') {
      sqlParts.push(table.render());
    }
  }
  
  for (const pkg of packages) {
    if (typeof pkg.render === 'function') {
      sqlParts.push(pkg.render());
    }
  }
  
  console.log(JSON.stringify({ sqlParts, tableCount: tables.length, packageCount: packages.length }));
}).catch(err => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});`;

          const loaderPath = path.resolve(tmpdir(), `ov-scaffold-${Date.now()}.mjs`);
          writeFileSync(loaderPath, loaderScript, 'utf-8');

          try {
            const result = execSync(`npx tsx ${loaderPath}`, {
              cwd: rootDir,
              encoding: 'utf-8',
              stdio: ['pipe', 'pipe', 'pipe'],
            });

            const jsonMatch = result.match(/\{.*\}/s);
            if (!jsonMatch) {
              throw new Error('No JSON output found from loader script');
            }

            const output = JSON.parse(jsonMatch[0]);

            if (output.error) {
              throw new Error(output.error);
            }

            const { sqlParts, tableCount, packageCount } = output;

            if (tableCount === 0 && packageCount === 0) {
              logger.warn(`No tables or packages exported from ${moduleName}`);
              return;
            }

            if (sqlParts.length > 0) {
              const sqlContent = sqlParts.join('\n\n');
              const outputPath = path.resolve(distDir, 'index.sql');
              writeFileSync(outputPath, sqlContent, 'utf-8');
              logger.success(
                `Scaffolded @odbvue/${moduleName} → ${path.relative(rootDir, outputPath)} (${tableCount} tables, ${packageCount} packages)`,
              );

              // Prompt user to execute
              const response = await prompts({
                type: 'confirm',
                name: 'execute',
                message: 'Would you like to execute this script?',
                initial: false,
              });

              if (response.execute) {
                const connection = process.env.ODBVUE_DB_CONN;
                if (!connection) {
                  logger.error(
                    'Database connection not set. Set ODBVUE_DB_CONN environment variable.',
                  );
                  return;
                }

                logger.info(`Executing with connection: ${connection}...`);

                try {
                  const sqlScript = `connect ${connection}\n@${outputPath}\nexit\n`;
                  const tempScriptPath = path.resolve(distDir, '.sql_temp');
                  writeFileSync(tempScriptPath, sqlScript);

                  try {
                    const isWindows = platform() === 'win32';
                    const shell = isWindows ? 'powershell.exe' : '/bin/bash';
                    const sqlclCommand = `sql /nolog "@${tempScriptPath}"`;

                    execSync(sqlclCommand, {
                      cwd: distDir,
                      stdio: 'inherit',
                      shell,
                    });

                    logger.success(`Script executed successfully.`);
                  } finally {
                    // Clean up temporary file
                    try {
                      unlinkSync(tempScriptPath);
                    } catch {
                      // Ignore cleanup errors
                    }
                  }
                } catch (error) {
                  logger.error(`Script execution failed: ${error}`);
                }
              }
            }
          } finally {
            // Clean up temp file
            try {
              unlinkSync(loaderPath);
            } catch {
              // Ignore cleanup errors
            }
          }
        } catch (error) {
          throw new Error(
            `Failed to process ${moduleName}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    });
};
