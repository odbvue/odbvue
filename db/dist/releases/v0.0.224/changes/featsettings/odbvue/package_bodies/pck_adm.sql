-- liquibase formatted sql
-- changeset ODBVUE:1764615774147 stripComments:false  logicalFilePath:featsettings\odbvue\package_bodies\pck_adm.sql
-- sqlcl_snapshot db/src/database/odbvue/package_bodies/pck_adm.sql:d458f55a64fad8f3415fe36b9c7d36983eb8cb2d:013e437a93172c3f5bcf584dbfdd8234ce0e7835:alter

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
        v_search VARCHAR2(2000 CHAR) := utl_url.unescape(coalesce(p_search, ''));
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
                            AND ( v_search IS NULL
                                  OR u.username LIKE upper(v_search)
                                                     || '%' )
            -- Search by UUID
                            OR ( v_search IS NULL
                                 OR u.uuid = v_search )
                        ORDER BY
                            u.username ASC
                        OFFSET p_offset ROWS FETCH NEXT p_limit ROWS ONLY;

    END get_users;

    PROCEDURE get_emails (
        p_filter VARCHAR2 DEFAULT NULL,
        p_limit  PLS_INTEGER DEFAULT 10,
        p_offset PLS_INTEGER DEFAULT 0,
        r_emails OUT SYS_REFCURSOR
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
                                                      LISTAGG(addr_addr, ', ') WITHIN GROUP(
                                                      ORDER BY
                                                          addr_addr
                                                      )
                                                  FROM
                                                      app_emails_addr a
                                                  WHERE
                                                          a.id_email = e.id
                                                      AND a.addr_type = 'To'
                                              )                                        AS "to",
                                              e.subject                                AS "subject",
                                              e.content                                AS "content",
                                              CASE e.status
                                                  WHEN 'E' THEN
                                                      'ERROR'
                                                  WHEN 'S' THEN
                                                      'SENT'
                                                  ELSE
                                                      'PENDING'
                                              END                                      AS "status",
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

    PROCEDURE get_jobs (
        p_search VARCHAR2 DEFAULT NULL,
        p_limit  PLS_INTEGER DEFAULT 10,
        p_offset PLS_INTEGER DEFAULT 0,
        r_jobs   OUT SYS_REFCURSOR
    ) AS
        v_search VARCHAR2(2000 CHAR) := utl_url.unescape(coalesce(p_search, ''));
    BEGIN
        IF pck_api_auth.role(NULL, 'ADMIN') IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;

        OPEN r_jobs FOR SELECT
                                          j.job_name                                        AS "name",
                                          (
                                              SELECT
                                                  LISTAGG(s.repeat_interval, ', ')
                                              FROM
                                                  user_scheduler_schedules s
                                              WHERE
                                                  s.schedule_name = j.schedule_name
                                          )                                                 AS "schedule",
                                          to_char(last_start_date, 'YYYY-MM-DD HH24:MI:SS') AS "started",
                                          to_char(last_run_duration)                        AS "duration",
                                          j.comments                                        AS "comments",
                                          j.enabled                                         AS "enabled"
                                      FROM
                                          user_scheduler_jobs j
                       WHERE
                               1 = 1
            -- Job name filter
                           AND ( v_search IS NULL
                                 OR j.job_name LIKE upper(v_search)
                                                    || '%' )
                       ORDER BY
                           j.job_name DESC
                       OFFSET p_offset ROWS FETCH NEXT p_limit ROWS ONLY;

    END get_jobs;

    PROCEDURE get_jobs_history (
        p_filter VARCHAR2 DEFAULT NULL,
        p_offset NUMBER DEFAULT 0,
        p_limit  NUMBER DEFAULT 10,
        r_items  OUT SYS_REFCURSOR
    ) AS
        v_filter VARCHAR2(2000 CHAR) := utl_url.unescape(coalesce(p_filter, '{}'));
    BEGIN
        IF pck_api_auth.role(NULL, 'ADMIN') IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;

        OPEN r_items FOR SELECT
                                            job_name                                            AS "name",
                                            to_char(actual_start_date, 'YYYY-MM-DD HH24:MI:SS') AS "started",
                                            to_char(run_duration)                               AS "duration",
                                            status                                              AS "status",
                                            TRIM(output
                                                 || ' ' || errors)                                   AS "output"
                                        FROM
                                            user_scheduler_job_run_details d
                        WHERE
                                1 = 1
        -- Job name filter
                            AND ( NOT JSON_EXISTS ( v_filter, '$.name' )
                                      OR EXISTS (
                                SELECT
                                    1
                                FROM
                                        JSON_TABLE ( JSON_QUERY(v_filter, '$.name'), '$[*]'
                                            COLUMNS (
                                                name VARCHAR2 ( 100 ) PATH '$'
                                            )
                                        )
                                    j
                                WHERE
                                    d.job_name = j.name
                            ) )
                        ORDER BY
                            actual_start_date DESC
                        OFFSET p_offset ROWS FETCH NEXT p_limit ROWS ONLY;

    END;

    PROCEDURE post_job_enable (
        p_name VARCHAR2
    ) AS
        v_uuid app_users.uuid%TYPE := pck_api_auth.uuid(NULL);
    BEGIN
        IF pck_api_auth.role(NULL, 'ADMIN') IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;

        pck_api_jobs.enable(upper(trim(replace(p_name, '_JOB', ''))));

        pck_api_audit.info('Job Enable',
                           pck_api_audit.attributes('name', p_name, 'uuid', v_uuid));

    EXCEPTION
        WHEN OTHERS THEN
            pck_api_audit.error('Job Enable',
                                pck_api_audit.attributes('name', p_name, 'uuid', v_uuid, 'error',
                                                         sqlerrm));
    END;

    PROCEDURE post_job_disable (
        p_name VARCHAR2
    ) AS
        v_uuid app_users.uuid%TYPE := pck_api_auth.uuid(NULL);
    BEGIN
        IF pck_api_auth.role(NULL, 'ADMIN') IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;

        pck_api_jobs.disable(upper(trim(replace(p_name, '_JOB', ''))));

        pck_api_audit.info('Job Disable',
                           pck_api_audit.attributes('name', p_name, 'uuid', v_uuid));

    EXCEPTION
        WHEN OTHERS THEN
            pck_api_audit.error('Job Disable',
                                pck_api_audit.attributes('name', p_name, 'uuid', v_uuid, 'error',
                                                         sqlerrm));
    END;

    PROCEDURE post_job_run (
        p_name VARCHAR2
    ) AS
        v_uuid app_users.uuid%TYPE := pck_api_auth.uuid(NULL);
    BEGIN
        IF pck_api_auth.role(NULL, 'ADMIN') IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;

        pck_api_jobs.run(upper(trim(replace(p_name, '_JOB', ''))));

        pck_api_audit.info('Job Run',
                           pck_api_audit.attributes('name', p_name, 'uuid', v_uuid));

    EXCEPTION
        WHEN OTHERS THEN
            pck_api_audit.error('Job Run',
                                pck_api_audit.attributes('name', p_name, 'uuid', v_uuid, 'error',
                                                         sqlerrm));
    END;

    PROCEDURE get_settings (
        p_search   VARCHAR2 DEFAULT NULL,
        p_limit    PLS_INTEGER DEFAULT 10,
        p_offset   PLS_INTEGER DEFAULT 0,
        r_settings OUT SYS_REFCURSOR
    ) AS
        v_search VARCHAR2(2000 CHAR) := utl_url.unescape(coalesce(p_search, ''));
    BEGIN
        IF pck_api_auth.role(NULL, 'ADMIN') IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;

        OPEN r_settings FOR SELECT
                                                  s.id      AS "id",
                                                  s.name    AS "name",
                                                  CASE
                                                      WHEN s.secret = 'Y' THEN
                                                          ''
                                                      ELSE
                                                          s.value
                                                  END       AS "value",
                                                  s.secret  AS "secret",
                                                  s.options AS "{}options"
                                              FROM
                                                  app_settings s
                           WHERE
                                   1 = 1
            -- Search by name or key
                               AND ( p_search IS NULL
                                     OR upper(s.name) LIKE '%'
                                     || upper(v_search)
                                     || '%'
                                        OR s.id LIKE '%'
                                                     || upper(v_search)
                                                     || '%' )
                           ORDER BY
                               s.id ASC
                           OFFSET p_offset ROWS FETCH NEXT p_limit ROWS ONLY;

    END get_settings;

    PROCEDURE post_setting (
        p_id     VARCHAR2,
        p_value  VARCHAR2,
        r_errors OUT SYS_REFCURSOR
    ) AS
        v_uuid app_users.uuid%TYPE := pck_api_auth.uuid(NULL);
    BEGIN
        IF pck_api_auth.role(NULL, 'ADMIN') IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;

        IF TRIM(p_value) IS NULL THEN
            OPEN r_errors FOR SELECT
                                  'value'    AS "name",
                                  'required' AS "message"
                              FROM
                                  dual;

            RETURN;
        END IF;

        UPDATE app_settings
        SET
            value =
                CASE
                    WHEN secret = 'Y' THEN
                        pck_api_settings.enc(p_value)
                    ELSE
                        p_value
                END
        WHERE
            id = p_id;

        COMMIT;
        pck_api_audit.info('Settings',
                           pck_api_audit.attributes('id', p_id, 'uuid', v_uuid));

    EXCEPTION
        WHEN OTHERS THEN
            pck_api_audit.error('Settings',
                                pck_api_audit.attributes('id', p_id, 'uuid', v_uuid));
    END post_setting;

END pck_adm;
/

