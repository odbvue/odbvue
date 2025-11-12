# Pdf

Package for creating PDF documents, credits to https://github.com/antonscheffer/as_pdf

::: details example
<<< ../../../../../db/tests/pck_api_pdf.sql
:::

::: details specification
<<< ../../../../../db/src/database/odbvue/package_specs/pck_api_pdf.sql
:::

::: details implementation
<<< ../../../../../db/src/database/odbvue/package_bodies/pck_api_pdf.sql
:::

## ADD_EMBEDDED_FILE

Add embedded file to PDF

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_NAME|IN|VARCHAR2||File name|
|P_CONTENT|IN|BLOB||File content|
|P_DESCR|IN|VARCHAR2||Description|
|P_MIME|IN|VARCHAR2||MIME type|
|P_AF_KEY|IN|VARCHAR2||Attachement key|

## BEZIER

Draw Bezier curve

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_X1|IN|NUMBER||Start X|
|P_Y1|IN|NUMBER||Start Y|
|P_X2|IN|NUMBER||Control X1|
|P_Y2|IN|NUMBER||Control Y1|
|P_X3|IN|NUMBER||Control X2|
|P_Y3|IN|NUMBER||Control Y2|
|P_X4|IN|NUMBER||End X|
|P_Y4|IN|NUMBER||End Y|
|P_LINE_WIDTH|IN|NUMBER||Line width|
|P_LINE_COLOR|IN|VARCHAR2||Line color|
|P_PAGE_PROC|IN|BINARY_INTEGER||Page procedure|

## BEZIER_V

Draw Bezier curve variant V

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_X1|IN|NUMBER||Start X|
|P_Y1|IN|NUMBER||Start Y|
|P_X2|IN|NUMBER||Control X1|
|P_Y2|IN|NUMBER||Control Y1|
|P_X3|IN|NUMBER||Control X2|
|P_Y3|IN|NUMBER||Control Y2|
|P_LINE_WIDTH|IN|NUMBER||Line width|
|P_LINE_COLOR|IN|VARCHAR2||Line color|
|P_PAGE_PROC|IN|BINARY_INTEGER||Page procedure|

## BEZIER_Y

Draw Bezier curve variant Y

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_X1|IN|NUMBER||Start X|
|P_Y1|IN|NUMBER||Start Y|
|P_X2|IN|NUMBER||Control X1|
|P_Y2|IN|NUMBER||Control Y1|
|P_X3|IN|NUMBER||Control X2|
|P_Y3|IN|NUMBER||Control Y2|
|P_LINE_WIDTH|IN|NUMBER||Line width|
|P_LINE_COLOR|IN|VARCHAR2||Line color|
|P_PAGE_PROC|IN|BINARY_INTEGER||Page procedure|

## CIRCLE

Draw circle

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_X|IN|NUMBER||Center X|
|P_Y|IN|NUMBER||Center Y|
|P_RADIUS|IN|NUMBER||Radius|
|P_LINE_COLOR|IN|VARCHAR2||Line color|
|P_FILL_COLOR|IN|VARCHAR2||Fill color|
|P_LINE_WIDTH|IN|NUMBER||Line width|
|P_PAGE_PROC|IN|BINARY_INTEGER||Page procedure|

## CONV2UU

Convert value to user units

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|NUMBER||Font index|
|P_VALUE|IN|NUMBER||Value to convert|
|P_UNIT|IN|VARCHAR2||Unit (mm/cm/point/pt/inch/in/pica/p/pc)|

## CURSOR2TABLE

Convert cursor to table

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_RC|IN|REF CURSOR||Result cursor|
|P_X|IN|NUMBER||X coordinate|
|P_Y|IN|NUMBER||Y coordinate|
|P_HEADERS|IN|TABLE||Column headers|
|P_WIDTHS|IN|TABLE||Column widths|
|P_FONT_INDEX|IN|BINARY_INTEGER||Font index|
|P_FONTSIZE|IN|NUMBER||Font size|
|P_TXT_COLOR|IN|VARCHAR2||Text color|
|P_ODD_COLOR|IN|VARCHAR2||Odd row color|
|P_EVEN_COLOR|IN|VARCHAR2||Even row color|
|P_LINE_COLOR|IN|VARCHAR2||Line color|
|P_LINE_WIDTH|IN|NUMBER||Line width|
|P_HEADER_FI|IN|BINARY_INTEGER||Header font index|
|P_HEADER_FS|IN|NUMBER||Header font size|
|P_HEADER_TXT_C|IN|VARCHAR2||Header text color|
|P_HEADER_COLOR|IN|VARCHAR2||Header background color|
|P_HEADER_REPEAT|IN|PL/SQL BOOLEAN||Repeat header on new page|
|P_FI|IN|PL/SQL TABLE||Font indices|
|P_FS|IN|PL/SQL TABLE||Font sizes|
|P_AL|IN|PL/SQL TABLE||Alignments|
|P_FMT|IN|PL/SQL TABLE||Formats|

## ELLIPS

Draw ellipse

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_X|IN|NUMBER||Center X|
|P_Y|IN|NUMBER||Center Y|
|P_MAJOR_RADIUS|IN|NUMBER||Major radius|
|P_MINOR_RADIUS|IN|NUMBER||Minor radius|
|P_LINE_COLOR|IN|VARCHAR2||Line color|
|P_FILL_COLOR|IN|VARCHAR2||Fill color|
|P_LINE_WIDTH|IN|NUMBER||Line width|
|P_DEGREES_ROTATION|IN|NUMBER||Rotation in degrees|
|P_PAGE_PROC|IN|BINARY_INTEGER||Page procedure|

## FINISH_PDF

Finish PDF and return blob

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|BLOB||PDF blob|
|P_PASSWORD|IN|VARCHAR2||Optional password|

## GET

Get PDF property value

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|NUMBER||Property value|
|P_WHAT|IN|BINARY_INTEGER||Property code|

## GET_FONT_INDEX

Get font index

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|BINARY_INTEGER||Font index|
|P_FONTNAME|IN|VARCHAR2||Font name|
|P_FAMILY|IN|VARCHAR2||Font family|
|P_STYLE|IN|VARCHAR2||Font style|

## GET_STRING

Get PDF property string value

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|VARCHAR2||String value|
|P_WHAT|IN|BINARY_INTEGER||Property code|
|P_IDX|IN|BINARY_INTEGER||Index|

## HORIZONTAL_LINE

Draw horizontal line

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_X|IN|NUMBER||X coordinate|
|P_Y|IN|NUMBER||Y coordinate|
|P_WIDTH|IN|NUMBER||Line width|
|P_LINE_WIDTH|IN|NUMBER||Stroke width|
|P_LINE_COLOR|IN|VARCHAR2||Line color|
|P_PAGE_PROC|IN|BINARY_INTEGER||Page procedure|

## INIT

Initialize PDF generator

## INIT_PDF

Initialize PDF

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_PAGE_SIZE|IN|VARCHAR2||Page size|
|P_PAGE_ORIENTATION|IN|VARCHAR2||Orientation|
|P_PAGE_WIDTH|IN|NUMBER||Page width|
|P_PAGE_HEIGHT|IN|NUMBER||Page height|
|P_MARGIN_LEFT|IN|NUMBER||Left margin|
|P_MARGIN_RIGHT|IN|NUMBER||Right margin|
|P_MARGIN_TOP|IN|NUMBER||Top margin|
|P_MARGIN_BOTTOM|IN|NUMBER||Bottom margin|
|P_UNIT|IN|VARCHAR2||Unit|

## LINE

Set line height factor

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_X1|IN|NUMBER||Start X|
|P_Y1|IN|NUMBER||Start Y|
|P_X2|IN|NUMBER||End X|
|P_Y2|IN|NUMBER||End Y|
|P_LINE_WIDTH|IN|NUMBER||Line width|
|P_LINE_COLOR|IN|VARCHAR2||Line color|
|P_PAGE_PROC|IN|BINARY_INTEGER||Page procedure|

## LINK

Create hyperlink

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_TXT|IN|VARCHAR2||Text to measure|
|P_URL|IN|VARCHAR2||URL|
|P_X|IN|NUMBER||X coordinate|
|P_Y|IN|NUMBER||Y coordinate|
|P_FONT_INDEX|IN|BINARY_INTEGER||Font index|
|P_FONTSIZE|IN|NUMBER||Font size in pt|
|P_COLOR|IN|VARCHAR2||Text color|
|P_PAGE_PROC|IN|BINARY_INTEGER||Page procedure|

## LOAD_FONT

Load font from blob

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|BINARY_INTEGER||Font index|
|P_FONT|IN|BLOB||Font blob|
|P_EMBED|IN|PL/SQL BOOLEAN||Embed font in PDF|

## LOAD_FONT

Load font from blob

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|BINARY_INTEGER||Font index|
|P_DIR|IN|VARCHAR2||Directory name|
|P_FILENAME|IN|VARCHAR2||File name|
|P_EMBED|IN|PL/SQL BOOLEAN||Embed font in PDF|

## LOAD_FONT

Load font from blob

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_FONT|IN|BLOB||Font blob|
|P_EMBED|IN|PL/SQL BOOLEAN||Embed font in PDF|

## LOAD_FONT

Load font from blob

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_DIR|IN|VARCHAR2||Directory name|
|P_FILENAME|IN|VARCHAR2||File name|
|P_EMBED|IN|PL/SQL BOOLEAN||Embed font in PDF|

## LOAD_IMAGE

Load image from blob

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|BINARY_INTEGER||Image index|
|P_IMG|IN|BLOB||Image blob|

## LOAD_IMAGE

Load image from blob

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|BINARY_INTEGER||Image index|
|P_DIR|IN|VARCHAR2||Directory name|
|P_FILE_NAME|IN|VARCHAR2||File name|

## MULTI_CELL

Write text in rectangle

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_TXT|IN|VARCHAR2||Text content|
|P_X|IN|NUMBER||X coordinate|
|P_Y|IN|NUMBER||Y coordinate|
|P_WIDTH|IN|NUMBER||Cell width|
|P_PADDING|IN|NUMBER||Cell padding|
|P_FONT_INDEX|IN|BINARY_INTEGER||Font index|
|P_FONTSIZE|IN|NUMBER||Font size|
|P_TXT_COLOR|IN|VARCHAR2||Text color|
|P_FILL_COLOR|IN|VARCHAR2||Fill color|
|P_LINE_COLOR|IN|VARCHAR2||Line color|
|P_ALIGN|IN|VARCHAR2||Text alignment|
|P_LINE_WIDTH|IN|NUMBER||Line width|
|P_URL|IN|VARCHAR2||URL link|
|P_PAGE_PROC|IN|BINARY_INTEGER||Page procedure|

## NEW_PAGE

Create new page

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_PAGE_SIZE|IN|VARCHAR2||Page size|
|P_PAGE_ORIENTATION|IN|VARCHAR2||Orientation|
|P_PAGE_WIDTH|IN|NUMBER||Page width|
|P_PAGE_HEIGHT|IN|NUMBER||Page height|
|P_MARGIN_LEFT|IN|NUMBER||Left margin|
|P_MARGIN_RIGHT|IN|NUMBER||Right margin|
|P_MARGIN_TOP|IN|NUMBER||Top margin|
|P_MARGIN_BOTTOM|IN|NUMBER||Bottom margin|
|P_UNIT|IN|VARCHAR2||Unit|

## PATH

Draw path

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_STEPS|IN|TABLE||Path steps|
|P_LINE_WIDTH|IN|NUMBER||Line width|
|P_LINE_COLOR|IN|VARCHAR2||Line color|
|P_PAGE_PROC|IN|BINARY_INTEGER||Page procedure|

## PUT_IMAGE

Put image by index

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_IMG_IDX|IN|BINARY_INTEGER||Image index|
|P_X|IN|NUMBER||X coordinate (left)|
|P_Y|IN|NUMBER||Y coordinate (bottom)|
|P_WIDTH|IN|NUMBER||Width|
|P_HEIGHT|IN|NUMBER||Height|
|P_ALIGN|IN|VARCHAR2||Horizontal alignment|
|P_VALIGN|IN|VARCHAR2||Vertical alignment|
|P_PAGE_PROC|IN|BINARY_INTEGER||Page procedure|

## PUT_IMAGE

Put image by index

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_IMG|IN|BLOB||Image index|
|P_X|IN|NUMBER||X coordinate (left)|
|P_Y|IN|NUMBER||Y coordinate (bottom)|
|P_WIDTH|IN|NUMBER||Width|
|P_HEIGHT|IN|NUMBER||Height|
|P_ALIGN|IN|VARCHAR2||Horizontal alignment|
|P_VALIGN|IN|VARCHAR2||Vertical alignment|

## PUT_IMAGE

Put image by index

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_DIR|IN|VARCHAR2||Directory name|
|P_FILE_NAME|IN|VARCHAR2||File name|
|P_X|IN|NUMBER||X coordinate (left)|
|P_Y|IN|NUMBER||Y coordinate (bottom)|
|P_WIDTH|IN|NUMBER||Width|
|P_HEIGHT|IN|NUMBER||Height|
|P_ALIGN|IN|VARCHAR2||Horizontal alignment|
|P_VALIGN|IN|VARCHAR2||Vertical alignment|

## PUT_TXT

Put text at position

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_X|IN|NUMBER||X coordinate|
|P_Y|IN|NUMBER||Y coordinate|
|P_TXT|IN|VARCHAR2||Text content|
|P_DEGREES_ROTATION|IN|NUMBER||Rotation in degrees|
|P_FONT_INDEX|IN|BINARY_INTEGER||Font index|
|P_FONTSIZE|IN|NUMBER||Font size|
|P_COLOR|IN|VARCHAR2||Text color|
|P_PAGE_PROC|IN|BINARY_INTEGER||Page procedure|

## QUERY2TABLE

Convert query result to table

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_QUERY|IN|VARCHAR2||SQL query|
|P_X|IN|NUMBER||X coordinate|
|P_Y|IN|NUMBER||Y coordinate|
|P_HEADERS|IN|TABLE||Column headers|
|P_WIDTHS|IN|TABLE||Column widths|
|P_FONT_INDEX|IN|BINARY_INTEGER||Font index|
|P_FONTSIZE|IN|NUMBER||Font size|
|P_TXT_COLOR|IN|VARCHAR2||Text color|
|P_ODD_COLOR|IN|VARCHAR2||Odd row color|
|P_EVEN_COLOR|IN|VARCHAR2||Even row color|
|P_LINE_COLOR|IN|VARCHAR2||Line color|
|P_LINE_WIDTH|IN|NUMBER||Line width|
|P_HEADER_FI|IN|BINARY_INTEGER||Header font index|
|P_HEADER_FS|IN|NUMBER||Header font size|
|P_HEADER_TXT_C|IN|VARCHAR2||Header text color|
|P_HEADER_COLOR|IN|VARCHAR2||Header background color|
|P_HEADER_REPEAT|IN|PL/SQL BOOLEAN||Repeat header on new page|
|P_FI|IN|PL/SQL TABLE||Font indices|
|P_FS|IN|PL/SQL TABLE||Font sizes|
|P_AL|IN|PL/SQL TABLE||Alignments|
|P_FMT|IN|PL/SQL TABLE||Formats|

## RECT

Draw rectangle

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_X|IN|NUMBER||X coordinate|
|P_Y|IN|NUMBER||Y coordinate|
|P_WIDTH|IN|NUMBER||Cell width|
|P_HEIGHT|IN|NUMBER||Height|
|P_LINE_COLOR|IN|VARCHAR2||Line color|
|P_FILL_COLOR|IN|VARCHAR2||Fill color|
|P_LINE_WIDTH|IN|NUMBER||Line width|
|P_PAGE_PROC|IN|BINARY_INTEGER||Page procedure|

## SAVE_PDF

Save PDF to file

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_DIR|IN|VARCHAR2||Directory name|
|P_FILENAME|IN|VARCHAR2||File name|
|P_PASSWORD|IN|VARCHAR2||Optional password|

## SET_BK_COLOR

Set background color (RGB hex)

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_RGB|IN|VARCHAR2||RGB hex or X11 color name|

## SET_BK_COLOR

Set background color (RGB hex)

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_RED|IN|NUMBER||Red component (0-255)|
|P_GREEN|IN|NUMBER||Green component (0-255)|
|P_BLUE|IN|NUMBER||Blue component (0-255)|

## SET_COLOR

Set text color (RGB hex)

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_RGB|IN|VARCHAR2||RGB hex or X11 color name|

## SET_COLOR

Set text color (RGB hex)

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_RED|IN|NUMBER||Red component (0-255)|
|P_GREEN|IN|NUMBER||Green component (0-255)|
|P_BLUE|IN|NUMBER||Blue component (0-255)|

## SET_FONT

Set font by index

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_INDEX|IN|BINARY_INTEGER||Font index|
|P_FONTSIZE_PT|IN|NUMBER||Font size in pt|

## SET_FONT

Set font by index

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_FONTNAME|IN|VARCHAR2||Font name|
|P_FONTSIZE_PT|IN|NUMBER||Font size in pt|

## SET_FONT

Set font by index

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_FAMILY|IN|VARCHAR2||Font family|
|P_STYLE|IN|VARCHAR2||Font style (N/I/B/BI)|
|P_FONTSIZE_PT|IN|NUMBER||Font size in pt|

## SET_INFO

Set document information

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_TITLE|IN|VARCHAR2||Document title|
|P_AUTHOR|IN|VARCHAR2||Author|
|P_SUBJECT|IN|VARCHAR2||Subject|
|P_CREATOR|IN|VARCHAR2||Creator|
|P_KEYWORDS|IN|VARCHAR2||Keywords|

## SET_INITIAL_ZOOM

Set initial zoom level

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_ZOOM_FACTOR|IN|NUMBER||Zoom factor|

## SET_LINE_HEIGHT_FACTOR

Set line height factor

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_FACTOR|IN|NUMBER||Height factor|

## SET_MARGINS

Set page margins

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_TOP|IN|NUMBER||Top margin|
|P_LEFT|IN|NUMBER||Left margin|
|P_BOTTOM|IN|NUMBER||Bottom margin|
|P_RIGHT|IN|NUMBER||Right margin|
|P_UNIT|IN|VARCHAR2||Unit (mm/cm/point/pt/inch/in/pica/p/pc)|

## SET_PAGE_FORMAT

Set page format

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_FORMAT|IN|VARCHAR2||Page format (A0-A10, etc)|

## SET_PAGE_ORIENTATION

Set page orientation

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_ORIENTATION|IN|VARCHAR2||Orientation (PORTRAIT/LANDSCAPE)|

## SET_PAGE_SIZE

Set page size

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_WIDTH|IN|NUMBER||Page width|
|P_HEIGHT|IN|NUMBER||Page height|
|P_UNIT|IN|VARCHAR2||Unit (mm/cm/point/pt/inch/in/pica/p/pc)|

## SET_PDFA3

Set PDF/A-3 conformance

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_CONFORMANCE|IN|VARCHAR2||Conformance level (A/B/U)|
|P_EXTRA_META_DATA_DESCRIPTIONS|IN|VARCHAR2||Extra metadata|

## SET_PDF_VERSION

Set PDF version

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_VERSION|IN|NUMBER||PDF version|

## STR_LEN

Calculate string length

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
||OUT|NUMBER||Property value|
|P_TXT|IN|VARCHAR2||Text to measure|
|P_FONT_INDEX|IN|BINARY_INTEGER||Font index|
|P_FONTSIZE|IN|NUMBER||Font size in pt|

## TABLE_ROW

Write table row

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_TXT|IN|TABLE||Cell texts|
|P_X|IN|NUMBER||X coordinate|
|P_Y|IN|NUMBER||Y coordinate|
|P_WIDTHS|IN|TABLE||Column widths|
|P_PADDING|IN|NUMBER||Cell padding|
|P_FONT_INDEX|IN|BINARY_INTEGER||Font index|
|P_FONTSIZE|IN|NUMBER||Font size|
|P_ALIGN|IN|VARCHAR2||Text alignment|
|P_TXT_COLOR|IN|VARCHAR2||Text color|
|P_FILL_COLOR|IN|VARCHAR2||Fill color|
|P_LINE_COLOR|IN|VARCHAR2||Line color|
|P_LINE_WIDTH|IN|NUMBER||Line width|
|P_FI|IN|PL/SQL TABLE||Fill color|
|P_FS|IN|PL/SQL TABLE||Font sizes|
|P_AL|IN|PL/SQL TABLE||Text alignment|
|P_TC|IN|PL/SQL TABLE||Text colors|

## VERTICAL_LINE

Draw vertical line

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_X|IN|NUMBER||X coordinate|
|P_Y|IN|NUMBER||Y coordinate|
|P_HEIGHT|IN|NUMBER||Line height|
|P_LINE_WIDTH|IN|NUMBER||Stroke width|
|P_LINE_COLOR|IN|VARCHAR2||Line color|
|P_PAGE_PROC|IN|BINARY_INTEGER||Page procedure|

## WRITE_TXT

Write text with current position

| Argument name | In Out | Data type | Default value | Description |
| ------------- | ------ | --------- | ------------- | ----------- |
|P_TXT|IN|VARCHAR2||Text content|
|P_X|IN|NUMBER||X coordinate|
|P_Y|IN|NUMBER||Y coordinate|
|P_FONT_INDEX|IN|BINARY_INTEGER||Font index|
|P_FONTSIZE|IN|NUMBER||Font size|
|P_COLOR|IN|VARCHAR2||Text color|


