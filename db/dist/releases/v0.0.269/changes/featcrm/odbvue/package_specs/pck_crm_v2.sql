-- liquibase formatted sql
-- changeset ODBVUE:1768206723111 stripComments:false  logicalFilePath:featcrm\odbvue\package_specs\pck_crm_v2.sql
-- sqlcl_snapshot db/src/database/odbvue/package_specs/pck_crm_v2.sql:fecb4b4b92ffb96149e58720aa4eeaddb90d8983:91ef6f4bb64992a62fbef2ddf595b696b2e1b285:alter

CREATE OR REPLACE PACKAGE odbvue.pck_crm_v2 AS -- CRM Package

    PROCEDURE get_persons ( -- Gets list of persons
        p_filter  IN VARCHAR2 DEFAULT NULL, -- Filter for persons
        p_sort    IN VARCHAR2 DEFAULT NULL, -- Sort order for persons
        p_limit   IN PLS_INTEGER DEFAULT NULL, -- Limit number of persons
        p_offset  IN PLS_INTEGER DEFAULT NULL, -- Offset for pagination
        r_persons OUT SYS_REFCURSOR -- List of persons
    );

    PROCEDURE post_person ( -- Create or update a person
        p_id         IN PLS_INTEGER, -- Person ID (null for insert)
        p_first_name IN VARCHAR2, -- First name
        p_last_name  IN VARCHAR2, -- Last name
        p_phone      IN VARCHAR2, -- Phone number
        p_email      IN VARCHAR2 -- Email address
    );

    PROCEDURE post_organization ( -- Create or update an organization
        p_id         IN PLS_INTEGER, -- Organization ID (null for insert)
        p_legal_name IN VARCHAR2 -- Legal name
    );

END pck_crm_v2;
/

