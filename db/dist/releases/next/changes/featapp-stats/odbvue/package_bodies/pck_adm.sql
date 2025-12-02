-- liquibase formatted sql
-- changeset ODBVUE:1764677784663 stripComments:false  logicalFilePath:featapp-stats\odbvue\package_bodies\pck_adm.sql
-- sqlcl_snapshot db/src/database/odbvue/package_bodies/pck_adm.sql:013e437a93172c3f5bcf584dbfdd8234ce0e7835:17a6f8686b3f928923f14371054ec235b0be1318:alter

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

    PROCEDURE job_stats AS
        v_last_run TIMESTAMP;
    BEGIN
        SELECT
            MAX(period_start)
        INTO v_last_run
        FROM
            app_stats;

        IF v_last_run IS NULL THEN
            v_last_run := systimestamp - INTERVAL '11' YEAR;
        END IF;

    -- Audit Records

        MERGE INTO app_stats tgt
        USING (
            WITH hours ( hour_start ) AS (
                SELECT
                    trunc(systimestamp, 'HH24')
                FROM
                    dual
                UNION ALL
                SELECT
                    hour_start - INTERVAL '1' HOUR
                FROM
                    hours
                WHERE
                    hour_start - INTERVAL '1' HOUR >= v_last_run
            ), periods AS (
                SELECT
                    'H'                                                  AS period_type,
                    to_char(hour_start, 'YYYY-MM-DD HH24')
                    || ':00'                                             AS period_label,
                    hour_start                                           AS period_start,
                    hour_start + INTERVAL '1' HOUR - INTERVAL '1' SECOND AS period_end
                FROM
                    hours
            )
            SELECT
                p.period_type,
                p.period_label,
                p.period_start,
                p.period_end,
                'Events'    AS metric_name,
                COUNT(a.id) AS metric_value
            FROM
                periods   p
                LEFT JOIN app_audit a ON a.created BETWEEN p.period_start AND p.period_end
            GROUP BY
                p.period_type,
                p.period_label,
                p.period_start,
                p.period_end
        ) src ON ( tgt.period_type = src.period_type
                   AND tgt.period_label = src.period_label
                   AND tgt.metric_name = src.metric_name )
        WHEN MATCHED THEN UPDATE
        SET tgt.metric_value = src.metric_value
        WHEN NOT MATCHED THEN
        INSERT (
            period_type,
            period_label,
            period_start,
            period_end,
            metric_name,
            metric_value )
        VALUES
            ( src.period_type,
              src.period_label,
              src.period_start,
              src.period_end,
              src.metric_name,
              src.metric_value );

        COMMIT;

    -- Audit Records - ERRORS
        MERGE INTO app_stats tgt
        USING (
            WITH hours ( hour_start ) AS (
                SELECT
                    trunc(systimestamp, 'HH24')
                FROM
                    dual
                UNION ALL
                SELECT
                    hour_start - INTERVAL '1' HOUR
                FROM
                    hours
                WHERE
                    hour_start - INTERVAL '1' HOUR >= v_last_run
            ), periods AS (
                SELECT
                    'H'                                                  AS period_type,
                    to_char(hour_start, 'YYYY-MM-DD HH24')
                    || ':00'                                             AS period_label,
                    hour_start                                           AS period_start,
                    hour_start + INTERVAL '1' HOUR - INTERVAL '1' SECOND AS period_end
                FROM
                    hours
            )
            SELECT
                p.period_type,
                p.period_label,
                p.period_start,
                p.period_end,
                'Errors'    AS metric_name,
                COUNT(a.id) AS metric_value
            FROM
                periods   p
                LEFT JOIN app_audit a ON a.created BETWEEN p.period_start AND p.period_end
                                         AND a.severity = 'ERROR'
            GROUP BY
                p.period_type,
                p.period_label,
                p.period_start,
                p.period_end
        ) src ON ( tgt.period_type = src.period_type
                   AND tgt.period_label = src.period_label
                   AND tgt.metric_name = src.metric_name )
        WHEN MATCHED THEN UPDATE
        SET tgt.metric_value = src.metric_value
        WHEN NOT MATCHED THEN
        INSERT (
            period_type,
            period_label,
            period_start,
            period_end,
            metric_name,
            metric_value )
        VALUES
            ( src.period_type,
              src.period_label,
              src.period_start,
              src.period_end,
              src.metric_name,
              src.metric_value );

        COMMIT;

    -- Users
        MERGE INTO app_stats tgt
        USING (
            WITH hours ( hour_start ) AS (
                SELECT
                    trunc(systimestamp, 'HH24')
                FROM
                    dual
                UNION ALL
                SELECT
                    hour_start - INTERVAL '1' HOUR
                FROM
                    hours
                WHERE
                    hour_start - INTERVAL '1' HOUR >= v_last_run
            ), periods AS (
                SELECT
                    'H'                                                  AS period_type,
                    to_char(hour_start, 'YYYY-MM-DD HH24')
                    || ':00'                                             AS period_label,
                    hour_start                                           AS period_start,
                    hour_start + INTERVAL '1' HOUR - INTERVAL '1' SECOND AS period_end
                FROM
                    hours
            )
            SELECT
                p.period_type,
                p.period_label,
                p.period_start,
                p.period_end,
                'Users'       AS metric_name,
                COUNT(u.uuid) AS metric_value
            FROM
                periods   p
                LEFT JOIN app_users u ON u.created BETWEEN p.period_start AND p.period_end
            GROUP BY
                p.period_type,
                p.period_label,
                p.period_start,
                p.period_end
        ) src ON ( tgt.period_type = src.period_type
                   AND tgt.period_label = src.period_label
                   AND tgt.metric_name = src.metric_name )
        WHEN MATCHED THEN UPDATE
        SET tgt.metric_value = src.metric_value
        WHEN NOT MATCHED THEN
        INSERT (
            period_type,
            period_label,
            period_start,
            period_end,
            metric_name,
            metric_value )
        VALUES
            ( src.period_type,
              src.period_label,
              src.period_start,
              src.period_end,
              src.metric_name,
              src.metric_value );

        COMMIT;

    -- Emails
        MERGE INTO app_stats tgt
        USING (
            WITH hours ( hour_start ) AS (
                SELECT
                    trunc(systimestamp, 'HH24')
                FROM
                    dual
                UNION ALL
                SELECT
                    hour_start - INTERVAL '1' HOUR
                FROM
                    hours
                WHERE
                    hour_start - INTERVAL '1' HOUR >= v_last_run
            ), periods AS (
                SELECT
                    'H'                                                  AS period_type,
                    to_char(hour_start, 'YYYY-MM-DD HH24')
                    || ':00'                                             AS period_label,
                    hour_start                                           AS period_start,
                    hour_start + INTERVAL '1' HOUR - INTERVAL '1' SECOND AS period_end
                FROM
                    hours
            )
            SELECT
                p.period_type,
                p.period_label,
                p.period_start,
                p.period_end,
                'Emails'    AS metric_name,
                COUNT(e.id) AS metric_value
            FROM
                periods    p
                LEFT JOIN app_emails e ON e.created BETWEEN p.period_start AND p.period_end
            GROUP BY
                p.period_type,
                p.period_label,
                p.period_start,
                p.period_end
        ) src ON ( tgt.period_type = src.period_type
                   AND tgt.period_label = src.period_label
                   AND tgt.metric_name = src.metric_name )
        WHEN MATCHED THEN UPDATE
        SET tgt.metric_value = src.metric_value
        WHEN NOT MATCHED THEN
        INSERT (
            period_type,
            period_label,
            period_start,
            period_end,
            metric_name,
            metric_value )
        VALUES
            ( src.period_type,
              src.period_label,
              src.period_start,
              src.period_end,
              src.metric_name,
              src.metric_value );

        COMMIT;

    -- Failed emails
        MERGE INTO app_stats tgt
        USING (
            WITH hours ( hour_start ) AS (
                SELECT
                    trunc(systimestamp, 'HH24')
                FROM
                    dual
                UNION ALL
                SELECT
                    hour_start - INTERVAL '1' HOUR
                FROM
                    hours
                WHERE
                    hour_start - INTERVAL '1' HOUR >= v_last_run
            ), periods AS (
                SELECT
                    'H'                                                  AS period_type,
                    to_char(hour_start, 'YYYY-MM-DD HH24')
                    || ':00'                                             AS period_label,
                    hour_start                                           AS period_start,
                    hour_start + INTERVAL '1' HOUR - INTERVAL '1' SECOND AS period_end
                FROM
                    hours
            )
            SELECT
                p.period_type,
                p.period_label,
                p.period_start,
                p.period_end,
                'Failed Emails' AS metric_name,
                COUNT(e.id)     AS metric_value
            FROM
                periods    p
                LEFT JOIN app_emails e ON e.created BETWEEN p.period_start AND p.period_end
                                          AND e.status = 'E'
            GROUP BY
                p.period_type,
                p.period_label,
                p.period_start,
                p.period_end
        ) src ON ( tgt.period_type = src.period_type
                   AND tgt.period_label = src.period_label
                   AND tgt.metric_name = src.metric_name )
        WHEN MATCHED THEN UPDATE
        SET tgt.metric_value = src.metric_value
        WHEN NOT MATCHED THEN
        INSERT (
            period_type,
            period_label,
            period_start,
            period_end,
            metric_name,
            metric_value )
        VALUES
            ( src.period_type,
              src.period_label,
              src.period_start,
              src.period_end,
              src.metric_name,
              src.metric_value );

        COMMIT;

    -- Storage
        MERGE INTO app_stats tgt
        USING (
            WITH hours ( hour_start ) AS (
                SELECT
                    trunc(systimestamp, 'HH24')
                FROM
                    dual
                UNION ALL
                SELECT
                    hour_start - INTERVAL '1' HOUR
                FROM
                    hours
                WHERE
                    hour_start - INTERVAL '1' HOUR >= v_last_run
            ), periods AS (
                SELECT
                    'H'                                                  AS period_type,
                    to_char(hour_start, 'YYYY-MM-DD HH24')
                    || ':00'                                             AS period_label,
                    hour_start                                           AS period_start,
                    hour_start + INTERVAL '1' HOUR - INTERVAL '1' SECOND AS period_end
                FROM
                    hours
            )
            SELECT
                p.period_type,
                p.period_label,
                p.period_start,
                p.period_end,
                'Storage'   AS metric_name,
                COUNT(s.id) AS metric_value
            FROM
                periods     p
                LEFT JOIN app_storage s ON s.created BETWEEN p.period_start AND p.period_end
            GROUP BY
                p.period_type,
                p.period_label,
                p.period_start,
                p.period_end
        ) src ON ( tgt.period_type = src.period_type
                   AND tgt.period_label = src.period_label
                   AND tgt.metric_name = src.metric_name )
        WHEN MATCHED THEN UPDATE
        SET tgt.metric_value = src.metric_value
        WHEN NOT MATCHED THEN
        INSERT (
            period_type,
            period_label,
            period_start,
            period_end,
            metric_name,
            metric_value )
        VALUES
            ( src.period_type,
              src.period_label,
              src.period_start,
              src.period_end,
              src.metric_name,
              src.metric_value );

        COMMIT;

    -- Jobs
        MERGE INTO app_stats tgt
        USING (
            WITH hours ( hour_start ) AS (
                SELECT
                    trunc(systimestamp, 'HH24')
                FROM
                    dual
                UNION ALL
                SELECT
                    hour_start - INTERVAL '1' HOUR
                FROM
                    hours
                WHERE
                    hour_start - INTERVAL '1' HOUR >= v_last_run
            ), periods AS (
                SELECT
                    'H'                                                  AS period_type,
                    to_char(hour_start, 'YYYY-MM-DD HH24')
                    || ':00'                                             AS period_label,
                    hour_start                                           AS period_start,
                    hour_start + INTERVAL '1' HOUR - INTERVAL '1' SECOND AS period_end
                FROM
                    hours
            )
            SELECT
                p.period_type,
                p.period_label,
                p.period_start,
                p.period_end,
                'Jobs'            AS metric_name,
                COUNT(j.job_name) AS metric_value
            FROM
                periods                        p
                LEFT JOIN user_scheduler_job_run_details j ON j.actual_start_date BETWEEN p.period_start AND p.period_end
            GROUP BY
                p.period_type,
                p.period_label,
                p.period_start,
                p.period_end
        ) src ON ( tgt.period_type = src.period_type
                   AND tgt.period_label = src.period_label
                   AND tgt.metric_name = src.metric_name )
        WHEN MATCHED THEN UPDATE
        SET tgt.metric_value = src.metric_value
        WHEN NOT MATCHED THEN
        INSERT (
            period_type,
            period_label,
            period_start,
            period_end,
            metric_name,
            metric_value )
        VALUES
            ( src.period_type,
              src.period_label,
              src.period_start,
              src.period_end,
              src.metric_name,
              src.metric_value );

        COMMIT;

    -- Consolidate By Days
        MERGE INTO app_stats tgt
        USING (
            SELECT
                'D'                                                            AS period_type,
                trunc(s.period_start)                                          AS period_start,
                trunc(s.period_start) + INTERVAL '1' DAY - INTERVAL '1' SECOND AS period_end,
                to_char(
                    trunc(s.period_start),
                    'YYYY-MM-DD'
                )                                                              AS period_label,
                s.metric_name,
                SUM(s.metric_value)                                            AS metric_value
            FROM
                app_stats s
            WHERE
                s.period_type = 'H'
            GROUP BY
                trunc(s.period_start),
                s.metric_name
        ) src ON ( tgt.period_type = src.period_type
                   AND tgt.period_label = src.period_label
                   AND tgt.metric_name = src.metric_name )
        WHEN MATCHED THEN UPDATE
        SET tgt.metric_value = src.metric_value
        WHEN NOT MATCHED THEN
        INSERT (
            period_type,
            period_label,
            period_start,
            period_end,
            metric_name,
            metric_value )
        VALUES
            ( src.period_type,
              src.period_label,
              src.period_start,
              src.period_end,
              src.metric_name,
              src.metric_value );

        COMMIT; 

    -- Consolidate By Weeks
        MERGE INTO app_stats tgt
        USING (
            SELECT
                'W'                 AS period_type,
                MIN(s.period_start) AS period_start,
                MAX(s.period_start) AS period_end,
                to_char(
                    trunc(s.period_start, 'IW'),
                    'YYYY-"W"IW'
                )                   AS period_label,
                s.metric_name,
                SUM(s.metric_value) AS metric_value
            FROM
                app_stats s
            WHERE
                s.period_type = 'D'
            GROUP BY
                to_char(
                    trunc(s.period_start, 'IW'),
                    'YYYY-"W"IW'
                ),
                s.metric_name
        ) src ON ( tgt.period_type = src.period_type
                   AND tgt.period_label = src.period_label
                   AND tgt.metric_name = src.metric_name )
        WHEN MATCHED THEN UPDATE
        SET tgt.metric_value = src.metric_value
        WHEN NOT MATCHED THEN
        INSERT (
            period_type,
            period_label,
            period_start,
            period_end,
            metric_name,
            metric_value )
        VALUES
            ( src.period_type,
              src.period_label,
              src.period_start,
              src.period_end,
              src.metric_name,
              src.metric_value );

        COMMIT;

    -- Consolidate By Months
        MERGE INTO app_stats tgt
        USING (
            SELECT
                'M'                                                               AS period_type,
                trunc(s.period_start, 'MM')                                       AS period_start,
                last_day(s.period_start) + INTERVAL '1' DAY - INTERVAL '1' SECOND AS period_end,
                to_char(s.period_start, 'YYYY-MM')                                AS period_label,
                s.metric_name,
                SUM(s.metric_value)                                               AS metric_value
            FROM
                app_stats s
            WHERE
                s.period_type = 'D'
            GROUP BY
                to_char(s.period_start, 'YYYY-MM'),
                last_day(s.period_start) + INTERVAL '1' DAY - INTERVAL '1' SECOND,
                trunc(s.period_start, 'MM'),
                s.metric_name
        ) src ON ( tgt.period_type = src.period_type
                   AND tgt.period_label = src.period_label
                   AND tgt.metric_name = src.metric_name )
        WHEN MATCHED THEN UPDATE
        SET tgt.metric_value = src.metric_value
        WHEN NOT MATCHED THEN
        INSERT (
            period_type,
            period_label,
            period_start,
            period_end,
            metric_name,
            metric_value )
        VALUES
            ( src.period_type,
              src.period_label,
              src.period_start,
              src.period_end,
              src.metric_name,
              src.metric_value );

        COMMIT;

    -- Consolidate By Quarters
        MERGE INTO app_stats tgt
        USING (
            SELECT
                'Q'                                  AS period_type,
                trunc(s.period_start, 'Q')           AS period_start,
                add_months(
                    trunc(s.period_start, 'Q'),
                    3
                ) - INTERVAL '1' SECOND              AS period_end,
                to_char(s.period_start, 'YYYY-"Q"Q') AS period_label,
                s.metric_name,
                SUM(s.metric_value)                  AS metric_value
            FROM
                app_stats s
            WHERE
                s.period_type = 'D'
            GROUP BY
                to_char(s.period_start, 'YYYY-"Q"Q'),
                add_months(
                    trunc(s.period_start, 'Q'),
                    3
                ) - INTERVAL '1' SECOND,
                trunc(s.period_start, 'Q'),
                s.metric_name
        ) src ON ( tgt.period_type = src.period_type
                   AND tgt.period_label = src.period_label
                   AND tgt.metric_name = src.metric_name )
        WHEN MATCHED THEN UPDATE
        SET tgt.metric_value = src.metric_value
        WHEN NOT MATCHED THEN
        INSERT (
            period_type,
            period_label,
            period_start,
            period_end,
            metric_name,
            metric_value )
        VALUES
            ( src.period_type,
              src.period_label,
              src.period_start,
              src.period_end,
              src.metric_name,
              src.metric_value );

        COMMIT;

    -- Consolidate By Years
        MERGE INTO app_stats tgt
        USING (
            SELECT
                'Y'                             AS period_type,
                trunc(s.period_start, 'YYYY')   AS period_start,
                add_months(
                    trunc(s.period_start, 'YYYY'),
                    12
                ) - INTERVAL '1' SECOND         AS period_end,
                to_char(s.period_start, 'YYYY') AS period_label,
                s.metric_name,
                SUM(s.metric_value)             AS metric_value
            FROM
                app_stats s
            WHERE
                s.period_type = 'D'
            GROUP BY
                to_char(s.period_start, 'YYYY'),
                add_months(
                    trunc(s.period_start, 'YYYY'),
                    12
                ) - INTERVAL '1' SECOND,
                trunc(s.period_start, 'YYYY'),
                s.metric_name
        ) src ON ( tgt.period_type = src.period_type
                   AND tgt.period_label = src.period_label
                   AND tgt.metric_name = src.metric_name )
        WHEN MATCHED THEN UPDATE
        SET tgt.metric_value = src.metric_value
        WHEN NOT MATCHED THEN
        INSERT (
            period_type,
            period_label,
            period_start,
            period_end,
            metric_name,
            metric_value )
        VALUES
            ( src.period_type,
              src.period_label,
              src.period_start,
              src.period_end,
              src.metric_name,
              src.metric_value );

        COMMIT;
        dbms_output.put_line('Updated App Stats from ' || to_char(v_last_run, 'YYYY-MM-DD HH24:MI:SS.FF'));
    END job_stats;

    PROCEDURE get_stats (
        r_stats OUT SYS_REFCURSOR
    ) AS
    BEGIN
        IF pck_api_auth.role(NULL, 'ADMIN') IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;

        OPEN r_stats FOR SELECT
                                            period_type  AS "period_type",
                                            period_label AS "period_label",
                                            metric_name  AS "metric_name",
                                            metric_value AS "metric_value"
                                        FROM
                                            (
                                                SELECT
                                                    period_type,
                                                    period_label,
                                                    metric_name,
                                                    metric_value,
                                                    ROW_NUMBER()
                                                    OVER(PARTITION BY period_type, metric_name
                                                         ORDER BY
                                                             period_label DESC
                                                    ) AS rn
                                                FROM
                                                    app_stats
                                            )
                        WHERE
                            rn <= 10
                        ORDER BY
                            period_type,
                            metric_name,
                            period_label;

    END get_stats;

    PROCEDURE job_alerts AS
    BEGIN

        -- Total file storage size alert

        MERGE INTO app_alerts a
        USING (
            SELECT
                'file.storage.total.size' AS alert_text,
                CASE
                    WHEN SUM(file_size) < 1024               THEN
                        round(
                            sum(file_size),
                            2
                        )
                        || ' B'
                    WHEN SUM(file_size) < 1024 * 1024        THEN
                        round(sum(file_size) / 1024,
                              2)
                        || ' KB'
                    WHEN SUM(file_size) < 1024 * 1024 * 1024 THEN
                        round(sum(file_size) / 1024 / 1024,
                              2)
                        || ' MB'
                    ELSE
                        round(sum(file_size) / 1024 / 1024 / 1024,
                              2)
                        || ' GB'
                END                       AS alert_value,
                'info'                    AS alert_type
            FROM
                app_storage
        ) src ON ( a.alert_text = src.alert_text )
        WHEN MATCHED THEN UPDATE
        SET a.alert_value = src.alert_value,
            a.alert_type = src.alert_type,
            a.created = systimestamp
        WHEN NOT MATCHED THEN
        INSERT (
            alert_text,
            alert_value,
            alert_type,
            created )
        VALUES
            ( src.alert_text,
              src.alert_value,
              src.alert_type,
              systimestamp );

        COMMIT;

        -- Active users alert
        MERGE INTO app_alerts a
        USING (
            SELECT
                'active.users'       AS alert_text,
                COUNT(DISTINCT uuid) AS alert_value,
                'info'               AS alert_type
            FROM
                app_tokens
            WHERE
                    type_id = 'REFRESH'
                AND expiration >= systimestamp
        ) src ON ( a.alert_text = src.alert_text )
        WHEN MATCHED THEN UPDATE
        SET a.alert_value = src.alert_value,
            a.alert_type = src.alert_type,
            a.created = systimestamp
        WHEN NOT MATCHED THEN
        INSERT (
            alert_text,
            alert_value,
            alert_type,
            created )
        VALUES
            ( src.alert_text,
              src.alert_value,
              src.alert_type,
              systimestamp );

        COMMIT;

        -- Errors in last 24 hours alert
        MERGE INTO app_alerts a
        USING (
            SELECT
                'errors.in.last.24.hours' AS alert_text,
                COUNT(id)                 AS alert_value,
                CASE
                    WHEN COUNT(id) > 0 THEN
                        'error'
                    ELSE
                        'success'
                END                       AS alert_type
            FROM
                app_audit
            WHERE
                    severity = 'ERROR'
                AND created >= systimestamp - INTERVAL '24' HOUR
        ) src ON ( a.alert_text = src.alert_text )
        WHEN MATCHED THEN UPDATE
        SET a.alert_value = src.alert_value,
            a.alert_type = src.alert_type,
            a.created = systimestamp
        WHEN NOT MATCHED THEN
        INSERT (
            alert_text,
            alert_value,
            alert_type,
            created )
        VALUES
            ( src.alert_text,
              src.alert_value,
              src.alert_type,
              systimestamp );

        COMMIT;

        -- Warnings in last 24 hours alert
        MERGE INTO app_alerts a
        USING (
            SELECT
                'warnings.in.last.24.hours' AS alert_text,
                COUNT(id)                   AS alert_value,
                CASE
                    WHEN COUNT(id) > 0 THEN
                        'warning'
                    ELSE
                        'success'
                END                         AS alert_type
            FROM
                app_audit
            WHERE
                    severity = 'WARN'
                AND created >= systimestamp - INTERVAL '24' HOUR
        ) src ON ( a.alert_text = src.alert_text )
        WHEN MATCHED THEN UPDATE
        SET a.alert_value = src.alert_value,
            a.alert_type = src.alert_type,
            a.created = systimestamp
        WHEN NOT MATCHED THEN
        INSERT (
            alert_text,
            alert_value,
            alert_type,
            created )
        VALUES
            ( src.alert_text,
              src.alert_value,
              src.alert_type,
              systimestamp );

        COMMIT;

        -- Failed email deliveries in last 24 hours alert
        MERGE INTO app_alerts a
        USING (
            SELECT
                'failed.email.deliveries.in.last.24.hours' AS alert_text,
                COUNT(id)                                  AS alert_value,
                CASE
                    WHEN COUNT(id) > 0 THEN
                        'warning'
                    ELSE
                        'success'
                END                                        AS alert_type
            FROM
                app_emails
            WHERE
                    status = 'E'
                AND created >= systimestamp - INTERVAL '24' HOUR
        ) src ON ( a.alert_text = src.alert_text )
        WHEN MATCHED THEN UPDATE
        SET a.alert_value = src.alert_value,
            a.alert_type = src.alert_type,
            a.created = systimestamp
        WHEN NOT MATCHED THEN
        INSERT (
            alert_text,
            alert_value,
            alert_type,
            created )
        VALUES
            ( src.alert_text,
              src.alert_value,
              src.alert_type,
              systimestamp );

        COMMIT;
    END job_alerts;

    PROCEDURE get_alerts (
        r_alerts OUT SYS_REFCURSOR
    ) AS
    BEGIN
        IF pck_api_auth.role(NULL, 'ADMIN') IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;

        OPEN r_alerts FOR SELECT
                                              alert_text                                AS "text",
                                              alert_value                               AS "value",
                                              alert_type                                AS "type",
                                              to_char(created, 'YYYY-MM-DD HH24:MI:SS') AS "created"
                                          FROM
                                              app_alerts
                         ORDER BY
                             created DESC;

    END get_alerts;

END pck_adm;
/

