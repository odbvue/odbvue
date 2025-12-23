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
                -- Search by title or key
                              AND ( v_search IS NULL
                                    OR upper(b.title) LIKE '%'
                                    || upper(v_search)
                                    || '%'
                                       OR upper(b.key) LIKE '%'
                                                            || upper(v_search)
                                                            || '%' )
                          ORDER BY
                              b.created DESC
                          OFFSET p_offset ROWS FETCH NEXT p_limit ROWS ONLY;

    END get_boards;

    PROCEDURE post_board (
        p_data   CLOB,
        r_error  OUT VARCHAR2,
        r_errors OUT SYS_REFCURSOR
    ) AS

        v_uuid        CHAR(32 CHAR) := pck_api_auth.uuid;
        v_data        CLOB := utl_url.unescape(coalesce(p_data, '{}'));
        v_key         tra_boards.key%TYPE := upper(trim(JSON_VALUE(v_data, '$.key')));
        v_title       tra_boards.title%TYPE := JSON_VALUE(v_data, '$.title');
        v_description tra_boards.description%TYPE := JSON_VALUE(v_data, '$.description');
        v_settings    tra_boards.settings%TYPE := JSON_QUERY(v_data, '$.settings' RETURNING CLOB);
    BEGIN
        IF v_uuid IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;
        IF v_title IS NULL THEN
            pck_api_audit.errors(r_errors, 'title', 'required');
            RETURN;
        END IF;

        UPDATE tra_boards
        SET
            title = v_title,
            description = v_description,
            settings = v_settings,
            editor = v_uuid,
            modified = systimestamp
        WHERE
            key = v_key;

        IF SQL%rowcount = 0 THEN
            INSERT INTO tra_boards (
                key,
                title,
                description,
                settings,
                author
            ) VALUES ( v_key,
                       v_title,
                       v_description,
                       v_settings,
                       v_uuid );

        END IF;

        COMMIT;
    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            pck_api_audit.error('Travail',
                                pck_api_audit.attributes('data', v_data, 'uuid', v_uuid));

            r_error := 'something.went.wrong';
    END post_board;

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
                                              to_char(t.reminder, 'YYYY-MM-DD')            AS "reminder",
                                              to_char(t.started, 'YYYY-MM-DD')             AS "started",
                                              to_char(t.completed, 'YYYY-MM-DD')           AS "completed",
                                              to_char(t.archived, 'YYYY-MM-DD')            AS "archived",
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
                                              pt.num                                       AS "parent_num",
                                              r.rank_value                                 AS "rank_value"
                                          FROM
                                                   tra_tasks t
                                              JOIN tra_boards b ON t.key = b.key
                                              LEFT JOIN tra_ranks  r ON r.task_id = t.id
                                              LEFT JOIN app_users  u ON t.assignee = u.uuid
                                              LEFT JOIN tra_links  l ON t.id = l.child_id
                                              LEFT JOIN tra_tasks  pt ON l.parent_id = pt.id
                         WHERE 
                -- Search by title or description
                             ( v_search IS NULL
                               OR t.num LIKE '%'
                               || upper(v_search)
                               || '%'
                                  OR upper(t.title) LIKE '%'
                                                         || upper(v_search)
                                                         || '%' )
                             AND
               -- include archived or not
                              ( NOT JSON_EXISTS ( v_filter, '$.archived' )
                                       AND t.archived IS NULL
                                       OR EXISTS (
                                 SELECT
                                     1
                                 FROM
                                         JSON_TABLE ( JSON_QUERY(v_filter, '$.archived'), '$[*]'
                                             COLUMNS (
                                                 value VARCHAR2 ( 100 ) PATH '$'
                                             )
                                         )
                                     j
                                 WHERE
                                     t.archived IS NOT NULL
                                     OR j.value = 'true'
                             ) )
                             AND
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
                             nvl(r.rank_value, 999999999999999999) ASC,
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
        v_archived    tra_tasks.archived%TYPE := ts(JSON_VALUE(v_data, '$.archived'));
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
            archived = v_archived,
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
                archived,
                status,
                priority,
                estimated,
                assignee,
                author
            ) VALUES ( v_key,
                       v_title,
                       v_description,
                       v_due,
                       v_archived,
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

    PROCEDURE post_archive (
        p_key    IN VARCHAR2,
        r_error  OUT VARCHAR2,
        r_errors OUT SYS_REFCURSOR
    ) AS

        v_uuid CHAR(32 CHAR) := pck_api_auth.uuid;
        v_num  tra_tasks.num%TYPE := upper(trim(p_key));
    BEGIN
        IF v_uuid IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;
        UPDATE tra_tasks
        SET
            archived = systimestamp,
            editor = v_uuid,
            modified = systimestamp
        WHERE
            num = v_num;

        COMMIT;
        pck_api_audit.info('Travail',
                           pck_api_audit.attributes('num', v_num, 'uuid', v_uuid));

    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            pck_api_audit.error('Travail',
                                pck_api_audit.attributes('num', v_num, 'uuid', v_uuid));

            r_error := 'something.went.wrong';
    END post_archive;

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

    PROCEDURE get_notes (
        p_filter IN VARCHAR2 DEFAULT NULL,
        p_search IN VARCHAR2 DEFAULT NULL,
        p_offset IN PLS_INTEGER DEFAULT 0,
        p_limit  IN PLS_INTEGER DEFAULT 10,
        r_notes  OUT SYS_REFCURSOR
    ) AS

        v_uuid   CHAR(32 CHAR) := pck_api_auth.uuid;
        v_search VARCHAR2(2000 CHAR) := utl_url.unescape(coalesce(p_search, ''));
        v_filter VARCHAR2(2000 CHAR) := utl_url.unescape(coalesce(p_filter, '{}'));
    BEGIN
        IF v_uuid IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;
        OPEN r_notes FOR SELECT
                                              n.id                                         AS "id",
                                              t.num                                        AS "num",
                                              n.storage_id                                 AS "storage_id",
                                              n.content                                    AS "content",
                                              s.id                                         AS "file_id",
                                              s.file_name                                  AS "file_name",
                                              s.file_size                                  AS "file_size",
                                              n.assistant                                  AS "assistant",
                                              n.author                                     AS "author",
                                              ua.fullname                                  AS "author_fullname",
                                              to_char(n.created, 'YYYY-MM-DD HH24:MI:SS')  AS "created",
                                              n.editor                                     AS "editor",
                                              ue.fullname                                  AS "editor_fullname",
                                              to_char(n.modified, 'YYYY-MM-DD HH24:MI:SS') AS "modified"
                                          FROM
                                                   tra_notes n
                                              JOIN tra_tasks   t ON n.task_id = t.id
                                              JOIN app_users   ua ON n.author = ua.uuid
                                              LEFT JOIN app_users   ue ON n.editor = ue.uuid
                                              LEFT JOIN app_storage s ON n.storage_id = s.id
                         WHERE 
                -- filter by task_id 
                             ( NOT JSON_EXISTS ( v_filter, '$.num' )
                                   OR EXISTS (
                                 SELECT
                                     1
                                 FROM
                                         JSON_TABLE ( JSON_QUERY(v_filter, '$.num'), '$[*]'
                                             COLUMNS (
                                                 value VARCHAR2 ( 100 CHAR ) PATH '$'
                                             )
                                         )
                                     j
                                 WHERE
                                     n.task_id = (
                                         SELECT
                                             id
                                         FROM
                                             tra_tasks
                                         WHERE
                                             num = j.value
                                     )
                             ) )
                         ORDER BY
                             n.created DESC
                         OFFSET p_offset ROWS FETCH NEXT p_limit ROWS ONLY;

    END;

    PROCEDURE post_note (
        p_data   CLOB,
        r_error  OUT VARCHAR2,
        r_errors OUT SYS_REFCURSOR
    ) AS

        v_uuid         CHAR(32 CHAR) := pck_api_auth.uuid;
        v_data         CLOB := coalesce(p_data, '{}');
        v_num          tra_tasks.num%TYPE := JSON_VALUE(v_data, '$.num');
        v_content      tra_notes.content%TYPE := JSON_VALUE(v_data, '$.content');
        v_files        CLOB := JSON_QUERY(v_data, '$.file' RETURNING CLOB);
        v_storage_id   tra_notes.storage_id%TYPE;
        v_file_content BLOB;
    BEGIN
        IF v_uuid IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;
        IF v_num IS NULL THEN
            pck_api_audit.errors(r_errors, 'num', 'required');
            RETURN;
        END IF;

        FOR f IN (
            SELECT
                jt.file_name,
                jt.file_content
            FROM
                    JSON_TABLE ( v_files, '$[*]'
                        COLUMNS (
                            file_name VARCHAR2 ( 500 ) PATH '$.name',
                            file_content CLOB PATH '$.content'
                        )
                    )
                jt
        ) LOOP
            v_file_content := pck_api_lob.base64_to_blob(f.file_content);
            pck_api_storage.upload(v_file_content, f.file_name, v_storage_id);
            INSERT INTO tra_notes (
                task_id,
                storage_id,
                author
            ) VALUES ( (
                SELECT
                    id
                FROM
                    tra_tasks
                WHERE
                    num = v_num
            ),
                       v_storage_id,
                       v_uuid );

        END LOOP;

        IF v_content IS NOT NULL THEN
            INSERT INTO tra_notes (
                task_id,
                content,
                author
            ) VALUES ( (
                SELECT
                    id
                FROM
                    tra_tasks
                WHERE
                    num = v_num
            ),
                       v_content,
                       v_uuid );

        END IF;

        COMMIT;
    END post_note;

    PROCEDURE job_assistant AS

        v_batch_size PLS_INTEGER := 100;
        v_api_key    VARCHAR2(200 CHAR) := pck_api_settings.read('TRA_OPENAI_API_KEY');
        v_image      CLOB;
        r_message    CLOB;
        r_error      CLOB;
    BEGIN
        FOR r IN (
            SELECT
                n.id         AS note_id,
                n.storage_id AS storage_id,
                s.file_name  AS file_name,
                s.content    AS image_content
            FROM
                     tra_notes n
                JOIN app_storage s ON n.storage_id = s.id
            WHERE
                n.assistant IS NULL
            ORDER BY
                n.id
            FETCH FIRST v_batch_size ROWS ONLY
        ) LOOP
            v_image := pck_api_lob.blob_to_base64(r.image_content);
            pck_api_openai.vision(v_api_key, 'gpt-5', 'Provide a detailed analysis of the content of the image. Describe what is depicted, identify any notable objects, scenes, or text within the image, and suggest possible contexts or uses for the image.'
            , v_image, r_message,
                                  r_error);
            UPDATE tra_notes
            SET
                assistant = coalesce(r_message, r_error)
            WHERE
                id = r.note_id;

            COMMIT;
        END LOOP;
    END job_assistant;

    PROCEDURE get_download (
        p_id IN VARCHAR2
    ) AS

        v_uuid      CHAR(32 CHAR) := pck_api_auth.uuid;
        v_mime_type app_storage.mime_type%TYPE;
        v_file_size app_storage.file_size%TYPE;
        v_file_ext  app_storage.file_ext%TYPE;
        v_file_name app_storage.file_name%TYPE;
        v_file      BLOB;
    BEGIN
        IF v_uuid IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;
        pck_api_storage.download(p_id, v_file, v_file_name, v_file_size, v_file_ext,
                                 v_mime_type);
        owa_util.mime_header(v_mime_type, FALSE);
        htp.p('Content-length: ' || v_file_size);
        htp.p('Content-Disposition: filename="'
              || v_file_name || '"');
        owa_util.http_header_close;
        wpg_docload.download_file(v_file);
    END;

    PROCEDURE post_rank (
        p_num    IN VARCHAR2,
        p_before IN VARCHAR2,
        p_after  IN VARCHAR2
    ) AS

        v_uuid        CHAR(32 CHAR) := pck_api_auth.uuid;
        v_num         tra_tasks.num%TYPE := upper(trim(p_num));
        v_before_num  tra_tasks.num%TYPE := upper(trim(p_before));
        v_after_num   tra_tasks.num%TYPE := upper(trim(p_after));
        v_task_id     tra_tasks.id%TYPE;
        v_key         tra_tasks.key%TYPE;
        v_status      tra_tasks.status%TYPE;
        v_before_rank tra_ranks.rank_value%TYPE;
        v_after_rank  tra_ranks.rank_value%TYPE;
        v_new_rank    tra_ranks.rank_value%TYPE;
        c_start       CONSTANT PLS_INTEGER := 1000;
        c_step        CONSTANT PLS_INTEGER := 1000;
        c_gap         CONSTANT PLS_INTEGER := 500;
    BEGIN
        IF v_uuid IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;
        BEGIN
            SELECT
                t.id,
                t.key,
                t.status
            INTO
                v_task_id,
                v_key,
                v_status
            FROM
                tra_tasks t
            WHERE
                t.num = v_num;

        EXCEPTION
            WHEN no_data_found THEN
                pck_api_auth.http(400, 'task.not.found');
                RETURN;
        END;

        -- Normalize ranks in this column (board key + status) to ensure spacing and that every task has a rank.
        MERGE INTO tra_ranks tr
        USING (
            SELECT
                t.id               AS task_id,
                ( c_start + ( ROW_NUMBER()
                              OVER(
                    ORDER BY
                        nvl(r.rank_value, 999999999999999999) ASC,
                        t.created ASC
                              ) - 1 ) * c_step ) AS new_rank
            FROM
                tra_tasks t
                LEFT JOIN tra_ranks r ON r.task_id = t.id
            WHERE
                    t.key = v_key
                AND t.status = v_status
        ) src ON ( tr.task_id = src.task_id )
        WHEN MATCHED THEN UPDATE
        SET tr.rank_value = src.new_rank
        WHEN NOT MATCHED THEN
        INSERT (
            task_id,
            rank_value )
        VALUES
            ( src.task_id,
              src.new_rank );

        IF v_before_num IS NOT NULL THEN
            BEGIN
                SELECT
                    r.rank_value
                INTO v_before_rank
                FROM
                         tra_tasks t
                    JOIN tra_ranks r ON r.task_id = t.id
                WHERE
                        t.num = v_before_num
                    AND t.key = v_key
                    AND t.status = v_status;

            EXCEPTION
                WHEN no_data_found THEN
                    v_before_rank := NULL;
            END;
        END IF;

        IF v_after_num IS NOT NULL THEN
            BEGIN
                SELECT
                    r.rank_value
                INTO v_after_rank
                FROM
                         tra_tasks t
                    JOIN tra_ranks r ON r.task_id = t.id
                WHERE
                        t.num = v_after_num
                    AND t.key = v_key
                    AND t.status = v_status;

            EXCEPTION
                WHEN no_data_found THEN
                    v_after_rank := NULL;
            END;
        END IF;

        IF
            v_before_rank IS NULL
            AND v_after_rank IS NULL
        THEN
            v_new_rank := c_start;
        ELSIF v_before_rank IS NULL THEN
            v_new_rank := v_after_rank - c_gap;
        ELSIF v_after_rank IS NULL THEN
            v_new_rank := v_before_rank + c_gap;
        ELSE
            v_new_rank := floor((v_before_rank + v_after_rank) / 2);
            IF v_new_rank = v_before_rank
            OR v_new_rank = v_after_rank THEN
                -- No space left between neighbors; re-normalize with a larger step.
                MERGE INTO tra_ranks tr2
                USING (
                    SELECT
                        t.id                          AS task_id,
                        ( c_start + ( ROW_NUMBER()
                                      OVER(
                            ORDER BY
                                nvl(r.rank_value, 999999999999999999) ASC,
                                t.created ASC
                                      ) - 1 ) * ( c_step * 1000 ) ) AS new_rank
                    FROM
                        tra_tasks t
                        LEFT JOIN tra_ranks r ON r.task_id = t.id
                    WHERE
                            t.key = v_key
                        AND t.status = v_status
                ) src2 ON ( tr2.task_id = src2.task_id )
                WHEN MATCHED THEN UPDATE
                SET tr2.rank_value = src2.new_rank
                WHEN NOT MATCHED THEN
                INSERT (
                    task_id,
                    rank_value )
                VALUES
                    ( src2.task_id,
                      src2.new_rank );

                SELECT
                    r.rank_value
                INTO v_before_rank
                FROM
                         tra_tasks t
                    JOIN tra_ranks r ON r.task_id = t.id
                WHERE
                        t.num = v_before_num
                    AND t.key = v_key
                    AND t.status = v_status;

                SELECT
                    r.rank_value
                INTO v_after_rank
                FROM
                         tra_tasks t
                    JOIN tra_ranks r ON r.task_id = t.id
                WHERE
                        t.num = v_after_num
                    AND t.key = v_key
                    AND t.status = v_status;

                v_new_rank := floor((v_before_rank + v_after_rank) / 2);
            END IF;

        END IF;

        MERGE INTO tra_ranks tr3
        USING (
            SELECT
                v_task_id  AS task_id,
                v_new_rank AS rank_value
            FROM
                dual
        ) src3 ON ( tr3.task_id = src3.task_id )
        WHEN MATCHED THEN UPDATE
        SET tr3.rank_value = src3.rank_value
        WHEN NOT MATCHED THEN
        INSERT (
            task_id,
            rank_value )
        VALUES
            ( src3.task_id,
              src3.rank_value );

        COMMIT;
    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            pck_api_audit.error('Travail',
                                pck_api_audit.attributes('num', v_num, 'uuid', v_uuid));

            pck_api_auth.http(400, 'something.went.wrong');
    END post_rank;

    PROCEDURE get_acls (
        p_filter IN VARCHAR2 DEFAULT NULL,
        p_search IN VARCHAR2 DEFAULT NULL,
        p_offset IN PLS_INTEGER DEFAULT 0,
        p_limit  IN PLS_INTEGER DEFAULT 10,
        r_acls   OUT SYS_REFCURSOR
    ) AS

        v_uuid   CHAR(32 CHAR) := pck_api_auth.uuid;
        v_search VARCHAR2(2000 CHAR) := utl_url.unescape(coalesce(p_search, ''));
        v_filter VARCHAR2(2000 CHAR) := utl_url.unescape(coalesce(p_filter, '{}'));
    BEGIN
        IF v_uuid IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;
        OPEN r_acls FOR SELECT
                                            a.board AS "key",
                                            b.title AS "title",
                                            a.uuid  AS "uuid",
                                            u.fullname
                                            || ' ('
                                            || lower(u.username)
                                            || ')'  AS "user",
                                            a.role  AS "role"
                                        FROM
                                                 tra_acls a
                                            JOIN tra_boards b ON a.board = b.key
                                            LEFT JOIN app_users  u ON a.uuid = u.uuid
                        WHERE 
                -- search by board key or title
                            ( v_search IS NULL
                              OR b.title LIKE '%'
                              || upper(v_search)
                              || '%'
                                 OR b.key LIKE '%'
                                               || upper(v_search)
                                               || '%' )
                        ORDER BY
                            a.board
                        OFFSET p_offset ROWS FETCH NEXT p_limit ROWS ONLY;

    END get_acls;

    PROCEDURE post_acl (
        p_data   CLOB,
        r_error  OUT VARCHAR2,
        r_errors OUT SYS_REFCURSOR
    ) AS

        v_uuid CHAR(32 CHAR) := pck_api_auth.uuid;
        v_data CLOB := utl_url.unescape(coalesce(p_data, '{}'));
    BEGIN
        IF v_uuid IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;
    END post_acl;

    PROCEDURE delete_acl (
        p_data   CLOB,
        r_error  OUT VARCHAR2,
        r_errors OUT SYS_REFCURSOR
    ) AS

        v_uuid CHAR(32 CHAR) := pck_api_auth.uuid;
        v_data CLOB := utl_url.unescape(coalesce(p_data, '{}'));
    BEGIN
        IF v_uuid IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;
    END delete_acl;

END pck_tra;
/


-- sqlcl_snapshot {"hash":"bd8badf325f80e6b363c1482d550ef944d6168b9","type":"PACKAGE_BODY","name":"PCK_TRA","schemaName":"ODBVUE","sxml":""}