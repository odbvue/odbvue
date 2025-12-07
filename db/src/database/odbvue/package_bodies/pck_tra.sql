CREATE OR REPLACE PACKAGE BODY odbvue.pck_tra AS

    PROCEDURE get_tasks (
        p_filter IN VARCHAR2 DEFAULT NULL,
        p_search IN VARCHAR2 DEFAULT NULL,
        p_offset IN PLS_INTEGER DEFAULT 0,
        p_limit  IN PLS_INTEGER DEFAULT 10,
        r_tasks  OUT SYS_REFCURSOR
    ) AS
        v_uuid CHAR(32 CHAR) := pck_api_auth.uuid;
    BEGIN
        IF v_uuid IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;
        OPEN r_tasks FOR SELECT
                                              t.key                                        AS "key",
                                              pt.key                                       AS "parent_key",
                                              t.title                                      AS "title",
                                              t.description                                AS "description",
                                              to_char(t.due, 'YYYY-MM-DD HH24:MI:SS')      AS "due",
                                              t.author                                     AS "author_uuid",
                                              u.fullname                                   AS "author",
                                              t.assignee                                   AS "assignee_uuid",
                                              u2.fullname                                  AS "assignee",
                                              to_char(t.created, 'YYYY-MM-DD HH24:MI:SS')  AS "created",
                                              to_char(t.modified, 'YYYY-MM-DD HH24:MI:SS') AS "modified"
                                          FROM
                                                   tra_tasks t
                                              JOIN app_users u ON t.author = u.uuid
                                              JOIN app_users u2 ON t.assignee = u2.uuid
                                              LEFT JOIN tra_links pl ON t.id = pl.child_id
                                              LEFT JOIN tra_tasks pt ON pl.parent_id = pt.id
                         WHERE
                             ( p_search IS NULL
                               OR lower(t.title) LIKE '%'
                                                      || lower(p_search)
                                                      || '%' )
                             OR ( p_search IS NULL
                                  OR t.key = upper(trim(p_search)) )
                         ORDER BY
                             t.due,
                             t.created DESC
                         OFFSET p_offset ROWS FETCH NEXT p_limit ROWS ONLY;

    END get_tasks;

    PROCEDURE post_task (
        p_key         VARCHAR2,
        p_parent_key  VARCHAR2,
        p_title       VARCHAR2,
        p_description CLOB
    ) AS

        v_uuid       CHAR(32 CHAR) := pck_api_auth.uuid;
        v_id         tra_tasks.id%TYPE;
        v_parent_id  tra_tasks.id%TYPE;
        v_parent_key tra_tasks.key%TYPE;
    BEGIN
        IF v_uuid IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;
        BEGIN
            SELECT
                id,
                substr(key,
                       1,
                       instr(key, '-') - 1)
            INTO
                v_parent_id,
                v_parent_key
            FROM
                tra_tasks
            WHERE
                key = upper(trim(p_parent_key));

        EXCEPTION
            WHEN no_data_found THEN
                v_parent_id := NULL;
        END;

        INSERT INTO tra_tasks (
            title,
            description,
            due,
            author,
            assignee,
            created,
            modified
        ) VALUES ( p_title,
                   p_description,
                   sysdate + 7,
                   v_uuid,
                   v_uuid,
                   sysdate,
                   sysdate ) RETURNING id INTO v_id;

        UPDATE tra_tasks
        SET
            key = upper(coalesce(v_parent_key, p_key))
                  || '-'
                  || to_char(v_id)
        WHERE
            id = v_id;

        IF v_parent_id IS NOT NULL THEN
            INSERT INTO tra_links (
                parent_id,
                child_id
            ) VALUES ( v_parent_id,
                       v_id );

        END IF;

        COMMIT;
    END post_task;

END pck_tra;
/


-- sqlcl_snapshot {"hash":"8cbabab9fa3b1f964bb46f7839a39830b9a8e1f1","type":"PACKAGE_BODY","name":"PCK_TRA","schemaName":"ODBVUE","sxml":""}