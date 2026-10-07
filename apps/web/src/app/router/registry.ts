import { shallowRef, type ShallowRef } from 'vue'
import type { Router } from 'vue-router'
import type { PageManifest } from './manifest.js'
import type { Breadcrumb } from './types.js'

const manifests = new WeakMap<Router, PageManifest>()
const breadcrumbOverrides = new WeakMap<Router, ShallowRef<Breadcrumb | undefined>>()

export function registerPageManifest(router: Router, manifest: PageManifest): void {
  manifests.set(router, manifest)
}

export function getPageManifest(router: Router): PageManifest {
  return manifests.get(router) ?? { routes: [], pages: [] }
}

export function getBreadcrumbOverride(router: Router): ShallowRef<Breadcrumb | undefined> {
  let breadcrumbOverride = breadcrumbOverrides.get(router)
  if (!breadcrumbOverride) {
    breadcrumbOverride = shallowRef()
    breadcrumbOverrides.set(router, breadcrumbOverride)
  }
  return breadcrumbOverride
}
