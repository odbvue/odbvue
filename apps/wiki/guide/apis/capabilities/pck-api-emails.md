# Emails

Package for sending emails

::: details example
<<< ../../../../../db/tests/pck_api_emails.sql
:::

::: details specification
<<< ../../../../../db/src/database/odbvue/package_specs/pck_api_emails.sql
:::

::: details implementation
<<< ../../../../../db/src/database/odbvue/package_bodies/pck_api_emails.sql
:::

Dependencies:

| Referenced type | Referenced name |
| --------------- | --------------- |
|TABLE|APP_EMAILS|
|TABLE|APP_EMAILS_ADDR|

## ADDR

Add an email address to the email

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_ID|IN/OUT|CHAR||Email ID|
|P_TYPE|IN|VARCHAR2||Email address type (From, ReplyTo, To, Cc, Bcc)|
|P_EMAIL_ADDR|IN|VARCHAR2||Email address|
|P_EMAIL_NAME|IN|VARCHAR2||Email addressee name|

## ATTC

Add an attachment to the email

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_ID|IN/OUT|CHAR||Email ID|
|P_FILE_NAME|IN|VARCHAR2||Attachment file name|
|P_FILE_DATA|IN|BLOB||Attachment file data|

## MAIL

Create a new email

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|R_ID|OUT|CHAR||Email ID|
|P_EMAIL_ADDR|IN|VARCHAR2||Email address|
|P_EMAIL_NAME|IN|VARCHAR2||Email name|
|P_SUBJECT|IN|VARCHAR2||Email subject|
|P_CONTENT|IN|CLOB||Email content|
|P_PRIORITY|IN|NUMBER|3|Email priority (1..10)|

## SEND

Send the email

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_ID|IN/OUT|CHAR||Email ID|
|P_POSTPONE|IN|BINARY_INTEGER|300|Postpone sending the email (seconds)|


