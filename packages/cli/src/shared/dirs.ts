import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const cliDir = path.resolve(__dirname, '../../')
export const rootDir = path.resolve(cliDir, '../../')
export const currentDir = process.cwd()
export const homeDir = os.homedir()
export const configDir = path.resolve(rootDir, '.config')
export const webDir = path.resolve(rootDir, 'apps/web')
export const dbDir = path.resolve(rootDir, 'apps/db')
