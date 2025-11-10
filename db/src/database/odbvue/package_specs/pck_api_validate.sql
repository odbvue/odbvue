CREATE OR REPLACE PACKAGE odbvue.pck_api_validate AS -- Package provides methods for validating values against rules

    FUNCTION validate ( -- Function validates the provided value against the specified rules in JSON format
        p_value IN VARCHAR2, -- Value to validate
        p_rules IN CLOB -- Validation rules in JSON format
    ) RETURN VARCHAR2; -- Returns NULL if valid; otherwise error message
END pck_api_validate;
/


-- sqlcl_snapshot {"hash":"1940c6d16093d134b0ddbcc8988facae8a147dd3","type":"PACKAGE_SPEC","name":"PCK_API_VALIDATE","schemaName":"ODBVUE","sxml":""}