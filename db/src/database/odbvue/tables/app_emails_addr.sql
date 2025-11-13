CREATE TABLE odbvue.app_emails_addr (
    id_email  CHAR(32 CHAR) NOT NULL ENABLE,
    addr_type VARCHAR2(7 CHAR) NOT NULL ENABLE,
    addr_addr VARCHAR2(240 CHAR) NOT NULL ENABLE,
    addr_name VARCHAR2(240 CHAR)
);

ALTER TABLE odbvue.app_emails_addr
    ADD CONSTRAINT csc_app_emails_addr_addr_type
        CHECK ( addr_type IN ( 'From', 'ReplyTo', 'To', 'Cc', 'Bcc' ) ) ENABLE;


-- sqlcl_snapshot {"hash":"842e37092df195b7d6e2adfe3a2736e8b2dff4b3","type":"TABLE","name":"APP_EMAILS_ADDR","schemaName":"ODBVUE","sxml":"\n  <TABLE xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>APP_EMAILS_ADDR</NAME>\n   <RELATIONAL_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>ID_EMAIL</NAME>\n            <DATATYPE>CHAR</DATATYPE>\n            <LENGTH>32</LENGTH>\n            <CHAR_SEMANTICS></CHAR_SEMANTICS>\n            <COLLATE_NAME>USING_NLS_COMP</COLLATE_NAME>\n            <NOT_NULL></NOT_NULL>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>ADDR_TYPE</NAME>\n            <DATATYPE>VARCHAR2</DATATYPE>\n            <LENGTH>7</LENGTH>\n            <CHAR_SEMANTICS></CHAR_SEMANTICS>\n            <COLLATE_NAME>USING_NLS_COMP</COLLATE_NAME>\n            <NOT_NULL></NOT_NULL>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>ADDR_ADDR</NAME>\n            <DATATYPE>VARCHAR2</DATATYPE>\n            <LENGTH>240</LENGTH>\n            <CHAR_SEMANTICS></CHAR_SEMANTICS>\n            <COLLATE_NAME>USING_NLS_COMP</COLLATE_NAME>\n            <NOT_NULL></NOT_NULL>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>ADDR_NAME</NAME>\n            <DATATYPE>VARCHAR2</DATATYPE>\n            <LENGTH>240</LENGTH>\n            <CHAR_SEMANTICS></CHAR_SEMANTICS>\n            <COLLATE_NAME>USING_NLS_COMP</COLLATE_NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n      <CHECK_CONSTRAINT_LIST>\n         <CHECK_CONSTRAINT_LIST_ITEM>\n            <NAME>CSC_APP_EMAILS_ADDR_ADDR_TYPE</NAME>\n            <CONDITION>addr_type IN ('From', 'ReplyTo', 'To', 'Cc', 'Bcc')</CONDITION>\n         </CHECK_CONSTRAINT_LIST_ITEM>\n      </CHECK_CONSTRAINT_LIST>\n      <DEFAULT_COLLATION>USING_NLS_COMP</DEFAULT_COLLATION>\n      <PHYSICAL_PROPERTIES>\n         <HEAP_TABLE></HEAP_TABLE>\n      </PHYSICAL_PROPERTIES>\n   </RELATIONAL_TABLE>\n</TABLE>"}