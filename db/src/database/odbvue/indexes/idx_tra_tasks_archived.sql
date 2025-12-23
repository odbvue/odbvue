CREATE INDEX odbvue.idx_tra_tasks_archived ON
    odbvue.tra_tasks (
        archived
    );


-- sqlcl_snapshot {"hash":"cc0ab32f1aa2b47307b58b2a20c2e3a7fc1545ca","type":"INDEX","name":"IDX_TRA_TASKS_ARCHIVED","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_TRA_TASKS_ARCHIVED</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>TRA_TASKS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>ARCHIVED</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}