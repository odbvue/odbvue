CREATE INDEX odbvue.idx_app_audit_logs_trace_id ON
    odbvue.app_audit_logs (
        trace_id
    );


-- sqlcl_snapshot {"hash":"67398e0276220e69a449006955ad91d23763b700","type":"INDEX","name":"IDX_APP_AUDIT_LOGS_TRACE_ID","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_APP_AUDIT_LOGS_TRACE_ID</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_AUDIT_LOGS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>TRACE_ID</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}