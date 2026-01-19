-- Index: idx_app_users_status
DECLARE
  v_exists NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_exists FROM all_indexes WHERE owner = 'ODBVUE' AND index_name = 'IDX_APP_USERS_STATUS';
  IF v_exists = 0 THEN
    EXECUTE IMMEDIATE 'CREATE INDEX ODBVUE.idx_app_users_status ON ODBVUE.APP_USERS (STATUS)';
    DBMS_OUTPUT.PUT_LINE('Created index idx_app_users_status');
  ELSE
    DBMS_OUTPUT.PUT_LINE('Index idx_app_users_status already exists');
  END IF;
END;
/