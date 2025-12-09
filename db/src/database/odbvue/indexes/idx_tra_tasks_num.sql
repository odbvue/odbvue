CREATE INDEX odbvue.idx_tra_tasks_num ON
    odbvue.tra_tasks (
        num
    );


-- sqlcl_snapshot {"hash":"9e2632177bdbee6c57a7be75cfdc0a0ac7c65c4d","type":"INDEX","name":"IDX_TRA_TASKS_NUM","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_TRA_TASKS_NUM</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>TRA_TASKS</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>NUM</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}