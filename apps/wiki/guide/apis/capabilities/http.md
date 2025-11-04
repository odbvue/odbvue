# PCK_API_HTTP

Package for HTTP call processing

## MIME_TYPE

Function returns mime type from file extention, e.g. mp3->audio/mpeg

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|VARCHAR2||Mime type|
|P_EXT|IN|VARCHAR2||File extention|

## REQUEST

Function initiates HTTP request

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_REQ|IN/OUT|PL/SQL RECORD||HTTP request|
|P_METHOD|IN|VARCHAR2||Method (GET, POST, PUT, DELETE, ..)|
|P_URL|IN|VARCHAR2||Url|
|P_VERSION|IN|VARCHAR2|'HTTP/1.1'|Version|

## REQUEST_AUTH_BASIC

Procedure authenticates user with username and password

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_REQ|IN/OUT|PL/SQL RECORD||HTTP request|
|P_USERNAME|IN|VARCHAR2||User name|
|P_PASSWORD|IN|VARCHAR2||Password|

## REQUEST_AUTH_TOKEN

Procedure adds Bearer token to the request

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_REQ|IN/OUT|PL/SQL RECORD||HTTP request|
|P_TOKEN|IN|VARCHAR2||Token|

## REQUEST_AUTH_WALLET

Procedure adds Oracle Wallet to HTTP connection (must be called before starting request)

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_WALLET_PATH|IN|VARCHAR2||Path to Oracle Wallet (without "file" prefix)|
|P_WALLET_PASSWORD|IN|VARCHAR2||Wallet password|

## REQUEST_CHARSET

Procedure adds charset header to the HTTP request

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_REQ|IN/OUT|PL/SQL RECORD||HTTP request|
|P_BODY_CHARSET|IN|VARCHAR2||Charset|

## REQUEST_CONTENT_TYPE

Procedure adds content type header to the HTTP request

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_REQ|IN/OUT|PL/SQL RECORD||HTTP request|
|P_CONTENT_TYPE|IN|VARCHAR2||Content type|

## REQUEST_JSON

Procedure adds JSON payload to the HTTP request

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_REQ|IN/OUT|PL/SQL RECORD||HTTP request|
|P_JSON|IN|CLOB||JSON data|

## REQUEST_MULTIPART_BLOB

Procedure add file to multipart form data

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_REQ|IN/OUT|PL/SQL RECORD||HTTP request|
|P_NAME|IN|VARCHAR2||Name|
|P_FILENAME|IN|VARCHAR2||File name  |
|P_BLOB|IN|BLOB||File content|

## REQUEST_MULTIPART_END

Procedure closes multipart data

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_REQ|IN/OUT|PL/SQL RECORD||HTTP request|

## REQUEST_MULTIPART_START

Procedure starts multipart form data request

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_REQ|IN/OUT|PL/SQL RECORD||HTTP request|
|P_CHARSET|IN|VARCHAR2|'UTF-8'|Charset|

## REQUEST_MULTIPART_VARCHAR2

Procedure adds Varchar2 data to multipart form data 

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_REQ|IN/OUT|PL/SQL RECORD||HTTP request|
|P_NAME|IN|VARCHAR2||Name|
|P_VALUE|IN|VARCHAR2||Value|
|P_CHARSET|IN|VARCHAR2|'UTF-8'|Charset|

## RESPONSE_BINARY

Function returns binary data from HTTP request

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_REQ|IN/OUT|PL/SQL RECORD||HTTP request|
|R_BLOB|OUT|BLOB||Response data|

## RESPONSE_TEXT

Function returns text data from HTTP request

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_REQ|IN/OUT|PL/SQL RECORD||HTTP request|
|R_CLOB|OUT|CLOB||Response data|


