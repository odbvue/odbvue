-- liquibase formatted sql
-- changeset ODBVUE:1762934391313 stripComments:false  logicalFilePath:featdb\odbvue\package_specs\pck_api_md.sql
-- sqlcl_snapshot db/src/database/odbvue/package_specs/pck_api_md.sql:null:4b8f20847b1f7b1ca8e6cdc8f8e450abeec381e7:create

CREATE OR REPLACE PACKAGE odbvue.pck_api_md AS -- Package for Markdown document generation and export to PDF and HTML

    FUNCTION init RETURN CLOB; -- Initialize new markdown document
    PROCEDURE init (
        p_md IN OUT NOCOPY CLOB
    ); -- Initialize markdown buffer

    PROCEDURE append ( -- Append text to markdown
        p_md   IN OUT NOCOPY CLOB, -- Markdown buffer
        p_text IN VARCHAR2 -- Text to append
    );

    PROCEDURE append_line ( -- Append line to markdown
        p_md   IN OUT NOCOPY CLOB, -- Markdown buffer
        p_text IN VARCHAR2 DEFAULT NULL -- Text line
    );

    PROCEDURE h1 (
        p_md   IN OUT NOCOPY CLOB,
        p_text IN VARCHAR2
    ); -- Add level 1 heading
    PROCEDURE h2 (
        p_md   IN OUT NOCOPY CLOB,
        p_text IN VARCHAR2
    ); -- Add level 2 heading
    PROCEDURE h3 (
        p_md   IN OUT NOCOPY CLOB,
        p_text IN VARCHAR2
    ); -- Add level 3 heading
    PROCEDURE h4 (
        p_md   IN OUT NOCOPY CLOB,
        p_text IN VARCHAR2
    ); -- Add level 4 heading
    PROCEDURE h5 (
        p_md   IN OUT NOCOPY CLOB,
        p_text IN VARCHAR2
    ); -- Add level 5 heading
    PROCEDURE h6 (
        p_md   IN OUT NOCOPY CLOB,
        p_text IN VARCHAR2
    ); -- Add level 6 heading

    PROCEDURE p ( -- Add paragraph
        p_md   IN OUT NOCOPY CLOB, -- Markdown buffer
        p_text IN VARCHAR2 -- Paragraph text
    );

    PROCEDURE br (
        p_md IN OUT NOCOPY CLOB
    ); -- Add line break
    PROCEDURE hr (
        p_md IN OUT NOCOPY CLOB
    ); -- Add horizontal rule
    PROCEDURE quote ( -- Add blockquote
        p_md   IN OUT NOCOPY CLOB, -- Markdown buffer
        p_text IN VARCHAR2 -- Quote text
    );

    PROCEDURE lf (
        p_md IN OUT NOCOPY CLOB
    ); -- Add line feed

    FUNCTION b (
        p_text IN VARCHAR2
    ) RETURN VARCHAR2; -- Bold text
    FUNCTION i (
        p_text IN VARCHAR2
    ) RETURN VARCHAR2; -- Italic text
    FUNCTION bi (
        p_text IN VARCHAR2
    ) RETURN VARCHAR2; -- Bold and italic text
    FUNCTION s (
        p_text IN VARCHAR2
    ) RETURN VARCHAR2; -- Strikethrough text
    FUNCTION code (
        p_text IN VARCHAR2
    ) RETURN VARCHAR2; -- Inline code

    PROCEDURE li ( -- Add unordered list item
        p_md   IN OUT NOCOPY CLOB, -- Markdown buffer
        p_text IN VARCHAR2 -- List item text
    );

    PROCEDURE oli ( -- Add ordered list item
        p_md    IN OUT NOCOPY CLOB, -- Markdown buffer
        p_index IN PLS_INTEGER, -- List item index
        p_text  IN VARCHAR2 -- List item text
    );

    PROCEDURE link ( -- Add hyperlink
        p_md   IN OUT NOCOPY CLOB, -- Markdown buffer
        p_text IN VARCHAR2, -- Link text
        p_url  IN VARCHAR2 -- Link URL
    );

    PROCEDURE image ( -- Add image
        p_md  IN OUT NOCOPY CLOB, -- Markdown buffer
        p_url IN VARCHAR2, -- Image URL
        p_alt IN VARCHAR2 DEFAULT NULL -- Alt text
    );

    PROCEDURE code_inline ( -- Add inline code
        p_md   IN OUT NOCOPY CLOB, -- Markdown buffer
        p_text IN VARCHAR2 -- Code text
    );

    PROCEDURE code_block ( -- Add code block
        p_md   IN OUT NOCOPY CLOB, -- Markdown buffer
        p_text IN CLOB, -- Code content
        p_lang IN VARCHAR2 DEFAULT NULL -- Language hint
    );

    PROCEDURE note ( -- Add note admonition
        p_md   IN OUT NOCOPY CLOB, -- Markdown buffer
        p_text IN VARCHAR2 -- Note text
    );

    PROCEDURE tip ( -- Add tip admonition
        p_md   IN OUT NOCOPY CLOB, -- Markdown buffer
        p_text IN VARCHAR2 -- Tip text
    );

    PROCEDURE warning ( -- Add warning admonition
        p_md   IN OUT NOCOPY CLOB, -- Markdown buffer
        p_text IN VARCHAR2 -- Warning text
    );

    PROCEDURE important ( -- Add important admonition
        p_md   IN OUT NOCOPY CLOB, -- Markdown buffer
        p_text IN VARCHAR2 -- Important text
    );

    PROCEDURE caution ( -- Add caution admonition
        p_md   IN OUT NOCOPY CLOB, -- Markdown buffer
        p_text IN VARCHAR2 -- Caution text
    );

    PROCEDURE md_table ( -- Add markdown table
        p_md            IN OUT NOCOPY CLOB, -- Markdown buffer
        p_rows_json     IN CLOB, -- JSON array of row objects
        p_headings_json IN CLOB DEFAULT NULL -- JSON column definitions
    );

    FUNCTION md_escape ( -- Escape text for table cells
        p_text IN VARCHAR2 -- Text to escape
    ) RETURN VARCHAR2; -- Escaped text

    PROCEDURE finalize ( -- Finalize markdown document
        p_md IN OUT NOCOPY CLOB -- Markdown buffer
    );

    PROCEDURE to_pdf ( -- Convert markdown to PDF (EXPERIMENTAL)
        p_md      IN OUT NOCOPY CLOB, -- Markdown buffer
        r_pdf     OUT BLOB, -- PDF output
        p_options IN CLOB DEFAULT NULL -- JSON options
    );

    PROCEDURE to_html ( -- Convert markdown to HTML (EXPERIMENTAL)
        p_md      IN OUT NOCOPY CLOB, -- Markdown buffer
        r_html    OUT CLOB, -- HTML output
        p_options IN CLOB DEFAULT NULL -- JSON options
    );

END pck_api_md;
/

