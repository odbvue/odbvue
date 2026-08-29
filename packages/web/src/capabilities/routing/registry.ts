import { shallowRef, type ShallowRef } from 'vue'
import type { Router } from 'vue-router'
import type { OdbVuePageManifest } from './manifest.js'
import type { OdbVueBreadcrumb } from './types.js'

const manifests = new WeakMap<Router, OdbVuePageManifest>()
const breadcrumbOverrides = new WeakMap<Router, ShallowRef<OdbVueBreadcrumb | undefined>>()

export function registerOdbVuePageManifest(router: Router, manifest: OdbVuePageManifest): void {
  manifests.set(router, manifest)
}

export function getOdbVuePageManifest(router: Router): OdbVuePageManifest {
  return manifests.get(router) ?? { routes: [], pages: [] }
}

export function getOdbVueBreadcrumbOverride(
  router: Router,
): ShallowRef<OdbVueBreadcrumb | undefined> {
  let breadcrumbOverride = breadcrumbOverrides.get(router)
  if (!breadcrumbOverride) {
    breadcrumbOverride = shallowRef()
    breadcrumbOverrides.set(router, breadcrumbOverride)
  }
  return breadcrumbOverride
}
