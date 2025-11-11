# Validate

Package provides methods for validating values against rules

::: details example
<<< ../../../../../db/tests/pck_api_validate.sql
:::

::: details specification
<<< ../../../../../db/src/database/odbvue/package_specs/pck_api_validate.sql
:::

::: details implementation
<<< ../../../../../db/src/database/odbvue/package_bodies/pck_api_validate.sql
:::

## VALIDATE

Function validates the provided value against the specified rules in JSON format

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|VARCHAR2||Returns NULL if valid; otherwise error message|
|P_VALUE|IN|VARCHAR2||Value to validate|
|P_RULES|IN|CLOB||Validation rules in JSON format|


