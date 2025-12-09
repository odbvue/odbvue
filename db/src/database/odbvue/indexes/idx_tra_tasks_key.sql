CREATE INDEX odbvue.idx_tra_tasks_key ON
    odbvue.tra_tasks (
        key
    );


-- sqlcl_snapshot {"hash":"8f3b3a73f89246b981b9fc4d8a8ce91404baf614","type":"INDEX","name":"IDX_TRA_TASKS_KEY","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_TRA_TASKS_KEY</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>TRA_TASKS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>KEY</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}