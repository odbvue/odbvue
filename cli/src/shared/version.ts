import path from 'path'
import fs from 'fs'
import { rootDir } from './dirs.js'

const packageJsonPath = path.resolve(rootDir, 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
export const version = packageJson.version
