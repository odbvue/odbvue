import { runInfraUpPodman } from './infra-up-podman.js'
import { runInfraUpOci } from './infra-up-oci.js'
import { runConfigureWeb } from './infra-up-configure-web.js'

export const runInfraUp = async (): Promise<void> => {
  await runInfraUpPodman()
  await runInfraUpOci()
  await runConfigureWeb()
}
