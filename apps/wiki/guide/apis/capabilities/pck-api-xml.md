# XML

Package for handling xml 

::: details example
<<< ../../../../../db/src/database/odbvue/tests/pck_api_xml.sql
:::

::: details specification
<<< ../../../../../db/src/database/odbvue/package_specs/pck_api_xml.sql
:::

::: details implementation
<<< ../../../../../db/src/database/odbvue/package_bodies/pck_api_xml.sql
:::

## ELCOUNT

Function to count elements in an array at a specified path

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|BINARY_INTEGER||Returns the type as a string|
|C|IN|CLOB||Returns the type as a string|
|P|IN|VARCHAR2||Returns the type as a string|

## EXISTS

Function to check if a path exists in a xml object

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|PL/SQL BOOLEAN||Returns true if the key exists, false otherwise|
|C|IN|CLOB||Returns a clob representing an empty xml object|
|P|IN|VARCHAR2||Returns a clob representing an empty xml object|

## INIT

Function to initialize empty xml object 

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|CLOB||Returns true if the key exists, false otherwise|

## KEYS

Function to get the keys of an object at a specified path

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|VARCHAR2||Returns the count of elements|
|C|IN|CLOB||Returns the count of elements|
|P|IN|VARCHAR2||Returns the count of elements|

## PRINT

Procedure to pretty-print a xml object

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|C|IN/OUT|CLOB||Procedure to pretty-print a xml object|

## READ

Function reads by path form a xml object

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|CLOB||Returns true if the key exists, false otherwise|
|C|IN|CLOB||Function reads by path form a xml object|
|P|IN|VARCHAR2||Function reads by path form a xml object|

## TO_JSON

Function to convert xml object to json representation

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|CLOB||Returns the json representation as clob|
|C|IN|CLOB||The xml object as clob|

## TO_YAML

Function to convert xml object to yaml representation

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|CLOB||Returns the yaml representation as clob|
|C|IN|CLOB||The xml object as clob|

## TYPEOF

Function to get the type of the value at a specified path

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|VARCHAR2||Returns the value at the specified path as clob|
|C|IN|CLOB||Returns the value at the specified path as clob|
|P|IN|VARCHAR2||Returns the value at the specified path as clob|

## WRITE

Procedure to replace a value at a specified path 

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|C|IN/OUT|CLOB||Returns a list of keys|
|P|IN|VARCHAR2||Procedure to replace a value at a specified path |
|V|IN|CLOB||Returns a list of keys|


