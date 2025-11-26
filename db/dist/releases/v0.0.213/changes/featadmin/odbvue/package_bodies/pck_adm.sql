-- liquibase formatted sql
-- changeset ODBVUE:1764165348235 stripComments:false  logicalFilePath:featadmin\odbvue\package_bodies\pck_adm.sql
-- sqlcl_snapshot db/src/database/odbvue/package_bodies/pck_adm.sql:957e7ad0fb9026ec73294cd1524865e71d2d1eb4:96b09d9f914ad22df5281ba349957a016cba9a1e:alter

CREATE OR REPLACE PACKAGE BODY odbvue.pck_adm AS

    -- PUBLIC

    PROCEDURE get_audit (
        p_filter VARCHAR2 DEFAULT NULL,
        p_limit  PLS_INTEGER DEFAULT 10,
        p_offset PLS_INTEGER DEFAULT 0,
        r_audit  OUT SYS_REFCURSOR
    ) AS
        v_filter VARCHAR2(2000 CHAR) := utl_url.unescape(p_filter);
    BEGIN
        IF pck_api_auth.role(NULL, 'ADMIN') IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;

        OPEN r_audit FOR SELECT
                                            a.id                                        AS "id",
                                            a.severity                                  AS "severity",
                                            a.message                                   AS "message",
                                            u.username                                  AS "username",
                                            a.attributes                                AS "{}attributes",
                                            to_char(a.created, 'YYYY-MM-DD HH24:MI:SS') AS "created"
                                        FROM
                                            app_audit a
                                            LEFT JOIN app_users u ON a.uuid = u.uuid
                        WHERE
                                1 = 1
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
                        ORDER BY
                            a.created DESC
                        OFFSET p_offset ROWS FETCH NEXT p_limit ROWS ONLY;

    END get_audit;

END pck_adm;
/

