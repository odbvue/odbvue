-- liquibase formatted sql
-- changeset ODBVUE:1763708911240 stripComments:false  logicalFilePath:featauth\odbvue\package_bodies\pck_api_classifiers.sql
-- sqlcl_snapshot db/src/database/odbvue/package_bodies/pck_api_classifiers.sql:null:36fe1eed1fe7a8d31f7e33cc7c13583c19233a89:create

CREATE OR REPLACE PACKAGE BODY odbvue.pck_api_classifiers AS

    PROCEDURE lookup (
        p_classifier IN VARCHAR2,
        p_search     IN VARCHAR2,
        p_active     IN CHAR DEFAULT 'Y',
        p_limit      IN PLS_INTEGER DEFAULT 10,
        p_offset     IN PLS_INTEGER DEFAULT 0,
        r_result     OUT SYS_REFCURSOR
    ) AS
    BEGIN
        IF p_classifier = 'languages' THEN
            OPEN r_result FOR SELECT
                                                    id,
                                                    iso3,
                                                    name,
                                                    native
                                                FROM
                                                    app_languages
                              WHERE
                                  ( p_search IS NULL
                                    OR lower(name) LIKE lower('%'
                                                              || p_search || '%') )
                                  AND ( p_active IS NULL
                                        OR active = p_active )
                              ORDER BY
                                  name
                              OFFSET p_offset ROWS FETCH NEXT p_limit ROWS ONLY;

            RETURN;
        END IF;

        IF p_classifier = 'countries' THEN
            OPEN r_result FOR SELECT
                                                    id,
                                                    iso3,
                                                    name,
                                                    native
                                                FROM
                                                    app_countries
                              WHERE
                                  ( p_search IS NULL
                                    OR lower(name) LIKE lower('%'
                                                              || p_search || '%') )
                                  AND ( p_active IS NULL
                                        OR active = p_active )
                              ORDER BY
                                  name
                              OFFSET p_offset ROWS FETCH NEXT p_limit ROWS ONLY;

            RETURN;
        END IF;

        IF p_classifier = 'currencies' THEN
            OPEN r_result FOR SELECT
                                                    id,
                                                    name,
                                                    symbol
                                                FROM
                                                    app_currencies
                              WHERE
                                  ( p_search IS NULL
                                    OR lower(name) LIKE lower('%'
                                                              || p_search || '%') )
                                  AND ( p_active IS NULL
                                        OR active = p_active )
                              ORDER BY
                                  name
                              OFFSET p_offset ROWS FETCH NEXT p_limit ROWS ONLY;

            RETURN;
        END IF;

        raise_application_error(-20001, 'Unknown classifier: ' || p_classifier);
    END lookup;

    FUNCTION lookup (
        p_classifier IN VARCHAR2,
        p_search     IN VARCHAR2,
        p_active     IN CHAR DEFAULT 'Y',
        p_limit      IN PLS_INTEGER DEFAULT 10,
        p_offset     IN PLS_INTEGER DEFAULT 0
    ) RETURN CLOB AS
        c CLOB;
    BEGIN
        IF p_classifier = 'languages' THEN
            SELECT
                JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'id' VALUE id,
                        'iso3' VALUE iso3,
                        'name' VALUE name,
                        'native' VALUE native
                    )
                )
            INTO c
            FROM
                (
                    SELECT
                        id,
                        iso3,
                        name,
                        native
                    FROM
                        app_languages
                    WHERE
                        ( p_search IS NULL
                          OR lower(name) LIKE lower('%'
                                                    || p_search || '%') )
                        AND ( p_active IS NULL
                              OR active = p_active )
                    ORDER BY
                        name
                    OFFSET p_offset ROWS FETCH NEXT p_limit ROWS ONLY
                );

            RETURN c;
        END IF;

        IF p_classifier = 'countries' THEN
            SELECT
                JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'id' VALUE id,
                        'iso3' VALUE iso3,
                        'name' VALUE name,
                        'native' VALUE native
                    )
                )
            INTO c
            FROM
                (
                    SELECT
                        id,
                        iso3,
                        name,
                        native
                    FROM
                        app_countries
                    WHERE
                        ( p_search IS NULL
                          OR lower(name) LIKE lower('%'
                                                    || p_search || '%') )
                        AND ( p_active IS NULL
                              OR active = p_active )
                    ORDER BY
                        name
                    OFFSET p_offset ROWS FETCH NEXT p_limit ROWS ONLY
                );

            RETURN c;
        END IF;

        IF p_classifier = 'currencies' THEN
            SELECT
                JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'id' VALUE id,
                        'name' VALUE name,
                        'symbol' VALUE symbol
                    )
                )
            INTO c
            FROM
                (
                    SELECT
                        id,
                        name,
                        symbol
                    FROM
                        app_currencies
                    WHERE
                        ( p_search IS NULL
                          OR lower(name) LIKE lower('%'
                                                    || p_search || '%') )
                        AND ( p_active IS NULL
                              OR active = p_active )
                    ORDER BY
                        name
                    OFFSET p_offset ROWS FETCH NEXT p_limit ROWS ONLY
                );

            RETURN c;
        END IF;

        raise_application_error(-20001, 'Unknown classifier: ' || p_classifier);
    END lookup;

END pck_api_classifiers;
/

