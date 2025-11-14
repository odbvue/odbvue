# Authentication

Package provides methods for issuing and validating tokens 

::: details example
<<< ../../../../../db/tests/pck_api_auth.sql
:::

::: details specification
<<< ../../../../../db/src/database/odbvue/package_specs/pck_api_auth.sql
:::

::: details implementation
<<< ../../../../../db/src/database/odbvue/package_bodies/pck_api_auth.sql
:::

Dependencies:

| Referenced type | Referenced name |
| --------------- | --------------- |
|TABLE|APP_USERS|
|TABLE|APP_ROLES|
|TABLE|APP_PERMISSIONS|
|TABLE|APP_TOKENS|

## AUTH

Function authenticates user

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|CHAR||User unique ID|
|P_USERNAME|IN|VARCHAR2||Username|
|P_PASSWORD|IN|VARCHAR2||Password|

## AUTH

Function authenticates user

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_USERNAME|IN|VARCHAR2||Username|
|P_PASSWORD|IN|VARCHAR2||Password|
|R_UUID|OUT|CHAR||User unique ID|

## CLEANUP

Procedure removes expired tokens

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_BATCH_SIZE|IN|BINARY_INTEGER|10000|Batch size|

## HTTP_401

Procedure sends HTTP 401 Unauthorized status

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_ERROR|IN|VARCHAR2|NULL|Error message|

## HTTP_403

Procedure sends HTTP 403 Forbidden status

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_ERROR|IN|VARCHAR2|NULL|Error message|

## ISSUE_TOKEN

Procedure issues a JWT token

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_UUID|IN|CHAR||User unique ID|
|P_TYPE|IN|VARCHAR2||Token type|
|R_TOKEN|OUT|VARCHAR2||Token|

## ISSUE_TOKEN

Procedure issues a JWT token

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|VARCHAR2||Token|
|P_UUID|IN|CHAR||User unique ID|
|P_TYPE|IN|VARCHAR2||Token type|

## PERM

Function checks user permission

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|BINARY_INTEGER||Permission (0 - no permission, 1 - has permission)|
|P_UUID|IN|CHAR|NULL|User unique ID (NULL - current user from bearer token)|
|P_ROLE|IN|VARCHAR2||Role|
|P_PERMISSION|IN|VARCHAR2||Permission|

## PWD

Function returns hashed password

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|VARCHAR2||Hashed password|
|P_PASSWORD|IN|VARCHAR2||Password|

## REFRESH

Function returns user unique ID from cookie passed in the request

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|CHAR||Permission count for the role (0 - no role)|
|P_COOKIE_NAME|IN|VARCHAR2|'refresh_token'|Cookie name|
|P_CHECK_EXPIRATION|IN|CHAR|'Y'|Check token expiration (Y/N)|

## RELOAD_SETTINGS

Procedure reloads token settings from the database

## REVOKE_TOKEN

Procedure revokes a JWT token

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_TOKEN|IN|VARCHAR2||Token|

## REVOKE_TOKEN

Procedure revokes a JWT token

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_UUID|IN|CHAR||User unique ID|
|P_TYPE|IN|VARCHAR2|NULL|Token type|

## ROLE

Function checks if user has role

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|BINARY_INTEGER||Permission count for the role (0 - no role)|
|P_UUID|IN|CHAR|NULL|User unique ID (NULL - current user from bearer token)|
|P_ROLE|IN|VARCHAR2||Role|

## UUID

Function returns user unique ID from JWT token passed in the Authorization header as a Bearer token

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|CHAR||Permission count for the role (0 - no role)|
|P_CHECK_EXPIRATION|IN|CHAR|'Y'|Check token expiration (Y/N)|

## UUID_FROM_TOKEN

Function returns user unique ID from JWT token passed

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|CHAR||Permission count for the role (0 - no role)|
|P_TOKEN|IN|VARCHAR2||JWT token|
|P_CHECK_EXPIRATION|IN|CHAR|'Y'|Check token expiration (Y/N)|


