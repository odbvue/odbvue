CREATE INDEX odbvue.idx_app_audit_severity ON
    odbvue.app_audit (
        severity
    );


-- sqlcl_snapshot {"hash":"c14fe85143be1878c389c7af3cdd4e43f8a5d933","type":"INDEX","name":"IDX_APP_AUDIT_SEVERITY","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_APP_AUDIT_SEVERITY</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_AUDIT</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>SEVERITY</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}