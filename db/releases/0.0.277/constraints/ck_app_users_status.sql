-- Constraint: ck_app_users_status
DECLARE
  v_exists NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_exists FROM all_constraints WHERE owner = 'ODBVUE' AND constraint_name = 'CK_APP_USERS_STATUS';
  IF v_exists = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE ODBVUE.APP_USERS ADD CONSTRAINT ck_app_users_status CHECK (STATUS IN (''A'', ''D'', ''N''))';
    DBMS_OUTPUT.PUT_LINE('Created constraint ck_app_users_status');
  ELSE
    DBMS_OUTPUT.PUT_LINE('Constraint ck_app_users_status already exists');
  END IF;
END;
/