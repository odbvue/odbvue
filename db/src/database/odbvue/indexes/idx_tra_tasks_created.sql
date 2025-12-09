CREATE INDEX odbvue.idx_tra_tasks_created ON
    odbvue.tra_tasks (
        created
    );


-- sqlcl_snapshot {"hash":"b0b00b040ab8fd8993cc9ef6ab474c8d3200ef02","type":"INDEX","name":"IDX_TRA_TASKS_CREATED","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_TRA_TASKS_CREATED</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>TRA_TASKS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>CREATED</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}