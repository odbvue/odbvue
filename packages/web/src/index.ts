export { defineOdbVueApp } from './runtime/config.js'
export type {
  OdbVueAppConfig,
  OdbVueAuthConfig,
  OdbVueCapabilityName,
  OdbVueErrorsConfig,
  OdbVueHook,
  OdbVueI18nConfig,
  OdbVueProviderConfig,
  OdbVueUiConfig,
} from './runtime/config.js'
export {
  createConsoleErrorReporter,
  createLocalStorageErrorReporter,
  createOdbVueErrors,
} from './capabilities/errors/index.js'
export type {
  CaptureErrorOptions,
  ErrorReporter,
  ErrorSeverity,
  LocalStorageErrorReporterOptions,
  OdbVueErrorEvent,
  OdbVueErrors,
} from './capabilities/errors/index.js'
export * from './capabilities/http/index.js'
export { createOdbVueI18n, resolveOdbVueLocale } from './capabilities/i18n/index.js'
export { odbVueRuntimeKey, useOdbVue } from './runtime/context.js'
export { useCapability, useOdbVueConfig } from './runtime/config.js'
export { installOdbVue } from './runtime/install.js'
export { defineOdbVueModule } from './runtime/module.js'
export type { OdbVueRuntime } from './runtime/types.js'
export type { OdbVueModule, OdbVueModuleNavigationItem } from './runtime/module.js'
export {
  createOdbVuePinia,
  getOdbVueStores,
  getPersistOptions,
} from './capabilities/state/index.js'
export type {
  PersistCookieOptions,
  PersistOptions,
  PersistStorage,
} from './capabilities/state/index.js'
export { useAppStore } from './runtime/app.js'
export { createOdbVueVuetify } from './capabilities/ui/index.js'
export { usePreferencesStore, useUi } from './capabilities/ui/index.js'
export type { AlertOptions, UiNotification, UiNotificationType } from './capabilities/ui/index.js'
export * from './capabilities/routing/index.js'
export { defineCapability, odbVueCapabilities } from './capabilities/index.js'
export type { CapabilityDefinition, CapabilityKind } from './capabilities/index.js'
