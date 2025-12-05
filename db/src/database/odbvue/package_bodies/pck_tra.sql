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
                         WHERE
                             ( p_search IS NULL
                               OR lower(t.title) LIKE '%'
                                                      || lower(p_search)
                                                      || '%' )
                         ORDER BY
                             t.due,
                             t.created DESC
                         OFFSET p_offset ROWS FETCH NEXT p_limit ROWS ONLY;

    END get_tasks;

    PROCEDURE post_task (
        p_key         VARCHAR2,
        p_title       VARCHAR2,
        p_description CLOB
    ) AS
        v_uuid CHAR(32 CHAR) := pck_api_auth.uuid;
    BEGIN
        IF v_uuid IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;
        INSERT INTO tra_tasks (
            key,
            title,
            description,
            due,
            author,
            assignee,
            created,
            modified
        ) VALUES ( p_key,
                   p_title,
                   p_description,
                   sysdate + 7,
                   v_uuid,
                   v_uuid,
                   sysdate,
                   sysdate );

        COMMIT;
    END post_task;

END pck_tra;
/


-- sqlcl_snapshot {"hash":"188eef5b024aa4f204b6c69e0599530a74fc1505","type":"PACKAGE_BODY","name":"PCK_TRA","schemaName":"ODBVUE","sxml":""}