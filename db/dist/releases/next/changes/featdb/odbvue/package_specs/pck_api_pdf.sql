-- liquibase formatted sql
-- changeset ODBVUE:1762927054511 stripComments:false  logicalFilePath:featdb\odbvue\package_specs\pck_api_pdf.sql
-- sqlcl_snapshot db/src/database/odbvue/package_specs/pck_api_pdf.sql:null:525c17d61bb28aae9e51c007e87a3ac942720cf8:create

CREATE OR REPLACE PACKAGE odbvue.pck_api_pdf -- Package for creating PDF documents, credits to https://github.com/antonscheffer/as_pdf
 IS
  --
    use_utl_file CONSTANT BOOLEAN := TRUE;
    use_dbms_crypto CONSTANT BOOLEAN := FALSE;
  --
-- declare
-- to do
-- signature
-- CFF font subsetting
-- tables
-- patterns, achtergrond kleur voor text? in table?
--
--https://github.com/lka/excel2zugferd
--https://forums.oracle.com/ords/apexds/post/generating-password-protected-pdf-document-usuing-as-pdf-mi-3107
--https://forums.oracle.com/ords/apexds/post/does-anyone-uses-pl-fpdf-1781
--https://github.com/py-pdf/fpdf2/tree/master/test
--https://github.com/typst/svg2pdf/tree/main/tests
--https://www.adobe.com/uk/acrobat/online/password-protect-pdf.html
--https://github.com/Valerio-Rossetti/Oracle/tree/main
--https://github.com/jtsoya539/as_pdf
--https://github.com/grlicaa/GEN_PDF
--https://www.pdf-online.com/osa/validate.aspx
--https://xodo.com/validate-pdfa
--https://demo.verapdf.org/
--select * from V$TEMPORARY_LOBS
--https://github.com/itext/itext-publications-examples-java/blob/develop/src/main/resources/pdfs/links2.pdf
--https://github.com/uswds/public-sans/tree/develop/fonts
--https://learn.microsoft.com/en-us/typography/opentype/spec/post
--https://github.com/xiayukun/font/blob/master/BAUHS93.TTF
--https://www.w3.org/WAI/WCAG21/Techniques/pdf/PDF6
--https://apex-de.blogspot.com/2024/10/zugferd-xrechnung-development-status.html
--https://www.pdflib.com/pdf-knowledge-base/zugferd-and-factur-x/
--https://publisher.bfo.com/live/help/#_factur_x
--https://www.ilovepdf.com/protect-pdf
--https://www.pdflib.com/pdf-knowledge-base/pdf-password-security/encryption/
--https://pomax.github.io/CFF-glyphlet-fonts/
--https://github.com/Pomax/the-cff-table
--https://github.com/Pomax/fontmetrics.js
--https://pdfa.org/resources/
--https://opentype.js.org/
--https://github.com/itext/itext-publications-examples-java/tree/develop/cmpfiles/sandbox/signatures/validation
--https://simonbengtsson.github.io/jsPDF-AutoTable/#minimal
--https://community.adobe.com/t5/acrobat-discussions/tagging-repeating-table-header/m-p/12094073
--https://github.com/foliojs/pdfkit/blob/master/lib/font/data/Courier.afm
--https://github.com/jboss/uel/blob/master/fonts/Times-Roman.pfb
--https://ctan.org/tex-archive/fonts/psfonts/bitstrea/courier
--  l_zip blob;
--  l_file_names as_zip.file_names;
  --
    c_get_cp_page_width CONSTANT PLS_INTEGER := 0;
    c_get_cp_page_height CONSTANT PLS_INTEGER := 1;
    c_get_cp_margin_top CONSTANT PLS_INTEGER := 2;
    c_get_cp_margin_right CONSTANT PLS_INTEGER := 3;
    c_get_cp_margin_bottom CONSTANT PLS_INTEGER := 4;
    c_get_cp_margin_left CONSTANT PLS_INTEGER := 5;
    c_get_pdf_page_width CONSTANT PLS_INTEGER := 6;
    c_get_pdf_page_height CONSTANT PLS_INTEGER := 7;
    c_get_pdf_margin_top CONSTANT PLS_INTEGER := 8;
    c_get_pdf_margin_right CONSTANT PLS_INTEGER := 9;
    c_get_pdf_margin_bottom CONSTANT PLS_INTEGER := 10;
    c_get_pdf_margin_left CONSTANT PLS_INTEGER := 11;
    c_get_x CONSTANT PLS_INTEGER := 12;
    c_get_y CONSTANT PLS_INTEGER := 13;
    c_get_fontsize CONSTANT PLS_INTEGER := 14;
    c_get_current_font CONSTANT PLS_INTEGER := 15;
    c_get_total_fonts CONSTANT PLS_INTEGER := 16;
    c_get_total_pages CONSTANT PLS_INTEGER := 17;
    c_get_current_page CONSTANT PLS_INTEGER := 18;
    c_get_font_name CONSTANT PLS_INTEGER := 30;
    c_get_font_style CONSTANT PLS_INTEGER := 31;
    c_get_font_family CONSTANT PLS_INTEGER := 32;
  --
    TYPE tp_numbers IS
        TABLE OF NUMBER;
    TYPE tp_varchar2s IS
        TABLE OF VARCHAR2(32767);
    TYPE tp_num_tab IS
        TABLE OF NUMBER INDEX BY PLS_INTEGER;
    TYPE tp_pls_tab IS
        TABLE OF PLS_INTEGER INDEX BY PLS_INTEGER;
    TYPE tp_txt_tab IS
        TABLE OF VARCHAR2(100) INDEX BY PLS_INTEGER;
  --
$IF dbms_db_version.ver_le_11
$THEN

    c_null_num_tab tp_num_tab;
    c_null_pls_tab tp_pls_tab;
    c_null_txt_tab tp_txt_tab;
$ELSIF dbms_db_version.ver_le_12
$THEN
  c_null_num_tab tp_num_tab;
  c_null_pls_tab tp_pls_tab;
  c_null_txt_tab tp_txt_tab;
$END
  --
    FUNCTION get ( -- Get PDF property value
        p_what PLS_INTEGER -- Property code
    ) RETURN NUMBER; -- Property value

    FUNCTION get_string ( -- Get PDF property string value
        p_what PLS_INTEGER, -- Property code
        p_idx  PLS_INTEGER := NULL -- Index
    ) RETURN VARCHAR2; -- String value

    FUNCTION get_font_index ( -- Get font index
        p_fontname VARCHAR2 := NULL, -- Font name
        p_family   VARCHAR2 := NULL, -- Font family
        p_style    VARCHAR2 := NULL -- Font style
    ) RETURN PLS_INTEGER; -- Font index

    PROCEDURE set_font ( -- Set font by index
        p_index       PLS_INTEGER, -- Font index
        p_fontsize_pt NUMBER := NULL -- Font size in pt
    );

    PROCEDURE set_font ( -- Set font by name
        p_fontname    VARCHAR2, -- Font name
        p_fontsize_pt NUMBER := NULL -- Font size in pt
    );

    PROCEDURE set_font ( -- Set font by family and style
        p_family      VARCHAR2, -- Font family
        p_style       VARCHAR2 := 'N', -- Font style (N/I/B/BI)
        p_fontsize_pt NUMBER := NULL -- Font size in pt
    );
  --
    FUNCTION str_len ( -- Calculate string length
        p_txt        VARCHAR2 CHARACTER SET any_cs, -- Text to measure
        p_font_index PLS_INTEGER := NULL, -- Font index
        p_fontsize   NUMBER := NULL -- Font size
    ) RETURN NUMBER; -- Text length
  --
    PROCEDURE put_txt ( -- Put text at position
        p_x                NUMBER, -- X coordinate
        p_y                NUMBER, -- Y coordinate
        p_txt              VARCHAR2 CHARACTER SET any_cs, -- Text content
        p_degrees_rotation NUMBER := NULL, -- Rotation in degrees
        p_font_index       PLS_INTEGER := NULL, -- Font index
        p_fontsize         NUMBER := NULL, -- Font size
        p_color            VARCHAR2 := NULL, -- Text color
        p_page_proc        PLS_INTEGER := NULL -- Page procedure
    );

    PROCEDURE write_txt ( -- Write text with current position
        p_txt        VARCHAR2 CHARACTER SET any_cs, -- Text content
        p_x          NUMBER := NULL, -- X coordinate
        p_y          NUMBER := NULL, -- Y coordinate
        p_font_index PLS_INTEGER := NULL, -- Font index
        p_fontsize   NUMBER := NULL, -- Font size
        p_color      VARCHAR2 := NULL -- Text color
    );

    PROCEDURE link ( -- Create hyperlink
        p_txt        VARCHAR2 CHARACTER SET any_cs, -- Link text
        p_url        VARCHAR2, -- URL
        p_x          NUMBER, -- X coordinate
        p_y          NUMBER, -- Y coordinate
        p_font_index PLS_INTEGER := NULL, -- Font index
        p_fontsize   NUMBER := NULL, -- Font size
        p_color      VARCHAR2 := NULL, -- Text color
        p_page_proc  PLS_INTEGER := NULL -- Page procedure
    );

    PROCEDURE multi_cell ( -- Write text in rectangle
        p_txt        VARCHAR2 CHARACTER SET any_cs, -- Text content
        p_x          NUMBER, -- X coordinate
        p_y          NUMBER, -- Y coordinate
        p_width      NUMBER := NULL, -- Cell width
        p_padding    NUMBER := NULL, -- Cell padding
        p_font_index PLS_INTEGER := NULL, -- Font index
        p_fontsize   NUMBER := NULL, -- Font size
        p_txt_color  VARCHAR2 := NULL, -- Text color
        p_fill_color VARCHAR2 := NULL, -- Fill color
        p_line_color VARCHAR2 := NULL, -- Line color
        p_align      VARCHAR2 := NULL, -- Text alignment
        p_line_width NUMBER := NULL, -- Line width
        p_url        VARCHAR2 := NULL, -- URL link
        p_page_proc  PLS_INTEGER := NULL -- Page procedure
    );

    PROCEDURE table_row ( -- Write table row
        p_txt        tp_varchar2s, -- Cell texts
        p_x          NUMBER, -- X coordinate
        p_y          NUMBER, -- Y coordinate
        p_widths     tp_numbers := NULL, -- Column widths
        p_padding    NUMBER := NULL, -- Cell padding
        p_font_index PLS_INTEGER := NULL, -- Font index
        p_fontsize   NUMBER := NULL, -- Font size
        p_align      VARCHAR2 := NULL, -- Text alignment
        p_txt_color  VARCHAR2 := NULL, -- Text color
        p_fill_color VARCHAR2 := NULL, -- Fill color
        p_line_color VARCHAR2 := NULL, -- Line color
        p_line_width NUMBER := NULL, -- Line width
$IF dbms_db_version.ver_le_11
$THEN

        p_fi         tp_pls_tab := c_null_pls_tab, -- Font indices
        p_fs         tp_num_tab := c_null_num_tab, -- Font sizes
        p_al         tp_txt_tab := c_null_txt_tab, -- Alignments
        p_tc         tp_txt_tab := c_null_txt_tab -- Text colors
$ELSIF dbms_db_version.ver_le_12
$THEN
    p_fi tp_pls_tab := c_null_pls_tab, -- Font indices
    p_fs tp_num_tab := c_null_num_tab, -- Font sizes
    p_al tp_txt_tab := c_null_txt_tab, -- Alignments
    p_tc tp_txt_tab := c_null_txt_tab -- Text colors
$ELSE
    p_fi tp_pls_tab := tp_pls_tab(), -- Font indices
    p_fs tp_num_tab := tp_num_tab(), -- Font sizes
    p_al tp_txt_tab := tp_txt_tab(), -- Alignments
    p_tc tp_txt_tab := tp_txt_tab() -- Text colors
$END
    );
  --
    PROCEDURE cursor2table ( -- Convert cursor to table
        p_rc            SYS_REFCURSOR, -- Result cursor
        p_x             NUMBER, -- X coordinate
        p_y             NUMBER, -- Y coordinate
        p_headers       tp_varchar2s := NULL, -- Column headers
        p_widths        tp_numbers := NULL, -- Column widths
        p_font_index    PLS_INTEGER := NULL, -- Font index
        p_fontsize      NUMBER := NULL, -- Font size
        p_txt_color     VARCHAR2 := NULL, -- Text color
        p_odd_color     VARCHAR2 := NULL, -- Odd row color
        p_even_color    VARCHAR2 := NULL, -- Even row color
        p_line_color    VARCHAR2 := NULL, -- Line color
        p_line_width    NUMBER := NULL, -- Line width
        p_header_fi     PLS_INTEGER := NULL, -- Header font index
        p_header_fs     NUMBER := NULL, -- Header font size
        p_header_txt_c  VARCHAR2 := NULL, -- Header text color
        p_header_color  VARCHAR2 := NULL, -- Header background color
        p_header_repeat BOOLEAN := TRUE, -- Repeat header on new page
$IF dbms_db_version.ver_le_11
$THEN

        p_fi            tp_pls_tab := c_null_pls_tab, -- Font indices
        p_fs            tp_num_tab := c_null_num_tab, -- Font sizes
        p_al            tp_txt_tab := c_null_txt_tab, -- Alignments
        p_fmt           tp_txt_tab := c_null_txt_tab -- Formats
$ELSIF dbms_db_version.ver_le_12
$THEN
    p_fi tp_pls_tab := c_null_pls_tab, -- Font indices
    p_fs tp_num_tab := c_null_num_tab, -- Font sizes
    p_al tp_txt_tab := c_null_txt_tab, -- Alignments
    p_fmt tp_txt_tab := c_null_txt_tab -- Formats
$ELSE
    p_fi tp_pls_tab := tp_pls_tab(), -- Font indices
    p_fs tp_num_tab := tp_num_tab(), -- Font sizes
    p_al tp_txt_tab := tp_txt_tab(), -- Alignments
    p_fmt tp_txt_tab := tp_txt_tab() -- Formats
$END
    );
  --
    PROCEDURE query2table ( -- Convert query result to table
        p_query         VARCHAR2, -- SQL query
        p_x             NUMBER, -- X coordinate
        p_y             NUMBER, -- Y coordinate
        p_headers       tp_varchar2s := NULL, -- Column headers
        p_widths        tp_numbers := NULL, -- Column widths
        p_font_index    PLS_INTEGER := NULL, -- Font index
        p_fontsize      NUMBER := NULL, -- Font size
        p_txt_color     VARCHAR2 := NULL, -- Text color
        p_odd_color     VARCHAR2 := NULL, -- Odd row color
        p_even_color    VARCHAR2 := NULL, -- Even row color
        p_line_color    VARCHAR2 := NULL, -- Line color
        p_line_width    NUMBER := NULL, -- Line width
        p_header_fi     PLS_INTEGER := NULL, -- Header font index
        p_header_fs     NUMBER := NULL, -- Header font size
        p_header_txt_c  VARCHAR2 := NULL, -- Header text color
        p_header_color  VARCHAR2 := NULL, -- Header background color
        p_header_repeat BOOLEAN := TRUE, -- Repeat header on new page
$IF dbms_db_version.ver_le_11
$THEN

        p_fi            tp_pls_tab := c_null_pls_tab, -- Font indices
        p_fs            tp_num_tab := c_null_num_tab, -- Font sizes
        p_al            tp_txt_tab := c_null_txt_tab, -- Alignments
        p_fmt           tp_txt_tab := c_null_txt_tab -- Formats
$ELSIF dbms_db_version.ver_le_12
$THEN
    p_fi tp_pls_tab := c_null_pls_tab, -- Font indices
    p_fs tp_num_tab := c_null_num_tab, -- Font sizes
    p_al tp_txt_tab := c_null_txt_tab, -- Alignments
    p_fmt tp_txt_tab := c_null_txt_tab -- Formats
$ELSE
    p_fi tp_pls_tab := tp_pls_tab(), -- Font indices
    p_fs tp_num_tab := tp_num_tab(), -- Font sizes
    p_al tp_txt_tab := tp_txt_tab(), -- Alignments
    p_fmt tp_txt_tab := tp_txt_tab() -- Formats
$END
    );
  --
    FUNCTION load_image ( -- Load image from blob
        p_img BLOB -- Image blob
    ) RETURN PLS_INTEGER; -- Image index

    FUNCTION load_image ( -- Load image from file
        p_dir       VARCHAR2, -- Directory name
        p_file_name VARCHAR2 -- File name
    ) RETURN PLS_INTEGER; -- Image index

    PROCEDURE put_image ( -- Put image by index
        p_img_idx   PLS_INTEGER, -- Image index
        p_x         NUMBER, -- X coordinate (left)
        p_y         NUMBER, -- Y coordinate (bottom)
        p_width     NUMBER := NULL, -- Width
        p_height    NUMBER := NULL, -- Height
        p_align     VARCHAR2 := NULL, -- Horizontal alignment
        p_valign    VARCHAR2 := NULL, -- Vertical alignment
        p_page_proc PLS_INTEGER := NULL -- Page procedure
    );

    PROCEDURE put_image ( -- Put image from blob
        p_img    BLOB, -- Image blob
        p_x      NUMBER, -- X coordinate (left)
        p_y      NUMBER, -- Y coordinate (bottom)
        p_width  NUMBER := NULL, -- Width
        p_height NUMBER := NULL, -- Height
        p_align  VARCHAR2 := NULL, -- Horizontal alignment
        p_valign VARCHAR2 := NULL -- Vertical alignment
    );

    PROCEDURE put_image ( -- Put image from file
        p_dir       VARCHAR2, -- Directory name
        p_file_name VARCHAR2, -- File name
        p_x         NUMBER, -- X coordinate (left)
        p_y         NUMBER, -- Y coordinate (bottom)
        p_width     NUMBER := NULL, -- Width
        p_height    NUMBER := NULL, -- Height
        p_align     VARCHAR2 := NULL, -- Horizontal alignment
        p_valign    VARCHAR2 := NULL -- Vertical alignment
    );
  --
    PROCEDURE add_embedded_file ( -- Add embedded file to PDF
        p_name    VARCHAR2, -- File name
        p_content BLOB, -- File content
        p_descr   VARCHAR2 := NULL, -- Description
        p_mime    VARCHAR2 := NULL, -- MIME type
        p_af_key  VARCHAR2 := NULL -- Attachement key
    );

    PROCEDURE set_info ( -- Set document information
        p_title    VARCHAR2 := NULL, -- Document title
        p_author   VARCHAR2 := NULL, -- Author
        p_subject  VARCHAR2 := NULL, -- Subject
        p_creator  VARCHAR2 := NULL, -- Creator
        p_keywords VARCHAR2 := NULL -- Keywords
    );

    PROCEDURE set_pdf_version ( -- Set PDF version
        p_version NUMBER := 1.4 -- PDF version
    );

    PROCEDURE set_pdfa3 ( -- Set PDF/A-3 conformance
        p_conformance                  VARCHAR2 := 'B', -- Conformance level (A/B/U)
        p_extra_meta_data_descriptions VARCHAR2 := NULL -- Extra metadata
    );

    PROCEDURE set_initial_zoom ( -- Set initial zoom level
        p_zoom_factor NUMBER := NULL -- Zoom factor
    );

    PROCEDURE set_line_height_factor ( -- Set line height factor
        p_factor NUMBER := 1 -- Height factor
    );

    PROCEDURE set_color ( -- Set text color (RGB hex)
        p_rgb VARCHAR2 := '000000' -- RGB hex or X11 color name
    );

    PROCEDURE set_color ( -- Set text color (RGB values)
        p_red   NUMBER := 0, -- Red component (0-255)
        p_green NUMBER := 0, -- Green component (0-255)
        p_blue  NUMBER := 0 -- Blue component (0-255)
    );

    PROCEDURE set_bk_color ( -- Set background color (RGB hex)
        p_rgb VARCHAR2 := 'ffffff' -- RGB hex or X11 color name
    );

    PROCEDURE set_bk_color ( -- Set background color (RGB values)
        p_red   NUMBER := 255, -- Red component (0-255)
        p_green NUMBER := 255, -- Green component (0-255)
        p_blue  NUMBER := 255 -- Blue component (0-255)
    );
  --
    PROCEDURE line ( -- Draw line
        p_x1         NUMBER, -- Start X
        p_y1         NUMBER, -- Start Y
        p_x2         NUMBER, -- End X
        p_y2         NUMBER, -- End Y
        p_line_width NUMBER := NULL, -- Line width
        p_line_color VARCHAR2 := NULL, -- Line color
        p_page_proc  PLS_INTEGER := NULL -- Page procedure
    );

    PROCEDURE horizontal_line ( -- Draw horizontal line
        p_x          NUMBER, -- X coordinate
        p_y          NUMBER, -- Y coordinate
        p_width      NUMBER, -- Line width
        p_line_width NUMBER := NULL, -- Stroke width
        p_line_color VARCHAR2 := NULL, -- Line color
        p_page_proc  PLS_INTEGER := NULL -- Page procedure
    );

    PROCEDURE vertical_line ( -- Draw vertical line
        p_x          NUMBER, -- X coordinate
        p_y          NUMBER, -- Y coordinate
        p_height     NUMBER, -- Line height
        p_line_width NUMBER := NULL, -- Stroke width
        p_line_color VARCHAR2 := NULL, -- Line color
        p_page_proc  PLS_INTEGER := NULL -- Page procedure
    );

    PROCEDURE rect ( -- Draw rectangle
        p_x          NUMBER, -- X coordinate
        p_y          NUMBER, -- Y coordinate
        p_width      NUMBER, -- Width
        p_height     NUMBER, -- Height
        p_line_color VARCHAR2 := NULL, -- Line color
        p_fill_color VARCHAR2 := NULL, -- Fill color
        p_line_width NUMBER := NULL, -- Line width
        p_page_proc  PLS_INTEGER := NULL -- Page procedure
    );

    PROCEDURE path ( -- Draw path
        p_steps      tp_numbers, -- Path steps
        p_line_width NUMBER := NULL, -- Line width
        p_line_color VARCHAR2 := NULL, -- Line color
        p_page_proc  PLS_INTEGER := NULL -- Page procedure
    );

    PROCEDURE bezier ( -- Draw Bezier curve
        p_x1         NUMBER, -- Start X
        p_y1         NUMBER, -- Start Y
        p_x2         NUMBER, -- Control X1
        p_y2         NUMBER, -- Control Y1
        p_x3         NUMBER, -- Control X2
        p_y3         NUMBER, -- Control Y2
        p_x4         NUMBER, -- End X
        p_y4         NUMBER, -- End Y
        p_line_width NUMBER := NULL, -- Line width
        p_line_color VARCHAR2 := NULL, -- Line color
        p_page_proc  PLS_INTEGER := NULL -- Page procedure
    );

    PROCEDURE bezier_v ( -- Draw Bezier curve variant V
        p_x1         NUMBER, -- Start X
        p_y1         NUMBER, -- Start Y
        p_x2         NUMBER, -- Control X1
        p_y2         NUMBER, -- Control Y1
        p_x3         NUMBER, -- Control X2
        p_y3         NUMBER, -- Control Y2
        p_line_width NUMBER := NULL, -- Line width
        p_line_color VARCHAR2 := NULL, -- Line color
        p_page_proc  PLS_INTEGER := NULL -- Page procedure
    );

    PROCEDURE bezier_y ( -- Draw Bezier curve variant Y
        p_x1         NUMBER, -- Start X
        p_y1         NUMBER, -- Start Y
        p_x2         NUMBER, -- Control X1
        p_y2         NUMBER, -- Control Y1
        p_x3         NUMBER, -- Control X2
        p_y3         NUMBER, -- Control Y2
        p_line_width NUMBER := NULL, -- Line width
        p_line_color VARCHAR2 := NULL, -- Line color
        p_page_proc  PLS_INTEGER := NULL -- Page procedure
    );

    PROCEDURE circle ( -- Draw circle
        p_x          NUMBER, -- Center X
        p_y          NUMBER, -- Center Y
        p_radius     NUMBER, -- Radius
        p_line_color VARCHAR2 := NULL, -- Line color
        p_fill_color VARCHAR2 := NULL, -- Fill color
        p_line_width NUMBER := NULL, -- Line width
        p_page_proc  PLS_INTEGER := NULL -- Page procedure
    );

    PROCEDURE ellips ( -- Draw ellipse
        p_x                NUMBER, -- Center X
        p_y                NUMBER, -- Center Y
        p_major_radius     NUMBER, -- Major radius
        p_minor_radius     NUMBER, -- Minor radius
        p_line_color       VARCHAR2 := NULL, -- Line color
        p_fill_color       VARCHAR2 := NULL, -- Fill color
        p_line_width       NUMBER := NULL, -- Line width
        p_degrees_rotation NUMBER := NULL, -- Rotation in degrees
        p_page_proc        PLS_INTEGER := NULL -- Page procedure
    );
  --
    FUNCTION load_font ( -- Load font from blob
        p_font  BLOB, -- Font blob
        p_embed BOOLEAN := TRUE -- Embed font in PDF
    ) RETURN PLS_INTEGER; -- Font index

    FUNCTION load_font ( -- Load font from file
        p_dir      VARCHAR2, -- Directory name
        p_filename VARCHAR2, -- File name
        p_embed    BOOLEAN := TRUE -- Embed font in PDF
    ) RETURN PLS_INTEGER; -- Font index

    PROCEDURE load_font ( -- Load font from blob (void)
        p_font  BLOB, -- Font blob
        p_embed BOOLEAN := TRUE -- Embed font in PDF
    );

    PROCEDURE load_font ( -- Load font from file (void)
        p_dir      VARCHAR2, -- Directory name
        p_filename VARCHAR2, -- File name
        p_embed    BOOLEAN := TRUE -- Embed font in PDF
    );

    FUNCTION conv2uu ( -- Convert value to user units
        p_value NUMBER, -- Value to convert
        p_unit  VARCHAR2 -- Unit (mm/cm/point/pt/inch/in/pica/p/pc)
    ) RETURN NUMBER; -- Converted value

    PROCEDURE set_page_format ( -- Set page format
        p_format VARCHAR2 := 'A4' -- Page format (A0-A10, etc)
    );

    PROCEDURE set_page_orientation ( -- Set page orientation
        p_orientation VARCHAR2 := 'PORTRAIT' -- Orientation (PORTRAIT/LANDSCAPE)
    );

    PROCEDURE set_page_size ( -- Set page size
        p_width  NUMBER, -- Page width
        p_height NUMBER, -- Page height
        p_unit   VARCHAR2 := 'cm' -- Unit
    );

    PROCEDURE new_page ( -- Create new page
        p_page_size        VARCHAR2 := NULL, -- Page size
        p_page_orientation VARCHAR2 := NULL, -- Orientation
        p_page_width       NUMBER := NULL, -- Page width
        p_page_height      NUMBER := NULL, -- Page height
        p_margin_left      NUMBER := NULL, -- Left margin
        p_margin_right     NUMBER := NULL, -- Right margin
        p_margin_top       NUMBER := NULL, -- Top margin
        p_margin_bottom    NUMBER := NULL, -- Bottom margin
        p_unit             VARCHAR2 := 'cm' -- Unit
    );

    PROCEDURE set_margins ( -- Set page margins
        p_top    NUMBER := NULL, -- Top margin
        p_left   NUMBER := NULL, -- Left margin
        p_bottom NUMBER := NULL, -- Bottom margin
        p_right  NUMBER := NULL, -- Right margin
        p_unit   VARCHAR2 := 'cm' -- Unit
    );

    PROCEDURE init_pdf ( -- Initialize PDF
        p_page_size        VARCHAR2 := NULL, -- Page size
        p_page_orientation VARCHAR2 := NULL, -- Orientation
        p_page_width       NUMBER := NULL, -- Page width
        p_page_height      NUMBER := NULL, -- Page height
        p_margin_left      NUMBER := NULL, -- Left margin
        p_margin_right     NUMBER := NULL, -- Right margin
        p_margin_top       NUMBER := NULL, -- Top margin
        p_margin_bottom    NUMBER := NULL, -- Bottom margin
        p_unit             VARCHAR2 := 'cm' -- Unit
    );

    PROCEDURE init; -- Initialize PDF generator

    FUNCTION finish_pdf ( -- Finish PDF and return blob
        p_password VARCHAR2 := NULL -- Optional password
    ) RETURN BLOB; -- PDF blob

    PROCEDURE save_pdf ( -- Save PDF to file
        p_dir      VARCHAR2, -- Directory name
        p_filename VARCHAR2, -- File name
        p_password VARCHAR2 := NULL -- Optional password
    );

END pck_api_pdf;
/

