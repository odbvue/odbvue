import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const cliDir = path.resolve(__dirname, '../../')
export const rootDir = path.resolve(cliDir, '../../')

const packageJsonPath = path.resolve(rootDir, 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
export const version = packageJson.version
