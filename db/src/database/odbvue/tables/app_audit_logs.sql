CREATE TABLE odbvue.app_audit_logs (
    id              CHAR(32 CHAR) DEFAULT lower(sys_guid()) NOT NULL ENABLE,
    trace_id        CHAR(32 CHAR) NOT NULL ENABLE,
    span_id         CHAR(16 CHAR),
    severity_number NUMBER(2, 0) DEFAULT 9 NOT NULL ENABLE,
    severity_text   VARCHAR2(30 CHAR) NOT NULL ENABLE,
    message         VARCHAR2(2000 CHAR) NOT NULL ENABLE,
    created_at      TIMESTAMP(6) DEFAULT systimestamp NOT NULL ENABLE,
    attributes      CLOB,
    uuid            VARCHAR2(32 CHAR) GENERATED ALWAYS AS ( JSON_VALUE(attributes FORMAT JSON, '$.uuid' RETURNING VARCHAR2(32) NULL ON
    ERROR) ) VIRTUAL
);

ALTER TABLE odbvue.app_audit_logs ADD CONSTRAINT chk_app_audit_logs_attributes CHECK ( attributes IS JSON ) ENABLE;

ALTER TABLE odbvue.app_audit_logs
    ADD CONSTRAINT chk_app_audit_logs_severity_number CHECK ( severity_number BETWEEN 1 AND 24 ) ENABLE;

ALTER TABLE odbvue.app_audit_logs
    ADD CONSTRAINT chk_app_audit_logs_severity_text
        CHECK ( severity_text IN ( 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL' ) ) ENABLE;

ALTER TABLE odbvue.app_audit_logs
    ADD CONSTRAINT cpk_app_audit_logs PRIMARY KEY ( id )
        USING INDEX ENABLE;


-- sqlcl_snapshot {"hash":"92aec1f05a63f5f3fbc3689695d5cc99987e57b4","type":"TABLE","name":"APP_AUDIT_LOGS","schemaName":"ODBVUE","sxml":"\n  <TABLE xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>APP_AUDIT_LOGS</NAME>\n   <RELATIONAL_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>ID</NAME>\n            <DATATYPE>CHAR</DATATYPE>\n            <LENGTH>32</LENGTH>\n            <CHAR_SEMANTICS></CHAR_SEMANTICS>\n            <COLLATE_NAME>USING_NLS_COMP</COLLATE_NAME>\n            <DEFAULT>LOWER(SYS_GUID())</DEFAULT>\n            <NOT_NULL></NOT_NULL>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>TRACE_ID</NAME>\n            <DATATYPE>CHAR</DATATYPE>\n            <LENGTH>32</LENGTH>\n            <CHAR_SEMANTICS></CHAR_SEMANTICS>\n            <COLLATE_NAME>USING_NLS_COMP</COLLATE_NAME>\n            <NOT_NULL></NOT_NULL>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>SPAN_ID</NAME>\n            <DATATYPE>CHAR</DATATYPE>\n            <LENGTH>16</LENGTH>\n            <CHAR_SEMANTICS></CHAR_SEMANTICS>\n            <COLLATE_NAME>USING_NLS_COMP</COLLATE_NAME>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>SEVERITY_NUMBER</NAME>\n            <DATATYPE>NUMBER</DATATYPE>\n            <PRECISION>2</PRECISION>\n            <SCALE>0</SCALE>\n            <DEFAULT>9</DEFAULT>\n            <NOT_NULL></NOT_NULL>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>SEVERITY_TEXT</NAME>\n            <DATATYPE>VARCHAR2</DATATYPE>\n            <LENGTH>30</LENGTH>\n            <CHAR_SEMANTICS></CHAR_SEMANTICS>\n            <COLLATE_NAME>USING_NLS_COMP</COLLATE_NAME>\n            <NOT_NULL></NOT_NULL>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>MESSAGE</NAME>\n            <DATATYPE>VARCHAR2</DATATYPE>\n            <LENGTH>2000</LENGTH>\n            <CHAR_SEMANTICS></CHAR_SEMANTICS>\n            <COLLATE_NAME>USING_NLS_COMP</COLLATE_NAME>\n            <NOT_NULL></NOT_NULL>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>CREATED_AT</NAME>\n            <DATATYPE>TIMESTAMP</DATATYPE>\n            <SCALE>6</SCALE>\n            <DEFAULT>SYSTIMESTAMP</DEFAULT>\n            <NOT_NULL></NOT_NULL>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>ATTRIBUTES</NAME>\n            <DATATYPE>CLOB</DATATYPE>\n            <COLLATE_NAME>USING_NLS_COMP</COLLATE_NAME>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>UUID</NAME>\n            <DATATYPE>VARCHAR2</DATATYPE>\n            <LENGTH>32</LENGTH>\n            <CHAR_SEMANTICS></CHAR_SEMANTICS>\n            <COLLATE_NAME>USING_NLS_COMP</COLLATE_NAME>\n            <VIRTUAL>JSON_VALUE(\"ATTRIBUTES\" FORMAT JSON , '$.uuid' RETURNING VARCHAR2(32) NULL ON ERROR)</VIRTUAL>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n      <CHECK_CONSTRAINT_LIST>\n         <CHECK_CONSTRAINT_LIST_ITEM>\n            <NAME>CHK_APP_AUDIT_LOGS_ATTRIBUTES</NAME>\n            <CONDITION>attributes IS JSON</CONDITION>\n         </CHECK_CONSTRAINT_LIST_ITEM>\n         <CHECK_CONSTRAINT_LIST_ITEM>\n            <NAME>CHK_APP_AUDIT_LOGS_SEVERITY_NUMBER</NAME>\n            <CONDITION>severity_number BETWEEN 1 AND 24</CONDITION>\n         </CHECK_CONSTRAINT_LIST_ITEM>\n         <CHECK_CONSTRAINT_LIST_ITEM>\n            <NAME>CHK_APP_AUDIT_LOGS_SEVERITY_TEXT</NAME>\n            <CONDITION>severity_text IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL')</CONDITION>\n         </CHECK_CONSTRAINT_LIST_ITEM>\n      </CHECK_CONSTRAINT_LIST>\n      <PRIMARY_KEY_CONSTRAINT_LIST>\n         <PRIMARY_KEY_CONSTRAINT_LIST_ITEM>\n            <NAME>CPK_APP_AUDIT_LOGS</NAME>\n            <COL_LIST>\n               <COL_LIST_ITEM>\n                  <NAME>ID</NAME>\n               </COL_LIST_ITEM>\n            </COL_LIST>\n            <USING_INDEX></USING_INDEX>\n         </PRIMARY_KEY_CONSTRAINT_LIST_ITEM>\n      </PRIMARY_KEY_CONSTRAINT_LIST>\n      <DEFAULT_COLLATION>USING_NLS_COMP</DEFAULT_COLLATION>\n      <PHYSICAL_PROPERTIES>\n         <HEAP_TABLE></HEAP_TABLE>\n      </PHYSICAL_PROPERTIES>\n   </RELATIONAL_TABLE>\n</TABLE>"}