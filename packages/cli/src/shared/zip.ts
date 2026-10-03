import fs from 'fs'
import { execSync } from 'child_process'

import { logger } from './logger.js'

export const unZip = async (zipPath: string, extractDir: string): Promise<void> => {
  if (!fs.existsSync(zipPath)) {
    logger.fatal(`Zip file not found at ${zipPath}`)
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
    logger.fatal(error)
  }
}
