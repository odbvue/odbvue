import { Command } from 'commander';
import { tmpdir } from 'os';
import {
  logger,
  prompt,
  rootDir,
  path,
  existsSync,
  mkdirSync,
  writeFileSync,
  unlinkSync,
  execSync,
  platform,
} from '../utils.js';

export const registerDbScaffoldCommand = (program: Command) => {
  program
    .command('db-scaffold [path]')
    .alias('ds')
    .description(
      'Generate SQL scripts from module API definitions (scans current directory if no path provided)',
    )
    .option('-o, --output <dir>', 'Output directory (defaults to ./dist relative to module)')
    .action(async (pathArg: string | undefined, options: { output?: string }) => {
      try {
        const cwd = process.cwd();
        let apiPath: string;

        if (!pathArg) {
          // Default: look for index.ts in current directory
          apiPath = path.resolve(cwd, 'index.ts');
        } else {
          // Path provided: look for api/index.ts relative to that path
          const targetDir = path.isAbsolute(pathArg) ? pathArg : path.resolve(cwd, pathArg);
          apiPath = path.resolve(targetDir, 'api/index.ts');
        }

        if (!existsSync(apiPath)) {
          logger.error(`API file not found: ${apiPath}`);
          process.exit(1);
        }

        await scaffoldModule(apiPath, options.output);
      } catch (error) {
        logger.error(`Failed to scaffold: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
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
              const answer = await prompt('\nWould you like to execute this script? (y/n) ');

              if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
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
