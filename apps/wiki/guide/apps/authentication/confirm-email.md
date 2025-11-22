# Confirm emails

## Overview

When user is singned up, it has status `N` and confirmation e-mail is sent out. When user opens link from the e-mail, it gets confirmed and status updated to `A`.

## Api

1. Procedure `post_confirm_email`

#### `./db/src/database/odbvue/package_specs/pck_app.sql`

::: details specification
```plsql
    PROCEDURE post_confirm_email( -- Procedure confirms email address
        p_token APP_TOKENS.TOKEN%TYPE, --  Email confirmation token (sent by e-mail)
        r_error OUT VARCHAR2 -- Error (NULL if success)
    );
```
:::

#### `./db/src/database/odbvue/package_bodies/pck_app.sql`

::: details implementation
```plsql
    PROCEDURE post_confirm_email (
        p_token app_tokens.token%TYPE,
        r_error OUT VARCHAR2
    ) AS
        v_uuid app_users.uuid%TYPE;
    BEGIN
        BEGIN
            SELECT
                uuid
            INTO v_uuid
            FROM
                app_tokens
            WHERE
                    token = p_token
                AND type_id = 'VERIFY'
                AND expiration > systimestamp;

        EXCEPTION
            WHEN no_data_found THEN
                r_error := 'Invalid token';
                pck_api_auth.revoke_token(p_token => p_token);
                pck_api_audit.warn('Confirm email',
                                   pck_api_audit.attributes('uuid', v_uuid));
                RETURN;
        END;

        UPDATE app_users
        SET
            status = 'A'
        WHERE
            uuid = v_uuid;

        COMMIT;
        pck_api_auth.revoke_token(p_token => p_token);
        pck_api_audit.info('Confirm email',
                           pck_api_audit.attributes('uuid', v_uuid));
    EXCEPTION
        WHEN OTHERS THEN
            r_error := 'something.went.wrong';
            pck_api_auth.revoke_token(p_token => p_token);
            pck_api_audit.error('Confirm email',
                                pck_api_audit.attributes('uuid', v_uuid));
    END;
```
:::

## Store

Method in Auth Store to confirm e-mail address

#### `@/store/app/auth.ts`

```ts
    type ConfirmEmailResponse = {
      error?: string
    }

    const confirmEmail = async (confirmToken: string): Promise<boolean> => {
      startLoading()
      const { data, error } = await api.post<ConfirmEmailResponse>('app/confirm-email/', {
        token: confirmToken,
      })
      if (data?.error || error) {
        setError(data?.error || 'something.went.wrong')
      } else {
        setInfo('email.confirmation.success')
      }
      stopLoading()
      return !data?.error
    }
    // ...
    return {
      // ..
      confirmEmail,
    }
```

## View

View for confirming emails 

#### `@/pages/confirm-email/[id].vue`

```vue
<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" :md="4">
        <h1 class="mb-4">{{ t('email.confirmation') }}</h1>
        <v-btn @click="router.push('/')">{{ t('ok') }}</v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
definePage({ meta: { role: 'restricted' } })
const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()
const { t } = useI18n()

onMounted(async () => {
  const token = (route.params as { id: string }).id
  await authStore.confirmEmail(token)
})
</script>

```
