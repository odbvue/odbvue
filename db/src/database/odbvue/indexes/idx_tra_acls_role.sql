CREATE INDEX odbvue.idx_tra_acls_role ON
    odbvue.tra_acls (
        role
    );


-- sqlcl_snapshot {"hash":"3fe3e8dff5f3602795c8b92483d1738e1bf997cf","type":"INDEX","name":"IDX_TRA_ACLS_ROLE","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_TRA_ACLS_ROLE</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>TRA_ACLS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>ROLE</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}