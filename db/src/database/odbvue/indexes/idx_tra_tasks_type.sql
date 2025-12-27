CREATE INDEX odbvue.idx_tra_tasks_type ON
    odbvue.tra_tasks (
        type
    );


-- sqlcl_snapshot {"hash":"a2a84cdc76cb8fbccefaf48769a2e70a39fabdf9","type":"INDEX","name":"IDX_TRA_TASKS_TYPE","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_TRA_TASKS_TYPE</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>TRA_TASKS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>TYPE</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}