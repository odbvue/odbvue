-- liquibase formatted sql
-- changeset ODBVUE:1763708911268 stripComments:false  logicalFilePath:featauth\odbvue\package_specs\pck_api_classifiers.sql
-- sqlcl_snapshot db/src/database/odbvue/package_specs/pck_api_classifiers.sql:null:5ed526f2f7b6ce6ddb02dbef0d1259613c6be488:create

CREATE OR REPLACE PACKAGE odbvue.pck_api_classifiers AS -- Package provides classifier lookup

    PROCEDURE lookup ( -- Returns a ref cursor with the results
        p_classifier IN VARCHAR2, -- Classifier type: 'languages', 'countries', 'currencies' 
        p_search     IN VARCHAR2, -- Search term to filter results
        p_active     IN CHAR DEFAULT 'Y', -- Filter by active status ('Y' or 'N')
        p_limit      IN PLS_INTEGER DEFAULT 10, -- Maximum number of results to return
        p_offset     IN PLS_INTEGER DEFAULT 0, -- Number of results to skip
        r_result     OUT SYS_REFCURSOR -- Output ref cursor with the results
    );

    FUNCTION lookup ( -- Returns results as a JSON CLOB
        p_classifier IN VARCHAR2, -- Classifier type: 'languages', 'countries', 'currencies'
        p_search     IN VARCHAR2, -- Search term to filter results
        p_active     IN CHAR DEFAULT 'Y', -- Filter by active status ('Y' or 'N')
        p_limit      IN PLS_INTEGER DEFAULT 10, -- Maximum number of results to return
        p_offset     IN PLS_INTEGER DEFAULT 0 -- Number of results to skip
    ) RETURN CLOB; -- JSON CLOB with the results
END pck_api_classifiers;
/

