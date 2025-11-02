ALTER DATABASE DEFAULT EDITION = ORA$BASE;
/
 
DECLARE
  CURSOR c_editions IS
    SELECT edition_name
    FROM dba_editions
    WHERE edition_name != 'ORA$BASE'
    ORDER BY edition_name DESC;
BEGIN
  FOR r IN c_editions LOOP
    BEGIN
      DBMS_OUTPUT.PUT_LINE('Dropping edition: ' || r.edition_name);
      EXECUTE IMMEDIATE 'DROP EDITION ' || r.edition_name || ' CASCADE';
      DBMS_OUTPUT.PUT_LINE('  - Dropped successfully');
    EXCEPTION
      WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('  - Error: ' || SQLERRM);
    END;
  END LOOP;
  DBMS_OUTPUT.PUT_LINE('Done.');
END;
/