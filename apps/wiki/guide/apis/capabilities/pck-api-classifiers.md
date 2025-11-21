# Classifiers

Package provides classifier lookup

::: details example
<<< ../../../../../db/tests/pck_api_classifiers.sql
:::

::: details specification
<<< ../../../../../db/src/database/odbvue/package_specs/pck_api_classifiers.sql
:::

::: details implementation
<<< ../../../../../db/src/database/odbvue/package_bodies/pck_api_classifiers.sql
:::

## LOOKUP

Returns a ref cursor with the results

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_CLASSIFIER|IN|VARCHAR2||Classifier type: 'languages', 'countries', 'currencies' |
|P_SEARCH|IN|VARCHAR2||Search term to filter results|
|P_ACTIVE|IN|CHAR|'Y'|Filter by active status ('Y' or 'N')|
|P_LIMIT|IN|BINARY_INTEGER|10|Maximum number of results to return|
|P_OFFSET|IN|BINARY_INTEGER|0|Number of results to skip|
|R_RESULT|OUT|REF CURSOR||Output ref cursor with the results|

## LOOKUP

Returns a ref cursor with the results

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|CLOB||JSON CLOB with the results|
|P_CLASSIFIER|IN|VARCHAR2||Classifier type: 'languages', 'countries', 'currencies' |
|P_SEARCH|IN|VARCHAR2||Search term to filter results|
|P_ACTIVE|IN|CHAR|'Y'|Filter by active status ('Y' or 'N')|
|P_LIMIT|IN|BINARY_INTEGER|10|Maximum number of results to return|
|P_OFFSET|IN|BINARY_INTEGER|0|Number of results to skip|


