DECLARE
    id app_storage.id%TYPE;
    b app_storage.content%TYPE;
    n app_storage.file_name%TYPE;
    s PLS_INTEGER;
    e VARCHAR2(100);
    m VARCHAR2(100);
BEGIN
    -- local
    b := utl_raw.cast_to_raw('Hello World!');
    n := 'hello.txt';
    pck_api_storage.upload(b, n, id);
    dbms_output.put_line('  uploaded file ID: ' || id);
    COMMIT;
    b := EMPTY_BLOB();
    pck_api_storage.download(id, b, n, s, e, m);
    dbms_output.put_line('  downloaded file name: ' || n);
    dbms_output.put_line('  downloaded file size: ' || s);
    dbms_output.put_line('  downloaded file extension: ' || e);
    dbms_output.put_line('  downloaded file mime type: ' || m);
    dbms_output.put_line('  -- ');
    dbms_output.put_line('  downloaded file actual size: ' || dbms_lob.getlength(b));

    -- s3
    -- pck_api_settings.write('APP_STORAGE_S3_URI', 'Storage URI for S3 files', 'https://objectstorage.<region>.oraclecloud.com/n/<namespace>/b/<bucket/o/');
    pck_api_settings.write('APP_STORAGE_S3_URI', 'Storage URI for S3 files', 'https://objectstorage.eu-stockholm-1.oraclecloud.com/n/axuctz2iko0g/b/odbvue-obj/o/');
    pck_api_storage.upload(b, n, id, TRUE);
    dbms_output.put_line('  uploaded file ID to S3: ' || id);
    COMMIT;
    b := EMPTY_BLOB();
    pck_api_storage.download(id, b, n, s, e, m);
    dbms_output.put_line('  downloaded file name from S3: ' || n);
    dbms_output.put_line('  downloaded file size from S3: ' || s);
    dbms_output.put_line('  downloaded file extension from S3: ' || e);
    dbms_output.put_line('  downloaded file mime type from S3: ' || m);
    dbms_output.put_line('  -- ');
    dbms_output.put_line('  downloaded file actual size from S3: ' || dbms_lob.getlength(b));
END;
/