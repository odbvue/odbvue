export type CapabilityKind = 'core' | 'ui' | 'feature' | 'integration' | 'infrastructure'

export interface CapabilityDefinition {
  name: string
  kind: CapabilityKind
  required?: boolean
  requires?: string[]
  provides?: string[]
}

export function defineCapability<const Definition extends CapabilityDefinition>(
  definition: Definition,
): Definition {
  return definition
}

export const odbVueCapabilities = [
  defineCapability({ name: 'state', kind: 'core', required: true }),
  defineCapability({ name: 'ui', kind: 'ui', required: true }),
  defineCapability({ name: 'i18n', kind: 'core', required: true }),
  defineCapability({ name: 'http', kind: 'infrastructure', required: true }),
  defineCapability({ name: 'vite', kind: 'infrastructure', required: false }),
] as const
