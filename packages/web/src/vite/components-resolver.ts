const componentNames = new Set([
  'VOvChart',
  'VOvDialog',
  'VOvEditor',
  'VOvForm',
  'VOvMap',
  'VOvMedia',
  'VOvPad',
  'VOvShare',
  'VOvTable',
  'VOvView',
])

/** Resolves OdbVue's packaged Vue components for unplugin-vue-components. */
export function odbVueComponentsResolver(name: string) {
  if (!componentNames.has(name)) return

  return {
    name,
    from: '@odbvue/web/components',
  }
}
