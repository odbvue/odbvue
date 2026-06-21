import path from 'path'
import fs from 'fs'
import prompts from 'prompts'

import { homeDir } from '../shared/dirs.js'
import { fatalError } from '../shared/errors.js'

import { EnvironmentStore } from '../adapters/environment-store.js'
import { ConfigStore } from '../adapters/config-store.js'
import { OciClient, OciFile } from '../adapters/oci-client.js'

const CREATE_NEW = '__create_new'

export const runSetupPlatformOci = async () => {
  const { projectName, currentEnv, envDir } = new EnvironmentStore().getCurrent()

  const ociDirPath = path.join(envDir, '.oci')
  const homeOciDirPath = path.join(homeDir, '.oci')
  const ociFilePath = path.join(ociDirPath, 'config')

  if (!fs.existsSync(ociDirPath) && fs.existsSync(homeOciDirPath)) {
    fs.cpSync(homeOciDirPath, ociDirPath, { recursive: true })
  }

  if (!fs.existsSync(ociFilePath)) {
    fatalError(
      `OCI config file not found at ${ociFilePath}. Please set up your OCI config file and try again.`,
    )
  }

  const ociFile = new OciFile(ociFilePath)
  const ociProfiles = ociFile.getProfiles()

  let profile: string = 'DEFAULT'
  if (ociProfiles.length === 0) {
    fatalError(
      `No OCI profiles found in config file at ${ociFilePath}. Please set up your OCI config file and try again.`,
    )
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

  const ociClient = new OciClient(ociFilePath, profile)
  const compartmentList = await ociClient.getCompartments()

  let compartmentId: string = ''
  let compartmentName: string = ''
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
        initial: `${projectName}-${currentEnv}`,
        validate: (value) => (value.trim() ? true : 'This field is required'),
      },
      {
        type: 'text',
        name: 'description',
        message: 'Compartment description',
        initial: `${projectName} ${currentEnv} compartment`,
        validate: (value) => (value.trim() ? true : 'This field is required'),
      },
    ])
    const newCompartment = await ociClient.createCompartment(name, description)
    compartmentId = newCompartment.id!
    compartmentName = newCompartment.name!
  } else {
    const selectedCompartment = compartmentList.find((c) => c.id === compartment)
    if (!selectedCompartment) {
      fatalError('Selected compartment not found')
    } else {
      compartmentId = selectedCompartment.id
      compartmentName = selectedCompartment.name
    }
  }

  const config = new ConfigStore()
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
