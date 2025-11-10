CREATE OR REPLACE PACKAGE odbvue.pck_api_audit AS -- Audit Package

    g_service_name VARCHAR2(200);
    g_service_version VARCHAR2(30);
    FUNCTION attributes ( -- Create JSON attributes
        key1   IN VARCHAR2, -- Key 1
        value1 IN VARCHAR2, -- Value 1
        key2   IN VARCHAR2 DEFAULT NULL, -- Key 2
        value2 IN VARCHAR2 DEFAULT NULL, -- Value 2
        key3   IN VARCHAR2 DEFAULT NULL, -- Key 3
        value3 IN VARCHAR2 DEFAULT NULL, -- Value 3
        key4   IN VARCHAR2 DEFAULT NULL, -- Key 4
        value4 IN VARCHAR2 DEFAULT NULL, -- Value 4
        key5   IN VARCHAR2 DEFAULT NULL, -- Key 5
        value5 IN VARCHAR2 DEFAULT NULL, -- Value 5
        key6   IN VARCHAR2 DEFAULT NULL, -- Key 6
        value6 IN VARCHAR2 DEFAULT NULL -- Value 6
    ) RETURN CLOB; -- JSON attributes

    PROCEDURE debug ( -- Log Debug Message
        p_message    app_audit.message%TYPE, -- Message
        p_attributes app_audit.attributes%TYPE DEFAULT NULL -- Attributes
    );

    PROCEDURE info ( -- Log Info Message
        p_message    app_audit.message%TYPE, -- Message
        p_attributes app_audit.attributes%TYPE DEFAULT NULL -- Attributes
    );

    PROCEDURE warn ( -- Log Warn Message
        p_message    app_audit.message%TYPE, -- Message
        p_attributes app_audit.attributes%TYPE DEFAULT NULL -- Attributes
    );

    PROCEDURE error ( -- Log Error Message
        p_message    app_audit.message%TYPE, -- Message
        p_attributes app_audit.attributes%TYPE DEFAULT NULL -- Attributes
    );

    PROCEDURE fatal ( -- Log Fatal Message
        p_message    app_audit.message%TYPE, -- Message
        p_attributes app_audit.attributes%TYPE DEFAULT NULL -- Attributes
    );

    PROCEDURE bulk ( -- Bulk Log Messages
        p_data CLOB -- JSON Array of log entries [{severity, message, attributes, created}]
    );

    PROCEDURE archive ( -- Archive Old Records
        p_older_than IN TIMESTAMP -- Archive records older than this timestamp
    );

END pck_api_audit;
/


-- sqlcl_snapshot {"hash":"86d42f453885726e38c4bc45b2ec70e2beca5378","type":"PACKAGE_SPEC","name":"PCK_API_AUDIT","schemaName":"ODBVUE","sxml":""}