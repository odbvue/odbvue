CREATE OR REPLACE PACKAGE BODY odbvue.pck_crm AS

    PROCEDURE get_requests (
        p_search   IN VARCHAR2 DEFAULT NULL,
        p_filter   IN VARCHAR2 DEFAULT NULL,
        p_offset   IN NUMBER DEFAULT NULL,
        p_limit    IN NUMBER DEFAULT NULL,
        r_requests OUT SYS_REFCURSOR
    ) AS

        v_filter VARCHAR2(2000 CHAR) := utl_url.unescape(coalesce(p_filter, '{}'));
        v_search VARCHAR2(2000 CHAR) := utl_url.unescape(coalesce(p_search, ''));
    BEGIN
        IF pck_api_auth.role(NULL, 'ADMIN') IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;

        OPEN r_requests FOR SELECT
                                                  id           AS "id",
                                                  name         AS "name",
                                                  organization AS "organization",
                                                  phone        AS "phone",
                                                  email        AS "email",
                                                  message      AS "message",
                                                  created      AS "created"
                                              FROM
                                                  crm_discovery_requests
                           WHERE
                               ( v_search IS NULL
                                 OR lower(name) LIKE '%'
                                 || lower(v_search)
                                 || '%'
                                    OR lower(organization) LIKE '%'
                                 || lower(v_search)
                                 || '%'
                                    OR lower(phone) LIKE '%'
                                 || lower(v_search)
                                 || '%'
                                    OR lower(email) LIKE '%'
                                                         || lower(v_search)
                                                         || '%' )
                           ORDER BY
                               created DESC
                           OFFSET p_offset ROWS FETCH NEXT p_limit ROWS ONLY;

    END get_requests;

    PROCEDURE post_request (
        p_name         IN VARCHAR2,
        p_organization IN VARCHAR2,
        p_phone        IN VARCHAR2,
        p_email        IN VARCHAR2,
        p_message      IN CLOB
    ) AS
    BEGIN
        IF ( p_name IS NULL
             OR p_email IS NULL ) THEN
            pck_api_auth.http(400, 'Name and Email are required fields.');
            RETURN;
        END IF;

        INSERT INTO crm_discovery_requests (
            name,
            organization,
            phone,
            email,
            message,
            created
        ) VALUES ( p_name,
                   p_organization,
                   p_phone,
                   p_email,
                   p_message,
                   systimestamp );

        COMMIT;
        pck_api_audit.info('CRM Discovery');
    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            pck_api_audit.error('CRM Discovery');
    END post_request;

END pck_crm;
/


-- sqlcl_snapshot {"hash":"970e9aabc605f4bbb7e176af8084589d4027dec9","type":"PACKAGE_BODY","name":"PCK_CRM","schemaName":"ODBVUE","sxml":""}