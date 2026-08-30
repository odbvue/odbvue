import type { App } from 'vue'
import type { OdbVueRuntime } from './types.js'

export interface OdbVueSetupContext extends OdbVueRuntime {
  app: App
}

export interface OdbVueCapability {
  name: string
  requires?: readonly string[]
  setup?(context: OdbVueSetupContext): void | Promise<void>
  start?(runtime: OdbVueRuntime): void | Promise<void>
  dispose?(runtime: OdbVueRuntime): void | Promise<void>
}

/** Defines a capability participating in the OdbVue runtime lifecycle. */
export function defineCapability<const Capability extends OdbVueCapability>(
  capability: Capability,
): Capability {
  return capability
}

/** Resolves a capability set into dependency order and rejects invalid graphs. */
export function resolveOdbVueCapabilities(
  capabilities: readonly OdbVueCapability[],
): OdbVueCapability[] {
  const byName = new Map(capabilities.map((capability) => [capability.name, capability]))
  const resolved: OdbVueCapability[] = []
  const visiting = new Set<string>()
  const visited = new Set<string>()

  function visit(name: string, chain: readonly string[] = []): void {
    if (visited.has(name)) return
    if (visiting.has(name))
      throw new Error(`Capability dependency cycle: ${[...chain, name].join(' -> ')}`)
    const capability = byName.get(name)
    if (!capability) throw new Error(`Capability "${chain.at(-1)}" requires capability "${name}".`)

    visiting.add(name)
    for (const requirement of capability.requires ?? []) visit(requirement, [...chain, name])
    visiting.delete(name)
    visited.add(name)
    resolved.push(capability)
  }

  for (const capability of capabilities) visit(capability.name)
  return resolved
}
