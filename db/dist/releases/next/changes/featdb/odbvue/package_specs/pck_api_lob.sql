-- liquibase formatted sql
-- changeset ODBVUE:1762266057921 stripComments:false  logicalFilePath:featdb\odbvue\package_specs\pck_api_lob.sql
-- sqlcl_snapshot db/src/database/odbvue/package_specs/pck_api_lob.sql:null:4c9043e7129da66e6895b07731028514d3ef8073:create

create or replace package odbvue.pck_api_lob as -- Package for LOB processing. Credit: https://github.com/paulzip-dev/Base64

    subtype boolean is pls_integer range 0..1;
    function clob_to_blob ( -- Function converts CLOB to BLOB
        p_clob             clob, -- CLOB
        p_charset_id       integer default dbms_lob.default_csid, -- Character set ID 
        p_error_on_warning boolean default 0 -- Raise exception on warning (0 - No, 1 - Yes)
    ) return blob; -- BLOB

    function blob_to_clob ( --  Function converts BLOB to CLOB
        p_blob             blob, -- BLOB
        p_charset_id       integer default dbms_lob.default_csid, -- Character set ID 
        p_error_on_warning boolean default 0 -- Raise exception on warning (0 - No, 1 - Yes)
    ) return clob; -- CLOB

    function blob_to_base64 ( -- Function encodes BLOB to BASE64
        p_blob    blob, -- BLOB
        p_newline boolean default 1 -- Split in chunks (0 - No, 1 - Yes) 
    ) return clob; -- CLOB

    function clob_to_base64 ( -- Function encodes CLOB to BASE64
        p_clob    clob, -- CLOB
        p_newline boolean default 1 -- Split in chunks (0 - No, 1 - Yes) 
    ) return clob; -- CLOB

    function varchar2_to_base64 ( -- Function encodes VARCHAR2 to BASE64
        p_varchar2 varchar2, -- VARCHAR2
        p_newline  boolean default 1 -- Split in chunks (0 - No, 1 - Yes) 
    ) return clob; -- CLOB

    function base64_to_blob ( -- Function decodes BASE64 to BLOB
        p_base64 clob -- BASE64
    ) return blob; -- BLOB

    function base64_to_clob ( -- Function decodes BASE64 to CLOB
        p_base64 clob -- BASE64
    ) return clob; -- CLOB

    function base64_to_varchar2 ( -- Function decodes BASE64 to VARCHAR2
        p_base64 clob -- BASE64
    ) return varchar2; -- VARCHAR2
end;
/

