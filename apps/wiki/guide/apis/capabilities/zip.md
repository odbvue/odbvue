# PCK_API_ZIP

Package for handling zip files, Credit: https://github.com/antonscheffer/as_zip 

## ADD

Add a file to a zip archive

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_ZIP|IN/OUT|BLOB||The zip archive|
|P_NAME|IN|VARCHAR2||The name of the file|
|P_CONTENT|IN|BLOB||The content of the file, if content will be NULL, a directory will be created|
|P_PASSWORD|IN|VARCHAR2|NULL|The password for the file|
|P_COMMENT|IN|VARCHAR2|NULL|The comment for the file|

## DETAILS

Get the details of a file in a zip archive

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_ZIP|IN|BLOB||The zip archive|
|P_NAME|IN|VARCHAR2||The name of the file|
|R_SIZE|OUT|BINARY_INTEGER||The size of the file|
|R_COMPRESSED_SIZE|OUT|BINARY_INTEGER||The compressed size of the file|
|R_IS_DIRECTORY|OUT|PL/SQL BOOLEAN||The file is a directory|
|R_HAS_PASSWORD|OUT|PL/SQL BOOLEAN||The file has a password|
|R_COMMENT|OUT|VARCHAR2||The comment of the file|

## EXTRACT

Extract a file from a zip archive

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_ZIP|IN/OUT|BLOB||The zip archive|
|P_NAME|IN|VARCHAR2||The name of the file|
|R_CONTENT|OUT|BLOB||The content of the file|
|P_PASSWORD|IN|VARCHAR2|NULL|The password for the file|

## LIST

List the files in a zip archive

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|TABLE||The list of files|
|P_ZIP|IN|BLOB||The zip archive|
|P_SEARCH|IN|VARCHAR2|NULL|The search string|
|P_LIMIT|IN|BINARY_INTEGER|100|The maximum number of files to return|
|P_OFFSET|IN|BINARY_INTEGER|0|The number of files to skip|

## REMOVE

Remove a file from a zip archive

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_ZIP|IN/OUT|BLOB||The zip archive|
|P_NAME|IN|VARCHAR2||The name of the file|


