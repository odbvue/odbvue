DECLARE
  v_text  CLOB := 'Hello, World!';
  v_blob  BLOB;
  v_b64   CLOB;
  v_blob2 BLOB;
  v_text2 CLOB;
BEGIN
  v_blob  := odbvue.pck_api_lob.clob_to_blob(v_text);
  v_b64   := odbvue.pck_api_lob.blob_to_base64(v_blob, 0);
  v_blob2 := odbvue.pck_api_lob.base64_to_blob(v_b64);
  v_text2 := odbvue.pck_api_lob.blob_to_clob(v_blob2);
  
  DBMS_OUTPUT.PUT_LINE('Original: ' || v_text);
  DBMS_OUTPUT.PUT_LINE('Base64:   ' || SUBSTR(v_b64, 1, 50));
  DBMS_OUTPUT.PUT_LINE('Final:    ' || v_text2);
END;
/
