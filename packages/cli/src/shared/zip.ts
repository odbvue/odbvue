import fs from 'fs'
import { execSync } from 'child_process'

import { fatalError } from './errors.js'

export const unZip = async (zipPath: string, extractDir: string): Promise<void> => {
  if (!fs.existsSync(zipPath)) {
    fatalError(`Zip file not found at ${zipPath}`)
  }

  if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true })
  fs.mkdirSync(extractDir, { recursive: true })

  try {
    const command =
      process.platform === 'win32'
        ? `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force"`
        : `unzip -q "${zipPath}" -d "${extractDir}"`

    execSync(command, {
      stdio: 'pipe',
    })
  } catch (error) {
    fatalError(error)
  }
}
