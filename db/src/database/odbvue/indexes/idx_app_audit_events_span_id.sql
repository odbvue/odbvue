CREATE INDEX odbvue.idx_app_audit_events_span_id ON
    odbvue.app_audit_events (
        span_id
    );


-- sqlcl_snapshot {"hash":"99f2a4fdc894e20e78189e23e85c9a7b7b4af341","type":"INDEX","name":"IDX_APP_AUDIT_EVENTS_SPAN_ID","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_APP_AUDIT_EVENTS_SPAN_ID</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_AUDIT_EVENTS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>SPAN_ID</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}