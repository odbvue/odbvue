export type OdbVueModuleNavigationItem = {
  title: string
  to: string
  icon?: string
  order?: number
}

export type OdbVueModule = {
  name: string
  routePrefix?: string
  navigation?: OdbVueModuleNavigationItem[]
}

export function defineOdbVueModule<const Module extends OdbVueModule>(module: Module): Module {
  return module
}
