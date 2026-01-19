import { Command } from 'commander';
import yaml from 'js-yaml';
import {
  logger,
  rootDir,
  path,
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
} from '../utils.js';
import { execSync } from 'child_process';
import { cpSync, rmSync } from 'fs';

// ============================================================================
// Types
// ============================================================================

type ReleaseEntry = {
  version: string;
  date: string;
  description?: string;
  files: string[];
};

type ReleasesManifest = {
  schema: string;
  releases: ReleaseEntry[];
};

// ============================================================================
// Utilities
// ============================================================================

function getReleasesPath(): string {
  return path.join(rootDir, 'db', 'releases');
}

function getManifestPath(): string {
  return path.join(getReleasesPath(), 'releases.yaml');
}

function loadManifest(): ReleasesManifest {
  const manifestPath = getManifestPath();
  
  if (!existsSync(manifestPath)) {
    return {
      schema: 'ODBVUE',
      releases: [],
    };
  }

  const content = readFileSync(manifestPath, 'utf-8');
  return yaml.load(content) as ReleasesManifest;
}

function saveManifest(manifest: ReleasesManifest): void {
  const manifestPath = getManifestPath();
  const content = yaml.dump(manifest, { lineWidth: -1 });
  writeFileSync(manifestPath, content);
}

function getNextDir(): string {
  return path.join(getReleasesPath(), 'next');
}

function collectSqlFiles(dir: string, basePath: string = ''): string[] {
  const files: string[] = [];
  
  if (!existsSync(dir)) {
    return files;
  }

  const entries = readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      files.push(...collectSqlFiles(fullPath, relativePath));
    } else if (entry.name.endsWith('.sql')) {
      files.push(relativePath);
    }
  }
  
  return files;
}

function generateConsolidatedScript(releaseDir: string, version: string): string {
  const lines: string[] = [
    `-- Release ${version}`,
    `-- Generated: ${new Date().toISOString()}`,
    '',
    'SET SERVEROUTPUT ON',
    '',
  ];

  // Order of execution
  const executionOrder = [
    'scripts/before',
    'tables',
    'constraints',
    'indexes',
    'comments',
    'packages',
    'scripts/after',
  ];

  for (const subdir of executionOrder) {
    const subdirPath = path.join(releaseDir, subdir);
    
    if (!existsSync(subdirPath)) {
      continue;
    }

    const sqlFiles = readdirSync(subdirPath)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    if (sqlFiles.length === 0) {
      continue;
    }

    const sectionName = subdir.replace('/', ' - ').toUpperCase();
    lines.push(`-- ============================================================================`);
    lines.push(`-- ${sectionName}`);
    lines.push(`-- ============================================================================`);
    lines.push('');

    for (const sqlFile of sqlFiles) {
      lines.push(`@@${subdir}/${sqlFile}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// Commands
// ============================================================================

async function createRelease(version: string, description?: string): Promise<void> {
  const releasesPath = getReleasesPath();
  const nextDir = getNextDir();
  const versionDir = path.join(releasesPath, version);

  // Validate version format (semver-like)
  if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
    throw new Error(
      `Invalid version format: ${version}. Use semantic versioning (e.g., 1.0.0, 1.2.3-beta)`
    );
  }

  // Check if version already exists
  if (existsSync(versionDir)) {
    throw new Error(`Release ${version} already exists`);
  }

  // Check if next directory has content
  if (!existsSync(nextDir)) {
    throw new Error('No pending changes in db/releases/next/');
  }

  const sqlFiles = collectSqlFiles(nextDir);
  if (sqlFiles.length === 0) {
    throw new Error('No SQL files found in db/releases/next/');
  }

  // Create version directory
  mkdirSync(versionDir, { recursive: true });

  // Copy files from next to version directory
  logger.info(`Copying files to ${version}/...`);
  cpSync(nextDir, versionDir, { recursive: true });

  // Generate consolidated script
  const consolidatedScript = generateConsolidatedScript(versionDir, version);
  const scriptPath = path.join(versionDir, `${version}.sql`);
  writeFileSync(scriptPath, consolidatedScript);

  // Update manifest
  const manifest = loadManifest();
  
  const releaseEntry: ReleaseEntry = {
    version,
    date: new Date().toISOString().split('T')[0],
    files: sqlFiles,
  };
  
  if (description) {
    releaseEntry.description = description;
  }

  manifest.releases.push(releaseEntry);
  saveManifest(manifest);

  // Clear next directory (keep structure)
  logger.info('Clearing next/ directory...');
  const nextSubdirs = ['scripts/before', 'tables', 'constraints', 'indexes', 'comments', 'packages', 'scripts/after'];
  
  for (const subdir of nextSubdirs) {
    const subdirPath = path.join(nextDir, subdir);
    if (existsSync(subdirPath)) {
      const files = readdirSync(subdirPath).filter((f) => f.endsWith('.sql'));
      for (const file of files) {
        rmSync(path.join(subdirPath, file));
      }
    }
  }

  // Remove next.sql
  const nextSqlPath = path.join(nextDir, 'next.sql');
  if (existsSync(nextSqlPath)) {
    rmSync(nextSqlPath);
  }

  // Try to create git tag
  try {
    execSync(`git tag -a v${version} -m "Release ${version}"`, {
      cwd: rootDir,
      stdio: 'pipe',
    });
    logger.success(`Created git tag v${version}`);
  } catch {
    logger.warn('Could not create git tag (not a git repository or tag already exists)');
  }

  logger.success(`Created release ${version}`);
  logger.info(`  Files: ${sqlFiles.length}`);
  logger.info(`  Script: ${path.relative(rootDir, scriptPath)}`);
  logger.info(`  Manifest: ${path.relative(rootDir, getManifestPath())}`);
}

async function listReleases(): Promise<void> {
  const manifest = loadManifest();

  if (manifest.releases.length === 0) {
    logger.info('No releases found');
    return;
  }

  logger.info(`Schema: ${manifest.schema}`);
  logger.info('');
  logger.info('Releases:');

  for (const release of manifest.releases) {
    const desc = release.description ? ` - ${release.description}` : '';
    logger.info(`  ${release.version} (${release.date})${desc}`);
    logger.muted(`    Files: ${release.files.length}`);
  }
}

async function showReleaseInfo(version: string): Promise<void> {
  const manifest = loadManifest();
  const release = manifest.releases.find((r) => r.version === version);

  if (!release) {
    throw new Error(`Release ${version} not found`);
  }

  logger.info(`Release: ${release.version}`);
  logger.info(`Date: ${release.date}`);
  if (release.description) {
    logger.info(`Description: ${release.description}`);
  }
  logger.info('');
  logger.info('Files:');
  for (const file of release.files) {
    logger.muted(`  ${file}`);
  }
}

async function generateChangelog(): Promise<void> {
  const manifest = loadManifest();
  const releasesPath = getReleasesPath();

  if (manifest.releases.length === 0) {
    logger.info('No releases to generate changelog from');
    return;
  }

  const lines: string[] = [
    '# Database Changelog',
    '',
    `Schema: \`${manifest.schema}\``,
    '',
    '## Releases',
    '',
  ];

  // Sort releases by version (descending)
  const sortedReleases = [...manifest.releases].sort((a, b) => {
    const aParts = a.version.split('.').map((n) => parseInt(n, 10) || 0);
    const bParts = b.version.split('.').map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < 3; i++) {
      if ((bParts[i] || 0) !== (aParts[i] || 0)) {
        return (bParts[i] || 0) - (aParts[i] || 0);
      }
    }
    return 0;
  });

  for (const release of sortedReleases) {
    lines.push(`### ${release.version} (${release.date})`);
    lines.push('');
    
    if (release.description) {
      lines.push(release.description);
      lines.push('');
    }

    // Group files by type
    const tables = release.files.filter((f) => f.startsWith('tables/'));
    const packages = release.files.filter((f) => f.startsWith('packages/'));
    const scripts = release.files.filter((f) => f.startsWith('scripts/'));

    if (tables.length > 0) {
      lines.push('**Tables:**');
      for (const file of tables) {
        const name = path.basename(file, '.sql');
        lines.push(`- \`${name}\``);
      }
      lines.push('');
    }

    if (packages.length > 0) {
      lines.push('**Packages:**');
      const pkgNames = new Set<string>();
      for (const file of packages) {
        const name = path.basename(file, '.sql').replace(/_spec$|_body$/, '');
        pkgNames.add(name);
      }
      for (const name of pkgNames) {
        lines.push(`- \`${name}\``);
      }
      lines.push('');
    }

    if (scripts.length > 0) {
      lines.push('**Scripts:**');
      for (const file of scripts) {
        lines.push(`- \`${file}\``);
      }
      lines.push('');
    }
  }

  const changelogPath = path.join(releasesPath, 'CHANGELOG.md');
  writeFileSync(changelogPath, lines.join('\n'));

  logger.success(`Generated changelog: ${path.relative(rootDir, changelogPath)}`);
}

// ============================================================================
// Command Registration
// ============================================================================

export const registerDbReleaseCommand = (program: Command) => {
  const release = program
    .command('db-release')
    .alias('drl')
    .description('Manage database release versions');

  release
    .command('create <version>')
    .description('Create a new release from db/releases/next/')
    .option('-d, --description <desc>', 'Release description')
    .action(async (version: string, options: { description?: string }) => {
      try {
        await createRelease(version, options.description);
      } catch (error) {
        logger.error(`Release failed: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  release
    .command('list')
    .alias('ls')
    .description('List all releases')
    .action(async () => {
      try {
        await listReleases();
      } catch (error) {
        logger.error(`Failed: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  release
    .command('info <version>')
    .description('Show release details')
    .action(async (version: string) => {
      try {
        await showReleaseInfo(version);
      } catch (error) {
        logger.error(`Failed: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  release
    .command('changelog')
    .description('Generate CHANGELOG.md from releases')
    .action(async () => {
      try {
        await generateChangelog();
      } catch (error) {
        logger.error(`Failed: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
};
