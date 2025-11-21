-- liquibase formatted sql
-- changeset ODBVUE:1763766491354 stripComments:false  logicalFilePath:featdb\odbvue\package_specs\pck_api_validate.sql
-- sqlcl_snapshot db/src/database/odbvue/package_specs/pck_api_validate.sql:895fb912587a926520a4ba092a4375e7071c42cb:d73f1a49eb43a8b3b8b4f87d0cc015d968ec10ab:alter

CREATE OR REPLACE PACKAGE odbvue.pck_api_validate AS -- Package provides methods for validating values against rules

    FUNCTION validate ( -- Function validates the provided value against the specified rules in JSON format
        p_value IN VARCHAR2, -- Value to validate
        p_rules IN CLOB -- Validation rules in JSON format [{type, params, message}]
    ) RETURN VARCHAR2; -- Returns NULL if valid; otherwise error message if invalid
END pck_api_validate;
/

