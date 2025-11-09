CREATE INDEX odbvue.idx_app_audit_traces_created_at ON
    odbvue.app_audit_traces (
        created_at
    );


-- sqlcl_snapshot {"hash":"e8f8f73e13b0265382d90aefa5c31752692824e9","type":"INDEX","name":"IDX_APP_AUDIT_TRACES_CREATED_AT","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_APP_AUDIT_TRACES_CREATED_AT</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>APP_AUDIT_TRACES</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>CREATED_AT</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}