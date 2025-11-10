BEGIN
    pck_api_audit.info(
        p_message    => 'App Audit Package Deployed',
        p_attributes => pck_api_audit.attributes( -- key value pairs
            'uuid', LOWER(SYS_GUID()),
            'username', 'test'
        )
    );

END;
/

DECLARE
    c_data CLOB := '[
  {
    "severity": "INFO",
    "message": "Bulk Log Entry 1",
    "attributes": {
      "uuid": "433c66c3ccfe9b02e0630301590ac258",
      "username": "test1"
    },
    "created": "2023-10-01T12:00:00Z"
  },
  {
    "severity": "ERROR",
    "message": "Bulk Log Entry 2",
    "attributes": {
      "uuid": "fffc66c3ccfe9b02e0630301590ac258",
      "username": "test2"
    },
    "created": "2023-10-01T12:00:00Z"
  }
]';
BEGIN
    pck_api_audit.bulk(c_data);
END;
/

SELECT * FROM app_audit 
ORDER BY created DESC
FETCH FIRST 10 ROWS ONLY;
/

