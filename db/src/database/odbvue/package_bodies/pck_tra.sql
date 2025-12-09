CREATE OR REPLACE PACKAGE BODY odbvue.pck_tra AS

    FUNCTION ts (
        value IN VARCHAR2
    ) RETURN TIMESTAMP AS
    BEGIN
        RETURN TO_TIMESTAMP ( value, 'YYYY-MM-DD HH24:MI:SS' );
    EXCEPTION
        WHEN OTHERS THEN
            BEGIN
                RETURN TO_TIMESTAMP ( value, 'YYYY-MM-DD"T"HH24:MI:SS' );
            EXCEPTION
                WHEN OTHERS THEN
                    NULL;
            END;
    END ts;

    PROCEDURE get_boards (
        p_filter IN VARCHAR2 DEFAULT NULL,
        p_search IN VARCHAR2 DEFAULT NULL,
        p_offset IN PLS_INTEGER DEFAULT 0,
        p_limit  IN PLS_INTEGER DEFAULT 10,
        r_boards OUT SYS_REFCURSOR
    ) AS

        v_uuid   CHAR(32 CHAR) := pck_api_auth.uuid;
        v_search VARCHAR2(2000 CHAR) := utl_url.unescape(coalesce(p_search, ''));
        v_filter VARCHAR2(2000 CHAR) := utl_url.unescape(coalesce(p_filter, '{}'));
    BEGIN
        IF v_uuid IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;
        OPEN r_boards FOR SELECT
                                                b.key                                        AS "key",
                                                b.title                                      AS "title",
                                                b.description                                AS "description",
                                                b.settings                                   AS "{}settings",
                                                b.author                                     AS "author",
                                                JSON_OBJECT(
                                                        'uuid' VALUE ua.uuid,
                                                                'name' VALUE ua.fullname
                                                                             || ' ('
                                                                             || lower(ua.username)
                                                                             || ')'
                                                    )
                                                AS "{}author_details",
                                                to_char(b.created, 'YYYY-MM-DD HH24:MI:SS')  AS "created",
                                                b.editor                                     AS "editor",
                                                JSON_OBJECT(
                                                        'uuid' VALUE ue.uuid,
                                                                'name' VALUE ue.fullname
                                                                             || ' ('
                                                                             || lower(ue.username)
                                                                             || ')'
                                                    )
                                                AS "{}editor_details",
                                                to_char(b.modified, 'YYYY-MM-DD HH24:MI:SS') AS "modified"
                                            FROM
                                                     tra_boards b
                                                JOIN app_users ua ON b.author = ua.uuid
                                                LEFT JOIN app_users ue ON b.editor = ue.uuid
                          WHERE
                -- filter by key 
                              ( NOT JSON_EXISTS ( v_filter, '$.key' )
                                    OR EXISTS (
                                  SELECT
                                      1
                                  FROM
                                          JSON_TABLE ( JSON_QUERY(v_filter, '$.key'), '$[*]'
                                              COLUMNS (
                                                  value VARCHAR2 ( 100 ) PATH '$'
                                              )
                                          )
                                      j
                                  WHERE
                                      b.key = j.value
                              ) )
                          OFFSET p_offset ROWS FETCH NEXT p_limit ROWS ONLY;

    END get_boards;

    PROCEDURE get_tasks (
        p_filter IN VARCHAR2 DEFAULT NULL,
        p_search IN VARCHAR2 DEFAULT NULL,
        p_offset IN PLS_INTEGER DEFAULT 0,
        p_limit  IN PLS_INTEGER DEFAULT 10,
        r_tasks  OUT SYS_REFCURSOR
    ) AS

        v_uuid   CHAR(32 CHAR) := pck_api_auth.uuid;
        v_search VARCHAR2(2000 CHAR) := utl_url.unescape(coalesce(p_search, ''));
        v_filter VARCHAR2(2000 CHAR) := utl_url.unescape(coalesce(p_filter, '{}'));
    BEGIN
        IF v_uuid IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;
        OPEN r_tasks FOR SELECT
                                              t.num                                        AS "num",
                                              t.key                                        AS "key",
                                              t.title                                      AS "title",
                                              t.description                                AS "description",
                                              to_char(t.due, 'YYYY-MM-DD')                 AS "due",
                                              JSON_OBJECT(
                                                      'format' VALUE
                                                          JSON_OBJECT(
                                                              'color' VALUE
                                                                  CASE
                                                                      WHEN t.due IS NULL THEN
                                                                          NULL
                                                                      WHEN t.due < systimestamp                                                      THEN
                                                                          'error'
                                                                      WHEN t.due <= systimestamp +(JSON_VALUE(b.settings, '$.due_warn_before_days'
                                                                      )) THEN
                                                                          'warning'
                                                                      ELSE
                                                                          'info'
                                                                  END
                                                          )
                                                  )
                                              AS "{}due_details",
                                              t.reminder                                   AS "reminder",
                                              t.started                                    AS "started",
                                              t.completed                                  AS "completed",
                                              t.status                                     AS "status",
                                              t.priority                                   AS "priority",
                                              t.estimated                                  AS "estimated",
                                              t.remaining                                  AS "remaining",
                                              t.invested                                   AS "invested",
                                              JSON_OBJECT(
                                                      'value' VALUE t.assignee,
                                                      'title' VALUE u.fullname
                                                  )
                                              AS "{}assignee",
                                              t.author                                     AS "author",
                                              to_char(t.created, 'YYYY-MM-DD HH24:MI:SS')  AS "created",
                                              t.editor                                     AS "editor",
                                              to_char(t.modified, 'YYYY-MM-DD HH24:MI:SS') AS "modified",
                                              pt.num                                       AS "parent_num"
                                          FROM
                                                   tra_tasks t
                                              JOIN tra_boards b ON t.key = b.key
                                              LEFT JOIN app_users  u ON t.assignee = u.uuid
                                              LEFT JOIN tra_links  l ON t.id = l.child_id
                                              LEFT JOIN tra_tasks  pt ON l.parent_id = pt.id
                         WHERE 
                -- search by key
                             ( NOT JSON_EXISTS ( v_filter, '$.key' )
                                   OR EXISTS (
                                 SELECT
                                     1
                                 FROM
                                         JSON_TABLE ( JSON_QUERY(v_filter, '$.key'), '$[*]'
                                             COLUMNS (
                                                 value VARCHAR2 ( 100 ) PATH '$'
                                             )
                                         )
                                     j
                                 WHERE
                                     t.key = j.value
                             ) )
                             AND
                -- search by num
                              ( NOT JSON_EXISTS ( v_filter, '$.num' )
                                       OR EXISTS (
                                 SELECT
                                     1
                                 FROM
                                         JSON_TABLE ( JSON_QUERY(v_filter, '$.num'), '$[*]'
                                             COLUMNS (
                                                 value VARCHAR2 ( 100 ) PATH '$'
                                             )
                                         )
                                     j
                                 WHERE
                                     t.num = j.value
                             ) )
                         ORDER BY
                             t.created DESC
                         OFFSET p_offset ROWS FETCH NEXT p_limit ROWS ONLY;

    END get_tasks;

    PROCEDURE post_task (
        p_data   CLOB,
        r_error  OUT VARCHAR2,
        r_errors OUT SYS_REFCURSOR
    ) AS

        v_uuid        CHAR(32 CHAR) := pck_api_auth.uuid;
        v_data        CLOB := utl_url.unescape(coalesce(p_data, ''));
        v_num         tra_tasks.num%TYPE := upper(trim(JSON_VALUE(v_data, '$.num')));
        v_key         tra_tasks.key%TYPE := JSON_VALUE(v_data, '$.key');
        v_title       tra_tasks.title%TYPE := JSON_VALUE(v_data, '$.title');
        v_description tra_tasks.description%TYPE := JSON_VALUE(v_data, '$.description');
        v_due         tra_tasks.due%TYPE := ts(JSON_VALUE(v_data, '$.due'));
        v_status      tra_tasks.status%TYPE := JSON_VALUE(v_data, '$.status');
        v_priority    tra_tasks.priority%TYPE := JSON_VALUE(v_data, '$.priority');
        v_assignee    tra_tasks.assignee%TYPE := JSON_VALUE(v_data, '$.assignee');
        v_parent_num  tra_tasks.num%TYPE := upper(trim(JSON_VALUE(v_data, '$.parent')));
        v_estimeated  tra_tasks.estimated%TYPE := TO_NUMBER ( coalesce(
            JSON_VALUE(v_data, '$.estimated'),
            0
        ) );
    BEGIN
        IF v_uuid IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;
        IF v_title IS NULL THEN
            pck_api_audit.errors(r_errors, 'title', 'required');
            RETURN;
        END IF;

        IF v_status IS NULL THEN
            SELECT
                s.value
            INTO v_status
            FROM
                tra_boards b,
                JSON_TABLE ( JSON_QUERY(b.settings, '$.statuses'), '$[*]'
                        COLUMNS (
                            value VARCHAR2 ( 100 ) PATH '$.value',
                            title VARCHAR2 ( 200 ) PATH '$.title'
                        )
                    )
                s
            WHERE
                b.key = v_key
            ORDER BY
                ROWNUM
            FETCH FIRST 1 ROWS ONLY;

        END IF;

        UPDATE tra_tasks
        SET
            key = v_key,
            title = v_title,
            description = v_description,
            due = v_due,
            status = v_status,
            priority = v_priority,
            estimated = v_estimeated,
            assignee = v_assignee,
            editor = v_uuid,
            modified = systimestamp
        WHERE
            num = v_num;

        IF SQL%rowcount = 0 THEN
            INSERT INTO tra_tasks (
                key,
                title,
                description,
                due,
                status,
                priority,
                estimated,
                assignee,
                author
            ) VALUES ( v_key,
                       v_title,
                       v_description,
                       v_due,
                       v_status,
                       v_priority,
                       v_estimeated,
                       v_assignee,
                       v_uuid ) RETURNING num INTO v_num;

        END IF;

        IF v_parent_num IS NOT NULL THEN
            INSERT INTO tra_links (
                parent_id,
                child_id
            )
                SELECT
                    (
                        SELECT
                            id
                        FROM
                            tra_tasks
                        WHERE
                            num = v_parent_num
                    ),
                    (
                        SELECT
                            id
                        FROM
                            tra_tasks
                        WHERE
                            num = v_num
                    )
                FROM
                    dual;

        END IF;

        COMMIT;
    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            pck_api_audit.error('Travail',
                                pck_api_audit.attributes('data', v_data, 'uuid', v_uuid));

            r_error := 'something.went.wrong';
    END post_task;

    PROCEDURE get_assignees (
        p_filter    IN VARCHAR2 DEFAULT NULL,
        p_search    IN VARCHAR2 DEFAULT NULL,
        p_offset    IN PLS_INTEGER DEFAULT 0,
        p_limit     IN PLS_INTEGER DEFAULT 10,
        r_assignees OUT SYS_REFCURSOR
    ) AS
        v_uuid CHAR(32 CHAR) := pck_api_auth.uuid;
    BEGIN
        IF v_uuid IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;
        OPEN r_assignees FOR SELECT
                                                      u.uuid AS "value",
                                                      u.fullname
                                                      || ' ('
                                                      || lower(u.username)
                                                      || ')' AS "title"
                                                  FROM
                                                      app_users u
                             WHERE
                                 ( p_search IS NULL
                                   OR u.username LIKE '%'
                                                      || upper(p_search)
                                                      || '%' )
                                 OR ( p_search IS NULL
                                      OR lower(u.fullname) LIKE '%'
                                                                || lower(p_search)
                                                                || '%' )
                             ORDER BY
                                 u.fullname
                             OFFSET p_offset ROWS FETCH NEXT p_limit ROWS ONLY;

    END get_assignees;

END pck_tra;
/


-- sqlcl_snapshot {"hash":"0fac4d2f0d8950683e656c7c4ef45c1e1df9539b","type":"PACKAGE_BODY","name":"PCK_TRA","schemaName":"ODBVUE","sxml":""}