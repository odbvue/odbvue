CREATE INDEX odbvue.idx_app_audit_logs_span_id ON
    odbvue.app_audit_logs (
        span_id
    );


-- sqlcl_snapshot {"hash":"3d79f13dd56c84d01d2a9e40f872353668b66599","type":"INDEX","name":"IDX_APP_AUDIT_LOGS_SPAN_ID","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_APP_AUDIT_LOGS_SPAN_ID</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_AUDIT_LOGS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>SPAN_ID</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}