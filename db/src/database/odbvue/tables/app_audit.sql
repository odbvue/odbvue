CREATE TABLE odbvue.app_audit (
    id         CHAR(32 CHAR) DEFAULT lower(sys_guid()) NOT NULL ENABLE,
    severity   VARCHAR2(30 CHAR) DEFAULT 'INFO' NOT NULL ENABLE,
    message    VARCHAR2(2000 CHAR) NOT NULL ENABLE,
    attributes CLOB,
    created    TIMESTAMP(6) DEFAULT systimestamp NOT NULL ENABLE,
    uuid       VARCHAR2(32 CHAR) GENERATED ALWAYS AS ( JSON_VALUE(attributes FORMAT JSON, '$.uuid' RETURNING VARCHAR2(32) NULL ON ERROR
    ) ) VIRTUAL,
    module     VARCHAR2(200 CHAR) GENERATED ALWAYS AS ( JSON_VALUE(attributes FORMAT JSON, '$.module_name' RETURNING VARCHAR2(200) NULL
    ON ERROR) ) VIRTUAL
);

ALTER TABLE odbvue.app_audit ADD CONSTRAINT chk_app_audit_attributes CHECK ( attributes IS JSON ) ENABLE;

ALTER TABLE odbvue.app_audit
    ADD CONSTRAINT chk_app_audit_severity
        CHECK ( severity IN ( 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL' ) ) ENABLE;

ALTER TABLE odbvue.app_audit
    ADD CONSTRAINT cpk_app_audit PRIMARY KEY ( id )
        USING INDEX ENABLE;


-- sqlcl_snapshot {"hash":"89c1577ec8b1cd55d60fefd5a9d3b7a9bce0f0ef","type":"TABLE","name":"APP_AUDIT","schemaName":"ODBVUE","sxml":"\n  <TABLE xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>APP_AUDIT</NAME>\n   <RELATIONAL_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>ID</NAME>\n            <DATATYPE>CHAR</DATATYPE>\n            <LENGTH>32</LENGTH>\n            <CHAR_SEMANTICS></CHAR_SEMANTICS>\n            <COLLATE_NAME>USING_NLS_COMP</COLLATE_NAME>\n            <DEFAULT>lower(sys_guid())</DEFAULT>\n            <NOT_NULL></NOT_NULL>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>SEVERITY</NAME>\n            <DATATYPE>VARCHAR2</DATATYPE>\n            <LENGTH>30</LENGTH>\n            <CHAR_SEMANTICS></CHAR_SEMANTICS>\n            <COLLATE_NAME>USING_NLS_COMP</COLLATE_NAME>\n            <DEFAULT>'INFO'</DEFAULT>\n            <NOT_NULL></NOT_NULL>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>MESSAGE</NAME>\n            <DATATYPE>VARCHAR2</DATATYPE>\n            <LENGTH>2000</LENGTH>\n            <CHAR_SEMANTICS></CHAR_SEMANTICS>\n            <COLLATE_NAME>USING_NLS_COMP</COLLATE_NAME>\n            <NOT_NULL></NOT_NULL>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>ATTRIBUTES</NAME>\n            <DATATYPE>CLOB</DATATYPE>\n            <COLLATE_NAME>USING_NLS_COMP</COLLATE_NAME>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>CREATED</NAME>\n            <DATATYPE>TIMESTAMP</DATATYPE>\n            <SCALE>6</SCALE>\n            <DEFAULT>systimestamp</DEFAULT>\n            <NOT_NULL></NOT_NULL>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>UUID</NAME>\n            <DATATYPE>VARCHAR2</DATATYPE>\n            <LENGTH>32</LENGTH>\n            <CHAR_SEMANTICS></CHAR_SEMANTICS>\n            <COLLATE_NAME>USING_NLS_COMP</COLLATE_NAME>\n            <VIRTUAL>JSON_VALUE(\"ATTRIBUTES\" FORMAT JSON , '$.uuid' RETURNING VARCHAR2(32) NULL ON ERROR)</VIRTUAL>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>MODULE</NAME>\n            <DATATYPE>VARCHAR2</DATATYPE>\n            <LENGTH>200</LENGTH>\n            <CHAR_SEMANTICS></CHAR_SEMANTICS>\n            <COLLATE_NAME>USING_NLS_COMP</COLLATE_NAME>\n            <VIRTUAL>JSON_VALUE(\"ATTRIBUTES\" FORMAT JSON , '$.module_name' RETURNING VARCHAR2(200) NULL ON ERROR)</VIRTUAL>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n      <CHECK_CONSTRAINT_LIST>\n         <CHECK_CONSTRAINT_LIST_ITEM>\n            <NAME>CHK_APP_AUDIT_ATTRIBUTES</NAME>\n            <CONDITION> attributes IS JSON </CONDITION>\n         </CHECK_CONSTRAINT_LIST_ITEM>\n         <CHECK_CONSTRAINT_LIST_ITEM>\n            <NAME>CHK_APP_AUDIT_SEVERITY</NAME>\n            <CONDITION> severity IN ( 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL' ) </CONDITION>\n         </CHECK_CONSTRAINT_LIST_ITEM>\n      </CHECK_CONSTRAINT_LIST>\n      <PRIMARY_KEY_CONSTRAINT_LIST>\n         <PRIMARY_KEY_CONSTRAINT_LIST_ITEM>\n            <NAME>CPK_APP_AUDIT</NAME>\n            <COL_LIST>\n               <COL_LIST_ITEM>\n                  <NAME>ID</NAME>\n               </COL_LIST_ITEM>\n            </COL_LIST>\n            <USING_INDEX></USING_INDEX>\n         </PRIMARY_KEY_CONSTRAINT_LIST_ITEM>\n      </PRIMARY_KEY_CONSTRAINT_LIST>\n      <DEFAULT_COLLATION>USING_NLS_COMP</DEFAULT_COLLATION>\n      <PHYSICAL_PROPERTIES>\n         <HEAP_TABLE></HEAP_TABLE>\n      </PHYSICAL_PROPERTIES>\n   </RELATIONAL_TABLE>\n</TABLE>"}