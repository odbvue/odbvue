CREATE INDEX odbvue.idx_tra_notes_storage_id ON
    odbvue.tra_notes (
        storage_id
    );


-- sqlcl_snapshot {"hash":"875b136550c72dcc76e76ff9f6173cd253e54d43","type":"INDEX","name":"IDX_TRA_NOTES_STORAGE_ID","schemaName":"ODBVUE","sxml":"\n  <INDEX xmlns=\"http://xmlns.oracle.com/ku\" version=\"1.0\">\n   <SCHEMA>ODBVUE</SCHEMA>\n   <NAME>IDX_TRA_NOTES_STORAGE_ID</NAME>\n   <TABLE_INDEX>\n      <ON_TABLE>\n         <SCHEMA>ODBVUE</SCHEMA>\n         <NAME>TRA_NOTES</NAME>\n      </ON_TABLE>\n      <COL_LIST>\n         <COL_LIST_ITEM>\n            <NAME>STORAGE_ID</NAME>\n         </COL_LIST_ITEM>\n      </COL_LIST>\n   </TABLE_INDEX>\n</INDEX>"}