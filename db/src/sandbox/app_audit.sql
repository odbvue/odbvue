DROP TABLE app_audit PURGE;

CREATE TABLE app_audit (
    id CHAR(32 CHAR) DEFAULT LOWER(SYS_GUID()) NOT NULL,    
    severity VARCHAR2(30 CHAR) DEFAULT 'INFO' NOT NULL,
    message VARCHAR2(2000 CHAR) NOT NULL,
    attributes CLOB,
    created TIMESTAMP(6) DEFAULT SYSTIMESTAMP NOT NULL,
    uuid VARCHAR2(32 CHAR) GENERATED ALWAYS AS ( 
            JSON_VALUE(attributes FORMAT JSON, '$.uuid' RETURNING VARCHAR2(32) NULL ON ERROR) 
        ) VIRTUAL,
    module VARCHAR2(200 CHAR) GENERATED ALWAYS AS ( 
            JSON_VALUE(attributes FORMAT JSON, '$.module_name' RETURNING VARCHAR2(200) NULL ON ERROR) 
        ) VIRTUAL
);

COMMENT ON TABLE app_audit IS 'Stores audit log records.';
COMMENT ON COLUMN app_audit.id IS 'The unique identifier for the audit record.';
COMMENT ON COLUMN app_audit.severity IS 'The severity text of the audit record.';
COMMENT ON COLUMN app_audit.message IS 'The message content of the audit record.';
COMMENT ON COLUMN app_audit.attributes IS 'A JSON object containing additional attributes for the audit record.';
COMMENT ON COLUMN app_audit.created IS 'The timestamp when the audit record was created.';
COMMENT ON COLUMN app_audit.uuid IS 'A virtual column extracting the uuid from the attributes JSON object.';
COMMENT ON COLUMN app_audit.module IS 'A virtual column extracting the module_name from the attributes JSON object.';

ALTER TABLE app_audit ADD CONSTRAINT cpk_app_audit PRIMARY KEY (id);
ALTER TABLE app_audit ADD CONSTRAINT chk_app_audit_severity CHECK (severity IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'));
ALTER TABLE app_audit ADD CONSTRAINT chk_app_audit_attributes CHECK (attributes IS JSON);

CREATE INDEX idx_app_audit_created ON app_audit(created);
CREATE INDEX idx_app_audit_severity ON app_audit(severity);
CREATE INDEX idx_app_audit_uuid ON app_audit(uuid);
CREATE INDEX idx_app_audit_module ON app_audit(module);
/

DROP TABLE app_audit_archive PURGE;

CREATE TABLE app_audit_archive (
    id CHAR(32 CHAR) DEFAULT LOWER(SYS_GUID()) NOT NULL,    
    severity VARCHAR2(30 CHAR) DEFAULT 'INFO' NOT NULL,
    message VARCHAR2(2000 CHAR) NOT NULL,
    attributes CLOB,
    created TIMESTAMP(6) DEFAULT SYSTIMESTAMP NOT NULL,
    uuid VARCHAR2(32 CHAR) GENERATED ALWAYS AS ( 
            JSON_VALUE(attributes FORMAT JSON, '$.uuid' RETURNING VARCHAR2(32) NULL ON ERROR) 
        ) VIRTUAL,
    module VARCHAR2(200 CHAR) GENERATED ALWAYS AS ( 
            JSON_VALUE(attributes FORMAT JSON, '$.module_name' RETURNING VARCHAR2(200) NULL ON ERROR) 
        ) VIRTUAL
)
PARTITION BY RANGE (created)
INTERVAL (NUMTOYMINTERVAL(1, 'MONTH'))
(
    PARTITION p_start VALUES LESS THAN (TO_DATE('2025-01-01','YYYY-MM-DD'))
);

COMMENT ON TABLE app_audit_archive IS 'Stores archived audit log records.';
COMMENT ON COLUMN app_audit_archive.id IS 'The unique identifier for the audit record.';
COMMENT ON COLUMN app_audit_archive.severity IS 'The severity text of the audit record.';
COMMENT ON COLUMN app_audit_archive.message IS 'The message content of the audit record.';  
COMMENT ON COLUMN app_audit_archive.attributes IS 'A JSON object containing additional attributes for the audit record.';
COMMENT ON COLUMN app_audit_archive.created IS 'The timestamp when the audit record was created.';
COMMENT ON COLUMN app_audit_archive.uuid IS 'A virtual column extracting the uuid from the attributes JSON object.';
COMMENT ON COLUMN app_audit_archive.module IS 'A virtual column extracting the module_name from the attributes JSON object.';

ALTER TABLE app_audit_archive ADD CONSTRAINT cpk_app_audit_archive PRIMARY KEY (id);
ALTER TABLE app_audit_archive ADD CONSTRAINT chk_app_audit_archive_severity CHECK (severity IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'));
ALTER TABLE app_audit_archive ADD CONSTRAINT chk_app_audit_archive_attributes CHECK (attributes IS JSON);
/

CREATE OR REPLACE PACKAGE pck_api_audit AS -- Audit Package

    g_service_name    VARCHAR2(200);
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

    PROCEDURE debug( -- Log Debug Message
        p_message app_audit.message%TYPE, -- Message
        p_attributes app_audit.attributes%TYPE DEFAULT NULL -- Attributes
    );  

    PROCEDURE info( -- Log Info Message
        p_message app_audit.message%TYPE, -- Message
        p_attributes app_audit.attributes%TYPE DEFAULT NULL -- Attributes
    );

    PROCEDURE warn( -- Log Warn Message
        p_message app_audit.message%TYPE, -- Message
        p_attributes app_audit.attributes%TYPE DEFAULT NULL -- Attributes
    );

    PROCEDURE error( -- Log Error Message
        p_message app_audit.message%TYPE, -- Message
        p_attributes app_audit.attributes%TYPE DEFAULT NULL -- Attributes
    );

    PROCEDURE fatal( -- Log Fatal Message
        p_message app_audit.message%TYPE, -- Message
        p_attributes app_audit.attributes%TYPE DEFAULT NULL -- Attributes
    );

    PROCEDURE bulk( -- Bulk Log Messages
        p_data CLOB -- JSON Array of log entries [{severity, message, attributes, created}]
    );

    PROCEDURE archive( -- Archive Old Records
        p_older_than IN TIMESTAMP -- Archive records older than this timestamp
    );

END pck_api_audit;
/

CREATE OR REPLACE PACKAGE BODY pck_api_audit AS

    FUNCTION attributes (
        key1   IN VARCHAR2,
        value1 IN VARCHAR2,
        key2   IN VARCHAR2 DEFAULT NULL,
        value2 IN VARCHAR2 DEFAULT NULL,
        key3   IN VARCHAR2 DEFAULT NULL,
        value3 IN VARCHAR2 DEFAULT NULL,
        key4   IN VARCHAR2 DEFAULT NULL,
        value4 IN VARCHAR2 DEFAULT NULL,
        key5   IN VARCHAR2 DEFAULT NULL,
        value5 IN VARCHAR2 DEFAULT NULL,
        key6   IN VARCHAR2 DEFAULT NULL,
        value6 IN VARCHAR2 DEFAULT NULL
    ) RETURN CLOB AS
        v_json json_object_t := json_object_t();
    BEGIN
        v_json.put(key1, value1);
        IF key2 IS NOT NULL THEN
            v_json.put(key2, value2);
        END IF;
        IF key3 IS NOT NULL THEN
            v_json.put(key3, value3);
        END IF;
        IF key4 IS NOT NULL THEN
            v_json.put(key4, value4);
        END IF;
        IF key5 IS NOT NULL THEN
            v_json.put(key5, value5);
        END IF;
        IF key6 IS NOT NULL THEN
            v_json.put(key6, value6);
        END IF;
        RETURN v_json.to_clob();
    END attributes;

    PROCEDURE log(
        p_severity IN VARCHAR2,
        p_message IN app_audit.message%TYPE,
        p_attributes IN app_audit.attributes%TYPE DEFAULT NULL,
        p_created IN TIMESTAMP DEFAULT SYSTIMESTAMP
    ) AS
        v_request_method VARCHAR2(30 CHAR);
        v_request_uri VARCHAR2(2000 CHAR);
        v_agent VARCHAR2(2000 CHAR);
        v_ip VARCHAR2(200 CHAR);
        v_error_message VARCHAR2(2000 CHAR);
        v_error_backtrace VARCHAR2(2000 CHAR);
        v_attributes json_object_t := json_object_t.parse(COALESCE(p_attributes, '{}'));
        v_attributes_clob CLOB;
        PRAGMA autonomous_transaction;
    BEGIN

        BEGIN
            v_attributes.put('service_name', g_service_name);
            v_attributes.put('service_version', g_service_version);
        EXCEPTION
            WHEN OTHERS THEN
                NULL;
        END;

        BEGIN            
            v_request_method := TRIM(owa_util.get_cgi_env('REQUEST_METHOD'));
            v_request_uri := TRIM(owa_util.get_cgi_env('REQUEST_URI'));
            v_agent := TRIM(owa_util.get_cgi_env('HTTP_USER_AGENT'));
            v_ip := TRIM(owa_util.get_cgi_env('REMOTE_ADDR'));
        EXCEPTION
            WHEN OTHERS THEN
                NULL;
        END;

        IF v_request_method IS NOT NULL THEN
            v_attributes.put('request_method', v_request_method);
        END IF;
     
        IF v_request_uri IS NOT NULL THEN
            v_attributes.put('request_uri', v_request_uri);
            DECLARE
                v_module VARCHAR2(200 CHAR) := REGEXP_SUBSTR(v_request_uri, '[^/]+', 1, 3);
                v_method VARCHAR2(200 CHAR) := REGEXP_SUBSTR(v_request_uri, '[^/]+', 1, 4);
            BEGIN
                IF v_module IS NOT NULL THEN
                    v_attributes.put('module_name', v_module);
                END IF;
                IF v_method IS NOT NULL THEN
                    v_attributes.put('method_name', v_method);
                END IF;
            EXCEPTION
                WHEN OTHERS THEN
                    NULL;       
            END;
        END IF;

        IF v_agent IS NOT NULL THEN
            v_attributes.put('request_user_agent', v_agent);
        END IF;

        IF v_ip IS NOT NULL THEN
            v_attributes.put('request_client_ip', v_ip);
        END IF;

        BEGIN
            v_error_message := SUBSTR(SQLERRM, 1, 2000);
            v_error_backtrace := SUBSTR(dbms_utility.format_error_backtrace, 1, 2000);
            CASE WHEN SUBSTR(v_error_message, 1, 8) = 'ORA-0000' THEN
                v_error_message := NULL;
                v_error_backtrace := NULL;
            END CASE;
        EXCEPTION
            WHEN OTHERS THEN
                NULL;
        END;

        IF v_error_message IS NOT NULL THEN
            v_attributes.put('error_message', v_error_message);
        END IF;

        IF v_error_backtrace IS NOT NULL THEN
            v_attributes.put('error_stack', v_error_backtrace);
        END IF;

        v_attributes_clob := v_attributes.to_clob();

        INSERT INTO app_audit (
            severity,
            message,
            attributes,
            created
        ) VALUES (
            p_severity,
            p_message,
            v_attributes_clob,
            p_created
        );  

        COMMIT;

    END log;

    PROCEDURE debug(
        p_message app_audit.message%TYPE,
        p_attributes app_audit.attributes%TYPE DEFAULT NULL
    ) AS
    BEGIN
        log('DEBUG', p_message, p_attributes);
    END debug;  

    PROCEDURE info(
        p_message app_audit.message%TYPE,
        p_attributes app_audit.attributes%TYPE DEFAULT NULL
    ) AS
    BEGIN
        log('INFO', p_message, p_attributes);
    END info;

    PROCEDURE warn(
        p_message app_audit.message%TYPE,
        p_attributes app_audit.attributes%TYPE DEFAULT NULL
    ) AS
    BEGIN
        log('WARN', p_message, p_attributes);
    END warn;

    PROCEDURE error(
        p_message app_audit.message%TYPE,
        p_attributes app_audit.attributes%TYPE DEFAULT NULL
    ) AS
    BEGIN
        log('ERROR', p_message, p_attributes);
    END error;

    PROCEDURE fatal(
        p_message app_audit.message%TYPE,
        p_attributes app_audit.attributes%TYPE DEFAULT NULL
    ) AS
    BEGIN
        log('FATAL', p_message, p_attributes);
    END fatal;

    PROCEDURE bulk( 
        p_data CLOB 
    ) AS 
    BEGIN

        FOR rec IN (
            SELECT
                severity,
                message,
                attributes,
                created
            FROM JSON_TABLE(p_data, '$[*]'
                COLUMNS (
                    severity VARCHAR2(30 CHAR) PATH '$.severity',
                    message VARCHAR2(2000 CHAR) PATH '$.message',
                    attributes CLOB FORMAT JSON PATH '$.attributes',
                    created TIMESTAMP PATH '$.created'
                )
            )
        ) LOOP
            log(rec.severity, rec.message, rec.attributes, rec.created);
        END LOOP;

    END;

    PROCEDURE archive( 
        p_older_than IN TIMESTAMP 
    ) AS 
        PRAGMA autonomous_transaction;
    BEGIN
        INSERT INTO app_audit_archive (id, severity, message, attributes, created)
        SELECT id, severity, message, attributes, created
        FROM app_audit
        WHERE created < p_older_than;

        DELETE FROM app_audit
        WHERE created < p_older_than;

        COMMIT;

        DBMS_OUTPUT.PUT_LINE('Archived ' || SQL%ROWCOUNT || ' audit records older than ' || p_older_than || '.');
    END archive;        

BEGIN
    BEGIN
        WITH edition AS (
            SELECT
                sys_context('USERENV', 'CURRENT_EDITION_NAME') AS name
            FROM
                dual
        )
        SELECT
            lower(substr(name,
                         1,
                         instr(name, 'V_') - 2)),
            'v'
            || replace(
                substr(name,
                       instr(name, 'V_') + 2),
                '_',
                '.'
            )
        INTO
            g_service_name,
            g_service_version
        FROM
            edition;

    EXCEPTION
        WHEN OTHERS THEN
            g_service_name := 'unknown_service';
            g_service_version := 'unknown_version';
    END;

END pck_api_audit;
/

BEGIN
    pck_api_audit.info(
        p_message    => 'App Audit Package Deployed',
        p_attributes => pck_api_audit.attributes( -- key value pairs
            'uuid', LOWER(SYS_GUID()),
            'username', 'test'
        )
    );

END;
/

DECLARE
    c_data CLOB := '[
  {
    "severity": "INFO",
    "message": "Bulk Log Entry 1",
    "attributes": {
      "uuid": "433c66c3ccfe9b02e0630301590ac258",
      "username": "test1"
    },
    "created": "2023-10-01T12:00:00Z"
  },
  {
    "severity": "ERROR",
    "message": "Bulk Log Entry 2",
    "attributes": {
      "uuid": "fffc66c3ccfe9b02e0630301590ac258",
      "username": "test2"
    },
    "created": "2023-10-01T12:00:00Z"
  }
]';
BEGIN
    pck_api_audit.bulk(c_data);
END;
/

SELECT * FROM app_audit 
ORDER BY created DESC
FETCH FIRST 10 ROWS ONLY;
/

