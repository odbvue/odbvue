# Jobs

Package for managing jobs

::: details example
<<< ../../../../../db/tests/pck_api_jobs.sql
:::

::: details specification
<<< ../../../../../db/src/database/odbvue/package_specs/pck_api_jobs.sql
:::

::: details implementation
<<< ../../../../../db/src/database/odbvue/package_bodies/pck_api_jobs.sql
:::

## ADD

Add a new job

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_NAME|IN|VARCHAR2||Job name|
|P_PROGRAM|IN|VARCHAR2||Program name (PLSQL procedure)|
|P_ARGUMENTS|IN|CLOB||JSON array of arguments,  format [{type, name, value}]|
|P_SCHEDULE|IN|VARCHAR2||Schedule interval, https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_SCHEDULER.html#ARPLS-GUID-73622B78-EFF4-4D06-92F5-E358AB2D58F3|
|P_DESCRIPTION|IN|VARCHAR2||Job description|

## DISABLE

Disable a job

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_NAME|IN|VARCHAR2||Job name|

## ENABLE

Enable a job

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_NAME|IN|VARCHAR2||Job name|

## REMOVE

Remove a job

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_NAME|IN|VARCHAR2||Job name|

## RUN

Run a job

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_NAME|IN|VARCHAR2||Job name|


