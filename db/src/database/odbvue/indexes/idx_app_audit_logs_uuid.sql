CREATE INDEX odbvue.idx_app_audit_logs_uuid ON
    odbvue.app_audit_logs (
        uuid
    );


-- sqlcl_snapshot {"hash":"ce58c74fb68247b14a1a95a9c4dcdb73dd9a4fd8","type":"INDEX","name":"IDX_APP_AUDIT_LOGS_UUID","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_APP_AUDIT_LOGS_UUID</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_AUDIT_LOGS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>UUID</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}