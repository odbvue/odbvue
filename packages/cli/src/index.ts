#!/usr/bin/env node

import { Command } from 'commander'
import { version } from './utils/index.js'
import { logger } from './utils/logger.js'

import { registerSetupCommand } from './commands/setup.js'

const program = new Command()

program.name('ov').description('OdbVue CLI').version(version, '-v, --version')

logger.msg(`OdbVue CLI v${version}`)
logger.msg('')

registerSetupCommand(program)

program.parse(process.argv)

if (process.argv.length < 3) {
  program.outputHelp()
}
