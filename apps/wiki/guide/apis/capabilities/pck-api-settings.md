# Settings

Package provides methods for managing application settings 

::: details example
<<< ../../../../../db/tests/pck_api_settings.sql
:::

::: details specification
<<< ../../../../../db/src/database/odbvue/package_specs/pck_api_settings.sql
:::

::: details implementation
<<< ../../../../../db/src/database/odbvue/package_bodies/pck_api_settings.sql
:::

Dependencies:

| Referenced type | Referenced name |
| --------------- | --------------- |
|TABLE|APP_SETTINGS|

## DEC

Function decrypts the provided value

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|VARCHAR2||Value of the setting (variable character)|
|P_VALUE|IN|VARCHAR2||Value to be encrypted|

## ENC

Function encrypts the provided value

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|VARCHAR2||Value of the setting (variable character)|
|P_VALUE|IN|VARCHAR2||Value to be encrypted|

## READ

Procedure returns value of the setting with the specified id

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_ID|IN|VARCHAR2||Id of the setting|
|R_VALUE|OUT|VARCHAR2||Value of the setting (variable character)|

## READ

Procedure returns value of the setting with the specified id

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|VARCHAR2||Value of the setting (variable character)|
|P_ID|IN|VARCHAR2||Id of the setting|

## REMOVE

Procedure deletes setting with the specified id

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_ID|IN|VARCHAR2||Id of the setting|

## WRITE

Procedure sets value of the setting with the specified id

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_ID|IN|VARCHAR2||Id of the setting|
|P_NAME|IN|VARCHAR2||Name of the setting|
|P_VALUE|IN|VARCHAR2||Value of the setting (variable character)|
|P_OPTIONS|IN|CLOB|NULL|Additional options in JSON format|


