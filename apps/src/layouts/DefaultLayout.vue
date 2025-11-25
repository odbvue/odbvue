<template>
  <v-app>
    <v-navigation-drawer v-model="drawer" app>
      <v-container>
        <v-row>
          <v-col cols="4">
            <a href="/" class="d-block">
              <v-img eager class="rounded-lg border-thin" :alt="app.title" src="./logo.svg">
              </v-img>
            </a>
          </v-col>
        </v-row>
      </v-container>
      <v-divider />
      <v-list>
        <v-list-item
          v-for="page in app.navigation.pages"
          :key="page.path"
          :prepend-icon="page.icon"
          :to="page.path"
          @click="drawer = false"
        >
          <v-list-item-title>{{ page.title }}</v-list-item-title>
        </v-list-item>
      </v-list>
      <v-divider v-if="app.auth.isAuthenticated" />
      <v-list v-if="app.auth.isAuthenticated">
        <v-list-item>
          <strong>{{ app.user?.fullname }}</strong>
        </v-list-item>
        <v-list-item
          link
          prepend-icon="$mdiLogout"
          @click="
            app.auth.logout()
            drawer = false
          "
        >
          <v-list-item-title>{{ t('logout') }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>
    <v-app-bar>
      <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
      <v-toolbar-title>{{ app.title }}</v-toolbar-title>
      <v-btn v-show="!app.auth.isAuthenticated" to="/login" class="mr-2">
        <v-icon icon="$mdiAccount"></v-icon>
        {{ t('login') }}
      </v-btn>
      <v-btn v-show="app.auth.isAuthenticated" @click="app.auth.logout()" class="mr-2">
        <v-icon icon="$mdiLogout"></v-icon>
        {{ t('logout') }}
      </v-btn>
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
                    v-for="item in app.settings.fontSizes"
                    :key="item"
                    :value="item"
                    @click="app.settings.setFontSize(item)"
                  >
                    <v-list-item-title> {{ item }}% </v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </v-list-item>
            <v-list-item link prepend-icon="$mdiMenuLeft">
              <v-list-item-title>
                {{ app.settings.locale }}
              </v-list-item-title>
              <v-menu submenu activator="parent">
                <v-list>
                  <v-list-item
                    link
                    v-for="item in app.settings.locales"
                    :key="item"
                    :value="item"
                    @click="app.settings.setLocale(item)"
                  >
                    <v-list-item-title>
                      {{ item }}
                    </v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </v-list-item>
            <v-list-item
              link
              :prepend-icon="app.settings.themeIcon"
              @click="app.settings.toggleTheme()"
            >
              <v-list-item-title>
                <v-icon :icon="app.settings.themeIcon"></v-icon>
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
          <v-list-item v-for="(item, i) in app.settings.fontSizes" :key="i" :value="i">
            <v-list-item-title @click="app.settings.setFontSize(item)"
              >{{ item }}%</v-list-item-title
            >
          </v-list-item>
        </v-list>
      </v-menu>
      <v-menu v-if="!mobile">
        <template #activator="{ props }">
          <v-btn variant="text" v-bind="props">{{ app.settings.locale }}</v-btn>
        </template>
        <v-list>
          <v-list-item v-for="(item, i) in app.settings.locales" :key="i" :value="i">
            <v-list-item-title @click="app.settings.setLocale(item)">{{ item }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
      <v-btn
        v-if="!mobile"
        variant="text"
        :prepend-icon="app.settings.themeIcon"
        @click="app.settings.toggleTheme()"
        data-cy="theme-toggle"
      ></v-btn>
      <v-progress-linear
        :active="app.ui.loading"
        indeterminate
        absolute
        location="bottom"
        height="6"
      ></v-progress-linear>
    </v-app-bar>
    <v-main class="ma-4" id="main" tabindex="-1">
      <v-breadcrumbs :items="app.navigation.breadcrumbs">
        <template v-slot:title="{ item, index }">
          <v-breadcrumbs-item
            v-if="index !== app.navigation.breadcrumbs.length - 1"
            :to="item.href"
          >
            {{ item.title }}
          </v-breadcrumbs-item>
          <v-breadcrumbs-item v-else>{{ item.title }}</v-breadcrumbs-item>
        </template>
      </v-breadcrumbs>
      <v-alert
        type="info"
        :text="app.ui.info ? t(app.ui.info) : ''"
        v-show="app.ui.info.length > 0"
        class="mb-2"
      ></v-alert>
      <v-alert
        type="success"
        :text="app.ui.success ? t(app.ui.success) : ''"
        v-show="app.ui.success.length > 0"
        class="mb-2"
      ></v-alert>
      <v-alert
        type="warning"
        :text="app.ui.warning ? t(app.ui.warning) : ''"
        v-show="app.ui.warning.length > 0"
        class="mb-2"
      ></v-alert>
      <v-alert
        type="error"
        :text="app.ui.error ? t(app.ui.error) : ''"
        v-show="app.ui.error.length > 0"
        class="mb-2"
      ></v-alert>
      <div id="route-announcer" aria-live="polite" class="sr-only"></div>
      <a class="skip-link" href="#main" @click.prevent="focusMain">Skip to content</a>
      <slot />
      <v-snackbar v-model="app.ui.snackbar">
        {{ app.ui.snack }}
        <template v-slot:actions>
          <v-btn color="pink" variant="text" @click="app.ui.snack = ''">
            {{ t('close') }}
          </v-btn>
        </template>
      </v-snackbar>
      <v-overlay v-model="app.ui.loading" contained></v-overlay>
    </v-main>
    <v-footer app>
      <v-row>
        <v-col>
          {{ app.version }}
          <v-btn
            v-if="needRefresh"
            variant="outlined"
            density="compact"
            class="ml-2"
            @click="refresh = true"
          >
            Upgrade
          </v-btn>
          <v-snackbar v-model="refresh" multi-line vertical>
            New version is available, click OK to upgrade now.
            <template v-slot:actions>
              <v-btn color="primary" variant="text" @click="updateServiceWorker()"> Ok </v-btn>
              <v-btn color="secondary" variant="text" @click="refresh = false"> Cancel </v-btn>
            </template>
          </v-snackbar>
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
import { useRegisterSW } from 'virtual:pwa-register/vue'
const { needRefresh, updateServiceWorker } = useRegisterSW()
const refresh = ref(false)

const { mobile } = useDisplay()
const { t } = useI18n()

const app = useAppStore()
const drawer = ref(false)

function focusMain() {
  const el = document.getElementById('main')
  if (el) {
    el.focus({ preventScroll: true })
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}
</script>

<style scoped>
.skip-link {
  position: absolute;
  left: 0.5rem;
  top: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: white;
  border-radius: 0.375rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transform: translateY(-150%);
  transition: transform 0.15s ease;
  z-index: 1000;
}
.skip-link:focus {
  transform: translateY(0);
}
.sr-only {
  position: absolute !important;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
</style>
