# Storage

Package for storing and processing large binary objects

::: details example
<<< ../../../../../db/tests/pck_api_storage.sql
:::

::: details specification
<<< ../../../../../db/src/database/odbvue/package_specs/pck_api_storage.sql
:::

::: details implementation
<<< ../../../../../db/src/database/odbvue/package_bodies/pck_api_storage.sql
:::

Dependencies:

| Referenced type | Referenced name |
| --------------- | --------------- |
|TABLE|APP_STORAGE|

## DELETE

Procedure deletes binary file

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_ID|IN|CHAR||File ID|

## DOWNLOAD

Procedure retrieves binary file

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_ID|IN|CHAR||File ID|
|R_FILE|OUT|BLOB||File content|
|R_FILE_NAME|OUT|VARCHAR2||File name|
|R_FILE_SIZE|OUT|NUMBER||File size|
|R_FILE_EXT|OUT|VARCHAR2||File ext|
|R_MIME_TYPE|OUT|VARCHAR2||Mime type|

## DOWNLOAD

Procedure retrieves binary file

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_ID|IN|CHAR||File ID|
|R_FILE|OUT|BLOB||File content|
|R_FILE_NAME|OUT|VARCHAR2||File name|

## S3

Procedure migrates file to S3 storage

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_OPERATION|IN|CHAR||Operation (U - upload from local to S3, D - download from S3 to local)|
|P_ID|IN|CHAR||File ID|
|P_CREATED_FROM|IN|TIMESTAMP|NULL|Created from|
|P_CREATED_TO|IN|TIMESTAMP|NULL|Created to|
|P_BATCH_SIZE|IN|NUMBER|100|Batch size|

## UPLOAD

Procedure stores binary file

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_FILE|IN|BLOB||File content|
|P_FILE_NAME|IN|VARCHAR2||File name|
|R_ID|OUT|CHAR||File ID|
|P_S3|IN|PL/SQL BOOLEAN|FALSE|Upload to S3 flag|

## UPLOAD

Procedure stores binary file

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_FILE|IN|BLOB||File content|
|P_FILE_NAME|IN|VARCHAR2||File name|
|P_S3|IN|PL/SQL BOOLEAN|FALSE|Upload to S3 flag|


