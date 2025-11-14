CREATE TABLE odbvue.app_token_settings (
    issuer   VARCHAR2(200 BYTE) NOT NULL ENABLE,
    audience VARCHAR2(200 BYTE) NOT NULL ENABLE,
    secret   VARCHAR2(2000 BYTE) NOT NULL ENABLE
);

ALTER TABLE odbvue.app_token_settings
    ADD CONSTRAINT cpk_app_token_settings PRIMARY KEY ( issuer )
        USING INDEX ENABLE;


-- sqlcl_snapshot {"hash":"76b5fc7b0f4ab954b162e2f8a59c673879775b69","type":"TABLE","name":"APP_TOKEN_SETTINGS","schemaName":"ODBVUE","sxml":"\n  <TABLE xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>APP_TOKEN_SETTINGS</NAME>\n   <RELATIONAL_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>ISSUER</NAME>\n            <DATATYPE>VARCHAR2</DATATYPE>\n            <LENGTH>200</LENGTH>\n            <COLLATE_NAME>USING_NLS_COMP</COLLATE_NAME>\n            <NOT_NULL></NOT_NULL>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>AUDIENCE</NAME>\n            <DATATYPE>VARCHAR2</DATATYPE>\n            <LENGTH>200</LENGTH>\n            <COLLATE_NAME>USING_NLS_COMP</COLLATE_NAME>\n            <NOT_NULL></NOT_NULL>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>SECRET</NAME>\n            <DATATYPE>VARCHAR2</DATATYPE>\n            <LENGTH>2000</LENGTH>\n            <COLLATE_NAME>USING_NLS_COMP</COLLATE_NAME>\n            <NOT_NULL></NOT_NULL>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n      <PRIMARY_KEY_CONSTRAINT_LIST>\n         <PRIMARY_KEY_CONSTRAINT_LIST_ITEM>\n            <NAME>CPK_APP_TOKEN_SETTINGS</NAME>\n            <COL_LIST>\n               <COL_LIST_ITEM>\n                  <NAME>ISSUER</NAME>\n               </COL_LIST_ITEM>\n            </COL_LIST>\n            <USING_INDEX></USING_INDEX>\n         </PRIMARY_KEY_CONSTRAINT_LIST_ITEM>\n      </PRIMARY_KEY_CONSTRAINT_LIST>\n      <DEFAULT_COLLATION>USING_NLS_COMP</DEFAULT_COLLATION>\n      <PHYSICAL_PROPERTIES>\n         <HEAP_TABLE></HEAP_TABLE>\n      </PHYSICAL_PROPERTIES>\n   </RELATIONAL_TABLE>\n</TABLE>"}