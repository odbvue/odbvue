CREATE INDEX odbvue.idx_tra_tasks_reminder ON
    odbvue.tra_tasks (
        reminder
    );


-- sqlcl_snapshot {"hash":"c7160771ef275ce21032d4998243fc5913c85bd4","type":"INDEX","name":"IDX_TRA_TASKS_REMINDER","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_TRA_TASKS_REMINDER</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>TRA_TASKS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>REMINDER</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}