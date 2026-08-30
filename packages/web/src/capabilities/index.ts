import type { OdbVueCapabilityName } from '../runtime/config.js'

export type CapabilityKind = 'core' | 'ui' | 'feature' | 'integration' | 'infrastructure'
export interface CapabilityDefinition {
  name: string
  kind: CapabilityKind
  required?: boolean
  requires?: string[]
  provides?: string[]
  title: string
  description: string
  icon: string
  configKey?: OdbVueCapabilityName
}

function defineCapabilityMetadata<const Definition extends CapabilityDefinition>(
  definition: Definition,
): Definition {
  return definition
}

export const odbVueCapabilities: readonly CapabilityDefinition[] = [
  defineCapabilityMetadata({
    name: 'routing',
    kind: 'core',
    required: true,
    title: 'Routing',
    description: 'File-based pages, route metadata, and navigation conventions.',
    icon: '$mdiRoutes',
  }),
  defineCapabilityMetadata({
    name: 'state',
    kind: 'core',
    required: true,
    title: 'State',
    description: 'Application state management, stores, and persistence.',
    icon: '$mdiDatabase',
  }),
  defineCapabilityMetadata({
    name: 'ui',
    kind: 'core',
    required: true,
    title: 'UI',
    description: 'Vuetify integration, themes, and UI defaults.',
    icon: '$mdiPalette',
  }),
  defineCapabilityMetadata({
    name: 'components',
    kind: 'core',
    required: true,
    requires: ['ui'],
    title: 'Components',
    description: 'Reusable OdbVue form, data, content, and overlay components.',
    icon: '$mdiShape',
  }),
  defineCapabilityMetadata({
    name: 'i18n',
    kind: 'core',
    required: true,
    title: 'Internationalization',
    description: 'Locale resolution and translation support.',
    icon: '$mdiTranslate',
  }),
  defineCapabilityMetadata({
    name: 'http',
    kind: 'core',
    required: true,
    title: 'HTTP',
    description: 'Configured HTTP client services.',
    icon: '$mdiWeb',
  }),
  defineCapabilityMetadata({
    name: 'errors',
    kind: 'core',
    required: true,
    title: 'Error handling',
    description: 'Application error capture and reporting.',
    icon: '$mdiAlertCircle',
  }),
  defineCapabilityMetadata({
    name: 'auth',
    kind: 'feature',
    title: 'Authentication',
    description: 'Authentication and identity support.',
    icon: '$mdiShieldAccount',
    configKey: 'auth',
  }),
  defineCapabilityMetadata({
    name: 'audit',
    kind: 'feature',
    title: 'Audit',
    description: 'Audit event recording.',
    icon: '$mdiClipboardTextClock',
    configKey: 'audit',
  }),
  defineCapabilityMetadata({
    name: 'settings',
    kind: 'feature',
    title: 'Settings',
    description: 'Application settings management.',
    icon: '$mdiCog',
    configKey: 'settings',
  }),
  defineCapabilityMetadata({
    name: 'storage',
    kind: 'integration',
    title: 'Storage',
    description: 'External storage provider integration.',
    icon: '$mdiFolder',
    configKey: 'storage',
  }),
  defineCapabilityMetadata({
    name: 'ai',
    kind: 'integration',
    title: 'AI',
    description: 'AI provider integration.',
    icon: '$mdiCreation',
    configKey: 'ai',
  }),
  defineCapabilityMetadata({
    name: 'email',
    kind: 'integration',
    title: 'Email',
    description: 'Email provider integration.',
    icon: '$mdiEmail',
    configKey: 'email',
  }),
] as const
