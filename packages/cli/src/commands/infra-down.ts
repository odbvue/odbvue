import { Command } from 'commander'
import { logger } from '../shared/logger.js'
import { EnvironmentStore } from '../adapters/environment-store.js'
import { ConfigStore } from '../adapters/config-store.js'
import { YamlFile } from '../shared/yamlFile.js'
import { PodmanClient } from '../adapters/podman-client.js'
import path from 'path'
import { configDir } from '../shared/dirs.js'

export const registerInfraDownCommand = (program: Command) => {
  program
    .command('infra-down')
    .alias('id')
    .description('Infrastructure shutdown')
    .action(async () => {
      logger.info('Shutting down infrastructure...')

      const environmentStore = new EnvironmentStore()
      const { projectName, currentEnv } = environmentStore.getCurrent()

      const config = new ConfigStore()
      let services: Record<string, unknown> = {}
      config.getConfig().services.forEach((resource) => {
        if (resource.kind === 'oracle-adb') {
          services['adb'] = {
            build: {
              context: '.',
            },
            ports: [`${resource.spec.listenerPort}:1522`, `${resource.spec.ordsPort}:8443`],
            environment: {
              WORKLOAD_TYPE: 'ATP',
              ADMIN_PASSWORD: '${ODBVUE_ADMIN_PASSWORD}',
              WALLET_PASSWORD: '${ODBVUE_WALLET_PASSWORD}',
            },
            cap_add: ['SYS_ADMIN'],
            devices: ['/dev/fuse:/dev/fuse'],
          }
        }
      })

      const composeFileContent = {
        name: `${projectName}-${currentEnv}`,
        services,
      }

      const composeFile = new YamlFile(path.join(configDir, currentEnv, 'podman-compose.yaml'))
      composeFile.set(composeFileContent)

      const podman = new PodmanClient()
      const podmanDir = path.resolve(configDir, currentEnv)
      await podman.composeDown(podmanDir)

      logger.info('Infrastructure is shut down!')
      //logger.info(JSON.stringify({ platforms, resources }, null, 2))
    })
}
