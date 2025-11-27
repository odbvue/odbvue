# Validation

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

## RULE

Function to create a validation rule in JSON format

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|CLOB||Returns rule in JSON format|
|P_TYPE|IN|VARCHAR2||Type of validation (e.g., 'email', 'required', 'password')|
|P_PARAMS|IN|VARCHAR2|NULL|Additional parameters for the rule in JSON format|
|P_MESSAGE|IN|VARCHAR2||Error message if validation fails|

## VALIDATE

Function validates the provided value against the specified rules in JSON format

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|VARCHAR2||Returns NULL if valid; otherwise error message if invalid|
|P_VALUE|IN|VARCHAR2||Value to validate|
|P_RULES|IN|CLOB||Validation rules in JSON format [{type, params, message}]|

## VALIDATE

Function validates the provided value against the specified rules in JSON format

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_FIELD|IN|VARCHAR2||Name of the field being validated|
|P_VALUE|IN|VARCHAR2||Value to validate|
|P_RULES|IN|CLOB||Validation rules in JSON format [{type, params, message}]|
|R_ERROR|OUT|VARCHAR2||Output parameter for error message if invalid|
|R_ERRORS|OUT|REF CURSOR||Output parameter for error messages [{name, message}]|


