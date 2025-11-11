# YAML

Package for handling YAML

::: details example
<<< ../../../../../db/tests/pck_api_yaml.sql
:::

::: details specification
<<< ../../../../../db/src/database/odbvue/package_specs/pck_api_yaml.sql
:::

::: details implementation
<<< ../../../../../db/src/database/odbvue/package_bodies/pck_api_yaml.sql
:::

## ELCOUNT

Function to count elements in an array at a specified path

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|BINARY_INTEGER||Returns the count of elements|
|C|IN|CLOB||Function to count elements in an array at a specified path|
|P|IN|VARCHAR2||Function to count elements in an array at a specified path|

## EXISTS

Function to check if a path exists in a yaml object

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|PL/SQL BOOLEAN||Returns true if the key exists, false otherwise|
|C|IN|CLOB||Function to check if a path exists in a yaml object|
|P|IN|VARCHAR2||Function to check if a path exists in a yaml object|

## INIT

Function to initialize empty yaml object 

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|CLOB||Returns true if the key exists, false otherwise|

## KEYS

Function to get the keys of an object at a specified path

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|VARCHAR2||Returns a list of keys|
|C|IN|CLOB||Function to get the keys of an object at a specified path|
|P|IN|VARCHAR2||Function to get the keys of an object at a specified path|

## PRINT

Procedure to pretty-print a yaml object

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|C|IN/OUT|CLOB||Procedure to pretty-print a yaml object|

## READ

Function reads by path form a yaml object

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|CLOB||Returns the value at the specified path as clob|
|C|IN|CLOB||Function reads by path form a yaml object|
|P|IN|VARCHAR2||Function reads by path form a yaml object|

## TO_JSON

Function to convert yaml object to JSON representation

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|CLOB||Returns the JSON representation as clob|
|C|IN|CLOB||Function to convert yaml object to JSON representation|

## TO_XML

Function to convert yaml object to xml representation

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|CLOB||Returns the xml representation as clob|
|C|IN|CLOB||Function to convert yaml object to xml representation|

## TYPEOF

Function to get the type of the value at a specified path

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|VARCHAR2||Returns the type as a string|
|C|IN|CLOB||Function to get the type of the value at a specified path|
|P|IN|VARCHAR2||Function to get the type of the value at a specified path|

## WRITE

Procedure to replace a value at a specified path 

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|C|IN/OUT|CLOB||Procedure to replace a value at a specified path |
|P|IN|VARCHAR2||Procedure to replace a value at a specified path |
|V|IN|CLOB||Procedure to replace a value at a specified path |


