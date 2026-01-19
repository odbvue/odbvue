-- Constraint: uk_app_users_username
DECLARE
  v_exists NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_exists FROM all_constraints WHERE owner = 'ODBVUE' AND constraint_name = 'UK_APP_USERS_USERNAME';
  IF v_exists = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE ODBVUE.APP_USERS ADD CONSTRAINT uk_app_users_username UNIQUE (USERNAME)';
    DBMS_OUTPUT.PUT_LINE('Created constraint uk_app_users_username');
  ELSE
    DBMS_OUTPUT.PUT_LINE('Constraint uk_app_users_username already exists');
  END IF;
END;
/