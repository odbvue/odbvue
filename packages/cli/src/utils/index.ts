import os from 'os'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { logger } from './logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const cliDir = path.resolve(__dirname, '../../')
export const rootDir = path.resolve(cliDir, '../../')
export const currentDir = process.cwd()
export const homeDir = os.homedir()

const packageJsonPath = path.resolve(rootDir, 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
export const version = packageJson.version

export { logger }
