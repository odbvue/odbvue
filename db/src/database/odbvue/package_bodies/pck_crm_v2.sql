CREATE OR REPLACE PACKAGE BODY odbvue.pck_crm_v2 AS

    PROCEDURE get_persons (
        p_filter  IN VARCHAR2 DEFAULT NULL,
        p_sort    IN VARCHAR2 DEFAULT NULL,
        p_limit   IN PLS_INTEGER DEFAULT NULL,
        p_offset  IN PLS_INTEGER DEFAULT NULL,
        r_persons OUT SYS_REFCURSOR
    ) IS
    BEGIN
        IF pck_api_auth.role(NULL, 'crm') IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;

        OPEN r_persons FOR SELECT
                                                guid                  AS "id",
                                                TRIM(first_name
                                                     || ' '
                                                     || last_name
                                                     || ' ' || legal_name) AS "fullname",
                                                type                  AS "type",
                                                created               AS "created"
                                            FROM
                                                crm_persons
                          ORDER BY
                              created DESC
                          OFFSET p_offset ROWS FETCH NEXT p_limit ROWS ONLY;

    END get_persons;

    PROCEDURE post_person (
        p_id         IN PLS_INTEGER,
        p_first_name IN VARCHAR2,
        p_last_name  IN VARCHAR2,
        p_legal_name IN VARCHAR2
    ) IS
    BEGIN
        IF pck_api_auth.role(NULL, 'crm') IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;

        UPDATE crm_persons
        SET
            first_name = p_first_name,
            last_name = p_last_name,
            legal_name = p_legal_name,
            modified = systimestamp
        WHERE
            id = p_id;

        IF SQL%rowcount = 0 THEN
            INSERT INTO crm_persons (
                first_name,
                last_name,
                legal_name
            ) VALUES ( p_first_name,
                       p_last_name,
                       p_legal_name );

        END IF;

        COMMIT;
    END post_person;

    PROCEDURE post_organization (
        p_id         IN PLS_INTEGER,
        p_legal_name IN VARCHAR2
    ) IS
    BEGIN
        IF pck_api_auth.role(NULL, 'crm') IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;

        UPDATE crm_persons
        SET
            legal_name = p_legal_name,
            modified = systimestamp
        WHERE
            id = p_id;

        IF SQL%rowcount = 0 THEN
            INSERT INTO crm_persons ( legal_name ) VALUES ( p_legal_name );

        END IF;

        COMMIT;
    END post_organization;

END pck_crm_v2;
/


-- sqlcl_snapshot {"hash":"c5775e658d7cc40243319fefabd0788e2140462f","type":"PACKAGE_BODY","name":"PCK_CRM_V2","schemaName":"ODBVUE","sxml":""}