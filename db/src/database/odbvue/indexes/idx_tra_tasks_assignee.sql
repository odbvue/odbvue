CREATE INDEX odbvue.idx_tra_tasks_assignee ON
    odbvue.tra_tasks (
        assignee
    );


-- sqlcl_snapshot {"hash":"d5d1bbc7817b2650fedc9adc35209c77110fff85","type":"INDEX","name":"IDX_TRA_TASKS_ASSIGNEE","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_TRA_TASKS_ASSIGNEE</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>TRA_TASKS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>ASSIGNEE</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}