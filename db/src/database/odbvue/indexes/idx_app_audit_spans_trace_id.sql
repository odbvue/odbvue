CREATE INDEX odbvue.idx_app_audit_spans_trace_id ON
    odbvue.app_audit_spans (
        trace_id
    );


-- sqlcl_snapshot {"hash":"7410e5d883906b5542613b15ddc34b42077ccf8f","type":"INDEX","name":"IDX_APP_AUDIT_SPANS_TRACE_ID","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_APP_AUDIT_SPANS_TRACE_ID</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_AUDIT_SPANS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>TRACE_ID</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}