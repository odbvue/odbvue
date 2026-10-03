import { defineOdbVueModule } from '@odbvue/web'

export default defineOdbVueModule({
  name: 'sandbox',
  routePrefix: '/sandbox',
  navigation: [
    {
      title: 'Sandbox',
      to: '/sandbox',
      icon: '$mdiFlask',
      order: 90,
    },
  ],
})
