CREATE INDEX odbvue.idx_app_audit_logs_created_at ON
    odbvue.app_audit_logs (
        created_at
    );


-- sqlcl_snapshot {"hash":"19c64076bc2687cce38c9a11bc4d8a6c04326087","type":"INDEX","name":"IDX_APP_AUDIT_LOGS_CREATED_AT","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_APP_AUDIT_LOGS_CREATED_AT</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_AUDIT_LOGS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>CREATED_AT</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}