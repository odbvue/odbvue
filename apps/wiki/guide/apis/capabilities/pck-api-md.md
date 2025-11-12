# Markdown

Package for Markdown document generation and export to PDF and HTML

::: details example
<<< ../../../../../db/tests/pck_api_md.sql
:::

::: details specification
<<< ../../../../../db/src/database/odbvue/package_specs/pck_api_md.sql
:::

::: details implementation
<<< ../../../../../db/src/database/odbvue/package_bodies/pck_api_md.sql
:::

## APPEND

Append text to markdown

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_MD|IN/OUT|CLOB||Markdown buffer|
|P_TEXT|IN|VARCHAR2||Text to append|

## APPEND_LINE

Append line to markdown

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_MD|IN/OUT|CLOB||Markdown buffer|
|P_TEXT|IN|VARCHAR2||Text line|

## B

Bold text

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|VARCHAR2||Bold text|
|P_TEXT|IN|VARCHAR2||Text to append|

## BI

Bold and italic text

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|VARCHAR2||Strikethrough text|
|P_TEXT|IN|VARCHAR2||Strikethrough text|

## BR

Add line break

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_MD|IN/OUT|CLOB||Add horizontal rule|

## CAUTION

Add caution admonition

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_MD|IN/OUT|CLOB||Markdown buffer|
|P_TEXT|IN|VARCHAR2||Caution text|

## CODE

Inline code

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|VARCHAR2||Bold text|
|P_TEXT|IN|VARCHAR2||Add level 2 heading|

## CODE_BLOCK

Add code block

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_MD|IN/OUT|CLOB||Markdown buffer|
|P_TEXT|IN|CLOB||Code content|
|P_LANG|IN|VARCHAR2||Language hint|

## CODE_INLINE

Add inline code

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_MD|IN/OUT|CLOB||Markdown buffer|
|P_TEXT|IN|VARCHAR2||Code text|

## FINALIZE

Finalize markdown document

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_MD|IN/OUT|CLOB||Markdown buffer|

## H1

Add level 1 heading

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_MD|IN/OUT|CLOB||Add level 2 heading|
|P_TEXT|IN|VARCHAR2||Add level 2 heading|

## H2

Add level 2 heading

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_MD|IN/OUT|CLOB||Add level 3 heading|
|P_TEXT|IN|VARCHAR2||Add level 3 heading|

## H3

Add level 3 heading

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_MD|IN/OUT|CLOB||Add level 4 heading|
|P_TEXT|IN|VARCHAR2||Add level 4 heading|

## H4

Add level 4 heading

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_MD|IN/OUT|CLOB||Add level 5 heading|
|P_TEXT|IN|VARCHAR2||Add level 5 heading|

## H5

Add level 5 heading

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_MD|IN/OUT|CLOB||Add level 6 heading|
|P_TEXT|IN|VARCHAR2||Add level 6 heading|

## H6

Add level 6 heading

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_MD|IN/OUT|CLOB||Markdown buffer|
|P_TEXT|IN|VARCHAR2||Paragraph text|

## HR

Add horizontal rule

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_MD|IN/OUT|CLOB||Markdown buffer|

## I

Italic text

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|VARCHAR2||Bold text|
|P_TEXT|IN|VARCHAR2||Text to append|

## IMAGE

Add image

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_MD|IN/OUT|CLOB||Markdown buffer|
|P_URL|IN|VARCHAR2||Image URL|
|P_ALT|IN|VARCHAR2||Alt text|

## IMPORTANT

Add important admonition

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_MD|IN/OUT|CLOB||Markdown buffer|
|P_TEXT|IN|VARCHAR2||Important text|

## INIT

Initialize new markdown document

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|CLOB||Bold text|

## INIT

Initialize new markdown document

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_MD|IN/OUT|CLOB||Initialize markdown buffer|

## LF

Add line feed

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_MD|IN/OUT|CLOB||Markdown buffer|

## LI

Add unordered list item

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_MD|IN/OUT|CLOB||Initialize markdown buffer|
|P_TEXT|IN|VARCHAR2||Text to append|

## LINK

Add hyperlink

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_MD|IN/OUT|CLOB||Initialize markdown buffer|
|P_TEXT|IN|VARCHAR2||Text to append|
|P_URL|IN|VARCHAR2||Link URL|

## MD_ESCAPE

Escape text for table cells

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|VARCHAR2||Escaped text|
|P_TEXT|IN|VARCHAR2||Text to escape|

## MD_TABLE

Add markdown table

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_MD|IN/OUT|CLOB||Markdown buffer|
|P_ROWS_JSON|IN|CLOB||JSON array of row objects|
|P_HEADINGS_JSON|IN|CLOB||JSON column definitions|

## NOTE

Add note admonition

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_MD|IN/OUT|CLOB||Markdown buffer|
|P_TEXT|IN|VARCHAR2||Note text|

## OLI

Add ordered list item

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_MD|IN/OUT|CLOB||Markdown buffer|
|P_INDEX|IN|BINARY_INTEGER||List item index|
|P_TEXT|IN|VARCHAR2||List item text|

## P

Add paragraph

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_MD|IN/OUT|CLOB||Initialize markdown buffer|
|P_TEXT|IN|VARCHAR2||Text to append|

## QUOTE

Add blockquote

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_MD|IN/OUT|CLOB||Markdown buffer|
|P_TEXT|IN|VARCHAR2||Quote text|

## S

Strikethrough text

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|VARCHAR2||Bold text|
|P_TEXT|IN|VARCHAR2||Text to append|

## TIP

Add tip admonition

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_MD|IN/OUT|CLOB||Markdown buffer|
|P_TEXT|IN|VARCHAR2||List item text|

## TO_HTML

Convert markdown to HTML (EXPERIMENTAL)

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_MD|IN/OUT|CLOB||Markdown buffer|
|R_HTML|OUT|CLOB||HTML output|
|P_OPTIONS|IN|CLOB||JSON options|

## TO_PDF

Convert markdown to PDF (EXPERIMENTAL)

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_MD|IN/OUT|CLOB||Markdown buffer|
|R_PDF|OUT|BLOB||PDF output|
|P_OPTIONS|IN|CLOB||JSON options|

## WARNING

Add warning admonition

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_MD|IN/OUT|CLOB||Markdown buffer|
|P_TEXT|IN|VARCHAR2||Warning text|


