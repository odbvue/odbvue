# Labels

Package provides methods for managing labels

::: details example
<<< ../../../../../db/src/database/odbvue/tests/pck_api_labels.sql
:::

::: details specification
<<< ../../../../../db/src/database/odbvue/package_specs/pck_api_labels.sql
:::

::: details implementation
<<< ../../../../../db/src/database/odbvue/package_bodies/pck_api_labels.sql
:::

Dependencies:

| Referenced type | Referenced name |
| --------------- | --------------- |
|TABLE|LABEL_LINKS|
|TABLE|LABELS|

## LINK_LABEL_NM

Procedure links a label to an entity

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_LABEL_NAME|IN|VARCHAR2||Name of the label|
|P_ENTITY_NAME|IN|VARCHAR2||Name of the entity|
|P_ENTITY_ID_NM|IN|NUMBER||Numeric Id of the entity|

## LINK_LABEL_VC

Procedure links a label to an entity

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_LABEL_NAME|IN|VARCHAR2||Name of the label|
|P_ENTITY_NAME|IN|VARCHAR2||Name of the entity|
|P_ENTITY_ID_VC|IN|VARCHAR2||Variable character Id of the entity|

## UNLINK_LABEL_NM

Procedure unlinks a label from an entity

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_LABEL_NAME|IN|VARCHAR2||Name of the label|
|P_ENTITY_NAME|IN|VARCHAR2||Name of the entity|
|P_ENTITY_ID_NM|IN|NUMBER|NULL|Numeric Id of the entity|

## UNLINK_LABEL_VC

Procedure unlinks a label from an entity

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_LABEL_NAME|IN|VARCHAR2||Name of the label|
|P_ENTITY_NAME|IN|VARCHAR2||Name of the entity|
|P_ENTITY_ID_VC|IN|VARCHAR2|NULL|Variable character Id of the entity|


