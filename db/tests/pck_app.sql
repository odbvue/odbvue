DECLARE r_version varchar2(30 char);
BEGIN
    pck_app.get_context(r_version);
    dbms_output.put_line('Application version: ' || r_version);
END;
/
