/// <reference types="vite/client" />

declare module 'virtual:odbvue-i18n-inventory' {
  const inventory: {
    app: Record<string, number>
    modules: Record<string, Record<string, number>>
  }
  export default inventory
}
