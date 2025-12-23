CREATE TABLE odbvue.tra_acls (
    board VARCHAR2(32 CHAR) NOT NULL ENABLE,
    role  VARCHAR2(32 CHAR),
    uuid  CHAR(32 CHAR)
);

ALTER TABLE odbvue.tra_acls
    ADD CONSTRAINT cpk_tra_acls
        PRIMARY KEY ( board,
                      role,
                      uuid )
            USING INDEX ENABLE;


-- sqlcl_snapshot {"hash":"878e4279b660f5788b3d4f3bfe42d25f3f7d81b8","type":"TABLE","name":"TRA_ACLS","schemaName":"ODBVUE","sxml":"\n  <TABLE xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>TRA_ACLS</NAME>\n   <RELATIONAL_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>BOARD</NAME>\n            <DATATYPE>VARCHAR2</DATATYPE>\n            <LENGTH>32</LENGTH>\n            <CHAR_SEMANTICS></CHAR_SEMANTICS>\n            <COLLATE_NAME>USING_NLS_COMP</COLLATE_NAME>\n            <NOT_NULL></NOT_NULL>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>ROLE</NAME>\n            <DATATYPE>VARCHAR2</DATATYPE>\n            <LENGTH>32</LENGTH>\n            <CHAR_SEMANTICS></CHAR_SEMANTICS>\n            <COLLATE_NAME>USING_NLS_COMP</COLLATE_NAME>\n         </COL_LIST_ITEM>\n         <COL_LIST_ITEM>\n            <NAME>UUID</NAME>\n            <DATATYPE>CHAR</DATATYPE>\n            <LENGTH>32</LENGTH>\n            <CHAR_SEMANTICS></CHAR_SEMANTICS>\n            <COLLATE_NAME>USING_NLS_COMP</COLLATE_NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n      <PRIMARY_KEY_CONSTRAINT_LIST>\n         <PRIMARY_KEY_CONSTRAINT_LIST_ITEM>\n            <NAME>CPK_TRA_ACLS</NAME>\n            <COL_LIST>\n               <COL_LIST_ITEM>\n                  <NAME>BOARD</NAME>\n               </COL_LIST_ITEM>\n               <COL_LIST_ITEM>\n                  <NAME>ROLE</NAME>\n               </COL_LIST_ITEM>\n               <COL_LIST_ITEM>\n                  <NAME>UUID</NAME>\n               </COL_LIST_ITEM>\n            </COL_LIST>\n            <USING_INDEX></USING_INDEX>\n         </PRIMARY_KEY_CONSTRAINT_LIST_ITEM>\n      </PRIMARY_KEY_CONSTRAINT_LIST>\n      <DEFAULT_COLLATION>USING_NLS_COMP</DEFAULT_COLLATION>\n      <PHYSICAL_PROPERTIES>\n         <HEAP_TABLE></HEAP_TABLE>\n      </PHYSICAL_PROPERTIES>\n   </RELATIONAL_TABLE>\n</TABLE>"}