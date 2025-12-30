CREATE INDEX odbvue.idx_tra_work_work_date ON
    odbvue.tra_work (
        work_date
    );


-- sqlcl_snapshot {"hash":"6a4bf3a2f50bd5c6a0e59e66b48b0d290744ebd3","type":"INDEX","name":"IDX_TRA_WORK_WORK_DATE","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_TRA_WORK_WORK_DATE</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>TRA_WORK</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>WORK_DATE</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}