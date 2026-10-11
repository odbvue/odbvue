CREATE OR REPLACE PACKAGE odb_emails AS
  PROCEDURE mail(
    p_address VARCHAR2, p_name VARCHAR2, p_subject VARCHAR2,
    p_content CLOB, p_priority PLS_INTEGER, p_id OUT VARCHAR2
  );
  PROCEDURE addr(p_id VARCHAR2, p_type VARCHAR2, p_address VARCHAR2, p_name VARCHAR2 DEFAULT NULL);
  PROCEDURE attc(p_id VARCHAR2, p_owner_id VARCHAR2, p_storage_id VARCHAR2);
  PROCEDURE send(p_id VARCHAR2, p_postpone PLS_INTEGER DEFAULT 300);
  PROCEDURE list(p_after VARCHAR2, p_limit PLS_INTEGER, p_items OUT SYS_REFCURSOR);
END;
/
