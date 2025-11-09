CREATE INDEX odbvue.idx_app_audit_spans_parent_span_id ON
    odbvue.app_audit_spans (
        parent_span_id
    );


-- sqlcl_snapshot {"hash":"ff8b31b61b757a969704e0262c7ea92b6815cf0e","type":"INDEX","name":"IDX_APP_AUDIT_SPANS_PARENT_SPAN_ID","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_APP_AUDIT_SPANS_PARENT_SPAN_ID</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_AUDIT_SPANS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>PARENT_SPAN_ID</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}