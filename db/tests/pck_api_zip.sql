DECLARE
  v_zip     BLOB;
  v_content BLOB;
  v_files   odbvue.pck_api_zip.t_file_list;
BEGIN
  v_zip := NULL;
  v_content := utl_raw.cast_to_raw('Hello from ZIP!');
  
  odbvue.pck_api_zip.add(v_zip, 'test.txt', v_content);
  
  v_files := odbvue.pck_api_zip.list(v_zip);
  DBMS_OUTPUT.PUT_LINE('Files in ZIP: ' || v_files.COUNT);
  DBMS_OUTPUT.PUT_LINE('File: ' || v_files(1));
  
  odbvue.pck_api_zip.extract(v_zip, 'test.txt', v_content);
  DBMS_OUTPUT.PUT_LINE('Content: ' || utl_raw.cast_to_varchar2(v_content));
END;
/
