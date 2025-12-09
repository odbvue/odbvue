CREATE INDEX odbvue.idx_tra_tasks_completed ON
    odbvue.tra_tasks (
        completed
    );


-- sqlcl_snapshot {"hash":"8f7eca3c16aa3cc9a61e5e8ee4108be5d9bff01e","type":"INDEX","name":"IDX_TRA_TASKS_COMPLETED","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_TRA_TASKS_COMPLETED</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>TRA_TASKS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>COMPLETED</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}