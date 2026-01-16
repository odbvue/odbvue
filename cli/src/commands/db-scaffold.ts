import chalk from 'chalk'
import { existsSync, mkdirSync, writeFileSync, readdirSync, rmSync } from 'fs'
import { join, relative, dirname, resolve } from 'path'
import { pathToFileURL } from 'url'
import { execSync } from 'child_process'
import { tmpdir } from 'os'
import { logger, rootDir } from '../index.js'

type TsConfigDiscovery = {
  projectRoot: string
  tsconfigPath?: string
}

function discoverTsConfig(startDir: string): TsConfigDiscovery {
  let projectRoot = startDir
  let tsconfigPath: string | undefined

  while (projectRoot !== dirname(projectRoot)) {
    const appConfig = join(projectRoot, 'tsconfig.app.json')
    const baseConfig = join(projectRoot, 'tsconfig.json')
    if (existsSync(appConfig)) {
      tsconfigPath = appConfig
      break
    }
    if (existsSync(baseConfig)) {
      tsconfigPath = baseConfig
      break
    }
    projectRoot = dirname(projectRoot)
  }

  return { projectRoot, tsconfigPath }
}

function runTsModuleToJson(indexTsFile: string): string {
  const absolutePath = resolve(indexTsFile)
  const apiDir = dirname(absolutePath)
  const { projectRoot, tsconfigPath } = discoverTsConfig(apiDir)

  const startToken = '__OV_DS_RESULT__'
  const endToken = '__OV_DS_RESULT_END__'
  const fileUrl = pathToFileURL(absolutePath).href

  // Build the loader script as an array of lines, then join with newlines.
  // This avoids issues with tsx's lexer parsing string literals in the generated file.
  const loaderLines = [
    `const fileUrl = ${JSON.stringify(fileUrl)};`,
    `const startToken = ${JSON.stringify(startToken)};`,
    `const endToken = ${JSON.stringify(endToken)};`,
    ``,
    `import(fileUrl).then(function(m) {`,
    `  var jsonOutput;`,
    `  if (m.schema && typeof m.schema.render === 'function') {`,
    `    jsonOutput = m.schema.render();`,
    `  } else if (m.default && typeof m.default === 'function') {`,
    `    var result = m.default();`,
    `    jsonOutput = typeof result === 'string' ? result : JSON.stringify(result);`,
    `  } else if (typeof m.default === 'object' && m.default) {`,
    `    jsonOutput = JSON.stringify(m.default);`,
    `  } else {`,
    `    throw new Error('No schema export or executable module found');`,
    `  }`,
    `  process.stdout.write(startToken + JSON.stringify({ jsonOutput: jsonOutput }) + endToken);`,
    `}).catch(function(err) {`,
    `  process.stderr.write(startToken + JSON.stringify({ error: err && err.message ? err.message : String(err) }) + endToken);`,
    `  process.exit(1);`,
    `});`,
  ]
  const loaderScript = loaderLines.join('\n')

  // Use .cjs extension so tsx's ESM hook skips this file entirely
  const loaderPath = resolve(
    tmpdir(),
    `ov-ds-${Date.now()}-${Math.random().toString(16).slice(2)}.cjs`,
  )
  writeFileSync(loaderPath, loaderScript, 'utf-8')

  try {
    let stdout = ''
    try {
      // Use Node directly with tsx's ESM hook for TypeScript imports.
      // The loader itself is .cjs so tsx won't try to transform it.
      // Custom tsconfig is passed via TSX_TSCONFIG_PATH.
      const env: Record<string, string | undefined> = {
        ...process.env,
        ...(tsconfigPath ? { TSX_TSCONFIG_PATH: tsconfigPath } : {}),
      }

      const nodeCmd = `node --import tsx "${loaderPath}"`

      stdout = execSync(nodeCmd, {
        cwd: projectRoot,
        encoding: 'utf-8',
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    } catch (error) {
      const err = error as { stderr?: string; stdout?: string; message?: string }
      const combined = `${err.stdout || ''}\n${err.stderr || ''}`
      const startIdx = combined.lastIndexOf(startToken)
      const endIdx = combined.lastIndexOf(endToken)
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        const payload = combined.slice(startIdx + startToken.length, endIdx)
        try {
          const parsed = JSON.parse(payload)
          if (parsed?.error) {
            throw new Error(parsed.error)
          }
        } catch {
          // fall through
        }
      }
      if (err.stderr) {
        throw new Error(`${err.message || 'Failed to execute TypeScript module'}\n${err.stderr}`)
      }
      throw new Error(err.message || 'Failed to execute TypeScript module')
    }

    const startIdx = stdout.lastIndexOf(startToken)
    const endIdx = stdout.lastIndexOf(endToken)
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
      // Fallback: if module printed raw JSON and nothing else
      const trimmed = stdout.trim()
      try {
        JSON.parse(trimmed)
        return trimmed
      } catch {
        throw new Error('No JSON output captured from TypeScript module (missing ov ds sentinel)')
      }
    }

    const payload = stdout.slice(startIdx + startToken.length, endIdx)
    const parsed = JSON.parse(payload) as { jsonOutput?: string; error?: string }
    if (parsed.error) {
      throw new Error(parsed.error)
    }
    if (!parsed.jsonOutput) {
      throw new Error('No jsonOutput returned from TypeScript module')
    }

    return parsed.jsonOutput
  } finally {
    try {
      rmSync(loaderPath, { force: true })
    } catch {
      // ignore
    }
  }
}

/**
 * Recursively find all index.ts files in a directory
 */
function findIndexFiles(dirPath: string): string[] {
  const files: string[] = []

  function traverse(currentPath: string) {
    try {
      const entries = readdirSync(currentPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = join(currentPath, entry.name)

        if (entry.isDirectory()) {
          // Skip node_modules and dist directories
          if (entry.name !== 'node_modules' && entry.name !== 'dist') {
            traverse(fullPath)
          }
        } else if (entry.name === 'index.ts' || entry.name === 'index.js') {
          files.push(fullPath)
        }
      }
    } catch {
      // Silently skip inaccessible directories
    }
  }

  traverse(dirPath)
  return files
}

/**
 * Derive output filename from input path.
 * Pattern: use the folder name before 'api' if the path ends with 'api',
 * otherwise use the last folder name.
 * Examples:
 *   apps/src/api -> api.json
 *   apps/src/api/packages/crm -> crm.json
 *   modules/crm/api -> crm.json
 */
function deriveOutputName(inputPath: string): string {
  const normalized = resolve(inputPath)
  const parts = normalized.split(/[\\/]/).filter(Boolean)

  // If the last part is 'api', use the part before it
  if (parts.length >= 2 && parts[parts.length - 1].toLowerCase() === 'api') {
    return parts[parts.length - 2]
  }

  // Otherwise use the last part
  return parts[parts.length - 1] || 'schema'
}

export async function handleDbScaffold(argv: string[]) {
  if (argv.length < 1) {
    logger.error(chalk.red('Error: Missing arguments. Usage: ov ds <input-path>'))
    logger.log('')
    logger.log(chalk.cyan('Usage:'))
    logger.log(chalk.gray('  $ ov ds <input-path>'))
    logger.log('')
    logger.log(chalk.cyan('Description:'))
    logger.log(chalk.gray('  Scans input path for index.ts files with schema exports'))
    logger.log(chalk.gray('  Outputs schema JSON to ./db/schema/<name>.json'))
    logger.log(chalk.gray('  Output name is derived from input path (folder before "api")'))
    logger.log('')
    logger.log(chalk.cyan('Examples:'))
    logger.log(chalk.gray('  $ ov ds apps/src/api           → db/schema/src.json'))
    logger.log(chalk.gray('  $ ov ds apps/src/api/packages/crm → db/schema/crm.json'))
    logger.log('')
    process.exit(1)
  }

  const inputPath = argv[0]
  // Derive output filename from input path structure
  const outputName = deriveOutputName(inputPath)
  const outputFile = join(rootDir, 'db', 'schema', `${outputName}.json`)

  // Validate input path
  if (!existsSync(inputPath)) {
    logger.error(chalk.red(`Error: Input path does not exist: ${inputPath}`))
    process.exit(1)
  }

  try {
    logger.info(chalk.cyan('Scanning for schema definitions...'))
    logger.log(`Input:  ${inputPath}`)
    logger.log(`Output: ${relative(process.cwd(), outputFile)}`)
    logger.log('')

    // Find all index files (both .ts and .js)
    const indexFiles = findIndexFiles(inputPath)

    // Deduplicate - if both index.ts and index.js exist, prefer .js
    const uniqueFiles = new Map<string, string>()
    for (const file of indexFiles) {
      const dir = dirname(file)
      const existing = uniqueFiles.get(dir)
      if (!existing || file.endsWith('.js')) {
        uniqueFiles.set(dir, file)
      }
    }

    const fileList = Array.from(uniqueFiles.values())
    logger.info(`Found ${fileList.length} index file(s)`)

    logger.log('')
    logger.info(chalk.cyan(`Processing ${fileList.length} file(s)...`))
    logger.log('')

    // Process each file - capture either schema.render() or console.log output
    for (const indexFile of fileList) {
      try {
        const absolutePath = resolve(indexFile)
        const fileUrl = pathToFileURL(absolutePath).href
        const relPath = relative(inputPath, indexFile)

        let jsonOutput: string

        if (indexFile.endsWith('.ts')) {
          try {
            jsonOutput = runTsModuleToJson(indexFile)
          } catch (error) {
            logger.error(
              chalk.red(
                `Error executing ${relPath}: ${error instanceof Error ? error.message : String(error)}`,
              ),
            )
            continue
          }
        } else {
          // For JavaScript files, use standard import
          const module = await import(fileUrl)

          if (module.schema && typeof module.schema.render === 'function') {
            jsonOutput = module.schema.render()
          } else if (module.default && typeof module.default === 'function') {
            // Try calling default export as function
            const result = module.default()
            jsonOutput = typeof result === 'string' ? result : JSON.stringify(result)
          } else if (typeof module.default === 'object') {
            // Use default export as JSON
            jsonOutput = JSON.stringify(module.default)
          } else {
            logger.warn(
              chalk.yellow(`Skipping ${relPath}: No schema export or executable module found`),
            )
            continue
          }
        }

        // Skip if no output was captured
        if (!jsonOutput) {
          logger.warn(chalk.yellow(`Skipping ${relPath}: No output captured`))
          continue
        }

        // Validate and parse JSON output
        let parsedJson: unknown
        try {
          parsedJson = JSON.parse(jsonOutput)
        } catch {
          logger.warn(chalk.yellow(`Skipping ${relPath}: Output is not valid JSON`))
          continue
        }

        // Store the parsed schema (we'll write only one file from this input path)
        // For now, use the first valid schema found
        // Create output directory if needed
        const outputDir = dirname(outputFile)
        mkdirSync(outputDir, { recursive: true })

        // Write JSON file (pretty-printed)
        writeFileSync(outputFile, JSON.stringify(parsedJson, null, 2), 'utf-8')

        logger.info(chalk.green(`✓ ${relPath} → ${relative(process.cwd(), outputFile)}`))
      } catch (error) {
        logger.error(
          chalk.red(
            `Error processing ${relative(inputPath, indexFile)}: ${error instanceof Error ? error.message : String(error)}`,
          ),
        )
      }
    }

    logger.log('')
    logger.info(chalk.green('Schema scaffolding completed successfully'))
    process.exit(0)
  } catch (error) {
    logger.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
    process.exit(1)
  }
}
