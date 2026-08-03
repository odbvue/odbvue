#!/usr/bin/env node

import { Command } from 'commander'
import { logger } from './shared/logger.js'
import { version } from './shared/version.js'

import { EnvironmentStore } from './adapters/environment-store.js'

import { registerSetupCommand } from './commands/setup.js'
import { registerImplodeCommand } from './commands/implode.js'

import { registerEnvironmentSetCommand } from './commands/environment-set.js'

import { registerInfraUpCommand } from './commands/infra-up.js'
import { registerInfraDownCommand } from './commands/infra-down.js'
import { registerInfraStatusCommand } from './commands/infra-status.js'

import { registerDbScaffoldCommand } from './commands/db-scaffold.js'
import { registerDbExecCommand } from './commands/db-exec.js'
import { registerDbUpCommand } from './commands/db-up.js'
import { registerDbDownCommand } from './commands/db-down.js'
import { registerDbTypesCommand } from './commands/db-types.js'

const program = new Command()
const environmentStore = new EnvironmentStore()
const { projectName, currentEnv } = environmentStore.getCurrent()

program.name('ov').description('OdbVue CLI').version(version, '-v, --version')

logger.msg(`OdbVue CLI v${version}`)
if (projectName) logger.msg(`Project:     ${projectName}`)
if (currentEnv) logger.msg(`Environment: ${currentEnv}`)
logger.lf()

registerSetupCommand(program)
registerImplodeCommand(program)

registerEnvironmentSetCommand(program)

registerInfraUpCommand(program)
registerInfraDownCommand(program)
registerInfraStatusCommand(program)

registerDbExecCommand(program)
registerDbScaffoldCommand(program)
registerDbUpCommand(program)
registerDbDownCommand(program)
registerDbTypesCommand(program)

program.parse(process.argv)

if (process.argv.length < 3) {
  program.outputHelp()
}
