# Json

Package for handling json 

::: details example
<<< ../../../../../db/src/database/odbvue/tests/pck_api_json.sql
:::

::: details specification
<<< ../../../../../db/src/database/odbvue/package_specs/pck_api_json.sql
:::

::: details implementation
<<< ../../../../../db/src/database/odbvue/package_bodies/pck_api_json.sql
:::

## ELCOUNT

Function to count elements in an array at a specified path

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|BINARY_INTEGER||Returns the count of elements|
|C|IN|CLOB||The json object as clob|
|P|IN|VARCHAR2||The path to the array|

## EXISTS

Function to check if a path exists in a json object

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|PL/SQL BOOLEAN||Returns true if the key exists, false otherwise|
|C|IN|CLOB||The json object as clob|
|P|IN|VARCHAR2||The path to check for existence|

## INIT

Function to initialize empty json object 

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|CLOB||Returns true if the key exists, false otherwise|

## KEYS

Function to get the keys of an object at a specified path

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|VARCHAR2||Returns a list of keys|
|C|IN|CLOB||The json object as clob|
|P|IN|VARCHAR2||The path to the object|

## PRINT

Procedure to pretty-print a json object

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|C|IN/OUT|CLOB||The json object as clob|

## READ

Function reads by path form a json object

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|CLOB||Returns the value at the specified path as clob|
|C|IN|CLOB||The json object as clob|
|P|IN|VARCHAR2||The path to read|

## TO_XML

Function to convert json object to xml representation

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|CLOB||Returns the xml representation as clob|
|C|IN|CLOB||The json object as clob|

## TO_YAML

Function to convert json object to yaml representation

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|CLOB||Returns the yaml representation as clob|
|C|IN|CLOB||The json object as clob|

## TYPEOF

Function to get the type of the value at a specified path

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|VARCHAR2||Returns the type as a string|
|C|IN|CLOB||The json object as clob|
|P|IN|VARCHAR2||The path to check the type of|

## WRITE

Procedure to replace a value at a specified path 

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|C|IN/OUT|CLOB||The json object as clob |
|P|IN|VARCHAR2||The json object as clob |
|V|IN|CLOB||The path to insert the value at (object path only, arrays not supported yet)|


