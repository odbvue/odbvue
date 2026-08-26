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

export function defineCapability<const Definition extends CapabilityDefinition>(
  definition: Definition,
): Definition {
  return definition
}

export const odbVueCapabilities: readonly CapabilityDefinition[] = [
  defineCapability({
    name: 'routing',
    kind: 'core',
    required: true,
    title: 'Routing',
    description: 'File-based pages, route metadata, and navigation conventions.',
    icon: '$mdiRoutes',
  }),
  defineCapability({
    name: 'state',
    kind: 'core',
    required: true,
    title: 'State',
    description: 'Application state management, stores, and persistence.',
    icon: '$mdiDatabase',
  }),
  defineCapability({
    name: 'ui',
    kind: 'ui',
    required: true,
    title: 'UI',
    description: 'Vuetify integration, themes, and UI defaults.',
    icon: '$mdiPalette',
  }),
  defineCapability({
    name: 'i18n',
    kind: 'core',
    required: true,
    title: 'Internationalization',
    description: 'Locale resolution and translation support.',
    icon: '$mdiTranslate',
  }),
  defineCapability({
    name: 'http',
    kind: 'infrastructure',
    required: true,
    title: 'HTTP',
    description: 'Configured HTTP client services.',
    icon: '$mdiWeb',
  }),
  defineCapability({
    name: 'errors',
    kind: 'core',
    required: true,
    title: 'Error handling',
    description: 'Application error capture and reporting.',
    icon: '$mdiAlertCircle',
  }),
  defineCapability({
    name: 'auth',
    kind: 'feature',
    title: 'Authentication',
    description: 'Authentication and identity support.',
    icon: '$mdiShieldAccount',
    configKey: 'auth',
  }),
  defineCapability({
    name: 'audit',
    kind: 'feature',
    title: 'Audit',
    description: 'Audit event recording.',
    icon: '$mdiClipboardTextClock',
    configKey: 'audit',
  }),
  defineCapability({
    name: 'settings',
    kind: 'feature',
    title: 'Settings',
    description: 'Application settings management.',
    icon: '$mdiCog',
    configKey: 'settings',
  }),
  defineCapability({
    name: 'storage',
    kind: 'integration',
    title: 'Storage',
    description: 'External storage provider integration.',
    icon: '$mdiFolder',
    configKey: 'storage',
  }),
  defineCapability({
    name: 'ai',
    kind: 'integration',
    title: 'AI',
    description: 'AI provider integration.',
    icon: '$mdiCreation',
    configKey: 'ai',
  }),
  defineCapability({
    name: 'email',
    kind: 'integration',
    title: 'Email',
    description: 'Email provider integration.',
    icon: '$mdiEmail',
    configKey: 'email',
  }),
] as const
