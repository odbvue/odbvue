CREATE TABLE odbvue.app_audit_events (
    event_id   NUMBER(19, 0) GENERATED ALWAYS AS IDENTITY NOT NULL ENABLE,
    span_id    CHAR(16 CHAR) NOT NULL ENABLE,
    name       VARCHAR2(200 CHAR) NOT NULL ENABLE,
    time_ns    NUMBER(19, 0) NOT NULL ENABLE,
    attributes CLOB
);

ALTER TABLE odbvue.app_audit_events ADD CONSTRAINT chk_app_audit_events_attributes CHECK ( attributes IS JSON ) ENABLE;

ALTER TABLE odbvue.app_audit_events ADD PRIMARY KEY ( event_id )
    USING INDEX ENABLE;


-- sqlcl_snapshot {"hash":"a485ad7c0dac3bcad7c1a2e4a6375d45d6485c76","type":"TABLE","name":"APP_AUDIT_EVENTS","schemaName":"ODBVUE","sxml":"\n  <TABLE xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>APP_AUDIT_EVENTS</NAME>\n   <RELATIONAL_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>EVENT_ID</NAME>\n            <DATATYPE>NUMBER</DATATYPE>\n            <PRECISION>19</PRECISION>\n            <SCALE>0</SCALE>\n            <IDENTITY_COLUMN>\n               <SCHEMA>ODBVUE</SCHEMA>\n               \n            <NOT_NULL></NOT_NULL>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>ATTRIBUTES</NAME>\n            <DATATYPE>CLOB</DATATYPE>\n            <COLLATE_NAME>USING_NLS_COMP</COLLATE_NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n      <CHECK_CONSTRAINT_LIST>\n         <CHECK_CONSTRAINT_LIST_ITEM>\n            <NAME>CHK_APP_AUDIT_EVENTS_ATTRIBUTES</NAME>\n            <CONDITION>attributes IS JSON</CONDITION>\n         </CHECK_CONSTRAINT_LIST_ITEM>\n      </CHECK_CONSTRAINT_LIST>\n      <PRIMARY_KEY_CONSTRAINT_LIST>\n         <PRIMARY_KEY_CONSTRAINT_LIST_ITEM>\n            <COL_LIST>\n               <COL_LIST_ITEM>\n                  <NAME>EVENT_ID</NAME>\n               </COL_LIST_ITEM>\n            </COL_LIST>\n            <USING_INDEX></USING_INDEX>\n         </PRIMARY_KEY_CONSTRAINT_LIST_ITEM>\n      </PRIMARY_KEY_CONSTRAINT_LIST>\n      <DEFAULT_COLLATION>USING_NLS_COMP</DEFAULT_COLLATION>\n      <PHYSICAL_PROPERTIES>\n         <HEAP_TABLE></HEAP_TABLE>\n      </PHYSICAL_PROPERTIES>\n   </RELATIONAL_TABLE>\n</TABLE>"}