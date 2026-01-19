-- Index: idx_app_users_created
DECLARE
  v_exists NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_exists FROM all_indexes WHERE owner = 'ODBVUE' AND index_name = 'IDX_APP_USERS_CREATED';
  IF v_exists = 0 THEN
    EXECUTE IMMEDIATE 'CREATE INDEX ODBVUE.idx_app_users_created ON ODBVUE.APP_USERS (CREATED)';
    DBMS_OUTPUT.PUT_LINE('Created index idx_app_users_created');
  ELSE
    DBMS_OUTPUT.PUT_LINE('Index idx_app_users_created already exists');
  END IF;
END;
/