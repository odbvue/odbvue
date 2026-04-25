import prompts from 'prompts'
import path from 'path'
import fs from 'fs'
import { configDir } from '../utils/index.js'
import { logger } from '../utils/logger.js'
import { Config } from '../utils/config.js'
import { PodmanManager } from '../utils/podman.js'
import { OciFile } from '../utils/ociFile.js'
import { OciClient } from '../utils/oci.js'

const CREATE_NEW = '__create_new'
const validateNotEmpty = (value: string) => (value.trim() ? true : 'This field is required')

export const runSetupPlatforms = async () => {
  logger.info('Setting up deployment platforms...')
  const config = new Config()
  const [projectName, environment] = [config.getProjectName(), config.getCurrentEnvironment()]

  const platforms = [
    { title: 'Oracle Cloud Infrastructure', value: 'oci', selected: true },
    { title: 'Local (Podman Containers)', value: 'local', selected: true },
  ]

  const { platform } = await prompts([
    {
      type: 'multiselect',
      name: 'platform',
      message: 'Deployment platform',
      choices: platforms,
      min: 1,
    },
  ])

  if (platform.includes('local')) {
    const podman = new PodmanManager()
    if (!podman.isInstalled()) {
      logger.error(
        'Podman is not installed. Please install Podman to use local deployment: https://podman.io/docs/installation',
      )
      process.exit(1)
    }
    if (!podman.isRunning()) {
      logger.info('Starting Podman machine...')
      if (!podman.startMachine()) {
        logger.error('Failed to start Podman machine. Please start it manually and try again.')
        process.exit(1)
      }
    }
    const { cpus, memoryGb } = podman.checkResources()
    if (cpus < 4 || memoryGb < 8) {
      logger.warn(
        `Podman machine has insufficient resources (CPUs: ${cpus}, Memory: ${memoryGb} GB).  It is recommended to allocate at least 4 CPUs and 8 GB of memory.`,
      )
    }

    config.addPlatform({ platform: 'local' })
  }
  if (platform.includes('oci')) {
    const ociConfigPath = path.resolve(configDir, environment, '.oci', 'config')
    if (!fs.existsSync(ociConfigPath)) {
      logger.error(
        `OCI config file not found at ${ociConfigPath}. Please set up your OCI config file and try again.`,
      )
      logger.lf()
      process.exit(1)
    }

    const ociFile = new OciFile(environment)
    const ociProfiles = ociFile.listProfiles()

    let profile: string
    if (ociProfiles.length === 0) {
      logger.error(
        `No OCI profiles found in config file at ${ociConfigPath}. Please set up your OCI config file and try again.`,
      )
      logger.lf()
      process.exit(1)
    } else if (ociProfiles.length === 1) {
      profile = ociProfiles[0]
    } else {
      const { profile: selectedProfile } = await prompts([
        {
          type: 'select',
          name: 'profile',
          message: 'Select OCI profile to use for deployment',
          choices: ociProfiles.map((p) => ({ title: p, value: p })),
        },
      ])
      profile = selectedProfile
    }

    const ociClient = new OciClient(ociConfigPath, profile)
    const compartmentList = await ociClient.getCompartmentList()

    let compartmentId: string
    let compartmentName: string
    const compartments = [
      ...compartmentList.map((compartment) => ({
        title: compartment.name!,
        value: compartment.id!,
      })),
      { title: '+ Create new', value: CREATE_NEW },
    ]

    const { compartment } = await prompts([
      {
        type: 'select',
        name: 'compartment',
        message: 'Select OCI compartment for deployment',
        choices: compartments,
      },
    ])

    if (compartment === CREATE_NEW) {
      const { name, description } = await prompts([
        {
          type: 'text',
          name: 'name',
          message: 'Compartment name',
          initial: `${projectName}-${environment}`,
          validate: validateNotEmpty,
        },
        {
          type: 'text',
          name: 'description',
          message: 'Compartment description',
          initial: `${projectName} ${environment} compartment`,
          validate: validateNotEmpty,
        },
      ])
      const newCompartment = await ociClient.createCompartment(name, description)
      compartmentId = newCompartment.id!
      compartmentName = newCompartment.name!
    } else {
      const selectedCompartment = compartmentList.find((c) => c.id === compartment)
      if (!selectedCompartment) {
        logger.error('Selected compartment not found. Please try again.')
        logger.lf()
        process.exit(1)
      }
      compartmentId = selectedCompartment.id!
      compartmentName = selectedCompartment.name!
    }

    config.addPlatform({
      platform: 'oci',
      spec: {
        profile,
        tenancy: ociClient.tenancyId,
        region: ociClient.regionId,
        compartment: {
          id: compartmentId,
          name: compartmentName,
        },
      },
    })
  }

  logger.lf()
}
