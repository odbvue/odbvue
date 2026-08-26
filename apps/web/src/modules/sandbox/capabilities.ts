import { odbVueCapabilities, type OdbVueCapabilityName } from '@odbvue/web'

export type SandboxCapability = {
  name: string
  title: string
  description: string
  icon: string
  kind: string
  required?: boolean
  configKey?: OdbVueCapabilityName
}

const capabilityDetails: Record<
  string,
  Pick<SandboxCapability, 'title' | 'description' | 'icon'>
> = {
  state: {
    title: 'State',
    description: 'Application state management and stores.',
    icon: '$mdiDatabase',
  },
  ui: {
    title: 'UI',
    description: 'Vuetify integration, themes, and UI defaults.',
    icon: '$mdiPalette',
  },
  i18n: {
    title: 'Internationalization',
    description: 'Locale resolution and translation support.',
    icon: '$mdiTranslate',
  },
  http: {
    title: 'HTTP',
    description: 'Configured HTTP client services.',
    icon: '$mdiWeb',
  },
  vite: {
    title: 'Vite',
    description: 'Vite development and build integration.',
    icon: '$mdiLightningBolt',
  },
}

const optionalCapabilities: SandboxCapability[] = [
  {
    name: 'auth',
    title: 'Authentication',
    description: 'Authentication and identity support.',
    icon: '$mdiShieldAccount',
    kind: 'feature',
    configKey: 'auth',
  },
  {
    name: 'audit',
    title: 'Audit',
    description: 'Audit event recording.',
    icon: '$mdiClipboardTextClock',
    kind: 'feature',
    configKey: 'audit',
  },
  {
    name: 'settings',
    title: 'Settings',
    description: 'Application settings management.',
    icon: '$mdiCog',
    kind: 'feature',
    configKey: 'settings',
  },
  {
    name: 'storage',
    title: 'Storage',
    description: 'External storage provider integration.',
    icon: '$mdiFolder',
    kind: 'integration',
    configKey: 'storage',
  },
  {
    name: 'ai',
    title: 'AI',
    description: 'AI provider integration.',
    icon: '$mdiCreation',
    kind: 'integration',
    configKey: 'ai',
  },
  {
    name: 'email',
    title: 'Email',
    description: 'Email provider integration.',
    icon: '$mdiEmail',
    kind: 'integration',
    configKey: 'email',
  },
]

export const sandboxCapabilities: SandboxCapability[] = [
  ...odbVueCapabilities.map((capability) => {
    const details = capabilityDetails[capability.name]

    return {
      ...capability,
      title: details?.title ?? capability.name,
      description: details?.description ?? 'Built-in OdbVue capability.',
      icon: details?.icon ?? '$mdiPuzzle',
    }
  }),
  ...optionalCapabilities,
]
