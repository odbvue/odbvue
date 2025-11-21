CREATE OR REPLACE PACKAGE odbvue.pck_api_validate AS -- Package provides methods for validating values against rules

    FUNCTION validate ( -- Function validates the provided value against the specified rules in JSON format
        p_value IN VARCHAR2, -- Value to validate
        p_rules IN CLOB -- Validation rules in JSON format [{type, params, message}]
    ) RETURN VARCHAR2; -- Returns NULL if valid; otherwise error message if invalid
END pck_api_validate;
/


-- sqlcl_snapshot {"hash":"d73f1a49eb43a8b3b8b4f87d0cc015d968ec10ab","type":"PACKAGE_SPEC","name":"PCK_API_VALIDATE","schemaName":"ODBVUE","sxml":""}