CREATE OR REPLACE PACKAGE BODY odbvue.pck_adm AS

    -- PUBLIC

    PROCEDURE get_audit (
        p_filter VARCHAR2 DEFAULT NULL,
        p_limit  PLS_INTEGER DEFAULT 10,
        p_offset PLS_INTEGER DEFAULT 0,
        r_audit  OUT SYS_REFCURSOR
    ) AS
        v_filter VARCHAR2(2000 CHAR) := utl_url.unescape(coalesce(p_filter, '{}'));
    BEGIN
        IF pck_api_auth.role(NULL, 'ADMIN') IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;

        OPEN r_audit FOR SELECT
                                            a.id                                        AS "id",
                                            a.severity                                  AS "severity",
                                            a.message                                   AS "message",
                                            a.module                                    AS "module",
                                            u.username                                  AS "username",
                                            a.attributes                                AS "{}attributes",
                                            to_char(a.created, 'YYYY-MM-DD HH24:MI:SS') AS "created"
                                        FROM
                                            app_audit a
                                            LEFT JOIN app_users u ON a.uuid = u.uuid
                        WHERE
                                1 = 1
            -- UUID filter
                            AND ( NOT JSON_EXISTS ( v_filter, '$.uuid' )
                                      OR EXISTS (
                                SELECT
                                    1
                                FROM
                                        JSON_TABLE ( JSON_QUERY(v_filter, '$.uuid'), '$[*]'
                                            COLUMNS (
                                                id VARCHAR2 ( 100 ) PATH '$'
                                            )
                                        )
                                    j
                                WHERE
                                    a.uuid = j.id
                            ) )
            -- Username filter
                            AND ( NOT JSON_EXISTS ( v_filter, '$.username' )
                                      OR EXISTS (
                                SELECT
                                    1
                                FROM
                                        JSON_TABLE ( JSON_QUERY(v_filter, '$.username'), '$[*]'
                                            COLUMNS (
                                                usr VARCHAR2 ( 100 ) PATH '$'
                                            )
                                        )
                                    j
                                WHERE
                                    u.username LIKE upper(j.usr)
                                                    || '%'
                            ) )
            -- Severity filter
                            AND ( NOT JSON_EXISTS ( v_filter, '$.severity' )
                                      OR EXISTS (
                                SELECT
                                    1
                                FROM
                                        JSON_TABLE ( JSON_QUERY(v_filter, '$.severity'), '$[*]'
                                            COLUMNS (
                                                sev VARCHAR2 ( 100 ) PATH '$'
                                            )
                                        )
                                    j
                                WHERE
                                    a.severity = j.sev
                            ) )
            -- Module filter
                            AND ( NOT JSON_EXISTS ( v_filter, '$.module' )
                                      OR EXISTS (
                                SELECT
                                    1
                                FROM
                                        JSON_TABLE ( JSON_QUERY(v_filter, '$.module'), '$[*]'
                                            COLUMNS (
                                                modl VARCHAR2 ( 100 ) PATH '$'
                                            )
                                        )
                                    j
                                WHERE
                                    a.module = j.modl
                            ) )
            -- Periofd from filter
                            AND ( NOT JSON_EXISTS ( v_filter, '$.period_from' )
                                      OR EXISTS (
                                SELECT
                                    1
                                FROM
                                        JSON_TABLE ( JSON_QUERY(v_filter, '$.period_from'), '$[*]'
                                            COLUMNS (
                                                val TIMESTAMP PATH '$'
                                            )
                                        )
                                    j
                                WHERE
                                    a.created >= j.val
                            ) )
            -- Period to filter
                            AND ( NOT JSON_EXISTS ( v_filter, '$.period_to' )
                                      OR EXISTS (
                                SELECT
                                    1
                                FROM
                                        JSON_TABLE ( JSON_QUERY(v_filter, '$.period_to'), '$[*]'
                                            COLUMNS (
                                                val TIMESTAMP PATH '$'
                                            )
                                        )
                                    j
                                WHERE
                                    a.created <= j.val
                            ) )
                        ORDER BY
                            a.created DESC
                        OFFSET p_offset ROWS FETCH NEXT p_limit ROWS ONLY;

    END get_audit;

    PROCEDURE get_users (
        p_search VARCHAR2 DEFAULT NULL,
        p_limit  PLS_INTEGER DEFAULT 10,
        p_offset PLS_INTEGER DEFAULT 0,
        r_users  OUT SYS_REFCURSOR
    ) AS
    BEGIN
        IF pck_api_auth.role(NULL, 'ADMIN') IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;

        OPEN r_users FOR SELECT
                                            u.uuid                                    AS "uuid",
                                            u.username                                AS "username",
                                            u.fullname                                AS "fullname",
                                            to_char(u.created, 'YYYY-MM-DD HH24:MI')  AS "created",
                                            to_char(u.accessed, 'YYYY-MM-DD HH24:MI') AS "accessed",
                                            u.status                                  AS "status",
                                            CASE u.status
                                                WHEN 'N' THEN
                                                    'Unverified'
                                                WHEN 'A' THEN
                                                    'Verified'
                                                WHEN 'D' THEN
                                                    'Suspended'
                                                ELSE
                                                    'Unknown'
                                            END                                       AS "status_text"
                                        FROM
                                            app_users u
                        WHERE
                                1 = 1
            -- Search by username
                            AND ( p_search IS NULL
                                  OR u.username LIKE upper(p_search)
                                                     || '%' )
            -- Search by UUID
                            OR ( p_search IS NULL
                                 OR u.uuid = p_search )
                        ORDER BY
                            u.username ASC
                        OFFSET p_offset ROWS FETCH NEXT p_limit ROWS ONLY;

    END get_users;

    PROCEDURE get_emails (
        p_filter VARCHAR2 DEFAULT NULL,
        p_limit  PLS_INTEGER DEFAULT 10,
        p_offset PLS_INTEGER DEFAULT 0,
        r_emails OUT SYS_REFCURSOR -- ref cursor for email records [{id, created, to_address, subject, status, message_id}]
    ) AS
        v_filter VARCHAR2(2000 CHAR) := utl_url.unescape(coalesce(p_filter, '{}'));
    BEGIN
        IF pck_api_auth.role(NULL, 'ADMIN') IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;

        OPEN r_emails FOR SELECT
                                              e.id                                     AS "id",
                                              to_char(e.created, 'YYYY-MM-DD HH24:MI') AS "created",
                                              (
                                                  SELECT
                                                      JSON_ARRAYAGG(addr_addr)
                                                  FROM
                                                      app_emails_addr a
                                                  WHERE
                                                          a.id_email = e.id
                                                      AND a.addr_type = 'To'
                                              )                                        AS "{}to",
                                              e.subject                                AS "subject",
                                              e.status                                 AS "status",
                                              e.error                                  AS "error"
                                          FROM
                                              app_emails e
                         WHERE
                                 1 = 1
            -- Status filter
                             AND ( NOT JSON_EXISTS ( v_filter, '$.status' )
                                       OR EXISTS (
                                 SELECT
                                     1
                                 FROM
                                         JSON_TABLE ( JSON_QUERY(v_filter, '$.status'), '$[*]'
                                             COLUMNS (
                                                 stat VARCHAR2 ( 100 ) PATH '$'
                                             )
                                         )
                                     j
                                 WHERE
                                     e.status = j.stat
                             ) )
            -- UUID filter
                             AND ( NOT JSON_EXISTS ( v_filter, '$.uuid' )
                                       OR EXISTS (
                                 SELECT
                                     1
                                 FROM
                                         JSON_TABLE ( JSON_QUERY(v_filter, '$.uuid'), '$[*]'
                                             COLUMNS (
                                                 uuid VARCHAR2 ( 100 ) PATH '$'
                                             )
                                         )
                                     j
                                 WHERE
                                     e.id IN (
                                         SELECT
                                             a.id_email
                                         FROM
                                             app_emails_addr a
                                         WHERE
                                                 a.addr_type = 'To'
                                             AND upper(a.addr_addr) IN (
                                                 SELECT
                                                     u.username
                                                 FROM
                                                     app_users u
                                                 WHERE
                                                     u.uuid = j.uuid
                                             )
                                     )
                             ) )
                         ORDER BY
                             e.created DESC
                         OFFSET p_offset ROWS FETCH NEXT p_limit ROWS ONLY;

    END get_emails;

END pck_adm;
/


-- sqlcl_snapshot {"hash":"235c40a6791ea22fc5bf6e555a5ae4cb23fd92fb","type":"PACKAGE_BODY","name":"PCK_ADM","schemaName":"ODBVUE","sxml":""}