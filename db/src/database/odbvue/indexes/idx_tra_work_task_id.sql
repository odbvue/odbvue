CREATE INDEX odbvue.idx_tra_work_task_id ON
    odbvue.tra_work (
        task_id
    );


-- sqlcl_snapshot {"hash":"726a1c1ad393914cc5391419dce03d617ea16a98","type":"INDEX","name":"IDX_TRA_WORK_TASK_ID","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_TRA_WORK_TASK_ID</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>TRA_WORK</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>TASK_ID</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}