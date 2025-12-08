-- liquibase formatted sql
-- changeset ODBVUE:1765201658670 stripComments:false  logicalFilePath:feattravail\odbvue\package_bodies\pck_tra.sql
-- sqlcl_snapshot db/src/database/odbvue/package_bodies/pck_tra.sql:null:4fd0224b8422e121de789704c9e25bac1c5b67b7:create

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

    PROCEDURE get_plans (
        p_filter IN VARCHAR2 DEFAULT NULL,
        p_search IN VARCHAR2 DEFAULT NULL,
        p_offset IN PLS_INTEGER DEFAULT 0,
        p_limit  IN PLS_INTEGER DEFAULT 10,
        r_plans  OUT SYS_REFCURSOR
    ) AS

        v_uuid   CHAR(32 CHAR) := pck_api_auth.uuid;
        v_search VARCHAR2(2000 CHAR) := utl_url.unescape(coalesce(p_search, ''));
        v_filter VARCHAR2(2000 CHAR) := utl_url.unescape(coalesce(p_filter, '{}'));
    BEGIN
        IF v_uuid IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;
        OPEN r_plans FOR SELECT
                                              p.key              AS "key",
                                              p.title            AS "title",
                                              p.description      AS "description",
                                              p.due_warning_days AS "due_warning_days",
                                              p.statuses         AS "{}statuses",
                                              p.priorities       AS "{}priorities"
                                          FROM
                                                   tra_plans p
                                              JOIN app_users u ON p.author = u.uuid
                         WHERE
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
                                     p.key = j.value
                             ) )
                         OFFSET p_offset ROWS FETCH NEXT p_limit ROWS ONLY;

    END get_plans;

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
                                              pt.num                                       AS "parent_num",
                                              t.title                                      AS "title",
                                              t.description                                AS "description",
                                              to_char(t.due, 'YYYY-MM-DD')                 AS "due",
                                              CASE
                                                  WHEN t.due IS NULL THEN
                                                      NULL
                                                  WHEN t.due < systimestamp THEN
                                                      'error'
                                                  WHEN t.due <= systimestamp + (
                                                      SELECT
                                                          p.due_warning_days
                                                      FROM
                                                          tra_plans p
                                                      WHERE
                                                          p.key = t.key
                                                  )                    THEN
                                                      'warning'
                                                  ELSE
                                                      'info'
                                              END                                          AS "due_color",
                                              (
                                                  SELECT
                                                      JSON_OBJECT(
                                                          'id' VALUE j.id,
                                                          'name' VALUE j.name,
                                                          'color' VALUE j.color,
                                                          'done' VALUE j.done
                                                      )
                                                  FROM
                                                      tra_plans p,
                                                      JSON_TABLE ( p.statuses, '$[*]'
                                                              COLUMNS (
                                                                  id VARCHAR2 ( 50 ) PATH '$.id',
                                                                  name VARCHAR2 ( 100 ) PATH '$.name',
                                                                  color VARCHAR2 ( 50 ) PATH '$.color',
                                                                  done VARCHAR2 ( 10 ) PATH '$.done'
                                                              )
                                                          )
                                                      j
                                                  WHERE
                                                          p.key = t.key
                                                      AND j.id = coalesce(t.status, 'todo')
                                              )                                            AS "{}status",
                                              (
                                                  SELECT
                                                      JSON_OBJECT(
                                                          'id' VALUE j.id,
                                                          'name' VALUE j.name,
                                                          'color' VALUE j.color
                                                      )
                                                  FROM
                                                      tra_plans p,
                                                      JSON_TABLE ( p.priorities, '$[*]'
                                                              COLUMNS (
                                                                  id VARCHAR2 ( 50 ) PATH '$.id',
                                                                  name VARCHAR2 ( 100 ) PATH '$.name',
                                                                  color VARCHAR2 ( 50 ) PATH '$.color'
                                                              )
                                                          )
                                                      j
                                                  WHERE
                                                          p.key = t.key
                                                      AND j.id = t.priority
                                              )                                            AS "{}priority",
                                              t.author                                     AS "author_uuid",
                                              u.fullname                                   AS "author",
                                              t.assignee                                   AS "assignee_uuid",
                                              u2.fullname                                  AS "assignee",
                                              to_char(t.created, 'YYYY-MM-DD HH24:MI:SS')  AS "created",
                                              to_char(t.modified, 'YYYY-MM-DD HH24:MI:SS') AS "modified"
                                          FROM
                                                   tra_tasks t
                                              JOIN app_users u ON t.author = u.uuid
                                              LEFT JOIN app_users u2 ON t.assignee = u2.uuid
                                              LEFT JOIN tra_links pl ON t.id = pl.child_id
                                              LEFT JOIN tra_tasks pt ON pl.parent_id = pt.id
                         WHERE
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
                             AND ( NOT JSON_EXISTS ( v_filter, '$.num' )
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
                             t.due,
                             t.created DESC
                         OFFSET p_offset ROWS FETCH NEXT p_limit ROWS ONLY;

    END get_tasks;

    PROCEDURE post_task (
        p_num         VARCHAR2,
        p_parent_num  VARCHAR2,
        p_title       VARCHAR2,
        p_description CLOB,
        p_due         VARCHAR2,
        p_priority    VARCHAR2,
        p_assignee    VARCHAR2
    ) AS

        v_uuid       CHAR(32 CHAR) := pck_api_auth.uuid;
        v_parent_id  tra_tasks.id%TYPE;
        v_parent_num tra_tasks.num%TYPE;
        v_parent_key tra_tasks.key%TYPE;
        v_id         tra_tasks.id%TYPE;
        v_due        TIMESTAMP := ts(p_due);
    BEGIN
        IF v_uuid IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;
        BEGIN
            SELECT
                id,
                key,
                num
            INTO
                v_parent_id,
                v_parent_key,
                v_parent_num
            FROM
                tra_tasks
            WHERE
                num = upper(trim(p_parent_num));

        EXCEPTION
            WHEN no_data_found THEN
                NULL;
        END;

        UPDATE tra_tasks
        SET
            title = p_title,
            description = p_description,
            due = v_due,
            modified = sysdate,
            assignee = p_assignee,
            priority = p_priority
        WHERE
            num = upper(trim(p_num))
        RETURNING id INTO v_id;

        IF SQL%rowcount = 0 THEN
            INSERT INTO tra_tasks (
                key,
                title,
                description,
                due,
                priority,
                author,
                assignee,
                created,
                modified
            ) VALUES ( coalesce(v_parent_key, 'TRA'),
                       p_title,
                       p_description,
                       v_due,
                       p_priority,
                       v_uuid,
                       p_assignee,
                       sysdate,
                       sysdate ) RETURNING id INTO v_id;

        END IF;

        IF v_parent_id IS NOT NULL THEN
            INSERT INTO tra_links (
                parent_id,
                child_id
            ) VALUES ( v_parent_id,
                       v_id );

        END IF;

        COMMIT;
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
                                                      u.uuid     AS "uuid",
                                                      u.fullname AS "fullname"
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

