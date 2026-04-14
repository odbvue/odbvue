#!/usr/bin/env node

import { Command } from 'commander'
import { logger } from './utils/logger.js'
import { version } from './utils/index.js'
import { Config } from './utils/config.js'

import { registerSetupCommand } from './commands/setup.js'

const program = new Command()
const config = new Config()
const environment = config.getEnvironment()

program.name('ov').description('OdbVue CLI').version(version, '-v, --version')

logger.msg(`OdbVue CLI v${version}`)
if (environment) logger.msg(`Environment: ${environment}`)
logger.lf()

registerSetupCommand(program)

program.parse(process.argv)

if (process.argv.length < 3) {
  program.outputHelp()
}
