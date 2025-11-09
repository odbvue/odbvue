CREATE TABLE odbvue.app_audit_spans (
    id             CHAR(16 CHAR) NOT NULL ENABLE,
    trace_id       CHAR(32 CHAR) NOT NULL ENABLE,
    parent_span_id CHAR(16 CHAR),
    name           VARCHAR2(200 CHAR) NOT NULL ENABLE,
    kind           VARCHAR2(30 CHAR) DEFAULT 'INTERNAL' NOT NULL ENABLE,
    start_time_ns  NUMBER(19, 0) NOT NULL ENABLE,
    end_time_ns    NUMBER(19, 0),
    status         VARCHAR2(30 CHAR) DEFAULT 'UNSET',
    attributes     CLOB
);

ALTER TABLE odbvue.app_audit_spans ADD CONSTRAINT chk_app_audit_spans_attributes CHECK ( attributes IS JSON ) ENABLE;

ALTER TABLE odbvue.app_audit_spans
    ADD CONSTRAINT chk_app_audit_spans_status
        CHECK ( status IN ( 'OK', 'ERROR', 'UNSET' ) ) ENABLE;

ALTER TABLE odbvue.app_audit_spans
    ADD CONSTRAINT cpk_app_audit_spans PRIMARY KEY ( id )
        USING INDEX ENABLE;

ALTER TABLE odbvue.app_audit_spans
    ADD CONSTRAINT cuq_app_audit_spans UNIQUE ( trace_id,
                                                id )
        USING INDEX ENABLE;


-- sqlcl_snapshot {"hash":"77d7c7df85e0a6f65b411d84f4837dcebfc4f845","type":"TABLE","name":"APP_AUDIT_SPANS","schemaName":"ODBVUE","sxml":"\n  <TABLE xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>APP_AUDIT_SPANS</NAME>\n   <RELATIONAL_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>ID</NAME>\n            <DATATYPE>CHAR</DATATYPE>\n            <LENGTH>16</LENGTH>\n            <CHAR_SEMANTICS></CHAR_SEMANTICS>\n            <COLLATE_NAME>USING_NLS_COMP</COLLATE_NAME>\n            <NOT_NULL></NOT_NULL>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>TRACE_ID</NAME>\n            <DATATYPE>CHAR</DATATYPE>\n            <LENGTH>32</LENGTH>\n            <CHAR_SEMANTICS></CHAR_SEMANTICS>\n            <COLLATE_NAME>USING_NLS_COMP</COLLATE_NAME>\n            <NOT_NULL></NOT_NULL>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>PARENT_SPAN_ID</NAME>\n            <DATATYPE>CHAR</DATATYPE>\n            <LENGTH>16</LENGTH>\n            <CHAR_SEMANTICS></CHAR_SEMANTICS>\n            <COLLATE_NAME>USING_NLS_COMP</COLLATE_NAME>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>NAME</NAME>\n            <DATATYPE>VARCHAR2</DATATYPE>\n            <LENGTH>200</LENGTH>\n            <CHAR_SEMANTICS></CHAR_SEMANTICS>\n            <COLLATE_NAME>USING_NLS_COMP</COLLATE_NAME>\n            <NOT_NULL></NOT_NULL>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>KIND</NAME>\n            <DATATYPE>VARCHAR2</DATATYPE>\n            <LENGTH>30</LENGTH>\n            <CHAR_SEMANTICS></CHAR_SEMANTICS>\n            <COLLATE_NAME>USING_NLS_COMP</COLLATE_NAME>\n            <DEFAULT>'INTERNAL'</DEFAULT>\n            <NOT_NULL></NOT_NULL>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>START_TIME_NS</NAME>\n            <DATATYPE>NUMBER</DATATYPE>\n            <PRECISION>19</PRECISION>\n            <SCALE>0</SCALE>\n            <NOT_NULL></NOT_NULL>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>END_TIME_NS</NAME>\n            <DATATYPE>NUMBER</DATATYPE>\n            <PRECISION>19</PRECISION>\n            <SCALE>0</SCALE>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>STATUS</NAME>\n            <DATATYPE>VARCHAR2</DATATYPE>\n            <LENGTH>30</LENGTH>\n            <CHAR_SEMANTICS></CHAR_SEMANTICS>\n            <COLLATE_NAME>USING_NLS_COMP</COLLATE_NAME>\n            <DEFAULT>'UNSET'</DEFAULT>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>ATTRIBUTES</NAME>\n            <DATATYPE>CLOB</DATATYPE>\n            <COLLATE_NAME>USING_NLS_COMP</COLLATE_NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n      <CHECK_CONSTRAINT_LIST>\n         <CHECK_CONSTRAINT_LIST_ITEM>\n            <NAME>CHK_APP_AUDIT_SPANS_STATUS</NAME>\n            <CONDITION>status IN ('OK', 'ERROR', 'UNSET')</CONDITION>\n         </CHECK_CONSTRAINT_LIST_ITEM>\n         <CHECK_CONSTRAINT_LIST_ITEM>\n            <NAME>CHK_APP_AUDIT_SPANS_ATTRIBUTES</NAME>\n            <CONDITION>attributes IS JSON</CONDITION>\n         </CHECK_CONSTRAINT_LIST_ITEM>\n      </CHECK_CONSTRAINT_LIST>\n      <PRIMARY_KEY_CONSTRAINT_LIST>\n         <PRIMARY_KEY_CONSTRAINT_LIST_ITEM>\n            <NAME>CPK_APP_AUDIT_SPANS</NAME>\n            <COL_LIST>\n               <COL_LIST_ITEM>\n                  <NAME>ID</NAME>\n               </COL_LIST_ITEM>\n            </COL_LIST>\n            <USING_INDEX></USING_INDEX>\n         </PRIMARY_KEY_CONSTRAINT_LIST_ITEM>\n      </PRIMARY_KEY_CONSTRAINT_LIST>\n      <UNIQUE_KEY_CONSTRAINT_LIST>\n         <UNIQUE_KEY_CONSTRAINT_LIST_ITEM>\n            <NAME>CUQ_APP_AUDIT_SPANS</NAME>\n            <COL_LIST>\n               <COL_LIST_ITEM>\n                  <NAME>TRACE_ID</NAME>\n               </COL_LIST_ITEM>\n               <COL_LIST_ITEM>\n                  <NAME>ID</NAME>\n               </COL_LIST_ITEM>\n            </COL_LIST>\n            <USING_INDEX></USING_INDEX>\n         </UNIQUE_KEY_CONSTRAINT_LIST_ITEM>\n      </UNIQUE_KEY_CONSTRAINT_LIST>\n      <DEFAULT_COLLATION>USING_NLS_COMP</DEFAULT_COLLATION>\n      <PHYSICAL_PROPERTIES>\n         <HEAP_TABLE></HEAP_TABLE>\n      </PHYSICAL_PROPERTIES>\n   </RELATIONAL_TABLE>\n</TABLE>"}