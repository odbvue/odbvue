import { useHead } from '@unhead/vue'

export function createPageTitleUpdater() {
  const entry = useHead({})
  return (appTitle: string, pageTitle?: string) => {
    const title = appTitle || 'OdbVue'
    entry.patch({ title: pageTitle ? `${title} - ${pageTitle}` : title })
  }
}
