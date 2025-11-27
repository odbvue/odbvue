-- liquibase formatted sql
-- changeset ODBVUE:1764231445611 stripComments:false  logicalFilePath:move-commits\odbvue\package_specs\pck_api_validate.sql
-- sqlcl_snapshot db/src/database/odbvue/package_specs/pck_api_validate.sql:d73f1a49eb43a8b3b8b4f87d0cc015d968ec10ab:cac872219b9b4e3af141e591813052113aa537a2:alter

CREATE OR REPLACE PACKAGE odbvue.pck_api_validate AS -- Package provides methods for validating values against rules

    FUNCTION rule ( -- Function to create a validation rule in JSON format
        p_type    IN VARCHAR2, -- Type of validation (e.g., 'email', 'required', 'password')
        p_params  IN VARCHAR2 DEFAULT NULL, -- Additional parameters for the rule in JSON format
        p_message IN VARCHAR2 -- Error message if validation fails
    ) RETURN CLOB; -- Returns rule in JSON format

    FUNCTION validate ( -- Function validates the provided value against the specified rules in JSON format
        p_value IN VARCHAR2, -- Value to validate
        p_rules IN CLOB -- Validation rules in JSON format [{type, params, message}]
    ) RETURN VARCHAR2; -- Returns NULL if valid; otherwise error message if invalid

    PROCEDURE validate (
        p_field  IN VARCHAR2, -- Name of the field being validated
        p_value  IN VARCHAR2, -- Value to validate
        p_rules  IN CLOB, -- Validation rules in JSON format [{type, params, message}]
        r_error  OUT VARCHAR2, -- Output parameter for error message if invalid
        r_errors OUT SYS_REFCURSOR -- Output parameter for error messages [{name, message}]
    );

END pck_api_validate;
/

