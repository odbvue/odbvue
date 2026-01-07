-- liquibase formatted sql
-- changeset ODBVUE:1767794235529 stripComments:false  logicalFilePath:featcrm\odbvue\package_bodies\pck_crm.sql
-- sqlcl_snapshot db/src/database/odbvue/package_bodies/pck_crm.sql:970e9aabc605f4bbb7e176af8084589d4027dec9:c1bbdb2d6d4d063097bc1942a00a6260cac0b571:alter

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

    -- Surveys

    PROCEDURE get_surveys (
        p_filter  IN VARCHAR2 DEFAULT NULL,
        p_search  IN VARCHAR2 DEFAULT NULL,
        p_limit   IN NUMBER DEFAULT 10,
        p_offset  IN NUMBER DEFAULT 0,
        r_surveys OUT SYS_REFCURSOR
    ) AS

        v_search VARCHAR2(2000 CHAR) := utl_url.unescape(coalesce(p_search, ''));
        v_filter VARCHAR2(2000 CHAR) := utl_url.unescape(coalesce(p_filter, '{}'));
    BEGIN
        IF pck_api_auth.role(NULL, 'CRM') IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;

        OPEN r_surveys FOR SELECT
                                                s.code                                           AS "code",
                                                s.title                                          AS "title",
                                                s.description                                    AS "description",
                                                to_char(s.valid_from, 'YYYY-MM-DD"T"HH24:MI:SS') AS "validFrom",
                                                to_char(s.valid_to, 'YYYY-MM-DD"T"HH24:MI:SS')   AS "validTo",
                                                u_author.fullname                                AS "author",
                                                to_char(s.created, 'YYYY-MM-DD"T"HH24:MI:SS')    AS "created",
                                                u_editor.fullname                                AS "editor",
                                                to_char(s.updated, 'YYYY-MM-DD"T"HH24:MI:SS')    AS "updated",
                                                s.active                                         AS "active",
                                                (
                                                    SELECT
                                                        COUNT(*)
                                                    FROM
                                                        crm_survey_questions q
                                                    WHERE
                                                        q.survey_id = s.id
                                                )                                                AS "countQuestions",
                                                (
                                                    SELECT
                                                        COUNT(*)
                                                    FROM
                                                        crm_survey_responses r
                                                    WHERE
                                                        r.survey_id = s.id
                                                )                                                AS "countResponses"
                                            FROM
                                                crm_surveys s
                                                LEFT JOIN app_users   u_author ON s.author = u_author.uuid
                                                LEFT JOIN app_users   u_editor ON s.editor = u_editor.uuid
                          WHERE
                                  1 = 1
                              -- Code filter
                              AND ( NOT JSON_EXISTS ( v_filter, '$.code' )
                                        OR EXISTS (
                                  SELECT
                                      1
                                  FROM
                                          JSON_TABLE ( JSON_QUERY(v_filter, '$.code'), '$[*]'
                                              COLUMNS (
                                                  val VARCHAR2 ( 100 ) PATH '$'
                                              )
                                          )
                                      j
                                  WHERE
                                      s.code = j.val
                              ) )
                              -- Search filter
                              AND ( v_search IS NULL
                                    OR v_search = ''
                                    OR lower(s.title) LIKE '%'
                                    || lower(v_search)
                                    || '%'
                                       OR lower(s.description) LIKE '%'
                                                                    || lower(v_search)
                                                                    || '%' )
                          ORDER BY
                              s.created DESC
                          OFFSET p_offset ROWS FETCH NEXT p_limit ROWS ONLY;

    END get_surveys;

    PROCEDURE get_surveys_questions (
        p_filter    IN VARCHAR2 DEFAULT NULL,
        p_limit     IN NUMBER DEFAULT 10,
        p_offset    IN NUMBER DEFAULT 0,
        r_questions OUT SYS_REFCURSOR
    ) AS
        v_filter VARCHAR2(2000 CHAR) := utl_url.unescape(coalesce(p_filter, '{}'));
    BEGIN
        IF pck_api_auth.role(NULL, 'CRM') IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;

        OPEN r_questions FOR SELECT
                                                    q.id       AS "id",
                                                    q.position AS "position",
                                                    q.question AS "question",
                                                    q.type     AS "type",
                                                    q.required AS "required"
                                                FROM
                                                         crm_survey_questions q
                                                    JOIN crm_surveys s ON q.survey_id = s.id
                            WHERE
                                    1 = 1
                                -- Code filter
                                AND ( NOT JSON_EXISTS ( v_filter, '$.code' )
                                          OR EXISTS (
                                    SELECT
                                        1
                                    FROM
                                            JSON_TABLE ( JSON_QUERY(v_filter, '$.code'), '$[*]'
                                                COLUMNS (
                                                    val VARCHAR2 ( 100 ) PATH '$'
                                                )
                                            )
                                        j
                                    WHERE
                                        s.code = j.val
                                ) )
                            ORDER BY
                                q.position ASC
                            OFFSET p_offset ROWS FETCH NEXT p_limit ROWS ONLY;

    END get_surveys_questions;

    PROCEDURE get_surveys_responses (
        p_survey IN VARCHAR2 DEFAULT NULL
    ) AS

        v_survey_id   crm_surveys.id%TYPE;
        v_survey_code crm_surveys.code%TYPE;
        v_title       crm_surveys.title%TYPE;
        v_json        CLOB;
    BEGIN
        IF pck_api_auth.role(NULL, 'CRM') IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;

        -- Get survey
        BEGIN
            SELECT
                s.id,
                s.code,
                s.title
            INTO
                v_survey_id,
                v_survey_code,
                v_title
            FROM
                crm_surveys s
            WHERE
                s.code = p_survey;

        EXCEPTION
            WHEN no_data_found THEN
                pck_api_auth.http(404, 'Survey not found');
                RETURN;
        END;

        -- Build JSON response
        SELECT
            JSON_OBJECT(
                'survey' VALUE
                    JSON_OBJECT(
                        'code' VALUE v_survey_code,
                        'title' VALUE v_title
                    ),
                        'responses' VALUE(
                    SELECT
                        JSON_ARRAYAGG(
                            JSON_OBJECT(
                                'submittedBy' VALUE u.fullname,
                                        'submittedAt' VALUE to_char(r.created, 'YYYY-MM-DD"T"HH24:MI:SS'),
                                        'responses' VALUE(
                                    SELECT
                                        JSON_ARRAYAGG(
                                            JSON_OBJECT(
                                                'question' VALUE q.question,
                                                'answer' VALUE(
                                                    SELECT
                                                        jt.answer
                                                    FROM
                                                            JSON_TABLE(r.responses, '$[*]'
                                                                COLUMNS(
                                                                    qid NUMBER PATH '$.id',
                                                                    answer VARCHAR2(4000 CHAR) PATH '$.answer'
                                                                )
                                                            )
                                                        jt
                                                    WHERE
                                                        jt.qid = q.id
                                                )
                                            )
                                        ORDER BY
                                            q.position
                                        )
                                    FROM
                                        crm_survey_questions q
                                    WHERE
                                        q.survey_id = r.survey_id
                                )
                            )
                        ORDER BY
                            r.created
                        )
                    FROM
                        crm_survey_responses r
                        LEFT JOIN app_users            u ON r.author = u.uuid
                    WHERE
                        r.survey_id = v_survey_id
                )
            RETURNING CLOB)
        INTO v_json
        FROM
            dual;

        -- Set response headers and return file
        owa_util.mime_header('application/json', FALSE);
        htp.p('Content-Disposition: attachment; filename="survey_'
              || v_survey_code || '_responses.json"');
        owa_util.http_header_close;
        htp.prn(v_json);
    END get_surveys_responses;

    PROCEDURE post_survey (
        p_survey      IN VARCHAR2,
        p_title       IN VARCHAR2,
        p_description IN VARCHAR2,
        p_valid_from  IN VARCHAR2,
        p_valid_to    IN VARCHAR2,
        p_active      IN VARCHAR2,
        r_code        OUT VARCHAR2,
        r_errors      OUT SYS_REFCURSOR
    ) AS

        v_uuid       app_users.uuid%TYPE := pck_api_auth.uuid;
        v_survey_id  crm_surveys.id%TYPE;
        v_valid_from TIMESTAMP;
        v_valid_to   TIMESTAMP;
    BEGIN
        IF pck_api_auth.role(NULL, 'CRM') IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;

        -- Validate title
        IF TRIM(p_title) IS NULL THEN
            pck_api_audit.errors(r_errors, 'title', 'title.is.required');
            RETURN;
        END IF;

        -- Parse dates - handle formats with and without seconds
        BEGIN
            IF
                p_valid_from IS NOT NULL
                AND length(p_valid_from) > 0
            THEN
                IF length(p_valid_from) = 16 THEN
                    -- Format: YYYY-MM-DDTHH24:MI (no seconds)
                    v_valid_from := TO_TIMESTAMP ( replace(p_valid_from, 'T', ' '), 'YYYY-MM-DD HH24:MI' );
                ELSE
                    -- Format: YYYY-MM-DDTHH24:MI:SS (with seconds)
                    v_valid_from := TO_TIMESTAMP ( replace(p_valid_from, 'T', ' '), 'YYYY-MM-DD HH24:MI:SS' );
                END IF;

            ELSE
                v_valid_from := systimestamp;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                v_valid_from := systimestamp;
        END;

        BEGIN
            IF
                p_valid_to IS NOT NULL
                AND length(p_valid_to) > 0
            THEN
                IF length(p_valid_to) = 16 THEN
                    -- Format: YYYY-MM-DDTHH24:MI (no seconds)
                    v_valid_to := TO_TIMESTAMP ( replace(p_valid_to, 'T', ' '), 'YYYY-MM-DD HH24:MI' );
                ELSE
                    -- Format: YYYY-MM-DDTHH24:MI:SS (with seconds)
                    v_valid_to := TO_TIMESTAMP ( replace(p_valid_to, 'T', ' '), 'YYYY-MM-DD HH24:MI:SS' );
                END IF;

            ELSE
                v_valid_to := NULL;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                v_valid_to := NULL;
        END;

        BEGIN
            SELECT
                id,
                code
            INTO
                v_survey_id,
                r_code
            FROM
                crm_surveys
            WHERE
                code = p_survey;

        EXCEPTION
            WHEN no_data_found THEN
                v_survey_id := NULL;
        END;

        -- Try update first
        UPDATE crm_surveys
        SET
            title = p_title,
            description = p_description,
            valid_from = v_valid_from,
            valid_to = v_valid_to,
            active = p_active,
            editor = v_uuid,
            updated = systimestamp
        WHERE
            id = v_survey_id;

        IF SQL%rowcount = 0 THEN
            -- Insert new survey
            INSERT INTO crm_surveys (
                title,
                description,
                valid_from,
                valid_to,
                author,
                created
            ) VALUES ( p_title,
                       p_description,
                       v_valid_from,
                       v_valid_to,
                       v_uuid,
                       systimestamp ) RETURNING id INTO v_survey_id;

            -- Set active status if provided
            IF p_active = 'N' THEN
                UPDATE crm_surveys
                SET
                    valid_to = systimestamp - INTERVAL '1' SECOND
                WHERE
                    id = v_survey_id;

            END IF;

        END IF;

        SELECT
            code
        INTO r_code
        FROM
            crm_surveys
        WHERE
            id = v_survey_id;

        COMMIT;
        pck_api_audit.info('CRM Survey',
                           pck_api_audit.attributes('action',
                                                    CASE
                                                        WHEN p_survey IS NULL THEN
                                                            'create'
                                                        ELSE
                                                            'update'
                                                    END, 'code', r_code));

    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            pck_api_audit.error('CRM Survey', sqlerrm);
            pck_api_audit.errors(r_errors, 'survey', 'survey.save.failed');
    END post_survey;

    PROCEDURE post_survey_question (
        p_survey   IN VARCHAR2,
        p_id       IN NUMBER,
        p_position IN NUMBER,
        p_question IN CLOB,
        p_type     IN VARCHAR2,
        p_required IN VARCHAR2,
        r_id       OUT NUMBER,
        r_errors   OUT SYS_REFCURSOR
    ) AS

        v_uuid      app_users.uuid%TYPE := pck_api_auth.uuid;
        v_survey_id crm_surveys.id%TYPE;
        v_max_pos   NUMBER;
    BEGIN
        IF pck_api_auth.role(NULL, 'CRM') IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;

        -- Get survey ID
        BEGIN
            SELECT
                id
            INTO v_survey_id
            FROM
                crm_surveys
            WHERE
                code = p_survey;

        EXCEPTION
            WHEN no_data_found THEN
                pck_api_audit.errors(r_errors, 'survey', 'survey.not.found');
                RETURN;
        END;

        -- Validate type
        IF p_type NOT IN ( 'free text', 'number', 'single choice', 'multiple choices', 'rating 5',
                           'none' ) THEN
            pck_api_audit.errors(r_errors, 'type', 'invalid.question.type');
            RETURN;
        END IF;

        IF p_id IS NULL THEN
            -- Get next position
            SELECT
                coalesce(
                    max(position),
                    0
                ) + 1
            INTO v_max_pos
            FROM
                crm_survey_questions
            WHERE
                survey_id = v_survey_id;

            -- Insert new question
            INSERT INTO crm_survey_questions (
                survey_id,
                position,
                question,
                type,
                required
            ) VALUES ( v_survey_id,
                       coalesce(p_position, v_max_pos),
                       p_question,
                       p_type,
                       coalesce(p_required, 'N') ) RETURNING id INTO r_id;

        ELSE
            -- Update existing question
            UPDATE crm_survey_questions
            SET
                position = p_position,
                question = p_question,
                type = p_type,
                required = coalesce(p_required, 'N')
            WHERE
                    id = p_id
                AND survey_id = v_survey_id;

            IF SQL%rowcount = 0 THEN
                pck_api_audit.errors(r_errors, 'id', 'question.not.found');
                RETURN;
            END IF;

            r_id := p_id;
        END IF;

        -- Update survey updated timestamp
        UPDATE crm_surveys
        SET
            editor = v_uuid,
            updated = systimestamp
        WHERE
            id = v_survey_id;

        COMMIT;
    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            pck_api_audit.error('CRM Survey Question', sqlerrm);
            pck_api_audit.errors(r_errors, 'question', 'question.save.failed');
    END post_survey_question;

    PROCEDURE post_survey_question_up (
        p_id IN NUMBER
    ) AS

        v_survey_id crm_surveys.id%TYPE;
        v_position  crm_survey_questions.position%TYPE;
        v_prev_id   crm_survey_questions.id%TYPE;
    BEGIN
        IF pck_api_auth.role(NULL, 'CRM') IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;

        -- Get current question info
        SELECT
            survey_id,
            position
        INTO
            v_survey_id,
            v_position
        FROM
            crm_survey_questions
        WHERE
            id = p_id;

        -- Find previous question
        BEGIN
            SELECT
                id
            INTO v_prev_id
            FROM
                crm_survey_questions
            WHERE
                    survey_id = v_survey_id
                AND position < v_position
            ORDER BY
                position DESC
            FETCH FIRST 1 ROW ONLY;

            -- Swap positions
            UPDATE crm_survey_questions
            SET
                position = position + 1
            WHERE
                id = v_prev_id;

            UPDATE crm_survey_questions
            SET
                position = position - 1
            WHERE
                id = p_id;

            COMMIT;
        EXCEPTION
            WHEN no_data_found THEN
                NULL; -- Already at top
        END;

    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
    END post_survey_question_up;

    PROCEDURE post_survey_question_down (
        p_id IN NUMBER
    ) AS

        v_survey_id crm_surveys.id%TYPE;
        v_position  crm_survey_questions.position%TYPE;
        v_next_id   crm_survey_questions.id%TYPE;
    BEGIN
        IF pck_api_auth.role(NULL, 'CRM') IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;

        -- Get current question info
        SELECT
            survey_id,
            position
        INTO
            v_survey_id,
            v_position
        FROM
            crm_survey_questions
        WHERE
            id = p_id;

        -- Find next question
        BEGIN
            SELECT
                id
            INTO v_next_id
            FROM
                crm_survey_questions
            WHERE
                    survey_id = v_survey_id
                AND position > v_position
            ORDER BY
                position ASC
            FETCH FIRST 1 ROW ONLY;

            -- Swap positions
            UPDATE crm_survey_questions
            SET
                position = position - 1
            WHERE
                id = v_next_id;

            UPDATE crm_survey_questions
            SET
                position = position + 1
            WHERE
                id = p_id;

            COMMIT;
        EXCEPTION
            WHEN no_data_found THEN
                NULL; -- Already at bottom
        END;

    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
    END post_survey_question_down;

    PROCEDURE post_survey_question_delete (
        p_id IN NUMBER
    ) AS
        v_uuid      app_users.uuid%TYPE := pck_api_auth.uuid;
        v_survey_id crm_surveys.id%TYPE;
    BEGIN
        IF pck_api_auth.role(NULL, 'CRM') IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;

        SELECT
            survey_id
        INTO v_survey_id
        FROM
            crm_survey_questions
        WHERE
            id = p_id;

        DELETE FROM crm_survey_questions
        WHERE
            id = p_id;

        -- Re-sequence remaining questions
        MERGE INTO crm_survey_questions tgt
        USING (
            SELECT
                id,
                ROW_NUMBER()
                OVER(
                    ORDER BY
                        position
                ) AS new_position
            FROM
                crm_survey_questions
            WHERE
                survey_id = v_survey_id
        ) src ON ( tgt.id = src.id )
        WHEN MATCHED THEN UPDATE
        SET tgt.position = src.new_position;

        -- Update survey updated timestamp
        UPDATE crm_surveys
        SET
            editor = v_uuid,
            updated = systimestamp
        WHERE
            id = v_survey_id;

        COMMIT;
    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
    END post_survey_question_delete;

    PROCEDURE get_survey_questions (
        p_survey    IN VARCHAR2 DEFAULT NULL,
        r_questions OUT SYS_REFCURSOR
    ) AS
        v_survey_id crm_surveys.id%TYPE;
    BEGIN
        -- Check if survey exists and is active
        BEGIN
            SELECT
                id
            INTO v_survey_id
            FROM
                crm_surveys
            WHERE
                    code = p_survey
                AND active = 'Y';

        EXCEPTION
            WHEN no_data_found THEN
                pck_api_auth.http(404, 'Survey not found or inactive');
                RETURN;
        END;

        -- Return questions
        OPEN r_questions FOR SELECT
                                                    p_survey AS "code",
                                                    id       AS "id",
                                                    position AS "position",
                                                    question AS "question",
                                                    type     AS "type",
                                                    required AS "required"
                                                FROM
                                                    crm_survey_questions
                            WHERE
                                survey_id = v_survey_id
                            ORDER BY
                                position ASC;

    END get_survey_questions;

    PROCEDURE post_survey_response (
        p_survey    IN VARCHAR2,
        p_responses IN CLOB,
        r_errors    OUT SYS_REFCURSOR
    ) AS
        v_uuid      app_users.uuid%TYPE := pck_api_auth.uuid;
        v_survey_id crm_surveys.id%TYPE;
    BEGIN
        -- Get survey ID and validate it's active
        BEGIN
            SELECT
                id
            INTO v_survey_id
            FROM
                crm_surveys
            WHERE
                    code = p_survey
                AND active = 'Y';

        EXCEPTION
            WHEN no_data_found THEN
                pck_api_auth.http(404, 'Survey not found or inactive');
                RETURN;
        END;

        -- Validate required questions are answered
        FOR rec IN (
            SELECT
                q.id,
                q.question
            FROM
                crm_survey_questions q
            WHERE
                    q.survey_id = v_survey_id
                AND q.required = 'Y'
                AND q.type != 'none'
                AND NOT EXISTS (
                    SELECT
                        1
                    FROM
                            JSON_TABLE ( p_responses, '$[*]'
                                COLUMNS (
                                    qid NUMBER PATH '$.id',
                                    answer VARCHAR2 ( 4000 CHAR ) PATH '$.answer'
                                )
                            )
                        jt
                    WHERE
                            jt.qid = q.id
                        AND jt.answer IS NOT NULL
                        AND TRIM(jt.answer) IS NOT NULL
                )
        ) LOOP
            pck_api_audit.errors(r_errors, 'question_' || rec.id, 'answer.is.required');
            RETURN;
        END LOOP;

        -- Insert response
        INSERT INTO crm_survey_responses (
            survey_id,
            responses,
            author,
            created
        ) VALUES ( v_survey_id,
                   p_responses,
                   v_uuid,
                   systimestamp );

        COMMIT;
        pck_api_audit.info('CRM Survey Response',
                           pck_api_audit.attributes('survey', p_survey));
    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            pck_api_audit.error('CRM Survey Response', sqlerrm);
            pck_api_audit.errors(r_errors, 'response', 'response.submit.failed');
    END post_survey_response;

END pck_crm;
/

