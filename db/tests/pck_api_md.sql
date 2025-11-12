DECLARE
    c clob;
    b blob;
    h clob;
BEGIN
    pck_api_md.init(c);
    pck_api_md.h1(c, 'Title');
    pck_api_md.h2(c, 'Subtitle 1');
    pck_api_md.p(c, 'Paragraph with some text.');
    pck_api_md.li(c, 'item 1');
    pck_api_md.li(c, 'item 2');
    pck_api_md.lf(c);
    pck_api_md.h2(c, 'Subtitle 2');   
    pck_api_md.p(c, 'Another paragraph under subtitle 2.');   
    pck_api_md.link(c, 'Link text', 'https://odbvue.com');
    pck_api_md.md_table(
        c,
        '[{"col1":"abc","col2":"123"},{"col1":"def","col2":"456"}]',
        '{"col1":{"title":"Column 1"},"col2":{"title":"Column 2"}}' 
    );
    pck_api_md.image(c, 'https://wiki.odbvue.com/logo.svg', 'logo');
    pck_api_md.code_inline(c, 'inline code example');
    pck_api_md.code_block(c, 'SELECT * FROM dual;', 'sql');
    pck_api_md.h2(c, 'Subtitle 3');
    pck_api_md.quote(c, 'This is a ' || pck_api_md.b('blockquote') || ' example.');
    pck_api_md.note(c, 'This is a note.');

    dbms_output.put_line('');
    dbms_output.put_line('--- Generated MD ---');
    dbms_output.put_line(dbms_lob.substr(c, 32000, 1));

    dbms_output.put_line('');
    dbms_output.put_line('--- Converted to HTML ---');
    pck_api_md.to_html(c, h);
    dbms_output.put_line(dbms_lob.substr(h, 32000, 1));

    dbms_output.put_line('');
    dbms_output.put_line('--- Converted to PDF ---');
    pck_api_md.to_pdf(c, b);
    dbms_output.put_line('Size: ' || dbms_lob.getlength(b));
    dbms_output.put_line(pck_api_lob.blob_to_base64(b));

    pck_api_md.finalize(c);
END;
/
