# Consents

Package for managing user consents

::: details example
<<< ../../../../../db/tests/pck_api_consents.sql
:::

::: details specification
<<< ../../../../../db/src/database/odbvue/package_specs/pck_api_consents.sql
:::

::: details implementation
<<< ../../../../../db/src/database/odbvue/package_bodies/pck_api_consents.sql
:::

Dependencies:

| Referenced type | Referenced name |
| --------------- | --------------- |
|TABLE|APP_CONSENTS|
|TABLE|APP_USER_CONSENTS|

## DOWNLOAD

Function to download consent content

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|CLOB||Returns consent content as CLOB|
|P_CONSENT_ID|IN|CHAR||Consent identifier|

## GIVE

Procedure to record user consent

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_USER_ID|IN|CHAR||User identifier|
|P_CONSENT_ID|IN|CHAR||Consent identifier|

## LOOKUP

Function to retrieve consent list

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|CLOB||Returns consent list as CLOB|
|P_LANGUAGE|IN|CHAR|NULL|Language filter for consents|
|P_ACTIVE|IN|CHAR|'Y'|Active status filter|

## VERIFY

Function to check if user has given consent

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|CHAR||Returns 'Y' if consent given, 'N' otherwise|
|P_USER_ID|IN|CHAR||User identifier|
|P_CONSENT_ID|IN|CHAR||Consent identifier|

## WITHDRAW

Procedure to revoke user consent

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_USER_ID|IN|CHAR||User identifier|
|P_CONSENT_ID|IN|CHAR||Consent identifier|


