CREATE INDEX odbvue.idx_tra_tasks_priority ON
    odbvue.tra_tasks (
        priority
    );


-- sqlcl_snapshot {"hash":"be38dca6f8936f25f0d91543bfcba8c1e8f8d70f","type":"INDEX","name":"IDX_TRA_TASKS_PRIORITY","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_TRA_TASKS_PRIORITY</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>TRA_TASKS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>PRIORITY</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}