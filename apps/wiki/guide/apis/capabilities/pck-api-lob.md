# Large Object Binaries

Package for LOB processing. Credit: https://github.com/paulzip-dev/Base64

::: details example
<<< ../../../../../db/src/database/odbvue/tests/pck_api_lob.sql
:::

::: details specification
<<< ../../../../../db/src/database/odbvue/package_specs/pck_api_lob.sql
:::

::: details implementation
<<< ../../../../../db/src/database/odbvue/package_bodies/pck_api_lob.sql
:::

## BASE64_TO_BLOB

Function decodes BASE64 to BLOB

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|BLOB||BLOB|
|P_BASE64|IN|CLOB||BASE64|

## BASE64_TO_CLOB

Function decodes BASE64 to CLOB

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|CLOB||CLOB|
|P_BASE64|IN|CLOB||BASE64|

## BASE64_TO_VARCHAR2

Function decodes BASE64 to VARCHAR2

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|VARCHAR2||VARCHAR2|
|P_BASE64|IN|CLOB||BASE64|

## BLOB_TO_BASE64

Function encodes BLOB to BASE64

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|CLOB||CLOB|
|P_BLOB|IN|BLOB||BLOB|
|P_NEWLINE|IN|BINARY_INTEGER|1|Split in chunks (0 - No, 1 - Yes) |

## BLOB_TO_CLOB

Function converts BLOB to CLOB

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|CLOB||CLOB|
|P_BLOB|IN|BLOB||BLOB|
|P_CHARSET_ID|IN|NUMBER|dbms_lob.default_csid|Character set ID |
|P_ERROR_ON_WARNING|IN|BINARY_INTEGER|0|Raise exception on warning (0 - No, 1 - Yes)|

## CLOB_TO_BASE64

Function encodes CLOB to BASE64

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|CLOB||CLOB|
|P_CLOB|IN|CLOB||CLOB|
|P_NEWLINE|IN|BINARY_INTEGER|1|Split in chunks (0 - No, 1 - Yes) |

## CLOB_TO_BLOB

Function converts CLOB to BLOB

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|BLOB||BLOB|
|P_CLOB|IN|CLOB||CLOB|
|P_CHARSET_ID|IN|NUMBER|dbms_lob.default_csid|Character set ID |
|P_ERROR_ON_WARNING|IN|BINARY_INTEGER|0|Raise exception on warning (0 - No, 1 - Yes)|

## VARCHAR2_TO_BASE64

Function encodes VARCHAR2 to BASE64

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|CLOB||CLOB|
|P_VARCHAR2|IN|VARCHAR2||VARCHAR2|
|P_NEWLINE|IN|BINARY_INTEGER|1|Split in chunks (0 - No, 1 - Yes) |


