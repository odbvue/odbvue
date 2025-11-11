# Audit

Audit Package

::: details example
<<< ../../../../../db/tests/pck_api_audit.sql
:::

::: details specification
<<< ../../../../../db/src/database/odbvue/package_specs/pck_api_audit.sql
:::

::: details implementation
<<< ../../../../../db/src/database/odbvue/package_bodies/pck_api_audit.sql
:::

Dependencies:

| Referenced type | Referenced name |
| --------------- | --------------- |
|TABLE|APP_AUDIT|

## ARCHIVE

Archive Old Records

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_OLDER_THAN|IN|TIMESTAMP||Archive records older than this timestamp|

## ATTRIBUTES

Create JSON attributes

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|CLOB||JSON attributes|
|KEY1|IN|VARCHAR2||Key 1|
|VALUE1|IN|VARCHAR2||Value 1|
|KEY2|IN|VARCHAR2|NULL|Key 2|
|VALUE2|IN|VARCHAR2|NULL|Value 2|
|KEY3|IN|VARCHAR2|NULL|Key 3|
|VALUE3|IN|VARCHAR2|NULL|Value 3|
|KEY4|IN|VARCHAR2|NULL|Key 4|
|VALUE4|IN|VARCHAR2|NULL|Value 4|
|KEY5|IN|VARCHAR2|NULL|Key 5|
|VALUE5|IN|VARCHAR2|NULL|Value 5|
|KEY6|IN|VARCHAR2|NULL|Key 6|
|VALUE6|IN|VARCHAR2|NULL|Value 6|

## BULK

Bulk Log Messages

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_DATA|IN|CLOB||JSON Array of log entries [{severity, message, attributes, created}]|

## DEBUG

Log Debug Message

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_MESSAGE|IN|VARCHAR2||Message|
|P_ATTRIBUTES|IN|CLOB|NULL|Attributes|

## ERROR

Log Error Message

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_MESSAGE|IN|VARCHAR2||Message|
|P_ATTRIBUTES|IN|CLOB|NULL|Attributes|

## FATAL

Log Fatal Message

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_MESSAGE|IN|VARCHAR2||Message|
|P_ATTRIBUTES|IN|CLOB|NULL|Attributes|

## INFO

Log Info Message

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_MESSAGE|IN|VARCHAR2||Message|
|P_ATTRIBUTES|IN|CLOB|NULL|Attributes|

## WARN

Log Warn Message

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_MESSAGE|IN|VARCHAR2||Message|
|P_ATTRIBUTES|IN|CLOB|NULL|Attributes|


