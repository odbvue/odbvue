-- liquibase formatted sql
-- changeset ODBVUE:1762934391210 stripComments:false  logicalFilePath:featdb\odbvue\package_bodies\pck_api_md.sql
-- sqlcl_snapshot db/src/database/odbvue/package_bodies/pck_api_md.sql:null:4402a261f6dea8f77a6f66bc191f2ab9547d6977:create

CREATE OR REPLACE PACKAGE BODY odbvue.pck_api_md AS

  -- tiny helper to ensure we always have a CLOB to append to
    PROCEDURE ensure_init (
        p_md IN OUT NOCOPY CLOB
    ) IS
    BEGIN
        IF p_md IS NULL THEN
            p_md := empty_clob();
            dbms_lob.createtemporary(p_md, TRUE);
            dbms_lob.trim(p_md, 0);
        END IF;
    END;

    FUNCTION init RETURN CLOB IS
        l_doc CLOB;
    BEGIN
        dbms_lob.createtemporary(l_doc, TRUE);
        dbms_lob.trim(l_doc, 0);
        RETURN l_doc;
    END init;

    PROCEDURE init (
        p_md IN OUT NOCOPY CLOB
    ) IS
    BEGIN
        ensure_init(p_md);
    END init;

    PROCEDURE append (
        p_md   IN OUT NOCOPY CLOB,
        p_text IN VARCHAR2
    ) IS
    BEGIN
        ensure_init(p_md);
        IF p_text IS NOT NULL THEN
            dbms_lob.writeappend(p_md,
                                 length(p_text),
                                 p_text);
        END IF;

    END append;

    PROCEDURE append_line (
        p_md   IN OUT NOCOPY CLOB,
        p_text IN VARCHAR2 DEFAULT NULL
    ) IS
    BEGIN
        IF p_text IS NOT NULL THEN
            append(p_md,
                   p_text || chr(10));
        ELSE
            append(p_md,
                   chr(10));
        END IF;
    END append_line;

    PROCEDURE heading (
        p_md    IN OUT NOCOPY CLOB,
        p_level PLS_INTEGER,
        p_text  IN VARCHAR2
    ) IS
    BEGIN
        append_line(p_md,
                    rpad('#',
                         greatest(1,
                                  least(6, p_level)),
                         '#')
                    || ' '
                    || p_text);

        append_line(p_md);
    END heading;

    PROCEDURE h1 (
        p_md   IN OUT NOCOPY CLOB,
        p_text IN VARCHAR2
    ) IS
    BEGIN
        heading(p_md, 1, p_text);
    END;

    PROCEDURE h2 (
        p_md   IN OUT NOCOPY CLOB,
        p_text IN VARCHAR2
    ) IS
    BEGIN
        heading(p_md, 2, p_text);
    END;

    PROCEDURE h3 (
        p_md   IN OUT NOCOPY CLOB,
        p_text IN VARCHAR2
    ) IS
    BEGIN
        heading(p_md, 3, p_text);
    END;

    PROCEDURE h4 (
        p_md   IN OUT NOCOPY CLOB,
        p_text IN VARCHAR2
    ) IS
    BEGIN
        heading(p_md, 4, p_text);
    END;

    PROCEDURE h5 (
        p_md   IN OUT NOCOPY CLOB,
        p_text IN VARCHAR2
    ) IS
    BEGIN
        heading(p_md, 5, p_text);
    END;

    PROCEDURE h6 (
        p_md   IN OUT NOCOPY CLOB,
        p_text IN VARCHAR2
    ) IS
    BEGIN
        heading(p_md, 6, p_text);
    END;

    PROCEDURE p (
        p_md   IN OUT NOCOPY CLOB,
        p_text IN VARCHAR2
    ) IS
    BEGIN
        append_line(p_md, p_text);
        append_line(p_md);
    END p;

    PROCEDURE br (
        p_md IN OUT NOCOPY CLOB
    ) IS
    BEGIN
        append_line(p_md, '');
    END;

    PROCEDURE hr (
        p_md IN OUT NOCOPY CLOB
    ) IS
    BEGIN
        append_line(p_md, '---');
        append_line(p_md);
    END hr;

    PROCEDURE lf (
        p_md IN OUT NOCOPY CLOB
    ) IS
    BEGIN
        append_line(p_md);
    END lf;

    FUNCTION b (
        p_text IN VARCHAR2
    ) RETURN VARCHAR2 IS
    BEGIN
        RETURN '**'
               || nvl(p_text, '')
               || '**';
    END b;

    FUNCTION i (
        p_text IN VARCHAR2
    ) RETURN VARCHAR2 IS
    BEGIN
        RETURN '*'
               || nvl(p_text, '')
               || '*';
    END i;

    FUNCTION bi (
        p_text IN VARCHAR2
    ) RETURN VARCHAR2 IS
    BEGIN
        RETURN '***'
               || nvl(p_text, '')
               || '***';
    END bi;

    FUNCTION s (
        p_text IN VARCHAR2
    ) RETURN VARCHAR2 IS
    BEGIN
        RETURN '~~'
               || nvl(p_text, '')
               || '~~';
    END s;

    FUNCTION code (
        p_text IN VARCHAR2
    ) RETURN VARCHAR2 IS
    BEGIN
        RETURN '`'
               || replace(p_text, '`', '\\`')
               || '`';
    END code;

    PROCEDURE quote (
        p_md   IN OUT NOCOPY CLOB,
        p_text IN VARCHAR2
    ) IS
    BEGIN
        append_line(p_md, '> ' || p_text);
        append_line(p_md);
    END quote;

    PROCEDURE li (
        p_md   IN OUT NOCOPY CLOB,
        p_text IN VARCHAR2
    ) IS
    BEGIN
        append_line(p_md, '- ' || p_text);
    END li;

    PROCEDURE oli (
        p_md    IN OUT NOCOPY CLOB,
        p_index IN PLS_INTEGER,
        p_text  IN VARCHAR2
    ) IS
    BEGIN
        append_line(p_md,
                    to_char(nvl(p_index, 1))
                    || '. '
                    || p_text);
    END oli;

    PROCEDURE link (
        p_md   IN OUT NOCOPY CLOB,
        p_text IN VARCHAR2,
        p_url  IN VARCHAR2
    ) IS
    BEGIN
        append_line(p_md,
                    '['
                    || nvl(p_text, p_url)
                    || ']('
                    || p_url
                    || ')');

        append_line(p_md);
    END link;

    PROCEDURE image (
        p_md  IN OUT NOCOPY CLOB,
        p_url IN VARCHAR2,
        p_alt IN VARCHAR2 DEFAULT NULL
    ) IS
    BEGIN
        append_line(p_md,
                    '!['
                    || nvl(p_alt, '')
                    || ']('
                    || p_url
                    || ')');

        append_line(p_md);
    END image;

    PROCEDURE code_inline (
        p_md   IN OUT NOCOPY CLOB,
        p_text IN VARCHAR2
    ) IS
    BEGIN
        append_line(p_md,
                    '`'
                    || replace(p_text, '`', '\\`')
                    || '`');
    END code_inline;

    PROCEDURE code_block (
        p_md   IN OUT NOCOPY CLOB,
        p_text IN CLOB,
        p_lang IN VARCHAR2 DEFAULT NULL
    ) IS
        l_open VARCHAR2(100);
    BEGIN
        l_open := '```' || nvl(p_lang, '');
        append_line(p_md, l_open);
        IF p_text IS NOT NULL THEN
            append(p_md,
                   to_char(dbms_lob.substr(p_text,
                                           dbms_lob.getlength(p_text),
                                           1)));
        END IF;

        append_line(p_md);
        append_line(p_md, '```');
        append_line(p_md);
    END code_block;

-- admonitions
    PROCEDURE admonition (
        p_md   IN OUT NOCOPY CLOB,
        p_tag  IN VARCHAR2,
        p_text IN VARCHAR2
    ) IS
    BEGIN
        append_line(p_md,
                    '> [!'
                    || upper(p_tag)
                    || ']');
        append_line(p_md,
                    '> '
                    || p_text
                    || chr(10));
    END;

    PROCEDURE note (
        p_md   IN OUT NOCOPY CLOB,
        p_text IN VARCHAR2
    ) IS
    BEGIN
        admonition(p_md, 'NOTE', p_text);
    END;

    PROCEDURE tip (
        p_md   IN OUT NOCOPY CLOB,
        p_text IN VARCHAR2
    ) IS
    BEGIN
        admonition(p_md, 'TIP', p_text);
    END;

    PROCEDURE warning (
        p_md   IN OUT NOCOPY CLOB,
        p_text IN VARCHAR2
    ) IS
    BEGIN
        admonition(p_md, 'WARNING', p_text);
    END;

    PROCEDURE important (
        p_md   IN OUT NOCOPY CLOB,
        p_text IN VARCHAR2
    ) IS
    BEGIN
        admonition(p_md, 'IMPORTANT', p_text);
    END;

    PROCEDURE caution (
        p_md   IN OUT NOCOPY CLOB,
        p_text IN VARCHAR2
    ) IS
    BEGIN
        admonition(p_md, 'CAUTION', p_text);
    END;

    FUNCTION md_escape (
        p_text IN VARCHAR2
    ) RETURN VARCHAR2 IS
        l_txt VARCHAR2(32767) := p_text;
    BEGIN
        IF l_txt IS NULL THEN
            RETURN NULL;
        END IF;
        l_txt := replace(l_txt, '|', '\\|');
        l_txt := replace(l_txt, '\n', ' ');
        RETURN l_txt;
    END md_escape;

  -- Lenient parse for headings JSON: extract an object even if wrapped oddly
    FUNCTION coerce_headings_obj (
        p_headings_json IN CLOB
    ) RETURN json_object_t IS
        l_elem json_element_t;
        l_obj  json_object_t;
        l_arr  json_array_t;
    BEGIN
        IF p_headings_json IS NULL THEN
            RETURN NULL;
        END IF;
        l_elem := json_element_t.parse(p_headings_json);
        IF l_elem.is_object THEN
            RETURN treat(l_elem AS json_object_t);
        ELSIF l_elem.is_array THEN
            l_arr := treat(l_elem AS json_array_t);
            IF
                l_arr.get_size > 0
                AND l_arr.get(0).is_object
            THEN
                RETURN treat(l_arr.get(0) AS json_object_t);
            END IF;

        END IF;

        RETURN NULL;
    EXCEPTION
        WHEN OTHERS THEN
            RETURN NULL;
    END coerce_headings_obj;

    PROCEDURE md_table (
        p_md            IN OUT NOCOPY CLOB,
        p_rows_json     IN CLOB,
        p_headings_json IN CLOB DEFAULT NULL
    ) IS

        l_rows_elem json_element_t;
        l_rows      json_array_t;
        l_head_obj  json_object_t;
        l_first_obj json_object_t;
        l_keys      json_key_list;
        l_key       VARCHAR2(4000);
        l_header    VARCHAR2(32767);
        l_sep       VARCHAR2(32767);
        l_line      VARCHAR2(32767);
        i           PLS_INTEGER;
        j           PLS_INTEGER;
    BEGIN
        l_rows_elem := json_element_t.parse(p_rows_json);
        IF NOT l_rows_elem.is_array THEN
            raise_application_error(-20000, 'table(): p_rows_json must be a JSON array of objects');
        END IF;
        l_rows := treat(l_rows_elem AS json_array_t);
        IF l_rows.get_size = 0 THEN
            append_line(p_md, '| |');
            append_line(p_md, '|-|');
            RETURN;
        END IF;

    -- Determine columns from first row
        l_first_obj := treat(l_rows.get(0) AS json_object_t);
        l_keys := l_first_obj.get_keys;

    -- Headings map
        l_head_obj := coerce_headings_obj(p_headings_json);

    -- Build header line
        l_header := '|';
        l_sep := '|';
        FOR i IN 1..l_keys.count LOOP
            l_key := l_keys(i);
            IF
                l_head_obj IS NOT NULL
                AND l_head_obj.has(l_key)
            THEN
                DECLARE
                    l_colmeta json_object_t := l_head_obj.get_object(l_key);
                    l_title   VARCHAR2(4000);
                BEGIN
                    IF l_colmeta.has('title') THEN
                        l_title := l_colmeta.get_string('title');
                    END IF;

                    l_header := l_header
                                || ' '
                                || nvl(l_title, l_key)
                                || ' |';

                END;

            ELSE
                l_header := l_header
                            || ' '
                            || l_key
                            || ' |';
            END IF;

            l_sep := l_sep || '---|';
        END LOOP;

        append_line(p_md, l_header);
        append_line(p_md, l_sep);

    -- Rows
        FOR i IN 0..l_rows.get_size - 1 LOOP
            l_line := '|';
            l_first_obj := treat(l_rows.get(i) AS json_object_t);
            FOR j IN 1..l_keys.count LOOP
                l_key := l_keys(j);
                IF l_first_obj.has(l_key) THEN
                    IF l_first_obj.get(l_key).is_scalar THEN
                        l_line := l_line
                                  || ' '
                                  || md_escape(l_first_obj.get_string(l_key))
                                  || ' |';

                    ELSE
                        l_line := l_line
                                  || ' '
                                  || md_escape(l_first_obj.get(l_key).to_string)
                                  || ' |';
                    END IF;

                ELSE
                    l_line := l_line || '  |';
                END IF;

            END LOOP;

            append_line(p_md, l_line);
        END LOOP;

        append_line(p_md);
    EXCEPTION
        WHEN OTHERS THEN
            append_line(p_md, '> **Table build error:** ' || sqlerrm);
            append_line(p_md);
    END md_table;

    PROCEDURE finalize (
        p_md IN OUT NOCOPY CLOB
    ) IS
    BEGIN
        IF dbms_lob.istemporary(p_md) = 1 THEN
            dbms_lob.freetemporary(p_md);
        END IF;

        p_md := NULL;
    END finalize;

    PROCEDURE to_pdf (
        p_md      IN OUT NOCOPY CLOB,
        r_pdf     OUT BLOB,
        p_options IN CLOB DEFAULT NULL
    ) IS

        l_lines         dbms_sql.varchar2a;
        l_line          VARCHAR2(32767);
        l_pos           PLS_INTEGER := 1;
        l_len           PLS_INTEGER;
        l_idx           PLS_INTEGER := 0;
        l_y             NUMBER := 750;
        l_x             NUMBER := 50;
        l_margin_left   NUMBER := 50;
        l_margin_right  NUMBER := 50;
        l_page_width    NUMBER := 595; -- A4 width in points
        l_content_width NUMBER;
        l_line_height   NUMBER := 15;
        l_in_list       BOOLEAN := FALSE;
        l_list_indent   NUMBER := 20;
        l_in_code       BOOLEAN := FALSE;
        l_code_lines    CLOB;
        l_code_lang     VARCHAR2(100);
        l_opts          json_object_t;
        l_title         VARCHAR2(4000);
        l_author        VARCHAR2(4000);

  -- Helper: check if line starts with pattern
        FUNCTION starts_with (
            p_line   VARCHAR2,
            p_prefix VARCHAR2
        ) RETURN BOOLEAN IS
        BEGIN
            RETURN substr(
                ltrim(p_line),
                1,
                length(p_prefix)
            ) = p_prefix;
        END starts_with;

  -- Helper: get heading level
        FUNCTION get_heading_level (
            p_line VARCHAR2
        ) RETURN PLS_INTEGER IS
            l_trimmed VARCHAR2(32767) := ltrim(p_line);
        BEGIN
            FOR i IN 1..6 LOOP
                IF
                    substr(l_trimmed, 1, i) = rpad('#', i, '#')
                    AND substr(l_trimmed, i + 1, 1) = ' '
                THEN
                    RETURN i;
                END IF;
            END LOOP;

            RETURN 0;
        END get_heading_level;

  -- Helper: strip markdown formatting
        FUNCTION strip_md_format (
            p_text VARCHAR2
        ) RETURN VARCHAR2 IS
            l_text VARCHAR2(32767) := p_text;
        BEGIN
    -- Remove bold
            l_text := regexp_replace(l_text, '\*\*([^*]+)\*\*', '\1');
    -- Remove italic
            l_text := regexp_replace(l_text, '\*([^*]+)\*', '\1');
    -- Remove inline code
            l_text := regexp_replace(l_text, '`([^`]+)`', '\1');
    -- Remove links [text](url)
            l_text := regexp_replace(l_text, '\[([^\]]+)\]\([^)]+\)', '\1');
            RETURN l_text;
        END strip_md_format;

  -- Helper: check for new page
        PROCEDURE check_new_page (
            p_required_space NUMBER DEFAULT 50
        ) IS
        BEGIN
            IF l_y < ( 50 + p_required_space ) THEN
                pck_api_pdf.new_page();
                l_y := 750;
            END IF;
        END check_new_page;

  -- Helper: write heading
        PROCEDURE write_heading (
            p_level PLS_INTEGER,
            p_text  VARCHAR2
        ) IS
            l_font_size NUMBER;
        BEGIN
            check_new_page(40);
            CASE p_level
                WHEN 1 THEN
                    l_font_size := 24;
                WHEN 2 THEN
                    l_font_size := 20;
                WHEN 3 THEN
                    l_font_size := 16;
                WHEN 4 THEN
                    l_font_size := 14;
                WHEN 5 THEN
                    l_font_size := 12;
                ELSE
                    l_font_size := 11;
            END CASE;

            pck_api_pdf.set_font(
                p_family      => 'helvetica',
                p_style       => 'B',
                p_fontsize_pt => l_font_size
            );

            pck_api_pdf.put_txt(
                p_x        => l_margin_left,
                p_y        => l_y,
                p_txt      => p_text,
                p_fontsize => l_font_size,
                p_color    => '000000'
            );

            l_y := l_y - ( l_font_size * 1.5 );
        END write_heading;

  -- Helper: write paragraph
        PROCEDURE write_paragraph (
            p_text   VARCHAR2,
            p_indent NUMBER DEFAULT 0
        ) IS
        BEGIN
            IF p_text IS NULL
               OR TRIM(p_text) IS NULL THEN
                RETURN;
            END IF;
            check_new_page(30);
            pck_api_pdf.set_font(
                p_family      => 'helvetica',
                p_style       => 'N',
                p_fontsize_pt => 11
            );

            pck_api_pdf.multi_cell(
                p_txt        => strip_md_format(p_text),
                p_x          => l_margin_left + p_indent,
                p_y          => l_y,
                p_width      => l_content_width - p_indent,
                p_fontsize   => 11,
                p_txt_color  => '000000',
                p_line_color => NULL,
                p_line_width => 0
            );

            l_y := l_y - ( l_line_height * 2 );
        END write_paragraph;

  -- Helper: write code block
        PROCEDURE write_code_block (
            p_code CLOB,
            p_lang VARCHAR2
        ) IS
            l_code_text VARCHAR2(32767);
        BEGIN
            check_new_page(50);
            l_code_text := dbms_lob.substr(p_code, 4000, 1);
            pck_api_pdf.set_font(
                p_family      => 'courier',
                p_style       => 'N',
                p_fontsize_pt => 9
            );

            pck_api_pdf.multi_cell(
                p_txt        => l_code_text,
                p_x          => l_margin_left + 10,
                p_y          => l_y,
                p_width      => l_content_width - 20,
                p_fontsize   => 9,
                p_txt_color  => '000000',
                p_fill_color => 'F5F5F5',
                p_line_color => 'DDDDDD',
                p_line_width => 0.5
            );

            l_y := l_y - 25;
        END write_code_block;

  -- Helper: write horizontal rule
        PROCEDURE write_hr IS
        BEGIN
            check_new_page(10);
            pck_api_pdf.horizontal_line(
                p_x          => l_margin_left,
                p_y          => l_y,
                p_width      => l_content_width,
                p_line_width => 0.5,
                p_line_color => 'CCCCCC'
            );

            l_y := l_y - 15;
        END write_hr;

    BEGIN
  -- Parse options
        IF p_options IS NOT NULL THEN
            BEGIN
                l_opts := json_object_t.parse(p_options);
                IF l_opts.has('title') THEN
                    l_title := l_opts.get_string('title');
                END IF;

                IF l_opts.has('author') THEN
                    l_author := l_opts.get_string('author');
                END IF;

            EXCEPTION
                WHEN OTHERS THEN
                    NULL; -- Ignore invalid JSON options
            END;
        END IF;

  -- Calculate content width
        l_content_width := l_page_width - l_margin_left - l_margin_right;

  -- Initialize PDF
        pck_api_pdf.init();

  -- Set document info
        pck_api_pdf.set_info(
            p_title   => nvl(l_title, 'Markdown Document'),
            p_author  => nvl(l_author, 'Generated by pck_api_md'),
            p_subject => 'Markdown to PDF Conversion'
        );

  -- Create first page
        pck_api_pdf.new_page();

  -- Parse markdown line by line
        l_len := dbms_lob.getlength(p_md);
        WHILE l_pos <= l_len LOOP
    -- Read line
            l_idx := l_idx + 1;
            DECLARE
                l_eol_pos PLS_INTEGER;
                l_chunk   VARCHAR2(32767);
            BEGIN
                l_eol_pos := dbms_lob.instr(p_md,
                                            chr(10),
                                            l_pos);
                IF l_eol_pos = 0 THEN
        -- Last line
                    l_chunk := dbms_lob.substr(p_md, l_len - l_pos + 1, l_pos);
                    l_pos := l_len + 1;
                ELSE
                    l_chunk := dbms_lob.substr(p_md, l_eol_pos - l_pos, l_pos);
                    l_pos := l_eol_pos + 1;
                END IF;

                l_line := rtrim(l_chunk,
                                chr(13));
                l_lines(l_idx) := l_line;
            END;

        END LOOP;

  -- Process lines
        FOR i IN 1..l_lines.count LOOP
            l_line := l_lines(i);

    -- Handle code blocks
            IF starts_with(l_line, '```') THEN
                IF NOT l_in_code THEN
        -- Start code block
                    l_in_code := TRUE;
                    l_code_lang := ltrim(substr(
                        ltrim(l_line),
                        4
                    ));
                    dbms_lob.createtemporary(l_code_lines, TRUE);
                ELSE
        -- End code block
                    l_in_code := FALSE;
                    write_code_block(l_code_lines, l_code_lang);
                    IF dbms_lob.istemporary(l_code_lines) = 1 THEN
                        dbms_lob.freetemporary(l_code_lines);
                    END IF;

                    l_code_lines := NULL;
                END IF;

                CONTINUE;
            END IF;

    -- Accumulate code lines
            IF l_in_code THEN
                IF l_code_lines IS NULL THEN
                    dbms_lob.createtemporary(l_code_lines, TRUE);
                END IF;
                dbms_lob.writeappend(l_code_lines,
                                     length(l_line) + 1,
                                     l_line || chr(10));

                CONTINUE;
            END IF;

    -- Process headings
            DECLARE
                l_heading_level PLS_INTEGER;
                l_heading_text  VARCHAR2(32767);
            BEGIN
                l_heading_level := get_heading_level(l_line);
                IF l_heading_level > 0 THEN
                    l_heading_text := ltrim(substr(
                        ltrim(l_line),
                        l_heading_level + 2
                    ));
                    write_heading(l_heading_level, l_heading_text);
                    l_in_list := FALSE;
                    CONTINUE;
                END IF;

            END;

    -- Process horizontal rule
            IF starts_with(l_line, '---')
            OR starts_with(l_line, '***') THEN
                write_hr();
                l_in_list := FALSE;
                CONTINUE;
            END IF;

    -- Process list items
            IF starts_with(l_line, '- ')
            OR starts_with(l_line, '* ') THEN
                l_in_list := TRUE;
                write_paragraph(
                    substr(
                        ltrim(l_line),
                        3
                    ),
                    l_list_indent
                );
                l_y := l_y + l_line_height; -- Adjust spacing for lists
                CONTINUE;
            END IF;

    -- Process ordered list items
            IF regexp_like(l_line, '^\s*[0-9]+\.\s') THEN
                l_in_list := TRUE;
                write_paragraph(
                    regexp_replace(l_line, '^\s*[0-9]+\.\s+', ''),
                    l_list_indent
                );
                l_y := l_y + l_line_height;
                CONTINUE;
            END IF;

    -- Process blockquote
            IF starts_with(l_line, '> ') THEN
                check_new_page(30);
                pck_api_pdf.rect(
                    p_x          => l_margin_left - 5,
                    p_y          => l_y - 15,
                    p_width      => 3,
                    p_height     => 20,
                    p_fill_color => 'CCCCCC'
                );

                write_paragraph(
                    substr(
                        ltrim(l_line),
                        3
                    ),
                    10
                );
                CONTINUE;
            END IF;

    -- Empty line
            IF TRIM(l_line) IS NULL THEN
                IF l_in_list THEN
                    l_y := l_y - 5;
                    l_in_list := FALSE;
                ELSE
                    l_y := l_y - 10;
                END IF;

                CONTINUE;
            END IF;

    -- Regular paragraph
            l_in_list := FALSE;
            write_paragraph(l_line);
        END LOOP;

  -- Finish PDF
        r_pdf := pck_api_pdf.finish_pdf();
    EXCEPTION
        WHEN OTHERS THEN
    -- Cleanup on error
            IF
                l_code_lines IS NOT NULL
                AND dbms_lob.istemporary(l_code_lines) = 1
            THEN
                dbms_lob.freetemporary(l_code_lines);
            END IF;

            RAISE;
    END to_pdf;

    PROCEDURE to_html (
        p_md      IN OUT NOCOPY CLOB,
        r_html    OUT CLOB,
        p_options IN CLOB DEFAULT NULL
    ) IS

        l_lines     dbms_sql.varchar2a;
        l_line      VARCHAR2(32767);
        l_pos       PLS_INTEGER := 1;
        l_len       PLS_INTEGER;
        l_idx       PLS_INTEGER := 0;
        l_in_list   BOOLEAN := FALSE;
        l_in_ol     BOOLEAN := FALSE;
        l_in_code   BOOLEAN := FALSE;
        l_code_lang VARCHAR2(100);
        l_opts      json_object_t;
        l_title     VARCHAR2(4000);
        l_css       CLOB;
        l_html      CLOB;

  -- Helper: check if line starts with pattern
        FUNCTION starts_with (
            p_line   VARCHAR2,
            p_prefix VARCHAR2
        ) RETURN BOOLEAN IS
        BEGIN
            RETURN substr(
                ltrim(p_line),
                1,
                length(p_prefix)
            ) = p_prefix;
        END starts_with;

  -- Helper: get heading level
        FUNCTION get_heading_level (
            p_line VARCHAR2
        ) RETURN PLS_INTEGER IS
            l_trimmed VARCHAR2(32767) := ltrim(p_line);
        BEGIN
            FOR i IN 1..6 LOOP
                IF
                    substr(l_trimmed, 1, i) = rpad('#', i, '#')
                    AND substr(l_trimmed, i + 1, 1) = ' '
                THEN
                    RETURN i;
                END IF;
            END LOOP;

            RETURN 0;
        END get_heading_level;

  -- Helper: convert inline markdown formatting to HTML
        FUNCTION convert_inline_md (
            p_text VARCHAR2
        ) RETURN VARCHAR2 IS

            l_text VARCHAR2(32767) := p_text;
            l_lt   CONSTANT VARCHAR2(4) := chr(38)
                                         || 'lt;';   -- &lt;
            l_gt   CONSTANT VARCHAR2(4) := chr(38)
                                         || 'gt;';   -- &gt;
        BEGIN
    -- Bold+Italic ***text***
            l_text := regexp_replace(l_text, '\*\*\*([^*]+)\*\*\*', '<strong><em>\1</em></strong>');
    -- Bold **text**
            l_text := regexp_replace(l_text, '\*\*([^*]+)\*\*', '<strong>\1</strong>');
    -- Italic *text*
            l_text := regexp_replace(l_text, '\*([^*]+)\*', '<em>\1</em>');
    -- Strikethrough ~~text~~
            l_text := regexp_replace(l_text, '~~([^~]+)~~', '<del>\1</del>');
    -- Inline code `text`
            l_text := regexp_replace(l_text, '`([^`]+)`', '<code>\1</code>');
    -- Links [text](url)
            l_text := regexp_replace(l_text, '\[([^\]]+)\]\(([^)]+)\)', '<a href="\2">\1</a>');
    -- HTML escape
            l_text := replace(l_text, '<', l_lt);
            l_text := replace(l_text, '>', l_gt);
    -- Re-enable our generated HTML tags
            l_text := replace(l_text, l_lt
                                      || 'strong'
                                      || l_gt, '<strong>');
            l_text := replace(l_text, l_lt
                                      || '/strong'
                                      || l_gt, '</strong>');
            l_text := replace(l_text, l_lt
                                      || 'em'
                                      || l_gt, '<em>');
            l_text := replace(l_text, l_lt
                                      || '/em'
                                      || l_gt, '</em>');
            l_text := replace(l_text, l_lt
                                      || 'del'
                                      || l_gt, '<del>');
            l_text := replace(l_text, l_lt
                                      || '/del'
                                      || l_gt, '</del>');
            l_text := replace(l_text, l_lt
                                      || 'code'
                                      || l_gt, '<code>');
            l_text := replace(l_text, l_lt
                                      || '/code'
                                      || l_gt, '</code>');
            l_text := replace(l_text, l_lt || 'a href="', '<a href="');
            l_text := replace(l_text, '"' || l_gt, '">');
            l_text := replace(l_text, l_lt
                                      || '/a'
                                      || l_gt, '</a>');
            RETURN l_text;
        END convert_inline_md;

  -- Helper: escape HTML
        FUNCTION html_escape (
            p_text VARCHAR2
        ) RETURN VARCHAR2 IS

            l_text VARCHAR2(32767) := p_text;
            l_amp  CONSTANT VARCHAR2(5) := chr(38)
                                          || 'amp;';  -- &amp;
            l_lt   CONSTANT VARCHAR2(4) := chr(38)
                                         || 'lt;';   -- &lt;
            l_gt   CONSTANT VARCHAR2(4) := chr(38)
                                         || 'gt;';   -- &gt;
            l_quot CONSTANT VARCHAR2(6) := chr(38)
                                           || 'quot;'; -- &quot;
            l_apos CONSTANT VARCHAR2(5) := chr(38)
                                           || '#39;';  -- &#39;
        BEGIN
            l_text := replace(l_text,
                              chr(38),
                              l_amp);
            l_text := replace(l_text, '<', l_lt);
            l_text := replace(l_text, '>', l_gt);
            l_text := replace(l_text, '"', l_quot);
            l_text := replace(l_text, '''', l_apos);
            RETURN l_text;
        END html_escape;

  -- Helper: append to HTML
        PROCEDURE append_html (
            p_text VARCHAR2
        ) IS
        BEGIN
            dbms_lob.writeappend(l_html,
                                 length(p_text),
                                 p_text);
        END append_html;

  -- Helper: close open lists
        PROCEDURE close_lists IS
        BEGIN
            IF l_in_list THEN
                append_html('</ul>' || chr(10));
                l_in_list := FALSE;
            END IF;

            IF l_in_ol THEN
                append_html('</ol>' || chr(10));
                l_in_ol := FALSE;
            END IF;

        END close_lists;

    BEGIN
  -- Parse options
        IF p_options IS NOT NULL THEN
            BEGIN
                l_opts := json_object_t.parse(p_options);
                IF l_opts.has('title') THEN
                    l_title := l_opts.get_string('title');
                END IF;

                IF l_opts.has('css') THEN
                    l_css := l_opts.get_clob('css');
                END IF;

            EXCEPTION
                WHEN OTHERS THEN
                    NULL; -- Ignore invalid JSON options
            END;
        END IF;

  -- Initialize HTML output
        dbms_lob.createtemporary(l_html, TRUE);

  -- HTML header
        append_html('<!DOCTYPE html>' || chr(10));
        append_html('<html lang="en">' || chr(10));
        append_html('<head>' || chr(10));
        append_html('<meta charset="UTF-8">' || chr(10));
        append_html('<meta name="viewport" content="width=device-width, initial-scale=1.0">' || chr(10));
        append_html('<title>'
                    || html_escape(nvl(l_title, 'Markdown Document'))
                    || '</title>' || chr(10));

  -- Default CSS
        IF l_css IS NULL THEN
            append_html('<style>' || chr(10));
            append_html('body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #333; }' || chr
            (10));
            append_html('h1, h2, h3, h4, h5, h6 { margin-top: 24px; margin-bottom: 16px; font-weight: 600; line-height: 1.25; }' || chr
            (10));
            append_html('h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }' || chr(10));
            append_html('h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }' || chr(10));
            append_html('h3 { font-size: 1.25em; }' || chr(10));
            append_html('h4 { font-size: 1em; }' || chr(10));
            append_html('h5 { font-size: 0.875em; }' || chr(10));
            append_html('h6 { font-size: 0.85em; color: #6a737d; }' || chr(10));
            append_html('p { margin-bottom: 16px; }' || chr(10));
            append_html('code { background-color: rgba(27,31,35,0.05); padding: 0.2em 0.4em; border-radius: 3px; font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; font-size: 85%; }' || chr
            (10));
            append_html('pre { background-color: #f6f8fa; padding: 16px; border-radius: 6px; overflow: auto; }' || chr(10));
            append_html('pre code { background-color: transparent; padding: 0; }' || chr(10));
            append_html('blockquote { margin: 0; padding: 0 1em; color: #6a737d; border-left: 0.25em solid #dfe2e5; }' || chr(10));
            append_html('ul, ol { padding-left: 2em; margin-bottom: 16px; }' || chr(10));
            append_html('li { margin-bottom: 0.25em; }' || chr(10));
            append_html('table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }' || chr(10));
            append_html('table th, table td { padding: 6px 13px; border: 1px solid #dfe2e5; }' || chr(10));
            append_html('table th { font-weight: 600; background-color: #f6f8fa; }' || chr(10));
            append_html('table tr:nth-child(2n) { background-color: #f6f8fa; }' || chr(10));
            append_html('hr { height: 0.25em; padding: 0; margin: 24px 0; background-color: #e1e4e8; border: 0; }' || chr(10));
            append_html('img { max-width: 100%; }' || chr(10));
            append_html('a { color: #0366d6; text-decoration: none; }' || chr(10));
            append_html('a:hover { text-decoration: underline; }' || chr(10));
            append_html('.admonition { padding: 12px; margin-bottom: 16px; border-left: 4px solid; border-radius: 4px; }' || chr(10))
            ;
            append_html('.admonition-note { background-color: #e7f2fa; border-color: #0969da; }' || chr(10));
            append_html('.admonition-tip { background-color: #dafbe1; border-color: #1a7f37; }' || chr(10));
            append_html('.admonition-warning { background-color: #fff8c5; border-color: #9a6700; }' || chr(10));
            append_html('.admonition-important { background-color: #ddf4ff; border-color: #0969da; }' || chr(10));
            append_html('.admonition-caution { background-color: #ffebe9; border-color: #cf222e; }' || chr(10));
            append_html('</style>' || chr(10));
        ELSE
            append_html('<style>' || chr(10));
            append_html(dbms_lob.substr(l_css, 32000, 1));
            append_html('</style>' || chr(10));
        END IF;

        append_html('</head>' || chr(10));
        append_html('<body>' || chr(10));

  -- Parse markdown line by line
        l_len := dbms_lob.getlength(p_md);
        WHILE l_pos <= l_len LOOP
            l_idx := l_idx + 1;
            DECLARE
                l_eol_pos PLS_INTEGER;
                l_chunk   VARCHAR2(32767);
            BEGIN
                l_eol_pos := dbms_lob.instr(p_md,
                                            chr(10),
                                            l_pos);
                IF l_eol_pos = 0 THEN
                    l_chunk := dbms_lob.substr(p_md, l_len - l_pos + 1, l_pos);
                    l_pos := l_len + 1;
                ELSE
                    l_chunk := dbms_lob.substr(p_md, l_eol_pos - l_pos, l_pos);
                    l_pos := l_eol_pos + 1;
                END IF;

                l_line := rtrim(l_chunk,
                                chr(13));
                l_lines(l_idx) := l_line;
            END;

        END LOOP;

  -- Process lines
        FOR i IN 1..l_lines.count LOOP
            l_line := l_lines(i);

    -- Handle code blocks
            IF starts_with(l_line, '```') THEN
                IF NOT l_in_code THEN
                    close_lists();
                    l_in_code := TRUE;
                    l_code_lang := ltrim(substr(
                        ltrim(l_line),
                        4
                    ));
                    append_html('<pre><code');
                    IF l_code_lang IS NOT NULL THEN
                        append_html(' class="language-'
                                    || html_escape(l_code_lang) || '"');
                    END IF;

                    append_html('>');
                ELSE
                    l_in_code := FALSE;
                    append_html('</code></pre>' || chr(10));
                END IF;

                CONTINUE;
            END IF;

    -- Accumulate code lines
            IF l_in_code THEN
                append_html(html_escape(l_line) || chr(10));
                CONTINUE;
            END IF;

    -- Process headings
            DECLARE
                l_heading_level PLS_INTEGER;
                l_heading_text  VARCHAR2(32767);
            BEGIN
                l_heading_level := get_heading_level(l_line);
                IF l_heading_level > 0 THEN
                    close_lists();
                    l_heading_text := ltrim(substr(
                        ltrim(l_line),
                        l_heading_level + 2
                    ));
                    append_html('<h'
                                || l_heading_level
                                || '>'
                                || convert_inline_md(l_heading_text)
                                || '</h'
                                || l_heading_level
                                || '>' || chr(10));

                    CONTINUE;
                END IF;

            END;

    -- Process horizontal rule
            IF starts_with(l_line, '---')
            OR starts_with(l_line, '***') THEN
                close_lists();
                append_html('<hr>' || chr(10));
                CONTINUE;
            END IF;

    -- Process images
            IF regexp_like(l_line, '^\s*!\[.*\]\(.*\)') THEN
                close_lists();
                DECLARE
                    l_alt VARCHAR2(4000);
                    l_url VARCHAR2(4000);
                BEGIN
                    l_alt := regexp_substr(l_line, '!\[([^\]]*)\]', 1, 1, NULL,
                                           1);
                    l_url := regexp_substr(l_line, '\]\(([^)]+)\)', 1, 1, NULL,
                                           1);
                    append_html('<p><img src="'
                                || html_escape(l_url)
                                || '" alt="'
                                || html_escape(l_alt)
                                || '"></p>' || chr(10));

                END;

                CONTINUE;
            END IF;

    -- Process unordered list items
            IF starts_with(l_line, '- ')
            OR starts_with(l_line, '* ') THEN
                IF l_in_ol THEN
                    append_html('</ol>' || chr(10));
                    l_in_ol := FALSE;
                END IF;

                IF NOT l_in_list THEN
                    append_html('<ul>' || chr(10));
                    l_in_list := TRUE;
                END IF;

                append_html('<li>'
                            || convert_inline_md(substr(
                    ltrim(l_line),
                    3
                ))
                            || '</li>' || chr(10));

                CONTINUE;
            END IF;

    -- Process ordered list items
            IF regexp_like(l_line, '^\s*[0-9]+\.\s') THEN
                IF l_in_list THEN
                    append_html('</ul>' || chr(10));
                    l_in_list := FALSE;
                END IF;

                IF NOT l_in_ol THEN
                    append_html('<ol>' || chr(10));
                    l_in_ol := TRUE;
                END IF;

                append_html('<li>'
                            || convert_inline_md(regexp_replace(l_line, '^\s*[0-9]+\.\s+', ''))
                            || '</li>' || chr(10));

                CONTINUE;
            END IF;

    -- Process blockquote / admonitions
            IF starts_with(l_line, '> ') THEN
                DECLARE
                    l_quote_text VARCHAR2(32767) := substr(
                        ltrim(l_line),
                        3
                    );
                    l_admon_type VARCHAR2(100);
                BEGIN
        -- Check for admonition
                    IF regexp_like(l_quote_text, '^\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]') THEN
                        l_admon_type := regexp_substr(l_quote_text, '^\[!([A-Z]+)\]', 1, 1, NULL,
                                                      1);
                        close_lists();
                        append_html('<div class="admonition admonition-'
                                    || lower(l_admon_type) || '">');
                        append_html('<strong>'
                                    || initcap(l_admon_type) || ':</strong> ');
          -- Get next line with actual content
                        IF
                            i < l_lines.count
                            AND starts_with(
                                l_lines(i + 1),
                                '> '
                            )
                        THEN
                            l_quote_text := substr(
                                ltrim(l_lines(i + 1)),
                                3
                            );
                            append_html(convert_inline_md(l_quote_text));
                        END IF;

                        append_html('</div>' || chr(10));
                    ELSE
                        close_lists();
                        append_html('<blockquote>' || chr(10));
                        append_html('<p>'
                                    || convert_inline_md(l_quote_text)
                                    || '</p>' || chr(10));

                        append_html('</blockquote>' || chr(10));
                    END IF;
                END;

                CONTINUE;
            END IF;

    -- Empty line
            IF TRIM(l_line) IS NULL THEN
                close_lists();
                CONTINUE;
            END IF;

    -- Process table rows
            IF instr(l_line, '|') > 0 THEN
      -- This is a simplified table handler - full implementation would need state tracking
                close_lists();
                CONTINUE;
            END IF;

    -- Regular paragraph
            IF TRIM(l_line) IS NOT NULL THEN
                close_lists();
                append_html('<p>'
                            || convert_inline_md(l_line)
                            || '</p>' || chr(10));

            END IF;

        END LOOP;

  -- Close any remaining open lists
        close_lists();

  -- HTML footer
        append_html('</body>' || chr(10));
        append_html('</html>' || chr(10));

  -- Return result
        r_html := l_html;

  -- Cleanup
        IF dbms_lob.istemporary(l_html) = 1 THEN
            dbms_lob.freetemporary(l_html);
        END IF;

    EXCEPTION
        WHEN OTHERS THEN
            IF
                l_html IS NOT NULL
                AND dbms_lob.istemporary(l_html) = 1
            THEN
                dbms_lob.freetemporary(l_html);
            END IF;

            RAISE;
    END to_html;

END pck_api_md;
/

