CREATE INDEX odbvue.idx_tra_notes_task_id ON
    odbvue.tra_notes (
        task_id
    );


-- sqlcl_snapshot {"hash":"aacd7e4df4eaf5034be25fda5835a96197dc52d3","type":"INDEX","name":"IDX_TRA_NOTES_TASK_ID","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_TRA_NOTES_TASK_ID</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>TRA_NOTES</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>TASK_ID</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}