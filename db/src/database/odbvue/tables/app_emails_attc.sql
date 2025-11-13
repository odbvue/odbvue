CREATE TABLE odbvue.app_emails_attc (
    id_email   CHAR(32 CHAR) NOT NULL ENABLE,
    id_storage CHAR(32 CHAR) NOT NULL ENABLE
);

ALTER TABLE odbvue.app_emails_attc
    ADD CONSTRAINT cpk_app_emails_attc PRIMARY KEY ( id_email,
                                                     id_storage )
        USING INDEX ENABLE;


-- sqlcl_snapshot {"hash":"d3b2e758e84420ff1120552b48ec69631b1163e0","type":"TABLE","name":"APP_EMAILS_ATTC","schemaName":"ODBVUE","sxml":"\n  <TABLE xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>APP_EMAILS_ATTC</NAME>\n   <RELATIONAL_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>ID_EMAIL</NAME>\n            <DATATYPE>CHAR</DATATYPE>\n            <LENGTH>32</LENGTH>\n            <CHAR_SEMANTICS></CHAR_SEMANTICS>\n            <COLLATE_NAME>USING_NLS_COMP</COLLATE_NAME>\n            <NOT_NULL></NOT_NULL>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>ID_STORAGE</NAME>\n            <DATATYPE>CHAR</DATATYPE>\n            <LENGTH>32</LENGTH>\n            <CHAR_SEMANTICS></CHAR_SEMANTICS>\n            <COLLATE_NAME>USING_NLS_COMP</COLLATE_NAME>\n            <NOT_NULL></NOT_NULL>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n      <PRIMARY_KEY_CONSTRAINT_LIST>\n         <PRIMARY_KEY_CONSTRAINT_LIST_ITEM>\n            <NAME>CPK_APP_EMAILS_ATTC</NAME>\n            <COL_LIST>\n               <COL_LIST_ITEM>\n                  <NAME>ID_EMAIL</NAME>\n               </COL_LIST_ITEM>\n               <COL_LIST_ITEM>\n                  <NAME>ID_STORAGE</NAME>\n               </COL_LIST_ITEM>\n            </COL_LIST>\n            <USING_INDEX></USING_INDEX>\n         </PRIMARY_KEY_CONSTRAINT_LIST_ITEM>\n      </PRIMARY_KEY_CONSTRAINT_LIST>\n      <DEFAULT_COLLATION>USING_NLS_COMP</DEFAULT_COLLATION>\n      <PHYSICAL_PROPERTIES>\n         <HEAP_TABLE></HEAP_TABLE>\n      </PHYSICAL_PROPERTIES>\n   </RELATIONAL_TABLE>\n</TABLE>"}