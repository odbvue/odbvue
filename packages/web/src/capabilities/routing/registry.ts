import type { Router } from 'vue-router'
import type { OdbVuePageManifest } from './manifest.js'

const manifests = new WeakMap<Router, OdbVuePageManifest>()

export function registerOdbVuePageManifest(router: Router, manifest: OdbVuePageManifest): void {
  manifests.set(router, manifest)
}

export function getOdbVuePageManifest(router: Router): OdbVuePageManifest {
  return manifests.get(router) ?? { routes: [], pages: [] }
}
