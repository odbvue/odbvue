<template>
  <v-app>
    <v-navigation-drawer v-model="drawer" app>
      <v-list>
        <v-list-item
          v-for="page in navigationPages"
          :key="page.path"
          :prepend-icon="page.meta.icon || '$mdiMinus'"
          :to="page.path"
        >
          <v-list-item-title>{{ page.title }}</v-list-item-title>
        </v-list-item>
      </v-list>
      <v-divider />
      <v-list v-if="auth.ready.value">
        <template v-if="auth.authenticated.value">
          <v-list-item
            prepend-icon="$mdiAccount"
            :title="displayName"
            :subtitle="auth.user.value?.username"
          />
          <v-list-item
            prepend-icon="$mdiLogout"
            :title="t('auth.logout')"
            :disabled="auth.loading.value"
            @click="logout"
          />
        </template>
        <v-list-item v-else to="/login" prepend-icon="$mdiAccount" :title="t('auth.login')" />
      </v-list>
    </v-navigation-drawer>
    <v-app-bar>
      <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
      <v-toolbar-title>{{ app.title }}</v-toolbar-title>
      <template v-if="auth.ready.value">
        <v-btn v-if="!auth.authenticated.value" to="/login" prepend-icon="$mdiAccount" class="mr-2">
          {{ t('auth.login') }}
        </v-btn>
        <v-btn
          v-else
          prepend-icon="$mdiLogout"
          :loading="auth.loading.value"
          class="mr-2"
          @click="logout"
        >
          {{ t('auth.logout') }}
        </v-btn>
      </template>
      <v-btn v-if="mobile">
        <v-icon :icon="'$mdiDotsVertical'"></v-icon>
        <v-menu activator="parent">
          <v-list>
            <v-list-item link prepend-icon="$mdiMenuLeft">
              <v-list-item-title>
                <v-icon icon="$mdiEyePlusOutline"></v-icon>
              </v-list-item-title>
              <v-menu submenu activator="parent">
                <v-list>
                  <v-list-item
                    link
                    v-for="item in app.preferences.fontSizes"
                    :key="item"
                    :value="item"
                    @click="app.preferences.setFontSize(item)"
                  >
                    <v-list-item-title> {{ item }}% </v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </v-list-item>
            <v-list-item link prepend-icon="$mdiMenuLeft">
              <v-list-item-title>
                {{ app.preferences.locale }}
              </v-list-item-title>
              <v-menu submenu activator="parent">
                <v-list>
                  <v-list-item
                    link
                    v-for="item in app.preferences.locales"
                    :key="item"
                    :value="item"
                    @click="app.preferences.setLocale(item)"
                  >
                    <v-list-item-title>
                      {{ item }}
                    </v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </v-list-item>
            <v-list-item @click="app.preferences.toggleTheme()">
              <v-list-item-title>
                <v-icon class="ml-10" :icon="app.preferences.themeIcon"></v-icon>
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </v-btn>
      <v-menu v-if="!mobile">
        <template #activator="{ props }">
          <v-btn variant="text" v-bind="props" prepend-icon="$mdiEyePlusOutline"></v-btn>
        </template>
        <v-list>
          <v-list-item v-for="(item, i) in app.preferences.fontSizes" :key="i" :value="i">
            <v-list-item-title @click="app.preferences.setFontSize(item)"
              >{{ item }}%</v-list-item-title
            >
          </v-list-item>
        </v-list>
      </v-menu>
      <v-menu v-if="!mobile">
        <template #activator="{ props }">
          <v-btn variant="text" v-bind="props">{{ app.preferences.locale }}</v-btn>
        </template>
        <v-list>
          <v-list-item v-for="(item, i) in app.preferences.locales" :key="i" :value="i">
            <v-list-item-title @click="app.preferences.setLocale(item)">{{
              item
            }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
      <v-btn
        v-if="!mobile"
        variant="text"
        :prepend-icon="app.preferences.themeIcon"
        @click="app.preferences.toggleTheme()"
        data-cy="theme-toggle"
      ></v-btn>
      <v-progress-linear
        :active="app.ui.loading || auth.loading.value"
        indeterminate
        absolute
        location="bottom"
        height="4"
      ></v-progress-linear>
    </v-app-bar>
    <v-app-bar>
      <v-breadcrumbs :items="routing.breadcrumbs.value">
        <template v-slot:divider>
          <v-icon icon="$mdiChevronRight"></v-icon>
        </template>
      </v-breadcrumbs>
    </v-app-bar>

    <v-app-bar class="pa-2" v-if="app.ui.notification && !app.ui.snackbar">
      <v-alert :type="app.ui.notification.type" :text="notificationMessage"></v-alert>
    </v-app-bar>

    <v-main class="ma-4">
      <slot />

      <v-snackbar :model-value="app.ui.snackbar" @update:model-value="!$event && app.ui.clear()">
        {{ notificationMessage }}
        <template v-slot:actions>
          <v-btn color="pink" variant="text" @click="app.ui.clear()">
            {{ t('close') }}
          </v-btn>
        </template>
      </v-snackbar>
      <v-overlay :model-value="app.ui.loading" contained></v-overlay>
    </v-main>
    <v-footer app>
      <v-row>
        <v-col>
          <span class="text-caption">v{{ app.version }}</span>
        </v-col>
        <v-col class="text-right">
          <v-btn
            icon
            href="https://github.com/odbvue/odbvue"
            target="_blank"
            rel="noopener"
            title="GitHub"
            size="xx-small"
            color="secondary"
            variant="flat"
          >
            <v-icon icon="$mdiGithub"></v-icon>
          </v-btn>
        </v-col>
      </v-row>
    </v-footer>
  </v-app>
</template>

<script setup lang="ts">
import { useAppStore, useAuth } from '@odbvue/web'
import { useNotificationMessage } from '@/composables/ui'

const drawer = ref(false)
const app = useAppStore()
const auth = useAuth()
const notificationMessage = useNotificationMessage(() => app.ui.notification?.message)
const routing = useRouting()
const navigationPages = computed(() =>
  routing.pages.value.filter((page) => page.module === undefined),
)
const displayName = computed(() =>
  typeof auth.user.value?.displayName === 'string'
    ? auth.user.value.displayName
    : auth.user.value?.username,
)
const router = useRouter()
async function logout() {
  drawer.value = false
  app.ui.clear()
  try {
    await auth.logout()
  } catch (error) {
    app.ui.error(error)
  }
  await router.replace('/')
}
const { mobile } = useDisplay()
const { t } = useI18n()
</script>
