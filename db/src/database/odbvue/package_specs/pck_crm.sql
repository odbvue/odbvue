CREATE OR REPLACE PACKAGE odbvue.pck_crm AS -- CRM

    PROCEDURE get_requests ( -- Method to get requests with pagination and filtering
        p_search   IN VARCHAR2 DEFAULT NULL, -- Search term for filtering requests
        p_filter   IN VARCHAR2 DEFAULT NULL, -- Additional filter criteria
        p_offset   IN NUMBER DEFAULT NULL, -- Offset for pagination
        p_limit    IN NUMBER DEFAULT NULL, -- Limit for pagination
        r_requests OUT SYS_REFCURSOR -- Output cursor for the requests
    );

    PROCEDURE post_request ( -- Method to post a new request (PUBLIC)
        p_name         IN VARCHAR2, -- Full name of the requester
        p_organization IN VARCHAR2, -- Organization name of the requester
        p_phone        IN VARCHAR2, -- Phone number of the requester
        p_email        IN VARCHAR2, -- Email address of the requester
        p_message      IN CLOB -- Additional message from the requester
    );

    -- Surveys

    PROCEDURE get_surveys ( -- Get list of surveys with pagination and search
        p_filter  IN VARCHAR2 DEFAULT NULL, -- Filter: code:[code]
        p_search  IN VARCHAR2 DEFAULT NULL, -- Search term for title/description
        p_limit   IN NUMBER DEFAULT 10, -- Number of records to return
        p_offset  IN NUMBER DEFAULT 0, -- Offset for pagination
        r_surveys OUT SYS_REFCURSOR -- Output cursor [{code, title, description, validFrom, validTo, author, created, editor, updated, active, countQuestions, countResponses}]
    );

    PROCEDURE get_surveys_questions ( -- Get questions for a survey
        p_filter    IN VARCHAR2 DEFAULT NULL, -- Filter: code:[code]
        p_limit     IN NUMBER DEFAULT 10, -- Number of records to return
        p_offset    IN NUMBER DEFAULT 0, -- Offset for pagination
        r_questions OUT SYS_REFCURSOR -- Output cursor [{id, position, question, type, required}]
    );

    PROCEDURE get_surveys_responses ( -- Download survey responses as JSON file
        p_survey IN VARCHAR2 DEFAULT NULL -- Survey code
    );

    PROCEDURE post_survey ( -- Create or update a survey
        p_survey      IN VARCHAR2, -- Survey code (null for new, existing for update)
        p_title       IN VARCHAR2, -- Survey title
        p_description IN VARCHAR2, -- Survey description
        p_valid_from  IN VARCHAR2, -- Validity start date
        p_valid_to    IN VARCHAR2, -- Validity end date
        p_active      IN VARCHAR2, -- Active (Y/N)
        r_code        OUT VARCHAR2, -- Returned survey code
        r_errors      OUT SYS_REFCURSOR -- Validation errors [{name, message}]
    );

    PROCEDURE post_survey_question ( -- Create or update a survey question
        p_survey   IN VARCHAR2, -- Survey code
        p_id       IN NUMBER, -- Question ID (null for new)
        p_position IN NUMBER, -- Position in survey
        p_question IN CLOB, -- Question text in markdown
        p_type     IN VARCHAR2, -- Question type
        p_required IN VARCHAR2, -- Required (Y/N)
        r_id       OUT NUMBER, -- Returned question ID
        r_errors   OUT SYS_REFCURSOR -- Validation errors [{name, message}]
    );

    PROCEDURE post_survey_question_up ( -- Move question up in position
        p_id IN NUMBER -- Question ID
    );

    PROCEDURE post_survey_question_down ( -- Move question down in position
        p_id IN NUMBER -- Question ID
    );

    PROCEDURE post_survey_question_delete ( -- Delete a survey question
        p_id IN NUMBER -- Question ID
    );

    PROCEDURE get_survey_questions ( -- Get survey details for public form (PUBLIC)
        p_survey    IN VARCHAR2 DEFAULT NULL, -- Survey code
        r_questions OUT SYS_REFCURSOR -- Questions [{id, position, question, type, required}]
    );

    PROCEDURE post_survey_response ( -- Submit survey response (PUBLIC)
        p_survey    IN VARCHAR2, -- Survey code
        p_responses IN CLOB, -- JSON array of responses: [{id, answer},..] 
        r_errors    OUT SYS_REFCURSOR -- Validation errors [{name, message}]
    );

END pck_crm;
/


-- sqlcl_snapshot {"hash":"453815fad402c62db3f6a0e8a44db8a22d6db2c6","type":"PACKAGE_SPEC","name":"PCK_CRM","schemaName":"ODBVUE","sxml":""}